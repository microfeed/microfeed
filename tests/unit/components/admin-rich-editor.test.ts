import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";

const source = (filename: string) => readFile(
  new URL(`../../../src/${filename}`, import.meta.url),
  "utf8",
);

describe("Admin rich editor", () => {
  it("distinguishes wrapped lines from new paragraphs", async () => {
    const adminStyles = await source("styles/admin.css");

    expect(adminStyles).toMatch(
      /\.admin-rich-editor \.ql-container \.ql-editor \{[\s\S]*?line-height: 1\.6;/u,
    );
    expect(adminStyles).toMatch(
      /\.admin-rich-editor \.ql-container \.ql-editor p \{\s*margin: 0;\s*\}/u,
    );
    expect(adminStyles).toMatch(
      /\.admin-rich-editor \.ql-container \.ql-editor p \+ p \{\s*margin-top: 1em;\s*\}/u,
    );
  });
});
