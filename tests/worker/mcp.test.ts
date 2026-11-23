import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";
import {hashPassword} from "better-auth/crypto";
import {Client, StreamableHTTPClientTransport, auth, type OAuthClientProvider, type StoredOAuthClientInformation, type StoredOAuthTokens} from "@modelcontextprotocol/client";
import {mcpResponse, mcpMetadataResponse} from "@/server/mcp/server";
import {MCP_TOOLS} from "@/server/mcp/tools";
import {readMcpSettings, updateMcpSettings} from "@/server/mcp/settings";
import {createMicrofeedAuth} from "@/server/auth/better-auth";
import {ALL as authRoute} from "@/pages/api/auth/[...all]";
import {GET as metadataRoute} from "@/pages/.well-known/oauth-authorization-server/api/auth";
import {storedOAuthTokenHash} from "@/server/auth/oauth-resource";
import {OAUTH_ACCESS_TOKEN_PREFIX} from "@/shared/OAuth";
import {mcpResource, isMcpPath, isMcpMetadataPath} from "@/shared/Mcp";
import {decideApiRequest} from "@/server/api/access";
import {updateApiAccessSettings} from "@/server/api/api-keys";
import {revokeOAuthApplicationAccess} from "@/server/auth/oauth-admin";
import ThemeStore from "@/server/themes/ThemeStore";
import {OPENAPI_DOCUMENT} from "@/shared/OpenApiDocument";
import {normalizeAdminPath, validateAdminPath} from "@/shared/AdminPath";
import {validatePageSlug} from "@/shared/Pages";
import {onRequest} from "@/middleware";
import type {APIContext, APIRoute} from "astro";

const ORIGIN = "https://feed.example.com";
const RESOURCE = mcpResource(ORIGIN);
const PASSWORD = "mcp-test-password-only";
let ownerCookie = "";

function request(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("cf-connecting-ip", "203.0.113.25");
  return new Request(new URL(path, ORIGIN), {...init, headers});
}

async function route(handler: APIRoute, req: Request): Promise<Response> {
  return await handler({request: req, url: new URL(req.url)} as APIContext) as Response;
}

const localFetch: typeof fetch = async (input, init) => {
  const incoming = new Request(input, init);
  const headers = new Headers(incoming.headers);
  headers.set("cf-connecting-ip", "203.0.113.25");
  const req = new Request(incoming, {headers});
  const path = new URL(req.url).pathname;
  if (isMcpPath(path)) return mcpResponse(env, req);
  if (isMcpMetadataPath(path)) return mcpMetadataResponse(env, req);
  if (path === "/.well-known/oauth-authorization-server/api/auth") return route(metadataRoute, req);
  if (path.startsWith("/api/auth/")) return route(authRoute, req);
  return new Response("404", {status: 404});
};

beforeEach(async () => {
  await env.FEED_DB.batch([
    env.FEED_DB.prepare("DELETE FROM auth_rate_limit"),
    env.FEED_DB.prepare("DELETE FROM auth_user"),
    env.FEED_DB.prepare("DELETE FROM oauth_client WHERE clientId != 'microfeed-cli'"),
    env.FEED_DB.prepare("DELETE FROM settings WHERE category IN ('mcpSettings', 'apiSettings')"),
  ]);
  const now = new Date().toISOString();
  await env.FEED_DB.prepare('INSERT INTO auth_user (id, name, email, emailVerified, createdAt, updatedAt, role) VALUES (?, ?, ?, 1, ?, ?, ?)')
    .bind("mcp-owner", "MCP test owner", "owner@example.com", now, now, "admin").run();
  await env.FEED_DB.prepare('INSERT INTO auth_account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind("mcp-account", "mcp-owner", "credential", "mcp-owner", await hashPassword(PASSWORD), now, now).run();
  const req = request("/api/auth/sign-in/email", {
    method: "POST", headers: {"content-type": "application/json", origin: ORIGIN},
    body: JSON.stringify({email: "owner@example.com", password: PASSWORD}),
  });
  const signedIn = await createMicrofeedAuth(env, req).handler(req);
  expect(signedIn.status).toBe(200);
  ownerCookie = signedIn.headers.getSetCookie().map(cookie => cookie.split(";", 1)[0]).join("; ");
});

async function connection(scopes = "content:read content:write offline_access", endpoint = RESOURCE, exchangeResource?: string) {
  let information: StoredOAuthClientInformation | undefined;
  let tokens: StoredOAuthTokens | undefined;
  let verifier = "";
  let authorization: URL | undefined;
  let discoveryState: Parameters<NonNullable<OAuthClientProvider["saveDiscoveryState"]>>[0] | undefined;
  const provider: OAuthClientProvider = {
    redirectUrl: "https://client.example/callback",
    clientMetadata: {
      client_name: "MCP integration test", redirect_uris: ["https://client.example/callback"],
      token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], scope: scopes,
    },
    state: () => "mcp-test-state",
    discoveryState: () => discoveryState,
    saveDiscoveryState: value => { discoveryState = value; },
    clientInformation: () => information,
    saveClientInformation: value => { information = value; },
    tokens: () => tokens,
    saveTokens: value => { tokens = value; },
    saveCodeVerifier: value => { verifier = value; },
    codeVerifier: () => verifier,
    redirectToAuthorization: value => { authorization = value; },
  };
  expect(await auth(provider, {serverUrl: endpoint, scope: scopes, fetchFn: localFetch})).toBe("REDIRECT");
  expect(authorization?.searchParams.get("resource")).toBe(RESOURCE);
  const authorized = await route(authRoute, request(authorization!.href, {headers: {cookie: ownerCookie}}));
  expect(authorized.status).toBe(302);
  const consentUrl = new URL(authorized.headers.get("location")!, ORIGIN);
  expect(consentUrl.pathname).toBe("/admin/api/oauth/consent/");
  expect(consentUrl.searchParams.get("resource"), "resource must survive the signed consent redirect").toBe(RESOURCE);
  const consent = await route(authRoute, request("/api/auth/oauth2/consent", {
    method: "POST", headers: {"content-type": "application/json", origin: ORIGIN, cookie: ownerCookie},
    body: JSON.stringify({accept: true, oauth_query: consentUrl.search.slice(1)}),
  }));
  expect(consent.status).toBe(200);
  const callback = new URL((await consent.json() as {url: string}).url);
  expect(callback.searchParams.get("state")).toBe("mcp-test-state");
  const storedResource = await env.FEED_DB.prepare("SELECT json_extract(value, '$.query.resource') AS resource FROM auth_verification WHERE json_valid(value) AND json_extract(value, '$.type') = 'authorization_code' LIMIT 1").first<{resource: string}>();
  expect(storedResource?.resource).toBe(RESOURCE);
  const exchangeFetch: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    if (exchangeResource !== undefined && new URL(req.url).pathname === "/api/auth/oauth2/token") {
      const body = new URLSearchParams(await req.text());
      body.set("resource", exchangeResource);
      return localFetch(req.url, {method: req.method, headers: req.headers, body});
    }
    return localFetch(req);
  };
  expect(await auth(provider, {serverUrl: endpoint, authorizationCode: callback.searchParams.get("code")!, iss: callback.searchParams.get("iss") ?? undefined, scope: scopes, fetchFn: exchangeFetch})).toBe("AUTHORIZED");
  return {
    provider,
    token: () => tokens!.access_token,
    refresh: () => tokens!.refresh_token!,
    clientId: () => information!.client_id,
    async client(url = endpoint) {
      const client = new Client({name: "microfeed-test", version: "1.0.0"});
      await client.connect(new StreamableHTTPClientTransport(new URL(url), {authProvider: provider, fetch: localFetch}));
      return client;
    },
  };
}

describe("OAuth MCP server", () => {
  it("is independently opt-in and exposes public discovery only while available", async () => {
    expect(await readMcpSettings(env.FEED_DB)).toEqual({enabled: false});
    expect((await mcpResponse(env, request(RESOURCE))).status).toBe(404);
    await updateApiAccessSettings(env.FEED_DB, {enabled: true, publicDocsEnabled: true});
    expect((await mcpMetadataResponse(env, request("/.well-known/oauth-protected-resource"))).status).toBe(404);
    await updateMcpSettings(env, {enabled: true});
    await updateApiAccessSettings(env.FEED_DB, {enabled: false, publicDocsEnabled: false});
    for (const path of ["/mcp", "/mcp/"]) {
      const response = await mcpResponse(env, request(path));
      expect(response.status).toBe(401);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("www-authenticate")).toContain("resource_metadata=");
    }
    const metadata = await mcpMetadataResponse(env, request("/.well-known/oauth-protected-resource/mcp/"));
    expect(await metadata.json()).toMatchObject({resource: RESOURCE, authorization_servers: [`${ORIGIN}/api/auth`], scopes_supported: ["content:read", "content:write"]});
    expect((await mcpResponse(env, request(RESOURCE, {headers: {cookie: ownerCookie}}))).status).toBe(401);
    expect((await mcpResponse({...env, MICROFEED_ADMIN_AUTH_MODE: "none"}, request(RESOURCE))).status).toBe(404);
    expect((await mcpResponse(env, request(RESOURCE, {headers: {origin: "https://untrusted.example"}}))).status).toBe(403);
    for (const path of ["/mcp", "/mcp/", "/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp/"]) {
      const req = request(path);
      const context: Partial<APIContext> = {request: req, url: new URL(req.url), params: {adminPath: "mcp"}};
      const response = await onRequest(context as APIContext, async () => new Response("Incorrect route"));
      expect(response instanceof Response).toBe(true);
      if (!(response instanceof Response)) throw new Error("Expected MCP middleware response");
      expect(response.status).toBe(isMcpPath(path) ? 401 : 200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("connects with the official OAuth client, advertises full tools, refreshes, and revokes", async () => {
    await updateMcpSettings(env, {enabled: true});
    const app = await connection();
    const client = await app.client();
    const listed = await client.listTools();
    expect(new Set(listed.tools.map(tool => tool.name))).toEqual(new Set(MCP_TOOLS.map(tool => tool.name)));
    const operations = Object.values(OPENAPI_DOCUMENT.paths ?? {}).flatMap(path => Object.entries(path)
      .filter(([method, value]) => ["get", "post", "put", "delete"].includes(method) && value && typeof value === "object" && "operationId" in value && !("tags" in value && value.tags?.includes("MCP")))
      .map(([, value]) => (value as {operationId: string}).operationId));
    expect(new Set(MCP_TOOLS.map(tool => tool.operationId))).toEqual(new Set(operations));
    expect(listed.tools.find(tool => tool.name === "delete_item")?.annotations?.destructiveHint).toBe(true);
    expect(listed.tools.find(tool => tool.name === "search_content")?.annotations?.readOnlyHint).toBe(true);
    expect((await client.callTool({name: "list_tags", arguments: {}})).isError).not.toBe(true);
    await client.close();
    const aliasClient = await app.client(`${ORIGIN}/mcp`);
    await aliasClient.listTools();
    await aliasClient.close();
    expect(await decideApiRequest(env.FEED_DB, request("/api/v1/feed/", {headers: {authorization: `Bearer ${app.token()}`}}), "/api/v1/feed/", "built-in")).toBe("not-found");
    await updateApiAccessSettings(env.FEED_DB, {enabled: true, publicDocsEnabled: false});
    expect(await decideApiRequest(env.FEED_DB, request("/api/v1/feed/", {headers: {authorization: `Bearer ${app.token()}`}}), "/api/v1/feed/", "built-in")).toBe("unauthorized");
    const firstRefresh = app.refresh();
    expect(await auth(app.provider, {serverUrl: RESOURCE, fetchFn: localFetch})).toBe("AUTHORIZED");
    expect(app.refresh() === firstRefresh).toBe(false);
    const rebound = await env.FEED_DB.prepare("SELECT resource FROM oauth_access_token WHERE token = ?").bind(await storedOAuthTokenHash(app.token(), OAUTH_ACCESS_TOKEN_PREFIX)).first<{resource: string}>();
    expect(rebound?.resource).toBe(RESOURCE);
    await revokeOAuthApplicationAccess(env.FEED_DB, "mcp-owner", app.clientId());
    expect((await mcpResponse(env, request(RESOURCE, {headers: {authorization: `Bearer ${app.token()}`}}))).status).toBe(401);
  });

  it("rejects code redemption for another resource and limits open registration", async () => {
    await updateMcpSettings(env, {enabled: true});
    await expect(connection("content:read", RESOURCE, ORIGIN)).rejects.toThrow("resource does not match");
    const count = await env.FEED_DB.prepare("SELECT COUNT(*) AS count FROM oauth_access_token").first<{count: number}>();
    expect(count?.count).toBe(0);
    let registration: Response | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      registration = await route(authRoute, request("/api/auth/oauth2/register", {
        method: "POST", headers: {"content-type": "application/json"},
        body: JSON.stringify({client_name: "Rate test", redirect_uris: ["https://client.example/callback"], token_endpoint_auth_method: "none"}),
      }));
    }
    expect(registration?.status).toBe(429);
  });

  it("enforces tool scopes at HTTP level before any mutation and rejects invalid transport inputs", async () => {
    await updateMcpSettings(env, {enabled: true});
    const app = await connection("content:read offline_access");
    const client = await app.client();
    await client.listTools();
    const send = (body: unknown, extra: Record<string, string> = {}) => mcpResponse(env, request(RESOURCE, {
      method: "POST", headers: {authorization: `Bearer ${app.token()}`, accept: "application/json, text/event-stream", "content-type": "application/json", ...extra}, body: JSON.stringify(body),
    }));
    const denied = await send({jsonrpc: "2.0", id: 7, method: "tools/call", params: {name: "create_tag", arguments: {input: {name: "Forbidden tag"}}}});
    expect(denied.status).toBe(403);
    expect(denied.headers.get("www-authenticate")).toContain('scope="content:write"');
    expect(await env.FEED_DB.prepare("SELECT id FROM tags WHERE name = 'Forbidden tag'").first()).toBeNull();
    expect((await send({not: "jsonrpc"})).status).toBe(400);
    expect((await send({}, {"content-type": "text/plain"})).status).toBe(415);
    expect((await send({}, {"content-length": "5000000"})).status).toBe(413);
    const legacy = await send({jsonrpc: "2.0", id: 20, method: "initialize", params: {protocolVersion: "2025-11-25", capabilities: {}, clientInfo: {name: "legacy-client", version: "1.0"}}}, {"MCP-Protocol-Version": "2025-11-25"});
    expect(legacy.status).toBe(200);
    expect(await legacy.json()).toMatchObject({result: {protocolVersion: "2025-11-25"}});
    expect((await send({jsonrpc: "2.0", id: 21, method: "tools/list"}, {"MCP-Protocol-Version": "2025-11-25"})).status).toBe(200);
    const switchResource = await route(authRoute, request("/api/auth/oauth2/token", {
      method: "POST", body: new URLSearchParams({grant_type: "refresh_token", refresh_token: app.refresh(), client_id: app.clientId(), resource: ORIGIN}),
    }));
    expect(switchResource.status).toBe(400);
    const tokenHash = await storedOAuthTokenHash(app.token(), OAUTH_ACCESS_TOKEN_PREFIX);
    await env.FEED_DB.prepare("UPDATE oauth_access_token SET expiresAt = '2000-01-01T00:00:00.000Z' WHERE token = ?").bind(tokenHash).run();
    expect((await send({jsonrpc: "2.0", id: 22, method: "tools/list"})).status).toBe(401);
    await updateMcpSettings(env, {enabled: false});
    expect((await send({jsonrpc: "2.0", id: 8, method: "tools/list"})).status).toBe(404);
    await client.close();
  });

  it("runs content and Site File lifecycles through the SDK with shared idempotency and webhooks", async () => {
    await updateMcpSettings(env, {enabled: true});
    await env.FEED_DB.prepare("INSERT INTO settings (category, data) VALUES ('access', ?) ON CONFLICT(category) DO UPDATE SET data = excluded.data").bind(JSON.stringify({currentPolicy: "public"})).run();
    const store = new ThemeStore(env.FEED_DB);
    const installed = await store.installVersion({
      id: "tests-mcp-theme", source: {kind: "admin"},
      manifest: {formatVersion: 2, packageId: "tests.mcp", name: "MCP test theme", version: "1.0.0", microfeed: "*", author: "Tests", license: "MIT", assets: [], files: {
        rssStylesheet: "rss.xsl", webBodyEnd: "end.mustache", webBodyStart: "start.mustache", webFeed: "feed.mustache", webHeader: "header.mustache", webItem: "item.mustache", webPage: "page.mustache", webSearch: "search.mustache",
      }},
      bundle: {assets: [], rssStylesheet: '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"></xsl:stylesheet>', webBodyEnd: "", webBodyStart: "", webFeed: "{{title}}", webHeader: "", webItem: "{{title}}", webPage: "{{page.title}}", webSearch: "Search"},
    });
    await store.activate(installed.id);
    await env.FEED_DB.prepare("UPDATE site_search_metadata SET ready = 1 WHERE id = 1").run();
    const app = await connection();
    const client = await app.client();
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({name, arguments: args});
      expect(result.isError, name).not.toBe(true);
      return result.structuredContent as Record<string, unknown>;
    };
    await call("update_primary_channel", {channelId: "primary", input: {title: "MCP integration feed", home_page_url: ORIGIN}});
    await env.FEED_DB.prepare("INSERT INTO webhook_endpoints (id, name, url, secret_ciphertext) VALUES ('mcp-endpoint', 'Test endpoint', 'https://example.com/hook', 'test-ciphertext')").run();
    await env.FEED_DB.prepare("INSERT INTO webhook_subscriptions (endpoint_id, event_type) VALUES ('mcp-endpoint', 'item.created')").run();
    const input = {title: "MCP searchable episode", content_html: "<p>Searchable content</p>", status: "unpublished"};
    await call("validate_item", {input});
    const created = await call("create_item", {input, idempotencyKey: "mcp-item-replay", automationContext: {"Microfeed-Correlation-Id": "mcp-lifecycle"}});
    expect((await call("create_item", {input, idempotencyKey: "mcp-item-replay"})).id).toBe(created.id);
    await call("get_item", {itemId: created.id});
    await call("update_item", {itemId: created.id, input: {title: "MCP updated episode"}});
    expect((await call("search_content", {q: "updated", types: "items"})).items).toHaveLength(1);
    await call("get_feed", {limit: 1});
    const tag = await call("create_tag", {input: {name: "MCP lifecycle tag"}});
    await call("update_tag_by_id", {tagId: tag.id, input: {description: "Edited through MCP"}});
    await call("get_tag_by_slug", {slug: tag.slug});
    await call("list_tags", {limit: 1});
    const pageInput = {title: "MCP Page", slug: "mcp-lifecycle-page", show_in_navigation: false, content_html: "<p>Page content</p>", status: "unpublished"};
    await call("validate_page", {input: pageInput});
    const page = await call("create_page", {input: pageInput});
    await call("get_page", {pageId: page.id});
    await call("update_page", {pageId: page.id, input: {title: "MCP Page updated"}});
    await call("list_pages", {limit: 1});
    const fileInput = {filename: "mcp-lifecycle.txt", content_type: "text/plain", draft_content: "Hello {{title}}"};
    await call("validate_site_file", {input: fileInput});
    const file = await call("create_site_file", {input: fileInput});
    await call("get_site_file", {siteFileId: file.id});
    await call("update_site_file", {siteFileId: file.id, input: {draft_content: "Updated {{title}}"}});
    const preview = await call("preview_site_file", {input: {...fileInput, draft_content: "Preview {{title}}"}});
    expect(preview.rendered_content).toContain("Preview");
    await call("publish_site_file", {siteFileId: file.id});
    expect((await client.callTool({name: "reset_site_file", arguments: {siteFileId: file.id}})).isError).toBe(true);
    await call("update_site_file", {siteFileId: "system-robots", input: {draft_content: "User-agent: *\nDisallow:"}});
    await call("publish_site_file", {siteFileId: "system-robots"});
    await call("reset_site_file", {siteFileId: "system-robots"});
    await call("list_site_files");
    const upload = await call("prepare_media_upload", {input: {category: "image", full_local_file_path: "cover.png", type: "image/png", size: 4}});
    expect(typeof upload.presigned_url === "string").toBe(true);
    expect(typeof upload.media_url === "string").toBe(true);
    await call("update_item", {itemId: created.id, input: {status: "published", _microfeed: {podcast: {chapters: [{startTime: 0, title: "Introduction"}]}}}});
    const published = await call("get_item", {itemId: created.id});
    const publishedItems = published.items as Array<{url: string}>;
    const slug = new URL(publishedItems[0]!.url).pathname.split("/").filter(Boolean).pop();
    const chapters = await call("get_podcast_chapters", {slug});
    expect(chapters.chapters).toHaveLength(1);
    await call("delete_page", {pageId: page.id});
    await call("delete_tag_by_id", {tagId: tag.id});
    await call("delete_site_file", {siteFileId: file.id});
    await call("delete_item", {itemId: created.id});
    const events = await env.FEED_DB.prepare("SELECT origin, correlation_id FROM webhook_events WHERE correlation_id = 'mcp-lifecycle'").all<{origin: string; correlation_id: string}>();
    expect(events.results.length).toBeGreaterThan(0);
    expect(events.results.every(event => event.origin === "mcp")).toBe(true);
    const missing = await client.callTool({name: "get_page", arguments: {pageId: page.id}});
    expect(missing.isError).toBe(true);
    await client.close();
  });

  it("reserves new routes while retaining existing administrator paths and refusing collisions", async () => {
    expect(validatePageSlug("mcp")).toBeDefined();
    expect(validateAdminPath("mcp")).toBeDefined();
    expect(normalizeAdminPath("mcp")).toBe("mcp");
    await expect(updateMcpSettings({...env, MICROFEED_ADMIN_PATH: "mcp"}, {enabled: true})).rejects.toThrow("administrator path");
    await expect(updateMcpSettings({...env, MICROFEED_ADMIN_AUTH_MODE: "none"}, {enabled: true})).rejects.toThrow("sign-in");
    await env.FEED_DB.prepare("INSERT INTO pages (id, slug, title, status) VALUES ('mcp-page', 'mcp', 'Existing Page', 1)").run();
    await expect(updateMcpSettings(env, {enabled: true})).rejects.toThrow("existing Page");
  });
});
