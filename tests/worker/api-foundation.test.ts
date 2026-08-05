import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";

import {decideApiRequest, providedApiKey} from "@/server/api/access";
import {legacyApiReferenceRedirect} from "@/server/api/reference";
import {
  ApiKeyNameConflictError,
  apiKeyExists,
  createApiKey,
  listApiKeys,
  readApiAccessSettings,
  renameApiKey,
  revokeApiKey,
  rotateApiKey,
  updateApiAccessSettings,
} from "@/server/api/api-keys";

const ORIGIN = "https://feed.example.com";

beforeEach(async () => {
  await env.FEED_DB.batch([
    env.FEED_DB.prepare("DELETE FROM api_keys"),
    env.FEED_DB.prepare(
      "DELETE FROM settings WHERE category = 'apiSettings'",
    ),
  ]);
});

function request(
  pathname: string,
  headers: HeadersInit = {},
): Request {
  return new Request(`${ORIGIN}${pathname}`, {headers});
}

describe("table-only API keys", () => {
  it("creates, lists, renames, rotates, and revokes multiple API keys", async () => {
    const first = await createApiKey(env.FEED_DB, {name: "Publishing"});
    const second = await createApiKey(env.FEED_DB, {name: "Analytics"});
    expect(first.apiKey).toMatch(/^mf_[a-f0-9]{64}$/u);
    expect(second.apiKey).not.toBe(first.apiKey);
    expect((await listApiKeys(env.FEED_DB)).map(({name}) => name).sort())
      .toEqual(["Analytics", "Publishing"]);

    await expect(createApiKey(env.FEED_DB, {name: "publishing"}))
      .rejects.toBeInstanceOf(ApiKeyNameConflictError);
    const renamed = await renameApiKey(env.FEED_DB, first.id, "Website");
    expect(renamed?.name).toBe("Website");

    const rotated = await rotateApiKey(env.FEED_DB, first.id);
    expect(rotated?.apiKey).not.toBe(first.apiKey);
    expect(await apiKeyExists(env.FEED_DB, first.apiKey)).toBe(false);
    expect(await apiKeyExists(env.FEED_DB, rotated!.apiKey)).toBe(true);

    expect(await revokeApiKey(env.FEED_DB, second.id)).toBe(true);
    expect(await revokeApiKey(env.FEED_DB, second.id)).toBe(false);
    expect((await listApiKeys(env.FEED_DB)).map(({id}) => id)).toEqual([
      first.id,
    ]);
  });

  it("uses settings and API-key creation in one D1 batch", async () => {
    const apiKey = await createApiKey(env.FEED_DB, {
      name: "Agent",
      settings: {enabled: true, publicDocsEnabled: false},
    });
    expect(await readApiAccessSettings(env.FEED_DB)).toEqual({
      enabled: true,
      publicDocsEnabled: false,
    });
    expect(await apiKeyExists(env.FEED_DB, apiKey.apiKey)).toBe(true);
  });

  it("keeps rollback JSON until rotation or revocation", async () => {
    const first = await createApiKey(env.FEED_DB, {name: "Migrated one"});
    const second = await createApiKey(env.FEED_DB, {name: "Migrated two"});
    await env.FEED_DB.prepare(
      "INSERT INTO settings (category, data) VALUES ('apiSettings', ?) " +
        "ON CONFLICT(category) DO UPDATE SET data = excluded.data",
    ).bind(JSON.stringify({
      apps: [
        {id: first.id, name: first.name, token: first.apiKey},
        {id: second.id, name: second.name, token: second.apiKey},
      ],
      enabled: true,
    })).run();

    await renameApiKey(env.FEED_DB, first.id, "Renamed");
    let settings = await env.FEED_DB.prepare(
      "SELECT data FROM settings WHERE category = 'apiSettings'",
    ).first<{data: string}>();
    expect(JSON.parse(settings!.data).apps).toHaveLength(2);

    await rotateApiKey(env.FEED_DB, first.id);
    await revokeApiKey(env.FEED_DB, second.id);
    settings = await env.FEED_DB.prepare(
      "SELECT data FROM settings WHERE category = 'apiSettings'",
    ).first<{data: string}>();
    expect(JSON.parse(settings!.data).apps).toEqual([]);
  });
});

describe("API access decisions", () => {
  it("defaults both API access and the public reference to off", async () => {
    expect(await readApiAccessSettings(env.FEED_DB)).toEqual({
      enabled: false,
      publicDocsEnabled: false,
    });
    expect(await decideApiRequest(
      env.FEED_DB,
      request("/api/openapi.json"),
      "/api/openapi.json",
    )).toBe("not-found");
  });

  it("preserves the existing-installation public-reference default", async () => {
    await env.FEED_DB.prepare(
      "INSERT INTO settings (category, data) VALUES ('apiSettings', ?)",
    ).bind(JSON.stringify({enabled: true})).run();
    expect(await readApiAccessSettings(env.FEED_DB)).toEqual({
      enabled: true,
      publicDocsEnabled: true,
    });
  });

  it("makes Bearer authoritative and retains the legacy header fallback", async () => {
    await updateApiAccessSettings(env.FEED_DB, {
      enabled: true,
      publicDocsEnabled: false,
    });
    const apiKey = await createApiKey(env.FEED_DB, {name: "Integration"});

    expect(await decideApiRequest(
      env.FEED_DB,
      request("/api/feed/", {authorization: `bearer ${apiKey.apiKey}`}),
      "/api/feed/",
    )).toBe("allow-integration");
    expect(await decideApiRequest(
      env.FEED_DB,
      request("/api/feed/", {"X-MicrofeedAPI-Key": apiKey.apiKey}),
      "/api/feed/",
    )).toBe("allow-integration");
    expect(await decideApiRequest(
      env.FEED_DB,
      request("/api/feed/", {
        authorization: "Bearer invalid",
        "X-MicrofeedAPI-Key": apiKey.apiKey,
      }),
      "/api/feed/",
    )).toBe("unauthorized");
    expect(providedApiKey(request("/api/feed/", {
      authorization: "Bearer invalid",
      "X-MicrofeedAPI-Key": apiKey.apiKey,
    }))).toBe("invalid");
  });

  it("never authenticates against the rollback JSON", async () => {
    await env.FEED_DB.prepare(
      "INSERT INTO settings (category, data) VALUES ('apiSettings', ?)",
    ).bind(JSON.stringify({
      apps: [{id: "legacy", name: "Legacy", token: "json-only-key"}],
      enabled: true,
    })).run();
    expect(await decideApiRequest(
      env.FEED_DB,
      request("/api/feed/", {authorization: "Bearer json-only-key"}),
      "/api/feed/",
    )).toBe("unauthorized");
  });

  it("applies the two availability switches to reference routes", async () => {
    await updateApiAccessSettings(env.FEED_DB, {
      enabled: true,
      publicDocsEnabled: false,
    });
    expect(await decideApiRequest(
      env.FEED_DB,
      request("/api/llms-full.txt"),
      "/api/llms-full.txt",
    )).toBe("not-found");
    await updateApiAccessSettings(env.FEED_DB, {
      enabled: true,
      publicDocsEnabled: true,
    });
    expect(await decideApiRequest(
      env.FEED_DB,
      request("/api/llms-full.txt"),
      "/api/llms-full.txt",
    )).toBe("allow-reference");
    const legacy = await legacyApiReferenceRedirect(
      env.FEED_DB,
      new URL(`${ORIGIN}/json/openapi.yaml`),
      "/api/openapi.yaml",
    );
    expect(legacy.status).toBe(308);
    expect(legacy.headers.get("location")).toBe(
      `${ORIGIN}/api/openapi.yaml`,
    );
    await updateApiAccessSettings(env.FEED_DB, {
      enabled: false,
      publicDocsEnabled: true,
    });
    expect(await readApiAccessSettings(env.FEED_DB)).toEqual({
      enabled: false,
      publicDocsEnabled: false,
    });
    expect(await decideApiRequest(
      env.FEED_DB,
      request("/api/llms-full.txt"),
      "/api/llms-full.txt",
    )).toBe("not-found");
    expect((await legacyApiReferenceRedirect(
      env.FEED_DB,
      new URL(`${ORIGIN}/json/openapi.yaml`),
      "/api/openapi.yaml",
    )).status).toBe(404);
  });
});
