import {afterEach, describe, expect, it, vi} from "vitest";

import {readJsonScript} from "@/client/BrowserUtils";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readJsonScript", () => {
  it("parses the script text without altering JSON escape sequences", () => {
    const value = {
      entityText: "&quot; stays data &amp; so does this",
      literalBackslash: String.raw`\unicode`,
      unicode: "世界",
    };
    vi.stubGlobal("document", {
      getElementById: vi.fn().mockReturnValue({
        textContent: JSON.stringify(value),
      }),
    });

    expect(readJsonScript("feed-content")).toEqual(value);
  });

  it("reports a missing data element clearly", () => {
    vi.stubGlobal("document", {
      getElementById: vi.fn().mockReturnValue(null),
    });

    expect(() => readJsonScript("feed-content")).toThrow(
      "JSON data element #feed-content was not found.",
    );
  });
});
