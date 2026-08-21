import {describe, expect, it} from "vitest";

import {
  parseThemeAdminTab,
  parseThemeListOptions,
} from "@/shared/themes/ThemeListing";

describe("theme listing query", () => {
  it("accepts only Built-in and Custom tab scopes", () => {
    expect(parseThemeAdminTab(new URLSearchParams())).toBeNull();
    expect(parseThemeAdminTab(new URLSearchParams("tab=built-in")))
      .toBe("built-in");
    expect(parseThemeAdminTab(new URLSearchParams("tab=custom")))
      .toBe("custom");
    expect(() => parseThemeAdminTab(new URLSearchParams("tab=deleted")))
      .toThrow("Unknown theme tab");
  });

  it("normalizes valid search, sort, and page values", () => {
    expect(parseThemeListOptions(new URLSearchParams(
      "q=%20Editorial%20&sort=name-asc&page=2",
    ))).toEqual({page: 2, q: "Editorial", sort: "name-asc"});
  });

  it("rejects invalid and unbounded query values", () => {
    expect(() => parseThemeListOptions(new URLSearchParams("sort=unknown")))
      .toThrow("Unknown theme sort order");
    expect(() => parseThemeListOptions(new URLSearchParams("page=0")))
      .toThrow("positive integer");
    expect(() => parseThemeListOptions(new URLSearchParams(`q=${"x".repeat(101)}`)))
      .toThrow("100 characters");
  });
});
