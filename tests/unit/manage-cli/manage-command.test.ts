import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

describe("repository management command", () => {
  async function packageScripts(): Promise<Record<string, string>> {
    const packageJson = JSON.parse(
      await readFile(
        new URL("../../../package.json", import.meta.url),
        "utf8",
      ),
    ) as {scripts: Record<string, string>};
    return packageJson.scripts;
  }

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

    expect(packageJson.scripts.manage).toContain("manage-cli/index.ts");
    expect(packageJson.scripts.manage).not.toContain("@microfeed/cli");
    expect(packageJson.scripts.admin).toBeUndefined();
    expect(packageJson.scripts.microfeed)
      .toBe("yarn workspace @microfeed/cli microfeed");
    expect(packageJson.scripts.dev).toBe("yarn manage dev");
    expect(packageJson.scripts.deploy).toBeUndefined();
    expect(packageJson.cloudflare).toBeUndefined();
  });

  it("keeps the deployment smoke suite focused on release-critical behavior", async () => {
    const scripts = await packageScripts();

    expect(scripts["test:deploy"]).toBe(
      "yarn test:deploy:unit && yarn test:deploy:worker",
    );
    expect(scripts["test:deploy:unit"]).toBe(
      "yarn theme:release-check && TZ=UTC vitest run " +
        "tests/unit/api-key-migration.test.ts " +
        "tests/unit/item-idempotency-migration.test.ts " +
        "tests/unit/item-search-migration.test.ts " +
        "tests/unit/item-timestamp-migration.test.ts",
    );
    expect(scripts["test:deploy:worker"]).toBe(
      "TZ=UTC vitest run --config vitest.worker.config.ts " +
        "tests/worker/api-item-service.test.ts " +
        "tests/worker/bootstrap-admin.test.ts " +
        "tests/worker/installation-identity.test.ts " +
        "tests/worker/item-idempotency.test.ts " +
        "tests/worker/item-search.test.ts " +
        "tests/worker/pages-site-files.test.ts " +
        "tests/worker/password-setup.test.ts",
    );
    expect(scripts["test:deploy"]).not.toBe(scripts.test);
  });
});
