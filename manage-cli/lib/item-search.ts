import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {
  CREATE_ITEM_SEARCH_INDEX_SQL,
  DROP_ITEM_SEARCH_INDEX_SQL,
} from "@/shared/ItemSearchSql";
import {ITEM_CONTENT_TEXT_REVISION} from "@/shared/ItemSearch";
import {CHARACTER_SEARCH_REVISION, characterSearchStatements} from "@/shared/CharacterSearch";
import {htmlToPlainText} from "@/shared/StringUtils";
import type {MicrofeedConfig} from "../types";
import type {CloudflareClient} from "./cloudflare";

const NORMALIZATION_BATCH_SIZE = 50;
const MAX_NORMALIZATION_BATCHES = 10_000;

interface ItemSearchOptions {
  local?: boolean;
  persistTo?: string;
}

interface ItemSearchSourceRow extends Record<string, unknown> {
  data: string;
  id: string;
  updated_at: string;
  generation: string;
}

function sqlString(value: string): string {
  // SQL source cannot contain NUL, although stored text can. Hex literals keep
  // legacy bodies intact during plain-text repair and snapshot preparation.
  if (value.includes("\0")) return `CAST(X'${Buffer.from(value).toString("hex")}' AS TEXT)`;
  return `'${value.replaceAll("'", "''")}'`;
}

async function executeTemporarySql(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  sql: string,
  options: ItemSearchOptions,
): Promise<void> {
  const directory = await mkdtemp(path.join(tmpdir(), "microfeed-item-search-"));
  try {
    const filename = path.join(directory, "item-search.sql");
    await writeFile(filename, `${sql.trim()}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await cloudflare.executeSqlFile(config, filename, options);
  } finally {
    await rm(directory, {force: true, recursive: true});
  }
}

function sourceRows(
  rows: Array<Record<string, unknown>>,
): ItemSearchSourceRow[] {
  return rows.map((row) => {
    if (
      typeof row.id !== "string" ||
      typeof row.data !== "string" ||
      typeof row.updated_at !== "string" ||
      typeof row.generation !== "string"
    ) {
      throw new Error("D1 returned an invalid item search normalization row.");
    }
    return row as ItemSearchSourceRow;
  });
}

function plainTextUpdateSql(id: string, generation: string, text: string): string {
  const guard = `content_type = 'item' AND content_id = ${sqlString(id)} ` +
    `AND generation = ${sqlString(generation)}`;
  // Stage large plain text in the existing disposable state row. Individual
  // SQL statements stay below D1's limit, including quotes and UTF-8 expansion.
  const parts = text.match(/[\s\S]{1,8000}/gu) ?? [];
  return [
    `UPDATE site_search_character_state SET normalized_content_text = '' WHERE ${guard};`,
    ...parts.map((part) => "UPDATE site_search_character_state SET " +
      `normalized_content_text = normalized_content_text || ${sqlString(part)} WHERE ${guard};`),
    "UPDATE items SET content_text = (SELECT normalized_content_text " +
      `FROM site_search_character_state WHERE ${guard}), ` +
      `content_text_revision = ${ITEM_CONTENT_TEXT_REVISION}, ` +
      "content_text_updated_at = updated_at " +
      `WHERE id = ${sqlString(id)} AND EXISTS (` +
      `SELECT 1 FROM site_search_character_state WHERE ${guard});`,
    `UPDATE site_search_character_state SET normalized_content_text = '' WHERE ${guard};`,
  ].join("\n");
}

function normalizedUpdateSql(rows: readonly ItemSearchSourceRow[]): string {
  return rows.map((row) => {
    let data: unknown;
    try {
      data = JSON.parse(row.data);
    } catch {
      throw new Error(
        `Item ${row.id} contains invalid saved JSON; search normalization ` +
          "stopped without marking the index ready.",
      );
    }
    const description = data && typeof data === "object" &&
        typeof (data as {description?: unknown}).description === "string"
      ? (data as {description: string}).description
      : "";
    const contentText = htmlToPlainText(description);
    return plainTextUpdateSql(row.id, row.generation, contentText);
  }).join("\n");
}

export async function rebuildItemSearchIndexes(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
): Promise<void> {
  await executeTemporarySql(
    cloudflare,
    config,
    `${DROP_ITEM_SEARCH_INDEX_SQL}\n${CREATE_ITEM_SEARCH_INDEX_SQL}`,
    options,
  );
}

export async function itemSearchIndexesExist(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
): Promise<boolean> {
  const rows = await cloudflare.queryD1(
    config,
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN " +
      "('site_search_exact', 'site_search_title_trigram', 'site_search_bigram') ORDER BY name",
    options,
  );
  return rows.length === 3;
}

export async function ensureItemSearchIndexes(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
): Promise<void> {
  if (!await itemSearchIndexesExist(cloudflare, config, options)) {
    await rebuildItemSearchIndexes(cloudflare, config, options);
  }
}

export async function dropItemSearchIndexes(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
): Promise<void> {
  await executeTemporarySql(
    cloudflare,
    config,
    DROP_ITEM_SEARCH_INDEX_SQL,
    options,
  );
}

export async function normalizeItemSearchContent(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
  markReady = true,
): Promise<number> {
  await cloudflare.queryD1(
    config,
    "UPDATE site_search_metadata SET ready = 0, normalized_at = NULL " +
      "WHERE id = 1",
    options,
  );

  let normalized = 0;
  for (let batch = 0; batch < MAX_NORMALIZATION_BATCHES; batch += 1) {
    const rows = sourceRows(await cloudflare.queryD1(
      config,
      "SELECT id, data, updated_at, (SELECT generation FROM site_search_character_state " +
        "WHERE content_type = 'item' AND content_id = items.id) AS generation FROM items " +
        "WHERE status != 3 AND (content_text_updated_at != updated_at OR " +
        `content_text_revision != ${ITEM_CONTENT_TEXT_REVISION}) ` +
        `ORDER BY rowid LIMIT ${NORMALIZATION_BATCH_SIZE}`,
      options,
    ));
    if (rows.length === 0) break;
    await executeTemporarySql(
      cloudflare,
      config,
      normalizedUpdateSql(rows),
      options,
    );
    normalized += rows.length;
  }

  const [remaining] = await cloudflare.queryD1(
    config,
    "SELECT COUNT(*) AS count FROM items " +
      "WHERE status != 3 AND (content_text_updated_at != updated_at OR " +
      `content_text_revision != ${ITEM_CONTENT_TEXT_REVISION})`,
    options,
  );
  if (!remaining || Number(remaining.count) !== 0) {
    throw new Error(
      "Item search normalization did not finish. Retry the same deployment " +
        "after item writes have settled.",
    );
  }
  await normalizeCharacterSearchContent(cloudflare, config, options);
  if (markReady) {
    const normalizedAt = new Date().toISOString();
    await cloudflare.queryD1(
      config,
      "INSERT INTO site_search_metadata (id, ready, normalized_at) VALUES " +
        `(1, 1, ${sqlString(normalizedAt)}) ON CONFLICT(id) DO UPDATE SET ` +
        "ready = NOT EXISTS (SELECT 1 FROM site_search_character_state " +
        `WHERE revision != ${CHARACTER_SEARCH_REVISION}) AND NOT EXISTS (` +
        "SELECT 1 FROM items WHERE status != 3 AND (content_text_updated_at != updated_at " +
        `OR content_text_revision != ${ITEM_CONTENT_TEXT_REVISION})), ` +
        "normalized_at = excluded.normalized_at",
      options,
    );
    const [unready] = await cloudflare.queryD1(config,
      "SELECT COUNT(*) AS count FROM site_search_metadata WHERE id = 1 AND ready = 0", options);
    if (!unready || Number(unready.count) !== 0) {
      throw new Error("Content changed during search preparation. Retry the same deployment.");
    }
  }
  return normalized;
}

export async function normalizeCharacterSearchContent(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
): Promise<void> {
  for (let batch = 0; batch < MAX_NORMALIZATION_BATCHES; batch++) {
    const rows = await cloudflare.queryD1(config,
      "SELECT s.content_type, s.content_id, s.generation, d.title, d.content_text, i.data " +
      "FROM site_search_character_state s JOIN site_search_documents d " +
      "ON s.content_type = d.content_type AND s.content_id = d.content_id " +
      "LEFT JOIN items i ON s.content_type = 'item' AND s.content_id = i.id " +
      `WHERE s.revision != ${CHARACTER_SEARCH_REVISION} ` +
      `ORDER BY s.content_type, s.content_id LIMIT ${NORMALIZATION_BATCH_SIZE}`,
      options);
    if (!rows.length) break;
    for (const row of rows) {
      if ((row.content_type !== "item" && row.content_type !== "page") ||
        typeof row.content_id !== "string" || typeof row.generation !== "string" ||
        typeof row.title !== "string" || typeof row.content_text !== "string") {
        throw new Error("D1 returned an invalid character search source row.");
      }
      const statements = characterSearchStatements(row.content_type, row.content_id,
        row.title, row.content_text, row.generation, 60_000);
      let repair = "";
      if (row.content_type === "item" && typeof row.data === "string") {
        const data = JSON.parse(row.data) as {description?: unknown};
        const plain = htmlToPlainText(data.description);
        if (plain !== row.content_text) {
          // A legacy writer can change HTML without updating plain text, even
          // within the same timestamp. Repair it under the generation guard;
          // its trigger invalidates this projection for the next pass.
          repair = plainTextUpdateSql(row.content_id, row.generation, plain);
        }
      }
      // Every statement is generation-guarded. A concurrent edit invalidates
      // this entire projection, including the final readiness update.
      const sql = repair + "\n" + statements.map(({sql, bindings}) => {
        let index = 0;
        return sql.replace(/\?/gu, () => {
          const value = bindings[index++]!;
          return typeof value === "number" ? String(value) : sqlString(value);
        }) + ";";
      }).join("\n");
      await executeTemporarySql(cloudflare, config, sql, options);
    }
  }
  const [remaining] = await cloudflare.queryD1(config,
    "SELECT COUNT(*) AS count FROM site_search_character_state " +
    `WHERE revision != ${CHARACTER_SEARCH_REVISION}`, options);
  if (!remaining || Number(remaining.count) !== 0) {
    throw new Error("Character search indexing did not finish. Retry the same deployment after content writes have settled.");
  }
}

export async function setItemSearchReady(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  ready: boolean,
  options: ItemSearchOptions = {},
): Promise<void> {
  await cloudflare.queryD1(
    config,
    "UPDATE site_search_metadata SET " +
      `ready = ${ready ? 1 : 0}, ` +
      `${ready ? "normalized_at = CURRENT_TIMESTAMP" : "normalized_at = NULL"} ` +
      "WHERE id = 1",
    options,
  );
}

export async function prepareItemSearch(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
  markReady = true,
): Promise<number> {
  await ensureItemSearchIndexes(cloudflare, config, options);
  return normalizeItemSearchContent(cloudflare, config, options, markReady);
}

export async function withItemSearchIndexesSuspended<T>(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  operation: () => Promise<T>,
  options: ItemSearchOptions = {},
): Promise<T> {
  if (!await itemSearchIndexesExist(cloudflare, config, options)) {
    return operation();
  }
  await dropItemSearchIndexes(cloudflare, config, options);
  try {
    return await operation();
  } finally {
    await rebuildItemSearchIndexes(cloudflare, config, options);
    await normalizeItemSearchContent(cloudflare, config, options);
  }
}
