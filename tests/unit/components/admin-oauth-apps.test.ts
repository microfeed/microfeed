import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";

import OAuthAppsApp from "@/components/admin/api/OAuthAppsApp";
import OAuthConsentApp from "@/components/admin/api/OAuthConsentApp";

const client = {
  clientId: "client-id",
  createdAt: "2026-08-07T00:00:00.000Z",
  name: "Publishing tool",
  public: true,
  redirectUris: ["https://app.example/callback"],
  scopes: ["content:read", "content:write"],
};

describe("OAuth administration", () => {
  it("shows registered and authorized apps with immediate revocation controls", () => {
    const output = renderToStaticMarkup(React.createElement(OAuthAppsApp, {
      available: true,
      initialClients: [client],
      initialConsents: [{
        clientId: client.clientId,
        clientName: client.name,
        createdAt: "2026-08-07T00:00:00.000Z",
        id: "consent-id",
        scopes: client.scopes,
        updatedAt: "2026-08-07T00:00:00.000Z",
      }],
    }));
    expect(output).toContain("Registered OAuth apps");
    expect(output).toContain("Authorized applications");
    expect(output).toContain("Publishing tool");
    expect(output).toContain("Revoke access");
    expect(output).toContain("matched exactly");
  });

  it("warns explicitly that write consent includes deletion", () => {
    const output = renderToStaticMarkup(React.createElement(OAuthConsentApp, {
      client,
      instanceName: "My feed",
      instanceOrigin: "https://feed.example",
      requestedScopes: ["content:read", "content:write", "offline_access"],
    }));
    expect(output).toContain("Allow Publishing tool");
    expect(output).toContain("https://feed.example");
    expect(output).toContain("Write access includes permission to delete items");
    expect(output).toContain("Deny");
    expect(output).toContain("Allow");
  });

  it("explains why OAuth is unavailable without built-in login", () => {
    const output = renderToStaticMarkup(React.createElement(OAuthAppsApp, {
      available: false,
      initialClients: [],
      initialConsents: [],
    }));
    expect(output).toContain("requires the built-in administrator");
    expect(output).toContain("continue using API keys");
  });

  it("continues a signed OAuth request after administrator login", async () => {
    const source = await readFile(
      new URL("../../../src/components/admin/AdminLoginApp.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("safeOAuthRedirect(response?.url)");
    expect(source).toContain("candidate.origin === window.location.origin");
  });
});
