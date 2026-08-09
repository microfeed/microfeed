import {describe, expect, it} from "vitest";

import {
  damerauLevenshteinDistance,
  fuzzyTitleMatches,
  itemSearchFtsQuery,
  itemSearchTrigramQuery,
  parseItemSearchQuery,
} from "@/shared/ItemSearch";

describe("item search query grammar", () => {
  it("parses terms, both quote styles, escapes, and an unfinished phrase", () => {
    expect(parseItemSearchQuery(
      `launch "season finale" 'director\\'s cut' don\\'t last`,
    )).toEqual([
      {phrase: false, prefix: false, text: "launch"},
      {phrase: true, prefix: false, text: "season finale"},
      {phrase: true, prefix: false, text: "director's cut"},
      {phrase: false, prefix: false, text: "don't"},
      {phrase: false, prefix: true, text: "last"},
    ]);
    expect(parseItemSearchQuery("one 'unfinished phrase")).toEqual([
      {phrase: false, prefix: false, text: "one"},
      {phrase: true, prefix: false, text: "unfinished phrase"},
    ]);
    expect(parseItemSearchQuery('one "unfinished phrase')).toEqual([
      {phrase: false, prefix: false, text: "one"},
      {phrase: true, prefix: false, text: "unfinished phrase"},
    ]);
    expect(parseItemSearchQuery('"the \\"finale\\"" next')).toEqual([
      {phrase: true, prefix: false, text: 'the "finale"'},
      {phrase: false, prefix: true, text: "next"},
    ]);
    expect(parseItemSearchQuery(`don't stop `).at(0)?.text).toBe("don't");
  });

  it("builds field-scoped AND and final-prefix FTS queries", () => {
    const clauses = parseItemSearchQuery('launch "season finale" pre');
    expect(itemSearchFtsQuery(clauses, ["title", "content"])).toBe(
      '"launch" AND "season finale" AND "pre"*',
    );
    expect(itemSearchFtsQuery(clauses, ["content"])).toBe(
      'content_text:"launch" AND content_text:"season finale" AND content_text:"pre"*',
    );
    expect(itemSearchTrigramQuery(clauses)).toContain('"lau"');
    expect(itemSearchTrigramQuery(parseItemSearchQuery("cat"))).toBeNull();
  });
});

describe("item title typo tolerance", () => {
  it("uses bounded Damerau-Levenshtein matching", () => {
    expect(damerauLevenshteinDistance("seasn", "season", 1)).toBe(1);
    expect(damerauLevenshteinDistance("seasno", "season", 1)).toBe(1);
    expect(damerauLevenshteinDistance("kitten", "sitting", 1)).toBe(2);
    expect(fuzzyTitleMatches(
      "The season finale",
      parseItemSearchQuery("seasn finale "),
    ).matches).toBe(true);
    expect(fuzzyTitleMatches(
      "The season finale",
      parseItemSearchQuery("cat "),
    ).matches).toBe(false);
    expect(fuzzyTitleMatches(
      "A season finale recap",
      parseItemSearchQuery("'season finale'"),
    ).matches).toBe(true);
    expect(fuzzyTitleMatches(
      "example",
      parseItemSearchQuery("exxmply "),
    ).matches).toBe(false);
    expect(fuzzyTitleMatches(
      "abcdefgh",
      parseItemSearchQuery("abxdxfgh "),
    ).matches).toBe(true);
  });
});
