import {env} from "cloudflare:workers";
import type {APIContext, APIRoute} from "astro";
import {beforeEach, describe, expect, it} from "vitest";

import {updateAdminFeed} from "@/pages/[adminPath]/ajax/feed";
import {
  createAdminPage,
  updateAdminPage,
} from "@/server/admin/page-handlers";
import FeedDb from "@/server/feed/FeedDb";
import {STATUSES} from "@/shared/Constants";
import {
  WEBMCP_INTERACTION_SOURCE,
  WEBMCP_INTERACTION_SOURCE_HEADER,
} from "@/shared/WebMcp";

const ORIGIN = "https://feed.example.com";

function webMcpRequest(
  pathname: string,
  method: string,
  body: unknown,
): Request {
  return new Request(`${ORIGIN}${pathname}`, {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      [WEBMCP_INTERACTION_SOURCE_HEADER]: WEBMCP_INTERACTION_SOURCE,
    },
    method,
  });
}

async function routeResponse(
  handler: APIRoute,
  request: Request,
  params: Record<string, string> = {},
): Promise<Response> {
  const response = await handler({
    locals: {},
    params: {adminPath: "admin", ...params},
    request,
    url: new URL(request.url),
  } as unknown as APIContext);
  if (!(response instanceof Response)) throw new Error("Expected a response.");
  return response;
}

beforeEach(async () => {
  await new FeedDb(env, new Request(`${ORIGIN}/admin/`)).getContent();
  await env.FEED_DB.batch([
    env.FEED_DB.prepare("DELETE FROM items WHERE id LIKE 'webmcp-test-%'"),
    env.FEED_DB.prepare(
      "DELETE FROM page_paths WHERE page_id IN " +
        "(SELECT id FROM pages WHERE slug LIKE 'webmcp-test-%')",
    ),
    env.FEED_DB.prepare("DELETE FROM pages WHERE slug LIKE 'webmcp-test-%'"),
  ]);
});

describe("WebMCP draft-only Worker enforcement", () => {
  it("accepts only unpublished Item results and rechecks stored status", async () => {
    const itemId = "webmcp-test-item";
    const create = await updateAdminFeed(
      webMcpRequest("/admin/ajax/feed/", "POST", {
        item: {
          id: itemId,
          pubDateMs: Date.now(),
          status: STATUSES.UNPUBLISHED,
          title: "Draft",
        },
      }),
      env,
      () => undefined,
    );
    expect(create.status).toBe(200);

    const publicResult = await updateAdminFeed(
      webMcpRequest("/admin/ajax/feed/", "POST", {
        item: {
          id: itemId,
          pubDateMs: Date.now(),
          status: STATUSES.PUBLISHED,
          title: "Must not publish",
        },
      }),
      env,
      () => undefined,
    );
    expect(publicResult.status).toBe(409);

    await env.FEED_DB.prepare(
      "UPDATE items SET status = ? WHERE id = ?",
    ).bind(STATUSES.PUBLISHED, itemId).run();
    const staleEditor = await updateAdminFeed(
      webMcpRequest("/admin/ajax/feed/", "POST", {
        item: {
          id: itemId,
          pubDateMs: Date.now(),
          status: STATUSES.UNPUBLISHED,
          title: "Must not revert",
        },
      }),
      env,
      () => undefined,
    );
    expect(staleEditor.status).toBe(409);
    const stored = await env.FEED_DB.prepare(
      "SELECT status, json_extract(data, '$.title') AS title FROM items WHERE id = ?",
    ).bind(itemId).first<{status: number; title: string}>();
    expect(stored).toEqual({status: STATUSES.PUBLISHED, title: "Draft"});

    const invalid = await updateAdminFeed(
      webMcpRequest("/admin/ajax/feed/", "POST", "{"),
      env,
      () => undefined,
    );
    expect(invalid.status).toBe(400);
    const missingId = await updateAdminFeed(
      webMcpRequest("/admin/ajax/feed/", "POST", {
        item: {status: STATUSES.UNPUBLISHED, title: "No ID"},
      }),
      env,
      () => undefined,
    );
    expect(missingId.status).toBe(400);
  });

  it("accepts new and existing Page drafts but rejects stale or public writes", async () => {
    const create = await routeResponse(
      createAdminPage,
      webMcpRequest("/admin/ajax/pages/", "POST", {
        navigation_label: "WebMCP",
        show_in_navigation: true,
        slug: "webmcp-test-page",
        status: "unpublished",
        title: "WebMCP draft",
      }),
    );
    expect(create.status).toBe(201);
    const page = await create.json() as {id: string};

    const update = await routeResponse(
      updateAdminPage,
      webMcpRequest(`/admin/ajax/pages/${page.id}/`, "PUT", {
        status: "unpublished",
        title: "Updated draft",
      }),
      {pageId: page.id},
    );
    expect(update.status).toBe(200);

    const publicResult = await routeResponse(
      updateAdminPage,
      webMcpRequest(`/admin/ajax/pages/${page.id}/`, "PUT", {
        status: "published",
        title: "Must not publish",
      }),
      {pageId: page.id},
    );
    expect(publicResult.status).toBe(409);

    await env.FEED_DB.prepare(
      "UPDATE pages SET status = ? WHERE id = ?",
    ).bind(STATUSES.PUBLISHED, page.id).run();
    const staleEditor = await routeResponse(
      updateAdminPage,
      webMcpRequest(`/admin/ajax/pages/${page.id}/`, "PUT", {
        status: "unpublished",
        title: "Must not revert",
      }),
      {pageId: page.id},
    );
    expect(staleEditor.status).toBe(409);

    const missing = await routeResponse(
      updateAdminPage,
      webMcpRequest("/admin/ajax/pages/missing/", "PUT", {
        status: "unpublished",
        title: "Missing",
      }),
      {pageId: "missing"},
    );
    expect(missing.status).toBe(404);
  });
});
