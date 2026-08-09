export const ITEM_SEARCH_FIELDS = ["title", "content"] as const;
export type ItemSearchField = typeof ITEM_SEARCH_FIELDS[number];

export const ITEM_CONTENT_TEXT_REVISION = 1;

export const ITEM_SEARCH_STATUSES = [
  "published",
  "unlisted",
  "unpublished",
] as const;
export type ItemSearchStatus = typeof ITEM_SEARCH_STATUSES[number];

export interface ItemSearchClause {
  phrase: boolean;
  prefix: boolean;
  text: string;
}

function quotedFtsValue(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function parseItemSearchQuery(input: string): ItemSearchClause[] {
  const clauses: ItemSearchClause[] = [];
  let buffer = "";
  let quote: "'" | '"' | null = null;
  let quoted = false;
  let escaped = false;

  const push = () => {
    const text = buffer.trim();
    if (text) {
      clauses.push({phrase: quoted, prefix: false, text});
    }
    buffer = "";
    quoted = false;
  };

  for (const character of input) {
    if (escaped) {
      buffer += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = null;
        push();
      } else {
        buffer += character;
      }
      continue;
    }
    if ((character === '"' || character === "'") && buffer.length === 0) {
      quote = character;
      quoted = true;
      continue;
    }
    if (/\s/u.test(character)) {
      push();
      continue;
    }
    buffer += character;
  }
  if (escaped) buffer += "\\";
  push();

  const last = clauses.at(-1);
  if (last && !last.phrase) {
    last.prefix = true;
  }
  return clauses;
}

export function itemSearchFtsQuery(
  clauses: readonly ItemSearchClause[],
  fields: readonly ItemSearchField[],
): string {
  const column = fields.length === 1
    ? fields[0] === "content" ? "content_text:" : "title:"
    : "";
  return clauses.map((clause) =>
    `${column}${quotedFtsValue(clause.text)}${clause.prefix ? "*" : ""}`
  ).join(" AND ");
}

export function normalizedSearchTokens(value: string): string[] {
  return value.normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("und")
    .match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

export function damerauLevenshteinDistance(
  left: string,
  right: string,
  maximum: number,
): number {
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > maximum) return maximum + 1;
  const previousPrevious = new Array<number>(right.length + 1).fill(0);
  let previous = Array.from({length: right.length + 1}, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = current[0]!;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1]! +
        (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      let distance = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        substitution,
      );
      if (
        leftIndex > 1 && rightIndex > 1 &&
        left[leftIndex - 1] === right[rightIndex - 2] &&
        left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        distance = Math.min(
          distance,
          previousPrevious[rightIndex - 2]! + 1,
        );
      }
      current[rightIndex] = distance;
      rowMinimum = Math.min(rowMinimum, distance);
    }
    if (rowMinimum > maximum) return maximum + 1;
    previousPrevious.splice(0, previousPrevious.length, ...previous);
    previous = current;
  }
  return previous[right.length]!;
}

export function fuzzyDistanceLimit(term: string): number {
  if (term.length < 4) return 0;
  return term.length < 8 ? 1 : 2;
}

export function itemSearchTrigramQuery(
  clauses: readonly ItemSearchClause[],
): string | null {
  const grams = new Set<string>();
  for (const clause of clauses) {
    if (clause.phrase) continue;
    for (const term of normalizedSearchTokens(clause.text)) {
      if (fuzzyDistanceLimit(term) === 0) continue;
      for (let index = 0; index <= term.length - 3; index += 1) {
        grams.add(term.slice(index, index + 3));
      }
    }
  }
  return grams.size > 0
    ? [...grams].map(quotedFtsValue).join(" OR ")
    : null;
}

export function fuzzyTitleMatches(
  title: string,
  clauses: readonly ItemSearchClause[],
): {matchedTokens: Set<string>; matches: boolean} {
  const titleTokens = normalizedSearchTokens(title);
  const matchedTokens = new Set<string>();
  for (const clause of clauses) {
    const queryTokens = normalizedSearchTokens(clause.text);
    if (queryTokens.length === 0) continue;
    if (clause.phrase) {
      let phraseIndex = -1;
      for (let index = 0; index <= titleTokens.length - queryTokens.length; index += 1) {
        if (queryTokens.every((token, offset) =>
          token === titleTokens[index + offset]
        )) {
          phraseIndex = index;
          break;
        }
      }
      if (phraseIndex < 0) return {matchedTokens, matches: false};
      queryTokens.forEach((_term, index) =>
        matchedTokens.add(titleTokens[phraseIndex + index]!)
      );
      continue;
    }
    for (const term of queryTokens) {
      const limit = fuzzyDistanceLimit(term);
      const match = titleTokens.find((candidate) =>
        damerauLevenshteinDistance(term, candidate, limit) <= limit
      );
      if (!match) return {matchedTokens, matches: false};
      matchedTokens.add(match);
    }
  }
  return {matchedTokens, matches: true};
}
