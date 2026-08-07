import {createServer} from "node:http";

import {afterEach, describe, expect, it, vi} from "vitest";

import {
  authorizationRequestUrl,
  refreshTokens,
  revokeToken,
  startOAuthCallback,
} from "../../../packages/cli/src/oauth";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(servers.splice(0).map((server) =>
    new Promise<void>((resolve) => server.close(() => resolve()))
  ));
});

describe("CLI OAuth requests", () => {
  it("always asks for consent with a stable per-computer connection", () => {
    const url = authorizationRequestUrl({
      authorization_endpoint: "https://feed.example/api/auth/oauth2/authorize",
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      issuer: "https://feed.example/api/auth",
      token_endpoint: "https://feed.example/api/auth/oauth2/token",
    }, {
      id: "86fe12c4-35a2-4f90-8b44-f14740c14551",
      name: "Home Mac",
    }, "state-value", "challenge-value");

    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("microfeed_connection_id"))
      .toBe("86fe12c4-35a2-4f90-8b44-f14740c14551");
    expect(url.searchParams.get("microfeed_connection_name")).toBe("Home Mac");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("sends the verified site origin for token exchange and refresh", async () => {
    const fetchMock = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      expect(String(input)).toBe("https://feed.example/api/auth/oauth2/token");
      const headers = new Headers(init?.headers);
      expect(headers.get("origin")).toBe("https://feed.example");
      expect(headers.get("content-type")).toBe(
        "application/x-www-form-urlencoded",
      );
      return Response.json({
        access_token: "mf_oat_access",
        expires_in: 3600,
        refresh_token: "mf_ort_refresh",
        scope: "content:read content:write offline_access",
        token_type: "Bearer",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshTokens(
      "https://feed.example/api/auth/oauth2/token",
      "mf_ort_existing",
    )).resolves.toMatchObject({
      accessToken: "mf_oat_access",
      refreshToken: "mf_ort_refresh",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends the verified site origin when revoking a token", async () => {
    const fetchMock = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      expect(String(input)).toBe("https://feed.example/api/auth/oauth2/revoke");
      expect(new Headers(init?.headers).get("origin")).toBe(
        "https://feed.example",
      );
      return new Response(null, {status: 200});
    });
    vi.stubGlobal("fetch", fetchMock);

    await revokeToken(
      "https://feed.example/api/auth",
      "mf_ort_refresh",
      "refresh_token",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("CLI OAuth callback", () => {
  it("rejects a callback whose state does not match", async () => {
    const callback = await startOAuthCallback("expected-state");
    const rejection = callback.code.then(
      () => null,
      (error: unknown) => error,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    const response = await fetch(
      "http://127.0.0.1:8977/callback?state=wrong-state&code=authorization-code",
    );

    expect(response.status).toBe(400);
    expect(await rejection).toMatchObject({
      message: "Browser authorization state validation failed.",
    });
  });

  it("reports an unavailable fixed callback port without opening a browser", async () => {
    const blocker = createServer();
    servers.push(blocker);
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(8977, "127.0.0.1", () => resolve());
    });

    await expect(startOAuthCallback("expected-state"))
      .rejects.toThrow("Callback port 8977 is already in use");
  });
});
