import {describe, expect, it} from "vitest";

import {r2BucketDomainsDashboardUrl} from "@/shared/CloudflareDashboard";

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
