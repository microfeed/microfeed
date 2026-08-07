import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

describe("repository management command", () => {
  it("keeps deployment management separate from the content CLI", async () => {
    const packageJson = JSON.parse(
      await readFile(
        new URL("../../../package.json", import.meta.url),
        "utf8",
      ),
    ) as {
      scripts: Record<string, string>;
      cloudflare?: unknown;
    };

    expect(packageJson.scripts.manage).toBe("tsx manage-cli/index.ts");
    expect(packageJson.scripts.admin).toBeUndefined();
    expect(packageJson.scripts.microfeed)
      .toBe("yarn workspace @microfeed/cli microfeed");
    expect(packageJson.scripts.dev).toBe("yarn manage dev");
    expect(packageJson.scripts.deploy).toBeUndefined();
    expect(packageJson.cloudflare).toBeUndefined();
  });
});
