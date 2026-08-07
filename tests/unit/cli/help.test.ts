import {describe, expect, it} from "vitest";

import {HELP} from "../../../packages/cli/src/index";

describe("microfeed CLI help", () => {
  it("documents every agent-facing command and global option", () => {
    expect(HELP).toContain("login <origin>");
    expect(HELP).toContain("instances list|use|remove");
    expect(HELP).toContain("item list|get|create|update|delete");
    expect(HELP).toContain("api <method> </api/v1/path>");
    expect(HELP).toContain("--instance <profile>");
    expect(HELP).toContain("--json");
    expect(HELP).toContain("MICROFEED_API_KEY");
  });
});
