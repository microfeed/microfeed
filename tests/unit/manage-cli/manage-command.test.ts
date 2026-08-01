import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

describe("repository management command", () => {
  it("exposes yarn manage as the only management CLI entrypoint", async () => {
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
    expect(packageJson.scripts.microfeed).toBeUndefined();
    expect(packageJson.scripts.dev).toBe("yarn manage dev");
    expect(packageJson.scripts.deploy).toBeUndefined();
    expect(packageJson.cloudflare).toBeUndefined();
  });
});
