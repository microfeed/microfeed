import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";

const source = (filename: string) => readFile(
  new URL(`../../../src/${filename}`, import.meta.url),
  "utf8",
);

describe("Admin rich editor", () => {
  it("keeps a consistent gap between every rich-text block", async () => {
    const adminStyles = await source("styles/admin.css");

    expect(adminStyles).toMatch(
      /\.admin-rich-editor \.ql-container \.ql-editor \{[\s\S]*?--mf-rich-block-gap: 1\.2rem;[\s\S]*?line-height: 1\.6;/u,
    );
    expect(adminStyles).toMatch(
      /\.admin-rich-editor \.ql-container \.ql-editor > \* \{\s*margin-block: 0;\s*\}/u,
    );
    expect(adminStyles).toMatch(
      /\.admin-rich-editor \.ql-container \.ql-editor > \* \+ \* \{\s*margin-top: var\(--mf-rich-block-gap\);\s*\}/u,
    );
  });
});
