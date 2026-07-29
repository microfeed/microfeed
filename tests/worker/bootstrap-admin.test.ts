import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";

import {createMicrofeedAuth} from "@/server/auth/better-auth";
import {handleAdminBootstrap} from "@/server/auth/bootstrap";

const ORIGIN = "https://feed.example.com";
const PASSWORD = "correct horse battery staple";

function bootstrapRequest(
  method = "POST",
  body?: string,
): Request {
  return new Request(
    `${ORIGIN}/.well-known/microfeed/bootstrap-admin/`,
    {body, method},
  );
}

function bootstrapEnv(
  overrides: Partial<{
    email: string;
    password: string;
    passwordConfirmation: string;
  }> = {},
) {
  return {
    FEED_DB: env.FEED_DB,
    MICROFEED_SETUP_ADMIN_EMAIL: overrides.email ?? " Admin@Example.com ",
    MICROFEED_SETUP_ADMIN_PASSWORD: overrides.password ?? PASSWORD,
    MICROFEED_SETUP_ADMIN_PASSWORD_CONFIRMATION:
      overrides.passwordConfirmation ?? PASSWORD,
  };
}

async function clearAuth(): Promise<void> {
  await env.FEED_DB.batch([
    env.FEED_DB.prepare('DELETE FROM "auth_rate_limit"'),
    env.FEED_DB.prepare('DELETE FROM "auth_session"'),
    env.FEED_DB.prepare('DELETE FROM "auth_account"'),
    env.FEED_DB.prepare('DELETE FROM "auth_user"'),
  ]);
}

beforeEach(clearAuth);

describe("Deploy to Cloudflare admin bootstrap", () => {
  it("is POST-only and disappears when setup bindings are absent", async () => {
    const getResponse = await handleAdminBootstrap(
      bootstrapEnv(),
      bootstrapRequest("GET"),
    );
    expect(getResponse.status).toBe(404);

    const unavailable = await handleAdminBootstrap(
      {FEED_DB: env.FEED_DB},
      bootstrapRequest(),
    );
    expect(unavailable.status).toBe(404);
    expect(await unavailable.text()).toBe("404");
  });

  it("returns one generic error for invalid setup values", async () => {
    const response = await handleAdminBootstrap(
      bootstrapEnv({passwordConfirmation: "not the configured password"}),
      bootstrapRequest("POST", JSON.stringify({
        email: "attacker@example.com",
        password: "request bodies are ignored",
      })),
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toBe('{"error":"Admin login could not be initialized."}');
    expect(body).not.toContain("admin@example.com");
    expect(body).not.toContain(PASSWORD);
  });

  it("creates a Better Auth administrator and stores only the hash", async () => {
    const response = await handleAdminBootstrap(
      bootstrapEnv(),
      bootstrapRequest(),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({status: "created"});

    const user = await env.FEED_DB.prepare(
      'SELECT "email", "role" FROM "auth_user"',
    ).first<{email: string; role: string}>();
    const account = await env.FEED_DB.prepare(
      'SELECT "password" FROM "auth_account"',
    ).first<{password: string}>();
    expect(user).toEqual({
      email: "admin@example.com",
      role: "admin",
    });
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toBe(PASSWORD);

    const signInRequest = new Request(
      `${ORIGIN}/api/auth/sign-in/email`,
      {
        body: JSON.stringify({
          email: "admin@example.com",
          password: PASSWORD,
        }),
        headers: {
          "cf-connecting-ip": "203.0.113.10",
          "content-type": "application/json",
          origin: ORIGIN,
        },
        method: "POST",
      },
    );
    const signIn = await createMicrofeedAuth(
      env,
      signInRequest,
    ).handler(signInRequest);
    expect(signIn.status).toBe(200);
  });

  it("never overwrites an existing administrator", async () => {
    await handleAdminBootstrap(bootstrapEnv(), bootstrapRequest());
    const response = await handleAdminBootstrap(
      bootstrapEnv({
        email: "replacement@example.com",
        password: "replacement secure password",
        passwordConfirmation: "replacement secure password",
      }),
      bootstrapRequest(),
    );
    await expect(response.json()).resolves.toEqual({
      status: "already_initialized",
    });

    const users = await env.FEED_DB.prepare(
      'SELECT "email" FROM "auth_user"',
    ).all<{email: string}>();
    expect(users.results).toEqual([{email: "admin@example.com"}]);
  });

  it("handles concurrent bootstrap requests idempotently", async () => {
    const responses = await Promise.all([
      handleAdminBootstrap(bootstrapEnv(), bootstrapRequest()),
      handleAdminBootstrap(bootstrapEnv(), bootstrapRequest()),
    ]);
    const statuses = await Promise.all(
      responses.map(async (response) =>
        (await response.json() as {status: string}).status
      ),
    );
    expect(statuses).toContain("created");
    expect(statuses.every((status) =>
      status === "created" || status === "already_initialized"
    )).toBe(true);

    const count = await env.FEED_DB.prepare(
      'SELECT COUNT(*) AS "count" FROM "auth_user"',
    ).first<{count: number}>();
    expect(count?.count).toBe(1);
  });
});
