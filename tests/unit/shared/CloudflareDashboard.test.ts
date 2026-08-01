import {describe, expect, it} from "vitest";

import {
  accessApplicationDashboardUrl,
  CLOUDFLARE_ACCESS_SELF_HOSTED_APPLICATION_PATH,
  r2BucketDomainsDashboardUrl,
  workerDomainsDashboardUrl,
} from "@/shared/CloudflareDashboard";

describe("account dashboard links", () => {
  it("targets the account's Zero Trust Access applications", () => {
    expect(CLOUDFLARE_ACCESS_SELF_HOSTED_APPLICATION_PATH).toBe(
      "one/access-controls/apps/self-hosted/add",
    );
    expect(accessApplicationDashboardUrl(
      "0123456789abcdef0123456789abcdef",
    )).toBe(
      "https://dash.cloudflare.com/0123456789abcdef0123456789abcdef/" +
        "one/access-controls/apps/self-hosted/add",
    );
  });

  it("targets the exact Worker's production domain settings", () => {
    expect(workerDomainsDashboardUrl(
      "0123456789abcdef0123456789abcdef",
      "demo-microfeed-org-worker",
    )).toBe(
      "https://dash.cloudflare.com/0123456789abcdef0123456789abcdef/" +
        "workers/services/view/demo-microfeed-org-worker/production/domains",
    );
  });

  it("encodes Worker identifiers and omits incomplete links", () => {
    expect(workerDomainsDashboardUrl("account/id", "worker name")).toBe(
      "https://dash.cloudflare.com/account%2Fid/workers/services/view/" +
        "worker%20name/production/domains",
    );
    expect(accessApplicationDashboardUrl(" ")).toBeNull();
    expect(workerDomainsDashboardUrl("account", undefined)).toBeNull();
  });
});

describe("R2 dashboard links", () => {
  it("targets the custom-domain settings for the exact managed bucket", () => {
    expect(r2BucketDomainsDashboardUrl(
      "0123456789abcdef0123456789abcdef",
      "microfeed-example-media",
    )).toBe(
      "https://dash.cloudflare.com/0123456789abcdef0123456789abcdef/" +
        "r2/default/buckets/microfeed-example-media/settings#domains",
    );
  });

  it("encodes identifiers and omits links without deployment metadata", () => {
    expect(r2BucketDomainsDashboardUrl("account/id", "media bucket")).toBe(
      "https://dash.cloudflare.com/account%2Fid/r2/default/buckets/" +
        "media%20bucket/settings#domains",
    );
    expect(r2BucketDomainsDashboardUrl(undefined, "media")).toBeNull();
    expect(r2BucketDomainsDashboardUrl("account", "")).toBeNull();
  });
});
