import {env} from "cloudflare:workers";
import type {APIContext, APIRoute} from "astro";
import {beforeEach, describe, expect, it} from "vitest";

import {
  addLegacyApiDeprecationHeaders,
  apiPathDetails,
  decideApiRequest,
  providedApiKey,
} from "@/server/api/access";
import {legacyApiReferenceRedirect} from "@/server/api/reference";
import {API_BASE_PATH, LEGACY_API_DEPRECATION} from "@/shared/ApiVersion";
import * as legacyChannel from "@/pages/api/channels/[channelId]/index";
import * as legacyFeed from "@/pages/api/feed/index";
import * as legacyApiDocs from "@/pages/api/index";
import * as legacyItem from "@/pages/api/items/[itemId]/index";
import * as legacyItems from "@/pages/api/items/index";
import * as legacyMedia from "@/pages/api/media_files/presigned_urls/index";
import * as legacyLlms from "@/pages/api/llms.txt";
import * as legacyLlmsFull from "@/pages/api/llms-full.txt";
import * as legacyOpenApiHtml from "@/pages/api/openapi.html";
import * as legacyOpenApiJson from "@/pages/api/openapi.json";
import * as legacyOpenApiYaml from "@/pages/api/openapi.yaml";
import * as versionedChannel from "@/pages/api/v1/channels/[channelId]/index";
import * as versionedFeed from "@/pages/api/v1/feed/index";
import * as versionedItem from "@/pages/api/v1/items/[itemId]/index";
import * as versionedItems from "@/pages/api/v1/items/index";
import * as versionedItemValidation from "@/pages/api/v1/items/validate/index";
import * as versionedMedia from "@/pages/api/v1/media_files/presigned_urls/index";
import * as versionedSearch from "@/pages/api/v1/search/index";
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

async function callRoute(handler: APIRoute, url: string): Promise<Response> {
  return handler({url: new URL(url)} as APIContext);
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
      request(`${API_BASE_PATH}openapi.json`),
      `${API_BASE_PATH}openapi.json`,
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

    for (const pathname of [`${API_BASE_PATH}feed/`, "/api/feed/"]) {
      expect(await decideApiRequest(
        env.FEED_DB,
        request(pathname, {authorization: `bearer ${apiKey.apiKey}`}),
        pathname,
      )).toBe("allow-integration");
    }
    expect(await decideApiRequest(
      env.FEED_DB,
      request(`${API_BASE_PATH}feed/`, {
        "X-MicrofeedAPI-Key": apiKey.apiKey,
      }),
      `${API_BASE_PATH}feed/`,
    )).toBe("allow-integration");
    expect(await decideApiRequest(
      env.FEED_DB,
      request(`${API_BASE_PATH}feed/`, {
        authorization: "Bearer invalid",
        "X-MicrofeedAPI-Key": apiKey.apiKey,
      }),
      `${API_BASE_PATH}feed/`,
    )).toBe("unauthorized");
    expect(providedApiKey(request(`${API_BASE_PATH}feed/`, {
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
      request(`${API_BASE_PATH}feed/`, {
        authorization: "Bearer json-only-key",
      }),
      `${API_BASE_PATH}feed/`,
    )).toBe("unauthorized");
  });

  it("applies the two availability switches to reference routes", async () => {
    await updateApiAccessSettings(env.FEED_DB, {
      enabled: true,
      publicDocsEnabled: false,
    });
    expect(await decideApiRequest(
      env.FEED_DB,
      request(`${API_BASE_PATH}llms-full.txt`),
      `${API_BASE_PATH}llms-full.txt`,
    )).toBe("not-found");
    await updateApiAccessSettings(env.FEED_DB, {
      enabled: true,
      publicDocsEnabled: true,
    });
    for (const pathname of [
      `${API_BASE_PATH}llms-full.txt`,
      "/api/llms-full.txt",
    ]) {
      expect(await decideApiRequest(
        env.FEED_DB,
        request(pathname),
        pathname,
      )).toBe("allow-reference");
    }
    const legacy = await legacyApiReferenceRedirect(
      env.FEED_DB,
      new URL(`${ORIGIN}/json/openapi.yaml`),
      `${API_BASE_PATH}openapi.yaml`,
    );
    expect(legacy.status).toBe(308);
    expect(legacy.headers.get("location")).toBe(
      `${ORIGIN}${API_BASE_PATH}openapi.yaml`,
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
      request(`${API_BASE_PATH}llms-full.txt`),
      `${API_BASE_PATH}llms-full.txt`,
    )).toBe("not-found");
    expect((await legacyApiReferenceRedirect(
      env.FEED_DB,
      new URL(`${ORIGIN}/json/openapi.yaml`),
      `${API_BASE_PATH}openapi.yaml`,
    )).status).toBe(404);
  });

  it("recognizes only canonical and compatibility API route shapes", () => {
    expect(apiPathDetails(`${API_BASE_PATH}items/item-id/`)).toEqual({
      canonicalPath: `${API_BASE_PATH}items/item-id/`,
      kind: "integration",
      legacy: false,
    });
    expect(apiPathDetails(`${API_BASE_PATH}search/`)).toEqual({
      canonicalPath: `${API_BASE_PATH}search/`,
      kind: "integration",
      legacy: false,
    });
    expect(apiPathDetails(`${API_BASE_PATH}items/validate/`)).toEqual({
      canonicalPath: `${API_BASE_PATH}items/validate/`,
      kind: "integration",
      legacy: false,
    });
    expect(apiPathDetails(`${API_BASE_PATH}pages/page-id/`)).toEqual({
      canonicalPath: `${API_BASE_PATH}pages/page-id/`,
      kind: "integration",
      legacy: false,
    });
    expect(apiPathDetails(`${API_BASE_PATH}site-files/file-id/publish/`))
      .toEqual({
        canonicalPath: `${API_BASE_PATH}site-files/file-id/publish/`,
        kind: "integration",
        legacy: false,
      });
    expect(apiPathDetails("/api/pages/page-id/")).toBeNull();
    expect(apiPathDetails("/api/search/")).toBeNull();
    expect(apiPathDetails("/api/items/item-id/")).toEqual({
      canonicalPath: `${API_BASE_PATH}items/item-id/`,
      kind: "integration",
      legacy: true,
    });
    expect(apiPathDetails(API_BASE_PATH)).toEqual({
      canonicalPath: API_BASE_PATH,
      kind: "reference",
      legacy: false,
    });
    expect(apiPathDetails("/api/v2/feed/")).toBeNull();
    expect(apiPathDetails(`${API_BASE_PATH}items/one/extra/`)).toBeNull();
    expect(apiPathDetails("/api/unknown/")).toBeNull();
    expect(apiPathDetails("/api/auth/session/")).toBeNull();
  });

  it("adds deprecation metadata only to recognized compatibility routes", () => {
    const legacyUrl = new URL(`${ORIGIN}/api/feed/?limit=3&order=asc`);
    const deprecated = addLegacyApiDeprecationHeaders(
      new Response("Unauthorized", {
        headers: {link: "</terms>; rel=license"},
        status: 401,
      }),
      legacyUrl,
      legacyUrl.pathname,
    );
    expect(deprecated.headers.get("deprecation")).toBe(
      LEGACY_API_DEPRECATION,
    );
    expect(deprecated.status).toBe(401);
    expect(deprecated.headers.get("link")).toContain(
      `<${ORIGIN}${API_BASE_PATH}feed/?limit=3&order=asc>; ` +
        'rel="successor-version"',
    );
    expect(deprecated.headers.get("link")).toContain("rel=license");
    expect(deprecated.headers.get("sunset")).toBeNull();

    const canonicalUrl = new URL(`${ORIGIN}${API_BASE_PATH}feed/`);
    const canonical = addLegacyApiDeprecationHeaders(
      new Response("ok"),
      canonicalUrl,
      canonicalUrl.pathname,
    );
    expect(canonical.headers.get("deprecation")).toBeNull();
  });
});

describe("API route version aliases", () => {
  it("exports the same integration handlers from compatibility routes", () => {
    expect(legacyFeed.GET).toBe(versionedFeed.GET);
    expect(legacyFeed.HEAD).toBe(versionedFeed.HEAD);
    expect(legacyItems.POST).toBe(versionedItems.POST);
    expect(legacyItem.GET).toBe(versionedItem.GET);
    expect(legacyItem.PUT).toBe(versionedItem.PUT);
    expect(legacyItem.DELETE).toBe(versionedItem.DELETE);
    expect(legacyChannel.PUT).toBe(versionedChannel.PUT);
    expect(legacyMedia.POST).toBe(versionedMedia.POST);
    expect(versionedSearch.GET).toBeTypeOf("function");
    expect(versionedItemValidation.POST).toBeTypeOf("function");
    expect("POST" in legacyItem).toBe(false);
  });

  it("redirects compatibility API docs directly to their v1 paths", async () => {
    const routes: Array<[APIRoute, string, string]> = [
      [legacyApiDocs.GET, "/api/", API_BASE_PATH],
      [
        legacyOpenApiHtml.GET,
        "/api/openapi.html",
        `${API_BASE_PATH}openapi.html`,
      ],
      [
        legacyOpenApiJson.GET,
        "/api/openapi.json",
        `${API_BASE_PATH}openapi.json`,
      ],
      [
        legacyOpenApiYaml.GET,
        "/api/openapi.yaml",
        `${API_BASE_PATH}openapi.yaml`,
      ],
      [legacyLlms.GET, "/api/llms.txt", `${API_BASE_PATH}llms.txt`],
      [
        legacyLlmsFull.GET,
        "/api/llms-full.txt",
        `${API_BASE_PATH}llms-full.txt`,
      ],
    ];

    for (const [handler, legacyPath, canonicalPath] of routes) {
      const response = await callRoute(
        handler,
        `${ORIGIN}${legacyPath}?download=1`,
      );
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(
        `${ORIGIN}${canonicalPath}?download=1`,
      );
    }
  });
});
