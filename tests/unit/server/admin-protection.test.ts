import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {
  AdminProtectionDescription,
  MediaDeliveryDescription,
  SiteCustomDomainDescription,
} from "@/components/admin/home/AdminHomeApp/component/SetupChecklistApp";
import {ONBOARDING_TYPES} from "@/shared/Constants";
import {
  adminProtectionStatus,
  cloudflareAccessDetected,
} from "@/server/auth/admin-protection";
import OnboardingChecker from "@/server/feed/OnboardingUtils";
import type {AdminProtectionStatus} from "@/types";

const ACCESS_ASSERTION = "header.payload.signature";

function description(
  status: AdminProtectionStatus & {dashboardUrl?: string},
): string {
  return renderToStaticMarkup(
    React.createElement(AdminProtectionDescription, status),
  );
}

describe("dashboard protection detection", () => {
  it("uses the Access assertion header instead of trusting cookies", () => {
    const cookieOnly = new Request("https://feed.example.com/admin/", {
      headers: {
        cookie: "CF_Authorization=unverified",
      },
    });
    const accessRequest = new Request("https://feed.example.com/admin/", {
      headers: {
        "cf-access-jwt-assertion": ACCESS_ASSERTION,
      },
    });

    expect(cloudflareAccessDetected(cookieOnly)).toBe(false);
    expect(cloudflareAccessDetected(accessRequest)).toBe(true);
    expect(adminProtectionStatus(accessRequest, false)).toEqual({
      builtInLogin: false,
      cloudflareAccess: true,
    });
  });

  it.each([
    {
      allOk: false,
      builtInLogin: false,
      cloudflareAccess: false,
      ready: false,
    },
    {
      allOk: true,
      builtInLogin: true,
      cloudflareAccess: false,
      ready: true,
    },
    {
      allOk: true,
      builtInLogin: false,
      cloudflareAccess: true,
      ready: true,
    },
    {
      allOk: true,
      builtInLogin: true,
      cloudflareAccess: true,
      ready: true,
    },
  ])(
    "reports built-in=$builtInLogin Access=$cloudflareAccess accurately",
    ({allOk, builtInLogin, cloudflareAccess, ready}) => {
      const adminProtection = {builtInLogin, cloudflareAccess};
      const result = new OnboardingChecker(
        new Request("https://feed.example.com/admin/"),
        adminProtection,
        {publicBucketUrl: "https://media.example.com/"},
      ).getResult();
      const protectionCheck = result.result[
        ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD
      ]!;

      expect(protectionCheck.ready).toBe(ready);
      expect(protectionCheck.adminProtection).toEqual(adminProtection);
      expect(result.allOk).toBe(allOk);
    },
  );
});

describe("media delivery onboarding", () => {
  it("links to the exact managed bucket and suggests a media hostname", () => {
    const result = new OnboardingChecker(
      new Request("https://feed.example.com/admin/"),
      {builtInLogin: true, cloudflareAccess: false},
      {
        accountId: "0123456789abcdef0123456789abcdef",
        publicBucketUrl: "/media/",
        r2BucketName: "microfeed-example-media",
      },
    ).getResult();
    const media = result.result[
      ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL
    ]!;

    expect(media.ready).toBe(false);
    expect(media.bucketName).toBe("microfeed-example-media");
    expect(media.dashboardUrl).toBe(
      "https://dash.cloudflare.com/0123456789abcdef0123456789abcdef/" +
        "r2/default/buckets/microfeed-example-media/settings#domains",
    );
    expect(media.suggestedUrl).toBe("https://media.feed.example.com/");
    expect(result.allOk).toBe(false);
  });

  it("completes only for a production R2 custom domain", () => {
    const request = new Request("https://feed.example.com/admin/");
    const protection = {builtInLogin: true, cloudflareAccess: false};

    const customDomain = new OnboardingChecker(request, protection, {
      publicBucketUrl: "https://media.example.com/",
    }).getResult();
    const developmentUrl = new OnboardingChecker(request, protection, {
      publicBucketUrl: "https://example.r2.dev/",
    }).getResult();
    const localMediaRoute = new OnboardingChecker(
      new Request("http://localhost:4321/admin/"),
      protection,
      {publicBucketUrl: "/media/"},
    ).getResult();

    expect(customDomain.result[
      ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL
    ]?.ready).toBe(true);
    expect(customDomain.allOk).toBe(true);
    expect(developmentUrl.result[
      ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL
    ]?.ready).toBe(false);
    expect(developmentUrl.allOk).toBe(false);
    expect(localMediaRoute.result[
      ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL
    ]?.ready).toBe(false);
    expect(localMediaRoute.allOk).toBe(false);
  });

  it("renders the verified bucket link and optimization guidance", () => {
    const dashboardUrl =
      "https://dash.cloudflare.com/account/r2/default/buckets/media/" +
      "settings#domains";
    const output = renderToStaticMarkup(
      React.createElement(MediaDeliveryDescription, {
        bucketName: "media",
        dashboardUrl,
        mediaDomainUrl: "https://media.example.com/",
        onChange: () => {},
        onSubmit: () => {},
        saving: false,
        suggestedUrl: "https://media.feed.example.com/",
      }),
    );

    expect(output).toContain(`href="${dashboardUrl}"`);
    expect(output).toContain("Open the media bucket domain settings");
    expect(output).toContain("both Worker and R2 billable usage");
    expect(output).toContain("Do not use the Public Development URL");
  });
});

describe("Cloudflare onboarding links", () => {
  it("links protection and site-domain checks to the exact deployment", () => {
    const accountId = "0123456789abcdef0123456789abcdef";
    const workerName = "demo-microfeed-org-worker";
    const result = new OnboardingChecker(
      new Request("https://demo.microfeed.org/admin/"),
      {builtInLogin: true, cloudflareAccess: false},
      {accountId, workerName},
    ).getResult();

    expect(result.result[
      ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD
    ]?.dashboardUrl).toBe(
      `https://dash.cloudflare.com/${accountId}/` +
        "one/access-controls/apps/self-hosted/add",
    );
    expect(result.result[ONBOARDING_TYPES.CUSTOM_DOMAIN]).toMatchObject({
      dashboardUrl:
        `https://dash.cloudflare.com/${accountId}/workers/services/view/` +
        `${workerName}/production/domains`,
      workerName,
    });
  });

  it("renders the exact Worker domain settings link", () => {
    const dashboardUrl =
      "https://dash.cloudflare.com/account/workers/services/view/" +
      "demo-worker/production/domains";
    const output = renderToStaticMarkup(
      React.createElement(SiteCustomDomainDescription, {
        dashboardUrl,
        workerName: "demo-worker",
      }),
    );

    expect(output).toContain(`href="${dashboardUrl}"`);
    expect(output).toContain("Open the demo-worker domain settings");
    expect(output).toContain("yarn manage domain");
  });
});

describe("dashboard protection description", () => {
  it("describes built-in login without claiming Access", () => {
    const dashboardUrl =
      "https://dash.cloudflare.com/account/" +
      "one/access-controls/apps/self-hosted/add";
    const output = description({
      builtInLogin: true,
      cloudflareAccess: false,
      dashboardUrl,
    });

    expect(output).toContain(
      "protected by the built-in email and password login",
    );
    expect(output).toContain(
      "Cloudflare Zero Trust Access</a> was not detected on this request",
    );
    expect(output).toContain(`href="${dashboardUrl}"`);
  });

  it("describes Access without claiming built-in login", () => {
    const output = description({
      builtInLogin: false,
      cloudflareAccess: true,
    });

    expect(output).toContain(
      "Cloudflare Zero Trust Access authentication was detected on this request",
    );
    expect(output).toContain(
      "built-in email and password login is disabled",
    );
  });

  it("describes both protection layers", () => {
    const output = description({
      builtInLogin: true,
      cloudflareAccess: true,
    });

    expect(output).toContain(
      "protected by the built-in email and password login",
    );
    expect(output).toContain(
      "Cloudflare Zero Trust Access authentication was also detected on this request",
    );
  });

  it("warns when neither protection method is detected", () => {
    const output = description({
      builtInLogin: false,
      cloudflareAccess: false,
    });

    expect(output).toContain("No dashboard protection was detected");
    expect(output).toContain("may be able to change your content");
  });
});
