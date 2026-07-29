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
    const readme = await readFile(
      new URL("../../../README.md", import.meta.url),
      "utf8",
    );

    expect(packageJson.scripts.manage).toBe("tsx manage-cli/index.ts");
    expect(packageJson.scripts.admin).toBeUndefined();
    expect(packageJson.scripts.microfeed).toBeUndefined();
    expect(packageJson.scripts.dev).toBe("yarn manage dev");
    expect(packageJson.scripts.deploy).toBeUndefined();
    expect(packageJson.cloudflare).toBeUndefined();
    expect(readme).toContain("yarn manage init");
    expect(readme).toContain("yarn manage destroy");
    expect(readme).toContain("Cloudflare dashboard links");
    expect(readme).not.toContain("yarn microfeed");
  });

  it("documents yarn manage as the only deployment engine", async () => {
    const readme = await readFile(
      new URL("../../../README.md", import.meta.url),
      "utf8",
    );
    expect(readme).toContain("one supported deployment engine");
    expect(readme).toContain("Cloudflare repository imports");
    expect(readme).toContain("`yarn manage` from a local");
    expect(readme).not.toContain("deploy.workers.cloudflare.com");
    expect(readme).not.toContain("`yarn deploy`");
  });

  it("documents multiple local instances and production-data isolation", async () => {
    const readme = await readFile(
      new URL("../../../README.md", import.meta.url),
      "utf8",
    );

    expect(readme).toContain(
      "yarn manage init --local --instance personal",
    );
    expect(readme).toContain("yarn manage connect");
    expect(readme).toContain("Cloudflare — available to connect");
    expect(readme).toContain(
      "it does not download, access, or modify production",
    );
    expect(readme).toContain(
      "there is no automatic local-to-production or",
    );
    expect(readme).not.toContain("deployment profiles");
  });
});
