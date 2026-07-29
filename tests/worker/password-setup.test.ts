import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";

import {createMicrofeedAuth} from "@/server/auth/better-auth";
import {handleAdminBootstrap} from "@/server/auth/bootstrap";
import {
  completeAdminPasswordSetup,
  currentAdminPasswordSetup,
  handleAdminPasswordSetupEntry,
} from "@/server/auth/password-setup";

const ORIGIN = "https://feed.example.com";
const EMAIL = "owner@example.com";
const OLD_PASSWORD = "the original secure password";
const NEW_PASSWORD = "a newly selected secure password";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function clearAuth(): Promise<void> {
  await env.FEED_DB.batch([
    env.FEED_DB.prepare('DELETE FROM "auth_password_setup"'),
    env.FEED_DB.prepare('DELETE FROM "auth_rate_limit"'),
    env.FEED_DB.prepare('DELETE FROM "auth_session"'),
    env.FEED_DB.prepare('DELETE FROM "auth_account"'),
    env.FEED_DB.prepare('DELETE FROM "auth_user"'),
  ]);
}

async function createOwner(): Promise<string> {
  await handleAdminBootstrap(
    {
      FEED_DB: env.FEED_DB,
      MICROFEED_SETUP_ADMIN_EMAIL: EMAIL,
      MICROFEED_SETUP_ADMIN_PASSWORD: OLD_PASSWORD,
      MICROFEED_SETUP_ADMIN_PASSWORD_CONFIRMATION: OLD_PASSWORD,
    },
    new Request(`${ORIGIN}/.well-known/microfeed/bootstrap-admin/`, {
      method: "POST",
    }),
  );
  const owner = await env.FEED_DB.prepare(
    'SELECT "id" FROM "auth_user" WHERE "email" = ?',
  ).bind(EMAIL).first<{id: string}>();
  return owner!.id;
}

async function issueSetup(
  token: string,
  purpose: "initial" | "reset" = "initial",
  userId: string | null = null,
  expiresAt = new Date(Date.now() + 30 * 60 * 1_000).toISOString(),
): Promise<void> {
  await env.FEED_DB.prepare(
    'INSERT INTO "auth_password_setup" ' +
      '("id", "purpose", "email", "userId", "tokenHash", "createdAt", ' +
      '"expiresAt") VALUES (?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT("id") DO UPDATE SET "purpose" = excluded."purpose", ' +
      '"email" = excluded."email", "userId" = excluded."userId", ' +
      '"tokenHash" = excluded."tokenHash", ' +
      '"createdAt" = excluded."createdAt", ' +
      '"expiresAt" = excluded."expiresAt"',
  ).bind(
    "owner",
    purpose,
    EMAIL,
    userId,
    await sha256Hex(token),
    new Date().toISOString(),
    expiresAt,
  ).run();
}

async function enter(token: string): Promise<string> {
  const response = await handleAdminPasswordSetupEntry(
    env.FEED_DB,
    new Request(`${ORIGIN}/admin/login/${token}/set_password/`),
    "admin",
    token,
  );
  expect(response.status).toBe(303);
  return response.headers.get("set-cookie")!;
}

function completionRequest(
  cookie: string,
  password = NEW_PASSWORD,
  origin = ORIGIN,
): Request {
  return new Request(`${ORIGIN}/admin/login/set_password/complete/`, {
    body: JSON.stringify({
      password,
      passwordConfirmation: password,
    }),
    headers: {
      cookie,
      "content-type": "application/json",
      origin,
    },
    method: "POST",
  });
}

async function signIn(password: string): Promise<Response> {
  const request = new Request(`${ORIGIN}/api/auth/sign-in/email`, {
    body: JSON.stringify({email: EMAIL, password}),
    headers: {
      "cf-connecting-ip": "203.0.113.15",
      "content-type": "application/json",
      origin: ORIGIN,
    },
    method: "POST",
  });
  return createMicrofeedAuth(env, request).handler(request);
}

beforeEach(clearAuth);

describe("browser-based admin password setup", () => {
  it("exchanges a valid secret URL for a protected clean-page cookie", async () => {
    const token = "a".repeat(64);
    await issueSetup(token);
    const stored = await env.FEED_DB.prepare(
      'SELECT "tokenHash" FROM "auth_password_setup" WHERE "id" = ?',
    ).bind("owner").first<{tokenHash: string}>();
    expect(stored?.tokenHash).toBe(await sha256Hex(token));
    expect(stored?.tokenHash).not.toBe(token);

    const malformed = await handleAdminPasswordSetupEntry(
      env.FEED_DB,
      new Request(`${ORIGIN}/admin/login/not-a-token/set_password/`),
      "admin",
      "not-a-token",
    );
    expect(malformed.status).toBe(404);

    const response = await handleAdminPasswordSetupEntry(
      env.FEED_DB,
      new Request(`${ORIGIN}/admin/login/${token}/set_password/`),
      "admin",
      token,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/admin/login/set_password/",
    );
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    await expect(currentAdminPasswordSetup(
      env.FEED_DB,
      new Request(`${ORIGIN}/admin/login/set_password/`, {
        headers: {cookie: response.headers.get("set-cookie")!},
      }),
    )).resolves.toMatchObject({email: EMAIL, purpose: "initial"});
  });

  it("creates the owner once and stores neither the link token nor password", async () => {
    const token = "b".repeat(64);
    await issueSetup(token);
    const cookie = await enter(token);

    const forbidden = await completeAdminPasswordSetup(
      env.FEED_DB,
      completionRequest(cookie, NEW_PASSWORD, "https://attacker.example"),
      "admin",
    );
    expect(forbidden.status).toBe(403);

    const response = await completeAdminPasswordSetup(
      env.FEED_DB,
      completionRequest(cookie),
      "admin",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      email: EMAIL,
      status: "created",
    });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");

    const account = await env.FEED_DB.prepare(
      'SELECT "password" FROM "auth_account"',
    ).first<{password: string}>();
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain(NEW_PASSWORD);
    const setup = await env.FEED_DB.prepare(
      'SELECT "tokenHash" FROM "auth_password_setup"',
    ).first<{tokenHash: string}>();
    expect(setup).toBeNull();
    expect(await signIn(NEW_PASSWORD)).toHaveProperty("status", 200);

    const reused = await completeAdminPasswordSetup(
      env.FEED_DB,
      completionRequest(cookie),
      "admin",
    );
    expect(reused.status).toBe(410);
  });

  it("replaces and expires links without exposing another dashboard route", async () => {
    const oldToken = "c".repeat(64);
    const newToken = "d".repeat(64);
    await issueSetup(oldToken);
    await issueSetup(newToken);

    const replaced = await handleAdminPasswordSetupEntry(
      env.FEED_DB,
      new Request(`${ORIGIN}/admin/login/${oldToken}/set_password/`),
      "admin",
      oldToken,
    );
    expect(replaced.status).toBe(410);

    await issueSetup(
      newToken,
      "initial",
      null,
      new Date(Date.now() - 1_000).toISOString(),
    );
    const expired = await handleAdminPasswordSetupEntry(
      env.FEED_DB,
      new Request(`${ORIGIN}/admin/login/${newToken}/set_password/`),
      "admin",
      newToken,
    );
    expect(expired.status).toBe(410);
    expect(await expired.text()).toContain("yarn manage auth setup");
  });

  it("atomically resets the password, revokes sessions, and consumes one concurrent use", async () => {
    const ownerId = await createOwner();
    const firstSignIn = await signIn(OLD_PASSWORD);
    expect(firstSignIn.status).toBe(200);
    const sessionBefore = await env.FEED_DB.prepare(
      'SELECT COUNT(*) AS "count" FROM "auth_session"',
    ).first<{count: number}>();
    expect(sessionBefore?.count).toBe(1);

    const token = "e".repeat(64);
    await issueSetup(token, "reset", ownerId);
    const cookie = await enter(token);
    const responses = await Promise.all([
      completeAdminPasswordSetup(
        env.FEED_DB,
        completionRequest(cookie),
        "admin",
      ),
      completeAdminPasswordSetup(
        env.FEED_DB,
        completionRequest(cookie),
        "admin",
      ),
    ]);
    expect(responses.map(({status}) => status).sort()).toEqual([200, 410]);

    const sessionsAfter = await env.FEED_DB.prepare(
      'SELECT COUNT(*) AS "count" FROM "auth_session"',
    ).first<{count: number}>();
    expect(sessionsAfter?.count).toBe(0);
    expect((await signIn(OLD_PASSWORD)).status).toBe(401);
    expect((await signIn(NEW_PASSWORD)).status).toBe(200);
  });
});
