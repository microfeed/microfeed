import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {
  AdminProtectionDescription,
} from "@/components/admin/home/AdminHomeApp/component/SetupChecklistApp";
import {ONBOARDING_TYPES} from "@/shared/Constants";
import {
  adminProtectionStatus,
  cloudflareAccessDetected,
} from "@/server/auth/admin-protection";
import OnboardingChecker from "@/server/feed/OnboardingUtils";
import type {AdminProtectionStatus} from "@/types";

const ACCESS_ASSERTION = "header.payload.signature";

function description(status: AdminProtectionStatus): string {
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

describe("dashboard protection description", () => {
  it("describes built-in login without claiming Access", () => {
    const output = description({
      builtInLogin: true,
      cloudflareAccess: false,
    });

    expect(output).toContain(
      "protected by the built-in email and password login",
    );
    expect(output).toContain(
      "Cloudflare Access was not detected on this request",
    );
  });

  it("describes Access without claiming built-in login", () => {
    const output = description({
      builtInLogin: false,
      cloudflareAccess: true,
    });

    expect(output).toContain(
      "Cloudflare Access authentication was detected on this request",
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
      "Cloudflare Access authentication was also detected on this request",
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
