import {describe, expect, it} from "vitest";

import {
  authActionOptions,
  pagesProjectOptions,
  visiblePagesProjects,
} from "../../../admin-cli/lib/prompts";

describe("admin auth action picker", () => {
  it("offers disable while the built-in login is active", () => {
    expect(authActionOptions().map(({value}) => value)).toContain("disable");
    expect(authActionOptions().map(({value}) => value)).not.toContain("setup");
  });

  it("offers setup instead of disable when the login is inactive", () => {
    expect(authActionOptions(true).map(({value}) => value)).toContain("setup");
    expect(authActionOptions(true).map(({value}) => value)).not.toContain(
      "disable",
    );
  });
});

describe("Pages project picker", () => {
  it("shows no more than the first five Pages projects", () => {
    expect(visiblePagesProjects([
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
    ])).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
    ]);
  });

  it("shows every Pages project when the account has five or fewer", () => {
    expect(visiblePagesProjects(["one", "two"])).toEqual(["one", "two"]);
  });

  it("offers manual entry and explains when more projects are hidden", () => {
    const options = pagesProjectOptions([
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
    ]);

    expect(options.map(({label}) => label)).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
      "Type another project name (2 more not shown)",
    ]);
    expect(options.at(-1)?.value).not.toBe("six");
  });
});
