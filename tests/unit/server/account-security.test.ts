import {afterEach, describe, expect, it, vi} from "vitest";

import {
  createOAuthConnectionCookie,
  createPasskeyStepUpCookie,
  normalizeConnectionName,
  oauthConnectionHandoff,
  validConnectionId,
  validPasskeyStepUp,
} from "@/server/auth/account-security";

const SECRET = "test-secret-that-is-long-enough-for-hmac";
const CONNECTION_ID = "86fe12c4-35a2-4f90-8b44-f14740c14551";

function requestWithCookie(cookie: string): Request {
  return new Request("https://feed.example/api/auth/oauth2/consent", {
    headers: {cookie: cookie.split(";", 1)[0]!},
  });
}

afterEach(() => vi.useRealTimers());

describe("account security handoffs", () => {
  it("validates connection vocabulary without accepting control characters", () => {
    expect(validConnectionId(CONNECTION_ID)).toBe(true);
    expect(validConnectionId("computer-one")).toBe(false);
    expect(normalizeConnectionName(" Home Mac ")).toBe("Home Mac");
    expect(normalizeConnectionName("Work\nLaptop")).toBeNull();
    expect(normalizeConnectionName("x".repeat(65))).toBeNull();
  });

  it("rejects tampered and expired OAuth connection cookies", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00Z"));
    const cookie = await createOAuthConnectionCookie(
      new Request("https://feed.example/api/auth/oauth2/authorize"),
      SECRET,
      {connectionId: CONNECTION_ID, connectionName: "Home Mac"},
    );
    await expect(oauthConnectionHandoff(
      requestWithCookie(cookie),
      SECRET,
    )).resolves.toEqual({
      connectionId: CONNECTION_ID,
      connectionName: "Home Mac",
    });

    const tampered = cookie.replace("microfeed.oauth_connection=", "microfeed.oauth_connection=x");
    await expect(oauthConnectionHandoff(
      requestWithCookie(tampered),
      SECRET,
    )).resolves.toBeNull();

    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    await expect(oauthConnectionHandoff(
      requestWithCookie(cookie),
      SECRET,
    )).resolves.toBeNull();
  });

  it("binds a five-minute passkey proof to the owner, action, and credential", async () => {
    const source = new Request("https://feed.example/admin/ajax/account/passkeys/reauth");
    const cookie = await createPasskeyStepUpCookie(source, SECRET, {
      action: "delete",
      passkeyId: "passkey-one",
      userId: "owner-one",
    });
    const request = new Request("https://feed.example/api/auth/passkey/delete-passkey", {
      headers: {cookie: cookie.split(";", 1)[0]!},
    });
    await expect(validPasskeyStepUp(request, SECRET, {
      action: "delete",
      passkeyId: "passkey-one",
      userId: "owner-one",
    })).resolves.toBe(true);
    await expect(validPasskeyStepUp(request, SECRET, {
      action: "add",
      userId: "owner-one",
    })).resolves.toBe(false);
    await expect(validPasskeyStepUp(request, SECRET, {
      action: "delete",
      passkeyId: "passkey-two",
      userId: "owner-one",
    })).resolves.toBe(false);
  });
});
