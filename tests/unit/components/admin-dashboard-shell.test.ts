import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import {
  ADMIN_UPDATE_PROMPT,
  adminSourceCommitView,
  adminUpdatePrompt,
} from "@/components/admin/AdminAboutDialog";
import AdminMobileNavigation from "@/components/admin/AdminMobileNavigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import {
  adminAccountSettingsDestination,
  adminLogoutDestination,
  displayedAdminIdentities,
} from "@/components/admin/AdminUserMenu";
import {
  adminChannelSummary,
  type AdminSidebarData,
} from "@/components/admin/admin-shell-types";
import {NAV_ITEMS, OUR_BRAND} from "@/shared/Constants";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";

function sidebarData(): AdminSidebarData {
  return {
    channel: adminChannelSummary(null),
    deployment: {
      deployedAt: "2026-08-03T20:00:00.000Z",
      protected: true,
      sourceCommit: COMMIT,
    },
    items: [{
      active: true,
      disabled: false,
      id: NAV_ITEMS.ADMIN_HOME,
      name: "Home",
      url: "/admin/",
    }],
    newItem: {
      disabled: false,
      url: "/admin/items/new/",
    },
    publicLinks: {
      json: "https://feed.example.com/json/",
      rss: "https://feed.example.com/rss/",
      website: "https://feed.example.com/",
    },
  };
}

describe("admin dashboard shell models", () => {
  it("uses the channel fallback and preserves the two-line title treatment", () => {
    const data = sidebarData();
    expect(data.channel).toEqual({
      imageUrl: undefined,
      title: "Untitled channel",
    });

    const output = renderToStaticMarkup(
      React.createElement(AdminSidebar, {data}),
    );
    expect(output).toContain("Untitled channel");
    expect(output).toContain("line-clamp-2");
    expect(output).toContain("/assets/brands/microfeed/horizontal-logo.png");
    expect(output).toContain(
      "/assets/brands/microfeed/horizontal-logo-dark.png",
    );
    expect(output).toContain('alt="microfeed by Listen Notes"');
    expect(output).toContain(
      "gap-3 rounded-xl px-3 py-2 text-base font-medium",
    );
    expect(output).toContain("Add new item");
    expect(output).toContain('href="/admin/items/new/"');
  });

  it("opens public access from the channel button instead of a dropdown", () => {
    const output = renderToStaticMarkup(
      React.createElement(AdminSidebar, {data: sidebarData()}),
    );

    expect(output).toContain(
      'aria-label="Open public access links for Untitled channel"',
    );
    expect(output).toContain('data-slot="dialog-trigger"');
    expect(output).not.toContain('data-slot="dropdown-menu-trigger"');
  });

  it("provides an accessible mobile navigation trigger", () => {
    const output = renderToStaticMarkup(
      React.createElement(AdminMobileNavigation, {sidebar: sidebarData()}),
    );

    expect(output).toContain('aria-label="Open admin navigation"');
    expect(output).toContain("lg:hidden");
  });

  it("shows both authentication layers and routes logout through Access", () => {
    expect(displayedAdminIdentities({
      builtInEmail: "owner@example.com",
      cloudflareAccessDetected: true,
      cloudflareAccessEmail: "access@example.com",
    })).toEqual([
      {label: "Built-in login", value: "owner@example.com"},
      {label: "Cloudflare Access", value: "access@example.com"},
    ]);
    expect(adminLogoutDestination("admin", true)).toBe(
      "/cdn-cgi/access/logout",
    );
    expect(adminLogoutDestination("admin", false)).toBe("/admin/login/");
    expect(displayedAdminIdentities({
      cloudflareAccessDetected: false,
    })).toEqual([]);
  });

  it("builds the Account settings link from a custom admin path", () => {
    expect(adminAccountSettingsDestination("private-studio"))
      .toBe("/private-studio/account/");
    expect(displayedAdminIdentities({cloudflareAccessDetected: false}))
      .toHaveLength(0);
  });

  it("distinguishes authenticated, unprotected, and legacy deployment metadata", () => {
    expect(adminSourceCommitView({
      deployedAt: "2026-08-03T20:00:00.000Z",
      protected: true,
      sourceCommit: COMMIT,
    })).toEqual({kind: "commit", full: COMMIT, short: COMMIT.slice(0, 12)});
    expect(adminSourceCommitView({
      deployedAt: "2026-08-03T20:00:00.000Z",
      protected: false,
      sourceCommit: COMMIT,
    })).toEqual({kind: "authenticated-required"});
    expect(adminSourceCommitView({
      deployedAt: "2026-08-03T20:00:00.000Z",
      protected: true,
    })).toEqual({kind: "legacy"});
  });

  it("keeps About links and the agent update prompt exact", () => {
    expect(OUR_BRAND.whatsnewWebsite).toBe("https://www.microfeed.org");
    expect(OUR_BRAND.githubRepository).toBe(
      "https://github.com/microfeed/microfeed",
    );
    expect(ADMIN_UPDATE_PROMPT).toBe(
      "Update this microfeed site to the latest version and deploy it.",
    );
    expect(adminUpdatePrompt({
      deployedAt: "2026-08-03T20:00:00.000Z",
      productionWorkerName: "my-microfeed",
      protected: true,
    })).toBe([
      ADMIN_UPDATE_PROMPT,
      "First run `yarn manage connect --worker my-microfeed`. Use the existing or newly created local instance name reported by that command. Then run `yarn manage status --instance <instance-name>`, deploy with `yarn manage deploy --instance <instance-name>`, and run status again to verify it.",
      "Do not initialize a new site or target another Worker.",
    ].join("\n\n"));
    expect(adminUpdatePrompt({
      deployedAt: "2026-08-03T20:00:00.000Z",
      productionWorkerName: "my-microfeed",
      protected: false,
    })).toBe(ADMIN_UPDATE_PROMPT);
    expect(adminUpdatePrompt({
      deployedAt: "2026-08-03T20:00:00.000Z",
      protected: true,
    })).toBe(ADMIN_UPDATE_PROMPT);
    expect(adminUpdatePrompt({
      deployedAt: "2026-08-03T20:00:00.000Z",
      productionWorkerName: "worker; deploy-something-else",
      protected: true,
    })).toBe(ADMIN_UPDATE_PROMPT);
  });
});
