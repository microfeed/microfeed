import {describe, expect, it} from "vitest";

import {
  configFilePath,
  localPersistencePath,
  normalizeLocalInstanceName,
  wranglerConfigPath,
} from "../../../manage-cli/lib/config";
import type {MicrofeedConfig} from "../../../manage-cli/types";

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
