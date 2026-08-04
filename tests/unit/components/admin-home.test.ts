import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, describe, expect, it, vi} from "vitest";

import AdminHomeApp from "@/components/admin/home/AdminHomeApp";
import {ONBOARDING_TYPES} from "@/shared/Constants";
import type {OnboardingCheck, OnboardingResult} from "@/types";

function onboardingResult(complete: boolean): OnboardingResult {
  const check = (ready: boolean): OnboardingCheck => ({
    ready,
    required: false,
  });

  return {
    allOk: complete,
    requiredOk: true,
    result: {
      [ONBOARDING_TYPES.CUSTOM_DOMAIN]: check(complete),
      [ONBOARDING_TYPES.MEDIA_STORAGE]: {
        ...check(true),
        mediaStorageState: "ready",
      },
      [ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD]: {
        ...check(complete),
        adminProtection: {
          builtInLogin: complete,
          cloudflareAccess: false,
        },
      },
      [ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL]: check(complete),
    },
  };
}

function renderHome(complete: boolean): string {
  vi.stubGlobal("window", {
    location: {
      hostname: "feed.example.com",
      port: "",
      protocol: "https:",
    },
  });

  return renderToStaticMarkup(
    React.createElement(AdminHomeApp, {
      feedContent: {},
      onboardingResult: onboardingResult(complete),
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("admin home section order", () => {
  it("shows the setup checklist first while tasks remain", () => {
    const output = renderHome(false);

    expect(output.indexOf(">Setup checklist</div>")).toBeLessThan(
      output.indexOf(">Public access</h2>"),
    );
  });

  it("moves the completed setup checklist below Public access", () => {
    const output = renderHome(true);

    expect(output.indexOf(">Public access</h2>")).toBeLessThan(
      output.indexOf(">Setup checklist</div>"),
    );
  });
});
