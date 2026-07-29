import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

import {
  configFilePath,
  localPersistencePath,
  normalizeLocalInstanceName,
  wranglerConfigPath,
} from "../../../admin-cli/lib/config";
import type {MicrofeedConfig} from "../../../admin-cli/types";

function config(
  instanceName: string,
  preview = false,
): MicrofeedConfig {
  return {
    accountId: "account-id",
    adminPath: "admin",
    completedSteps: [],
    customDomain: null,
    deploymentEnvironment: preview ? "preview" : "production",
    d1: {
      id: `${instanceName}-database-id`,
      name: `${instanceName}-db`,
      reuse: false,
    },
    deploymentUrl: null,
    hosting: "cloudflare",
    instanceId: `${instanceName}-installation-id`,
    instanceName,
    projectName: instanceName,
    r2: {
      name: `${instanceName}-media`,
      reuse: false,
    },
  };
}

describe("local instances", () => {
  it("normalizes project names into safe local instance names", () => {
    expect(normalizeLocalInstanceName("The Art of War")).toBe(
      "the-art-of-war",
    );
    expect(normalizeLocalInstanceName("../../")).toBe("microfeed");
  });

  it("keeps production, preview, and local state inside one instance", () => {
    const production = config("art-of-war");
    const preview = config("art-of-war", true);

    expect(configFilePath("art-of-war")).toMatch(
      /[/\\]\.microfeed[/\\]instances[/\\]art-of-war[/\\]config\.json$/u,
    );
    expect(configFilePath("art-of-war", true)).toMatch(
      /[/\\]art-of-war[/\\]preview[/\\]config\.json$/u,
    );
    expect(wranglerConfigPath(production)).toMatch(
      /[/\\]art-of-war[/\\]wrangler\.jsonc$/u,
    );
    expect(wranglerConfigPath(preview)).toMatch(
      /[/\\]art-of-war[/\\]preview[/\\]wrangler\.jsonc$/u,
    );
    expect(localPersistencePath(production)).toMatch(
      /[/\\]art-of-war[/\\]local-state$/u,
    );
  });

  it("isolates different deployments from each other", () => {
    const first = config("art-of-war");
    const second = config("company-changelog");

    expect(wranglerConfigPath(first)).not.toBe(wranglerConfigPath(second));
    expect(localPersistencePath(first)).not.toBe(
      localPersistencePath(second),
    );
  });
});

describe("Deploy to Cloudflare template", () => {
  it("contains only generic, automatically provisionable resources", async () => {
    const source = await readFile(
      new URL("../../../wrangler.jsonc", import.meta.url),
      "utf8",
    );
    const wrangler = JSON.parse(source) as {
      d1_databases: Array<{
        database_id: string;
        database_name: string;
      }>;
      name: string;
      observability: {enabled: boolean};
      r2_buckets: Array<{bucket_name: string}>;
      routes: unknown[];
      secrets?: unknown;
      vars?: Record<string, unknown>;
      workers_dev: boolean;
    };

    expect(wrangler.name).toBe("microfeed");
    expect(wrangler.workers_dev).toBe(true);
    expect(wrangler.d1_databases[0]).toEqual(
      expect.objectContaining({
        database_id: "00000000-0000-0000-0000-000000000000",
        database_name: "microfeed-db",
      }),
    );
    expect(wrangler.r2_buckets[0]?.bucket_name).toBe("microfeed-media");
    expect(wrangler.routes).toEqual([]);
    expect(wrangler.observability.enabled).toBe(false);
    expect(wrangler.secrets).toBeUndefined();
    expect(wrangler.vars).toBeUndefined();
    expect(source).not.toContain("dripdemo");
    expect(source).not.toContain("microfeed.org");
  });

  it("asks only for temporary admin setup secrets", async () => {
    const source = await readFile(
      new URL("../../../.dev.vars.example", import.meta.url),
      "utf8",
    );

    expect(source).toContain("MICROFEED_SETUP_ADMIN_EMAIL=");
    expect(source).toContain("MICROFEED_SETUP_ADMIN_PASSWORD=");
    expect(source).toContain(
      "MICROFEED_SETUP_ADMIN_PASSWORD_CONFIRMATION=",
    );
    expect(source).not.toContain("UPLOAD_SIGNING_KEY=");
    expect(source).not.toContain("BETTER_AUTH_SECRET=");
  });

  it("is linked from the README through the fork-first flow", async () => {
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
    expect(readme).not.toContain(
      "https://deploy.workers.cloudflare.com/?url=" +
        "https://github.com/microfeed/microfeed",
    );
  });
});
