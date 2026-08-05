import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, describe, expect, it, vi} from "vitest";

import AdminSettingsSidebar from "@/components/admin/settings/AdminSettingsSidebar";

const deployment = {
  deployedAt: "2026-08-04T12:00:00.000Z",
  protected: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin settings sidebar", () => {
  it("renders the back fallback, search, and anchored section navigation", () => {
    const output = renderToStaticMarkup(
      React.createElement(AdminSettingsSidebar, {
        data: {
          backUrl: "/admin/",
          deployment,
          sectionsUrl: "/admin/settings/",
        },
      }),
    );

    expect(output).toContain('aria-label="Go to Home"');
    expect(output).toContain('href="/admin/"');
    expect(output).toContain("Home");
    expect(output).not.toContain("history.back");
    expect(output).toContain('placeholder="Search settings..."');
    expect(output).toContain('href="/admin/settings/#tracking-urls"');
    expect(output).toContain('href="/admin/settings/#access-control"');
    expect(output).toContain('href="/admin/settings/#subscribe-methods"');
    expect(output).toContain('href="/admin/settings/#media-file-storage"');
    expect(output).toContain("Media file storage");
    expect(output).toContain('href="/admin/settings/#items-settings"');
    expect(output).toContain("Items settings");
    expect(output).toContain('href="/admin/settings/#favicon"');
    expect(output).toContain("Favicon");
    expect(output).not.toContain("Global settings");
    expect(output).toContain('href="/admin/settings/#custom-code"');
    expect(output).toContain("/assets/brands/microfeed/horizontal-logo.png");
    expect(output).toContain(
      "/assets/brands/microfeed/horizontal-logo-dark.png",
    );
  });

  it("keeps Custom code active on nested editor routes", () => {
    const output = renderToStaticMarkup(
      React.createElement(AdminSettingsSidebar, {
        data: {
          activeSection: "custom-code",
          backUrl: "/admin/",
          deployment,
          sectionsUrl: "/admin/settings/",
        },
      }),
    );

    expect(output).toContain(
      'aria-current="location" class="relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-base font-medium outline-none transition-colors bg-sidebar-accent',
    );
    expect(output).toContain('href="/admin/settings/#custom-code"');
  });

  it("keeps the server and first client render deterministic with a hash", () => {
    vi.stubGlobal("window", {location: {hash: "#favicon"}});
    const output = renderToStaticMarkup(
      React.createElement(AdminSettingsSidebar, {
        data: {
          backUrl: "/admin/",
          deployment,
          sectionsUrl: "/admin/settings/",
        },
      }),
    );
    const trackingLink = output.match(
      /<a[^>]*href="\/admin\/settings\/#tracking-urls"[^>]*>/u,
    )?.[0];
    const faviconLink = output.match(
      /<a[^>]*href="\/admin\/settings\/#favicon"[^>]*>/u,
    )?.[0];

    expect(trackingLink).toContain('aria-current="location"');
    expect(faviconLink).not.toContain('aria-current="location"');
  });
});
