import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

import {
  adminAuthMode,
  requiredSecrets,
  webhookQueueName,
  workersCacheEnabled,
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
    r2: {name: "feed-media", reuse: false, setupMode: "automatic"},
  };

  it("disables persisted Workers Logs by default", async () => {
    const template = await readFile(
      new URL("../../../wrangler.template.jsonc", import.meta.url),
      "utf8",
    );
    const config = JSON.parse(
      template
        .replace("__WORKERS_DEV__", "true")
        .replace("__WORKERS_CACHE_ENABLED__", "true")
        .replace(
          "__REQUIRED_SECRETS__",
          '["UPLOAD_SIGNING_KEY","BETTER_AUTH_SECRET"]',
        )
        .replace("__R2_BINDING__", '"r2_buckets": [],')
        .replace("__WEBHOOK_BINDINGS__", "")
        .replace("__R2_SETUP_MODE__", "automatic")
        .replace("__ROUTES__", "[]"),
    ) as {
      cache?: {
        enabled?: boolean;
      };
      observability?: {
        enabled?: boolean;
      };
      version_metadata?: {
        binding?: string;
      };
      vars?: Record<string, string>;
    };

    expect(config.cache?.enabled).toBe(true);
    expect(config.observability?.enabled).toBe(false);
    expect(config.version_metadata?.binding).toBe("CF_VERSION_METADATA");
    expect(config.vars?.MICROFEED_CLOUDFLARE_ACCOUNT_ID).toBe(
      "__CLOUDFLARE_ACCOUNT_ID__",
    );
    expect(config.vars?.MICROFEED_INSTANCE_NAME).toBe("__INSTANCE_NAME__");
    expect(config.vars?.MICROFEED_R2_BUCKET_NAME).toBe(
      "__R2_BUCKET_NAME__",
    );
    expect(config.vars?.MICROFEED_R2_SETUP_MODE).toBe("automatic");
    expect(config.vars?.MICROFEED_WORKER_NAME).toBe("__WORKER_NAME__");
  });

  it("enables workers.dev until a custom domain is configured", () => {
    expect(workersDevEnabled(config)).toBe(true);
    expect(workersDevEnabled({
      ...config,
      customDomain: "feed.example.com",
    })).toBe(false);
  });

  it("enables Workers Caching only for Cloudflare production", () => {
    expect(workersCacheEnabled(config)).toBe(true);
    expect(workersCacheEnabled({
      ...config,
      deploymentEnvironment: "preview",
    })).toBe(false);
    expect(workersCacheEnabled({
      ...config,
      accountId: null,
      hosting: "local",
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

  it("requires the webhook encryption secret only after explicit opt-in", () => {
    expect(requiredSecrets(config)).not.toContain("WEBHOOK_SECRET_KEY");
    expect(requiredSecrets({
      ...config,
      webhooks: {queueName: "feed-webhooks", state: "enabled"},
    })).toContain("WEBHOOK_SECRET_KEY");
    expect(requiredSecrets({
      ...config,
      webhooks: {queueName: "feed-webhooks", state: "disabled"},
    })).toContain("WEBHOOK_SECRET_KEY");
  });

  it("derives collision-resistant environment-specific Queue names", () => {
    expect(webhookQueueName("microfeed-personal")).toBe(
      "microfeed-personal-webhooks",
    );
    const first = webhookQueueName("a".repeat(63));
    const second = webhookQueueName(`${"a".repeat(62)}b`);
    expect(first).toHaveLength(63);
    expect(second).toHaveLength(63);
    expect(first).not.toBe(second);
    expect(first).toMatch(/-[a-f0-9]{10}-webhooks$/u);
  });
});
