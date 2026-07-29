import {describe, expect, it} from "vitest";

import {mediaPrefix} from "@/server/media/R2Utils";
import {
  deploymentEnvironment,
  workerName,
} from "../../../admin-cli/lib/config";
import type {MicrofeedConfig} from "../../../admin-cli/types";

const productionConfig: MicrofeedConfig = {
  accountId: "account-id",
  adminPath: "admin",
  completedSteps: [],
  customDomain: null,
  d1: {id: "production-d1-id", name: "feed-db", reuse: false},
  deploymentUrl: null,
  hosting: "cloudflare",
  instanceId: "production-instance",
  instanceName: "feed",
  projectName: "feed",
  r2: {name: "feed-media", reuse: false},
};

describe("preview environment isolation", () => {
  it("stores preview media beside, not inside, the production prefix", () => {
    expect(mediaPrefix({
      DEPLOYMENT_ENVIRONMENT: "production",
    })).toBe("production");
    expect(mediaPrefix({
      DEPLOYMENT_ENVIRONMENT: "preview",
    })).toBe("preview");
  });

  it("uses the preview Worker without changing the media project name", () => {
    const previewConfig: MicrofeedConfig = {
      ...productionConfig,
      adminPath: "admin",
      deploymentEnvironment: "preview",
      d1: {
        id: "preview-d1-id",
        name: "feed-preview-db",
        reuse: false,
      },
      instanceId: "preview-instance",
      workerName: "feed-preview",
    };

    expect(workerName(productionConfig)).toBe("feed");
    expect(deploymentEnvironment(productionConfig)).toBe("production");
    expect(workerName(previewConfig)).toBe("feed-preview");
    expect(deploymentEnvironment(previewConfig)).toBe("preview");
    expect(previewConfig.r2.name).toBe(productionConfig.r2.name);
    expect(previewConfig.d1.id).not.toBe(productionConfig.d1.id);
  });
});
