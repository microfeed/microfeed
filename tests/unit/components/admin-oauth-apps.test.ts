import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";

import AccountSettingsApp from "@/components/admin/account/AccountSettingsApp";
import OAuthConsentApp from "@/components/admin/api/OAuthConsentApp";

const client = {
  clientId: "client-id",
  createdAt: "2026-08-07T00:00:00.000Z",
  name: "Publishing tool",
  public: true,
  redirectUris: ["https://app.example/callback"],
  scopes: ["content:read", "content:write"],
};

describe("App access", () => {
  it("groups CLI computers and keeps suspended connections revocable", () => {
    const output = renderToStaticMarkup(React.createElement(AccountSettingsApp, {
      apiEnabled: false,
      applications: [{
        clientId: "microfeed-cli",
        name: "microfeed CLI",
        connections: [
          {
            active: true,
            connectedAt: "2026-08-07T00:00:00.000Z",
            id: "home-id",
            lastUsedAt: "2026-08-07T01:00:00.000Z",
            legacy: false,
            name: "Home Mac",
            scopes: ["content:read", "content:write"],
            updatedAt: "2026-08-07T00:00:00.000Z",
          },
          {
            active: false,
            connectedAt: "2026-08-03T00:00:00.000Z",
            id: "work-id",
            lastUsedAt: "2026-08-06T01:00:00.000Z",
            legacy: false,
            name: "Work laptop",
            scopes: ["content:read"],
            updatedAt: "2026-08-06T00:00:00.000Z",
          },
        ],
      }],
      builtInEmail: "owner@example.com",
      cloudflareAccessDetected: false,
      hostname: "feed.example.com",
      passkeys: [],
      sessions: [],
    }));
    expect(output).toContain("App access");
    expect(output).toContain("microfeed CLI");
    expect(output).toContain("Home Mac");
    expect(output).toContain("Work laptop");
    expect(output).toContain("Suspended");
    expect(output).toContain("Inactive");
    expect(output).toContain("Revoke all connections");
    expect(output).toContain("Built-in login");
    expect(output).toContain("owner@example.com");
    expect(output).toContain("Change password");
    expect(output).toContain("Change email");
    expect(output).not.toContain('id="account-current-password"');
    expect(output).not.toContain('id="account-new-email"');
    expect(output).not.toContain("Registered OAuth apps");
  });

  it("warns explicitly that write consent includes deletion", () => {
    const output = renderToStaticMarkup(React.createElement(OAuthConsentApp, {
      client,
      connectionName: "Home Mac",
      instanceName: "My feed",
      instanceOrigin: "https://feed.example",
      requestedScopes: ["content:read", "content:write", "offline_access"],
    }));
    expect(output).toContain("Allow Publishing tool");
    expect(output).toContain("https://feed.example");
    expect(output).toContain("Write access includes permission to delete items");
    expect(output).toContain("Home Mac");
    expect(output).toContain("Account settings");
    expect(output).toContain("Deny");
    expect(output).toContain("Allow");
  });

  it("separates Cloudflare Access identity from built-in controls", () => {
    const output = renderToStaticMarkup(React.createElement(AccountSettingsApp, {
      apiEnabled: true,
      applications: [],
      cloudflareAccessDetected: true,
      cloudflareAccessEmail: "owner@example.com",
      hostname: "feed.example.com",
      passkeys: [],
      sessions: [],
    }));
    expect(output).toContain("Cloudflare Access");
    expect(output).toContain("managed externally");
    expect(output).not.toContain("Change password");
  });

  it("continues a signed application request after administrator login", async () => {
    const source = await readFile(
      new URL("../../../src/components/admin/AdminLoginApp.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("safeAuthorizationRedirect(response?.url)");
    expect(source).toContain("candidate.origin === window.location.origin");
  });
});
