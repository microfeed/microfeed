import {describe, expect, it} from "vitest";

import {
  authActionOptions,
  pagesProjectOptions,
  visiblePagesProjects,
  withSpinner,
} from "../../../manage-cli/lib/prompts";

function recordingSpinner(events: string[]) {
  return {
    error: (message = "") => events.push(`error:${message}`),
    message: (message = "") => events.push(`message:${message}`),
    start: (message = "") => events.push(`start:${message}`),
    stop: (message = "") => events.push(`stop:${message}`),
  };
}

describe("long-running task spinner", () => {
  it("shows phase updates and finishes successfully", async () => {
    const events: string[] = [];
    const result = await withSpinner(
      {
        error: "Import failed",
        start: "Preparing import",
        success: "Import complete",
      },
      async (activity) => {
        activity.update("Importing database");
        activity.update("Restoring media");
        return "restored";
      },
      () => recordingSpinner(events),
    );

    expect(result).toBe("restored");
    expect(events).toEqual([
      "start:Preparing import",
      "message:Importing database",
      "message:Restoring media",
      "stop:Import complete",
    ]);
  });

  it("shows a failure state and preserves the original error", async () => {
    const events: string[] = [];
    const failure = new Error("D1 import failed");

    await expect(withSpinner(
      {
        error: "Import failed",
        start: "Preparing import",
        success: "Import complete",
      },
      async (activity) => {
        activity.update("Importing database");
        throw failure;
      },
      () => recordingSpinner(events),
    )).rejects.toBe(failure);
    expect(events).toEqual([
      "start:Preparing import",
      "message:Importing database",
      "error:Import failed",
    ]);
  });
});

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
