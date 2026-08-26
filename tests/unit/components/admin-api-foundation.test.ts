import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import ApiAuthenticationApp, {
  shouldShowApiAccessControls,
} from "@/components/admin/api/ApiAuthenticationApp";
import ApiOverviewApp from "@/components/admin/api/ApiOverviewApp";
import ApiSettingsApp from "@/components/admin/api/ApiSettingsApp";
import AdminApiSidebar from "@/components/admin/api/AdminApiSidebar";
import {
  buildApiExampleCode,
  highlightApiExampleCode,
} from "@/components/admin/api/ApiTryIt";
import {type ApiKeyRecord, updateApiAccessEnabled} from "@/shared/Api";

const deployment = {
  deployedAt: "2026-08-05T12:00:00.000Z",
  protected: true,
};

const apiKey: ApiKeyRecord = {
  apiKey: "mf_abcdefghijklmnopqrstuvwxyz",
  createdAtMs: 1_725_000_000_000,
  id: "api-key-1",
  name: "Publishing",
  scopes: ["content:read", "content:write"],
  updatedAtMs: 1_725_000_000_000,
};

describe("API admin pages", () => {
  it("shows API availability controls only when API access is disabled", () => {
    expect(shouldShowApiAccessControls({
      enabled: false,
      publicDocsEnabled: false,
    })).toBe(true);
    expect(shouldShowApiAccessControls({
      enabled: true,
      publicDocsEnabled: false,
    })).toBe(false);
    expect(updateApiAccessEnabled({
      enabled: true,
      publicDocsEnabled: true,
    }, false)).toEqual({
      enabled: false,
      publicDocsEnabled: false,
    });
    expect(updateApiAccessEnabled({
      enabled: false,
      publicDocsEnabled: false,
    }, true)).toEqual({
      enabled: true,
      publicDocsEnabled: false,
    });
  });

  it("renders explicit four-page API navigation", () => {
    const output = renderToStaticMarkup(React.createElement(AdminApiSidebar, {
      data: {
        activePage: "authentication",
        backUrl: "/admin/",
        deployment,
        pageUrls: {
          authentication: "/admin/api/auth/",
          explorer: "/admin/api/explorer/",
          overview: "/admin/api/",
          settings: "/admin/api/settings/",
        },
      },
    }));
    expect(output).toContain("API Overview");
    expect(output).toContain("API Authentication");
    expect(output).toContain("API Explorer");
    expect(output).toContain("API Settings");
    expect(output).toContain('href="/admin/"');
    expect(output).toContain('aria-current="page"');
  });

  it("renders overview status and gates the AI-agent prompt", () => {
    const output = renderToStaticMarkup(React.createElement(ApiOverviewApp, {
      apiKeys: [],
      authenticationUrl: "/admin/api/auth/",
      explorerUrl: "/admin/api/explorer/",
      llmsFullUrl: "https://feed.example.com/api/v1/llms-full.txt",
      settings: {enabled: false, publicDocsEnabled: false},
      settingsUrl: "/admin/api/settings/",
    }));
    expect(output).toContain("Active API keys");
    expect(output).toContain("!text-primary-foreground");
    expect(output).toContain(
      "Read https://feed.example.com/api/v1/llms-full.txt",
    );
    expect(output).toContain("Enable API access and publish API docs");
    expect(output).toContain("OpenAPI JSON");
    expect(output).toContain("llms-full.txt");
    expect(output.toLowerCase()).not.toContain("reference");
    expect(output).toContain("lg:grid-cols-2");
    expect(output).toContain('aria-label="Copy this prompt"');
    expect(output).toContain("absolute right-3 bottom-3");
    expect(output).not.toContain(">Copy prompt<");
  });

  it("prefills Bearer examples from a selected API key", () => {
    const code = buildApiExampleCode(
      "https://feed.example.com/api/v1/feed/?limit=3",
      apiKey.apiKey,
    );
    expect(code.javascript).toContain(`Bearer ${apiKey.apiKey}`);
    expect(code.javascript).toContain("await fetch");
    expect(code.curl).toContain(`Bearer ${apiKey.apiKey}`);
    expect(highlightApiExampleCode(code.javascript, "javascript"))
      .toContainEqual({kind: "keyword", value: "await"});
    expect(highlightApiExampleCode(code.curl, "curl"))
      .toContainEqual({kind: "command", value: "curl"});

    const output = renderToStaticMarkup(React.createElement(ApiOverviewApp, {
      apiKeys: [apiKey],
      authenticationUrl: "/admin/api/auth/",
      explorerUrl: "/admin/api/explorer/",
      llmsFullUrl: "https://feed.example.com/api/v1/llms-full.txt",
      settings: {enabled: true, publicDocsEnabled: true},
      settingsUrl: "/admin/api/settings/",
    }));
    expect(output).toContain("API key for this example");
    expect(output).toContain(`Bearer ${apiKey.apiKey}`);
    expect(output).toContain("JavaScript");
    expect(output).toContain("cURL");
    expect(output).toContain("Try it now");
    expect(output).toContain("pb-[50vh]");
    expect(output.match(/gap-3 border-b p-5/g)).toHaveLength(3);
    expect(output).toContain('data-syntax="keyword"');
    expect(output).toContain(">Run<");
  });

  it("renders multiple named API keys and immediate availability switches", () => {
    const authentication = renderToStaticMarkup(React.createElement(
      ApiAuthenticationApp,
      {
        initialApiKeys: [apiKey],
        initialSettings: {enabled: true, publicDocsEnabled: false},
      },
    ));
    expect(authentication).toContain("Publishing");
    expect(authentication).toContain("Create API key");
    expect(authentication).toContain("Rotate");
    expect(authentication).toContain("Revoke");
    expect(authentication).not.toContain(apiKey.apiKey);

    const settings = renderToStaticMarkup(React.createElement(ApiSettingsApp, {
      initialSettings: {enabled: true, publicDocsEnabled: false},
    }));
    expect(settings).toContain("Enable API access");
    expect(settings).toContain("Publish API docs");
    expect(settings).toContain("Control integration access and public API docs.");
    expect(settings.indexOf('data-slot="card-description"'))
      .toBeLessThan(settings.indexOf('data-slot="card-content"'));
    expect(settings).toContain("ml-4 divide-y border-l-2");
    expect(settings.toLowerCase()).not.toContain("reference");
    expect(settings).toContain("OpenAPI YAML");
    expect(settings).toContain("llms.txt");
    expect(settings).toContain("/api/v1/*");
    expect(settings).toContain("gap-3 border-b p-5");
    expect(settings).toContain("gap-0 py-0");
    expect(settings).not.toContain(">Update<");
  });
});
