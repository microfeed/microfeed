import {env} from "cloudflare:workers";
import {hashPassword} from "better-auth/crypto";
import {beforeEach, describe, expect, it} from "vitest";

import {createMicrofeedAuth} from "@/server/auth/better-auth";

const ORIGIN = "https://feed.example.com";

async function seedOwner(): Promise<void> {
  const now = new Date().toISOString();
  const password = await hashPassword("correct horse battery staple");
  await env.FEED_DB.batch([
    env.FEED_DB.prepare('DELETE FROM "auth_rate_limit"'),
    env.FEED_DB.prepare('DELETE FROM "auth_session"'),
    env.FEED_DB.prepare('DELETE FROM "auth_account"'),
    env.FEED_DB.prepare('DELETE FROM "auth_user"'),
    env.FEED_DB.prepare(
      'INSERT INTO "auth_user" ' +
      '("id", "name", "email", "emailVerified", "createdAt", "updatedAt", "role") ' +
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "owner-id",
      "owner@example.com",
      "owner@example.com",
      1,
      now,
      now,
      "admin",
    ),
    env.FEED_DB.prepare(
      'INSERT INTO "auth_account" ' +
      '("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt") ' +
      "VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      "account-id",
      "owner-id",
      "credential",
      "owner-id",
      password,
      now,
      now,
    ),
  ]);
}

function authRequest(
  pathname: string,
  init: RequestInit = {},
): Request {
  return new Request(`${ORIGIN}${pathname}`, {
    ...init,
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      origin: ORIGIN,
      ...init.headers,
    },
  });
}

beforeEach(seedOwner);

describe("Better Auth on Workers with D1", () => {
  it("signs in, reads a revocable D1 session, and signs out", async () => {
    const signInRequest = authRequest("/api/auth/sign-in/email", {
      body: JSON.stringify({
        email: "owner@example.com",
        password: "correct horse battery staple",
      }),
      headers: {"content-type": "application/json"},
      method: "POST",
    });
    const signIn = await createMicrofeedAuth(
      env,
      signInRequest,
    ).handler(signInRequest);
    expect(signIn.status).toBe(200);
    const cookie = signIn.headers.get("set-cookie")?.split(";", 1)[0];
    expect(cookie).toContain("microfeed.session_token=");

    const sessionRequest = authRequest("/api/auth/get-session", {
      headers: {cookie: cookie!},
    });
    const session = await createMicrofeedAuth(
      env,
      sessionRequest,
    ).handler(sessionRequest);
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      user: {
        email: "owner@example.com",
        role: "admin",
      },
    });

    const signOutRequest = authRequest("/api/auth/sign-out", {
      body: "{}",
      headers: {
        "content-type": "application/json",
        cookie: cookie!,
      },
      method: "POST",
    });
    const signOut = await createMicrofeedAuth(
      env,
      signOutRequest,
    ).handler(signOutRequest);
    expect(signOut.status).toBe(200);

    const remaining = await env.FEED_DB.prepare(
      'SELECT COUNT(*) AS "count" FROM "auth_session"',
    ).first<{count: number}>();
    expect(remaining?.count).toBe(0);
  });

  it("rejects public signup and invalid credentials", async () => {
    const signUpRequest = authRequest("/api/auth/sign-up/email", {
      body: JSON.stringify({
        email: "someone@example.com",
        name: "Someone",
        password: "another private password",
      }),
      headers: {"content-type": "application/json"},
      method: "POST",
    });
    const signUp = await createMicrofeedAuth(
      env,
      signUpRequest,
    ).handler(signUpRequest);
    expect(signUp.ok).toBe(false);

    const signInRequest = authRequest("/api/auth/sign-in/email", {
      body: JSON.stringify({
        email: "owner@example.com",
        password: "not the right password",
      }),
      headers: {"content-type": "application/json"},
      method: "POST",
    });
    const signIn = await createMicrofeedAuth(
      env,
      signInRequest,
    ).handler(signInRequest);
    expect(signIn.ok).toBe(false);
    expect(await signIn.text()).not.toContain("owner@example.com");
  });
});
