import {DatabaseSync} from "node:sqlite";
import {describe, expect, it} from "vitest";
import {
  CHARACTER_SEARCH_CHUNK_SIZE,
  characterSearchChunks,
  characterSearchPhrase,
  characterSearchTokens,
  normalizeCharacterSearch,
  searchCharacterCount,
  usesCharacterSearch,
} from "@/shared/CharacterSearch";
import {parseItemSearchQuery} from "@/shared/ItemSearch";
import {characterHighlights} from "@/server/items/character-highlights";

describe("multilingual character search", () => {
  it.each(["中文", "日本語", "한국어", "ภาษาไทย", "ພາສາລາວ", "ភាសាខ្មែរ", "မြန်မာ"])(
    "routes %s to character matching", (query) => {
      expect(usesCharacterSearch(parseItemSearchQuery(query)[0]!)).toBe(true);
    },
  );
  it("preserves one-character and other word queries", () => {
    for (const query of ["中", "𠀀", "hello", "café", "Привет", "مرحبا"]) {
      expect(usesCharacterSearch(parseItemSearchQuery(query)[0]!)).toBe(false);
    }
    expect(searchCharacterCount("𠀀𠀁")).toBe(2);
    expect(characterSearchTokens("𠀀𠀁")).toBe("g020000020001");
  });
  it("normalizes canonical forms without removing meaningful marks", () => {
    expect(characterSearchTokens("か\u3099く")).toBe(characterSearchTokens("がく"));
    expect(characterSearchTokens("がく")).not.toBe(characterSearchTokens("かく"));
    expect(normalizeCharacterSearch("OpenAI中文")).toBe("openai中文");
    expect(characterSearchPhrase(parseItemSearchQuery('"中文 OR title:*"')[0]!))
      .toMatch(/^"[g0-9a-f ]+"$/u);
  });
  it("matches ordered pairs across chunk boundaries without joining unrelated pairs", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE VIRTUAL TABLE f USING fts5(t, tokenize='ascii')");
    const text = "开".repeat(CHARACTER_SEARCH_CHUNK_SIZE - 1) + "人工智能" + "末".repeat(5000);
    for (const chunk of characterSearchChunks(text)) db.prepare("INSERT INTO f VALUES (?)").run(chunk);
    db.prepare("INSERT INTO f VALUES (?)").run(characterSearchTokens("人工，然后工智，最后智能"));
    const rows = db.prepare("SELECT rowid FROM f WHERE f MATCH ?").all(
      characterSearchPhrase(parseItemSearchQuery("人工智能")[0]!),
    );
    expect(rows).toHaveLength(1);
    expect(characterSearchChunks("Only English")).toEqual([]);
    db.close();
  });
  it("maps normalized matches and word marks to the original spelling safely", () => {
    expect(characterHighlights("\u0001OpenAI\u0002のか\u3099く𠀀𠀁<script>", ["がく", "𠀀𠀁"]))
      .toEqual([
        {matched: true, text: "OpenAI"},
        {matched: false, text: "の"},
        {matched: true, text: "か\u3099く𠀀𠀁"},
        {matched: false, text: "<script>"},
      ]);
  });

  it("keeps excerpts short and finds matches after a large decomposed prefix", () => {
    const source = "か\u3099".repeat(20000) + "中文𠀀𠀁" + "末".repeat(1000);
    const segments = characterHighlights(source, ["中文", "𠀀𠀁"], true);
    expect(segments.filter((segment) => segment.matched).map((segment) => segment.text).join(""))
      .toBe("中文𠀀𠀁");
    expect(Array.from(segments.map((segment) => segment.text).join("")).length).toBeLessThan(250);
  });
});
