import type {ItemSearchClause} from "./ItemSearch";

export const CHARACTER_SEARCH_REVISION = 1;
// NFC and lowercasing can expand a query. The overlap exceeds the maximum
// expansion of the existing 200 UTF-16-unit query limit, including combining
// characters. Chunking limits both D1 rows and management SQL statements.
export const CHARACTER_SEARCH_CHUNK_SIZE = 2048;
export const CHARACTER_SEARCH_OVERLAP = 1024;
const CHARACTER_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

export function searchCharacterCount(value: string): number {
  return Array.from(value).length;
}

export function normalizeCharacterSearch(value: string): string {
  return value.normalize("NFC").toLowerCase().normalize("NFC");
}

export function usesCharacterSearch(clause: ItemSearchClause): boolean {
  return CHARACTER_SCRIPT.test(clause.text) &&
    searchCharacterCount(clause.text) >= 2 &&
    searchCharacterCount(normalizeCharacterSearch(clause.text)) >= 2;
}

// Each pair is one ASCII token, independent of SQLite's Unicode version or
// punctuation rules. Fixed-width code points make the encoding unambiguous.
export function characterSearchTokens(value: string): string {
  const tokens: string[] = [];
  const encodings = new Map<string, string>();
  let previous = "";
  for (const point of normalizeCharacterSearch(value)) {
    let encoded = encodings.get(point);
    if (encoded === undefined) {
      encoded = point.codePointAt(0)!.toString(16).padStart(6, "0");
      encodings.set(point, encoded);
    }
    if (previous) tokens.push(`g${previous}${encoded}`);
    previous = encoded;
  }
  return tokens.join(" ");
}

export function characterSearchPhrase(clause: ItemSearchClause): string {
  return `"${characterSearchTokens(clause.text)}"`;
}

export function characterSearchChunks(value: string): string[] {
  if (!CHARACTER_SCRIPT.test(value)) return [];
  const tokens = characterSearchTokens(value);
  if (!tokens) return [];
  const pairs = (tokens.length + 1) / 14;
  const chunks: string[] = [];
  const step = CHARACTER_SEARCH_CHUNK_SIZE - CHARACTER_SEARCH_OVERLAP;
  for (let start = 0; start < pairs; start += step) {
    // Every encoded pair occupies 13 ASCII units followed by one space.
    chunks.push(tokens.slice(start * 14,
      Math.min(start + CHARACTER_SEARCH_CHUNK_SIZE - 1, pairs) * 14 - 1));
    if (start + CHARACTER_SEARCH_CHUNK_SIZE - 1 >= pairs) break;
  }
  return chunks;
}

export interface CharacterSearchStatement {
  sql: string;
  bindings: Array<string | number>;
}

function bulkChunks(value: string): string[] {
  if (!CHARACTER_SCRIPT.test(value)) return [];
  // Native Unicode regexp iteration avoids allocating one JS object per code
  // point in a large body. Adjacent blocks supply the same 1024-point overlap.
  const blocks = normalizeCharacterSearch(value).match(/[\s\S]{1,1024}/gu) ?? [];
  return blocks.length < 2 ? blocks : blocks.slice(1).map((block, index) =>
    blocks[index]! + block
  );
}

function bulkTokensSql(column: number): string {
  // SQLite expands large normalized chunks into the identical fixed-width
  // encoding. This keeps bulk indexing off the Free Worker's JS CPU budget.
  return `(WITH RECURSIVE source AS MATERIALIZED (
    SELECT json_extract(j.value, '$[${column}]') AS txt
  ), pairs(pos, a, b, size) AS (
    SELECT 1, unicode(substr(txt, 1, 1)), unicode(substr(txt, 2, 1)), length(txt)
    FROM source WHERE length(txt) > 1
    UNION ALL
    SELECT pos + 1, b, unicode(substr(txt, pos + 2, 1)), size
    FROM pairs, source WHERE pos + 1 < size
  ) SELECT coalesce(group_concat(printf('g%06x%06x', a, b), ' '), '') FROM pairs)`;
}

/** Append after the source write in the same D1 batch. The generation guard
 * also permits retryable backfills without overwriting a concurrent writer. */
export function characterSearchStatements(
  type: "item" | "page",
  id: string,
  title: string,
  contentText: string,
  generation?: string,
  maxInsertBytes = 1_500_000,
): CharacterSearchStatement[] {
  const guard = "content_type = ? AND content_id = ?" +
    (generation === undefined ? "" : " AND generation = ?");
  const keys: Array<string | number> = [type, id];
  if (generation !== undefined) keys.push(generation);
  const current = `SELECT 1 FROM site_search_character_state WHERE ${guard}`;
  const statements: CharacterSearchStatement[] = [{
    sql: "DELETE FROM site_search_character_chunks WHERE content_type = ? " +
      `AND content_id = ? AND EXISTS (${current})`,
    bindings: [type, id, ...keys],
  }];
  const bulk = title.length + contentText.length > 16_384;
  const chunks = bulk ? bulkChunks : characterSearchChunks;
  const titles = chunks(title);
  const bodies = chunks(contentText);
  let rows: Array<[string, string, boolean, boolean]> = [];
  let bytes = 0;
  const flush = () => {
    if (!rows.length) return;
    statements.push({
      sql: "INSERT INTO site_search_character_chunks " +
        "(content_type, content_id, title, content_text) " +
        "SELECT ?, ?, " +
        (bulk
          ? `CASE WHEN json_extract(j.value, '$[2]') THEN ${bulkTokensSql(0)} ELSE json_extract(j.value, '$[0]') END, ` +
            `CASE WHEN json_extract(j.value, '$[3]') THEN ${bulkTokensSql(1)} ELSE json_extract(j.value, '$[1]') END `
          : "json_extract(j.value, '$[0]'), json_extract(j.value, '$[1]') ") +
        `FROM json_each(?) j WHERE EXISTS (${current})`,
      bindings: [type, id, JSON.stringify(rows), ...keys],
    });
    rows = [];
    bytes = 0;
  };
  for (let chunk = 0; chunk < Math.max(titles.length, bodies.length); chunk++) {
    let titleChunk = titles[chunk] ?? "";
    let bodyChunk = bodies[chunk] ?? "";
    // SQLite text functions stop at NUL; encode only such exceptional chunks
    // in JS rather than losing anything after the embedded character.
    const rawTitle = bulk && !titleChunk.includes("\0");
    const rawBody = bulk && !bodyChunk.includes("\0");
    if (bulk && !rawTitle) titleChunk = characterSearchTokens(titleChunk);
    if (bulk && !rawBody) bodyChunk = characterSearchTokens(bodyChunk);
    const row: [string, string, boolean, boolean] = [titleChunk, bodyChunk, rawTitle, rawBody];
    // Three bytes per UTF-16 unit is an upper bound on encoded JSON's UTF-8
    // size; the small path contains ASCII tokens only.
    const size = JSON.stringify(row).length * (bulk ? 3 : 1) + 1;
    if (bytes + size > maxInsertBytes) flush();
    rows.push(row);
    bytes += size;
  }
  flush();
  statements.push({
    sql: `UPDATE site_search_character_state SET revision = ? WHERE ${guard}`,
    bindings: [CHARACTER_SEARCH_REVISION, ...keys],
  });
  return statements;
}
