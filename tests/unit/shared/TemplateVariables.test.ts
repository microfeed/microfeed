import {describe, expect, it} from "vitest";

import {
  getBuiltInTemplateVariables,
  resolveBuiltInTemplateVariables,
} from "@/shared/TemplateVariables";

describe("built-in template variables", () => {
  it("uses the UTC year across the New Year boundary", () => {
    expect(getBuiltInTemplateVariables(
      new Date("2026-12-31T23:59:59.999Z"),
    )).toEqual({current_year: 2026});
    expect(getBuiltInTemplateVariables(
      new Date("2027-01-01T00:00:00.000Z"),
    )).toEqual({current_year: 2027});
  });

  it("resolves allowlisted variables with optional whitespace", () => {
    expect(resolveBuiltInTemplateVariables(
      "©{{current_year}} / {{ current_year }} Publisher",
      {current_year: 2027},
    )).toBe("©2027 / 2027 Publisher");
  });

  it("preserves static text and unsupported expressions", () => {
    const copyright =
      "© 2024 Publisher / {{unknown}} / {{_microfeed.base_url}} / {{{current_year}}}";
    expect(resolveBuiltInTemplateVariables(
      copyright,
      {current_year: 2027},
    )).toBe(copyright);
  });
});
