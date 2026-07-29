import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

describe("repository administration command", () => {
  it("uses yarn admin and reserves the microfeed command name", async () => {
    const packageJson = JSON.parse(
      await readFile(
        new URL("../../../package.json", import.meta.url),
        "utf8",
      ),
    ) as {
      scripts: Record<string, string>;
    };
    const readme = await readFile(
      new URL("../../../README.md", import.meta.url),
      "utf8",
    );

    expect(packageJson.scripts.admin).toBe("tsx admin-cli/index.ts");
    expect(packageJson.scripts.microfeed).toBeUndefined();
    expect(packageJson.scripts.dev).toBe("yarn admin dev");
    expect(packageJson.scripts.deploy).toBe(
      "yarn admin deploy --cloudflare-build",
    );
    expect(readme).toContain("yarn admin setup");
    expect(readme).toContain("yarn admin destroy");
    expect(readme).toContain("Cloudflare dashboard links");
    expect(readme).not.toContain("yarn microfeed");
  });

  it("documents the fork-first Deploy to Cloudflare flow", async () => {
    const readme = await readFile(
      new URL("../../../README.md", import.meta.url),
      "utf8",
    );

    expect(readme).toContain(
      "https://github.com/microfeed/microfeed/fork",
    );
    expect(readme).toContain(
      "](https://deploy.workers.cloudflare.com/)",
    );
    expect(readme).toContain("**Sync fork**");
    expect(readme).toContain("**Build command** | `yarn build`");
    expect(readme).toContain("**Deploy command** | `yarn deploy`");
    expect(readme).toContain(
      'The entry-point file at "@astrojs/cloudflare/entrypoints/server" was not found',
    );
    expect(readme).toContain("Do not keep `npx wrangler deploy`");
    expect(readme).not.toContain(
      "deploy.workers.cloudflare.com/?url=https://github.com/microfeed/microfeed",
    );
  });

  it("documents multiple local instances and production-data isolation", async () => {
    const readme = await readFile(
      new URL("../../../README.md", import.meta.url),
      "utf8",
    );

    expect(readme).toContain(
      "yarn admin setup --local --instance personal",
    );
    expect(readme).toContain("yarn admin connect");
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
