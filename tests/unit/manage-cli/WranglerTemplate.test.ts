import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

import {
  adminAuthMode,
  requiredSecrets,
  workersDevEnabled,
} from "../../../manage-cli/lib/config";
import type {MicrofeedConfig} from "../../../manage-cli/types";

describe("Wrangler configuration template", () => {
  const config: MicrofeedConfig = {
    accountId: "account-id",
    adminPath: "admin",
    completedSteps: [],
    customDomain: null,
    d1: {id: "d1-id", name: "feed-db", reuse: false},
    deploymentUrl: "https://feed.example.workers.dev",
    hosting: "cloudflare",
    instanceId: "instance-id",
    instanceName: "feed",
    projectName: "feed",
    r2: {name: "feed-media", reuse: false},
  };

  it("disables persisted Workers Logs by default", async () => {
    const template = await readFile(
      new URL("../../../wrangler.template.jsonc", import.meta.url),
      "utf8",
    );
    const config = JSON.parse(
      template
        .replace("__WORKERS_DEV__", "true")
        .replace(
          "__REQUIRED_SECRETS__",
          '["UPLOAD_SIGNING_KEY","BETTER_AUTH_SECRET"]',
        )
        .replace("__ROUTES__", "[]"),
    ) as {
      observability?: {
        enabled?: boolean;
      };
      version_metadata?: {
        binding?: string;
      };
    };

    expect(config.observability?.enabled).toBe(false);
    expect(config.version_metadata?.binding).toBe("CF_VERSION_METADATA");
  });

  it("enables workers.dev until a custom domain is configured", () => {
    expect(workersDevEnabled(config)).toBe(true);
    expect(workersDevEnabled({
      ...config,
      customDomain: "feed.example.com",
    })).toBe(false);
  });

  it("defaults to built-in auth and requires its signing secret", () => {
    expect(adminAuthMode(config)).toBe("built-in");
    expect(requiredSecrets(config)).toEqual([
      "UPLOAD_SIGNING_KEY",
      "BETTER_AUTH_SECRET",
    ]);
  });

  it("does not require an auth secret when built-in auth is skipped", () => {
    const publicAdminConfig = {
      ...config,
      adminAuthMode: "none" as const,
    };

    expect(adminAuthMode(publicAdminConfig)).toBe("none");
    expect(requiredSecrets(publicAdminConfig)).toEqual([
      "UPLOAD_SIGNING_KEY",
    ]);
  });
});
