import {env} from "cloudflare:workers";
import type {APIContext} from "astro";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import FeedDb from "@/server/feed/FeedDb";
import FeedCrudManager from "@/server/feed/FeedCrudManager";
import FeedPublicRssBuilder from "@/server/feed/FeedPublicRssBuilder";
import {createItem, updateItem} from "@/server/items/service";
import {searchContent} from "@/server/items/search";
import {deleteTag, getTag, listTags, resolveTagRoute, saveTag} from "@/server/tags/service";
import {createApiTag, deleteApiTag, getApiTag, listApiTags, updateApiTag} from "@/server/tags/handlers";
import {contentMutationWebhookCommit, contentMutationWebhookInputs} from "@/server/webhooks/emission";
import {createWebhookEndpoint} from "@/server/webhooks/store";
import {processWebhookMessage, type WebhookQueueMessage} from "@/server/webhooks/delivery";
import {standardWebhookSignature} from "@/server/webhooks/crypto";
import {validateApiItem} from "@/server/api/handlers";
import {apiFeedSchema, apiTagListResponseSchema, apiTagOutputSchema, apiWebhookEventSchema} from "@/shared/ApiSchemas";
import {webhookGeneratedEnvelope} from "@/shared/WebhookExamples";
import {characterIndexStatements} from "@/server/items/character-index";
import {tagFeedResponse} from "@/server/tags/public";
import {publicTagPage} from "@/server/tags/pages";
import {createApiKey, updateApiAccessSettings} from "@/server/api/api-keys";
import {decideApiRequest} from "@/server/api/access";
import ThemeStore from "@/server/themes/ThemeStore";
import {BUNDLED_DEFAULT_THEME_BUNDLE, BUNDLED_DEFAULT_THEME_MANIFEST} from "@/server/themes/BundledThemes";
import {GET as listAdminTags, POST as createAdminTag} from "@/pages/[adminPath]/ajax/tags/index";
import {GET as getAdminTag, PUT as updateAdminTag, DELETE as deleteAdminTag} from "@/pages/[adminPath]/ajax/tags/by-id/[tagId]/index";

const ORIGIN = "https://feed.example.com";
afterEach(() => vi.unstubAllGlobals());
let db: FeedDb;
let crud: FeedCrudManager;
beforeEach(async () => {
  await env.FEED_DB.batch([
    env.FEED_DB.prepare("DELETE FROM item_tags"), env.FEED_DB.prepare("DELETE FROM tag_paths"),
    env.FEED_DB.prepare("DELETE FROM tags"), env.FEED_DB.prepare("DELETE FROM items WHERE id LIKE 'tagtest-%'"),
    env.FEED_DB.prepare("UPDATE site_search_metadata SET ready=1 WHERE id=1"),
  ]);
  const request = new Request(`${ORIGIN}/api/v1/tags/`);
  db = new FeedDb(env, request);
  crud = new FeedCrudManager(await db.getContent(), db, request);
  await db._updateOrAddSetting({access: {currentPolicy: "public"}}, "access");
  const pages = await env.FEED_DB.prepare("SELECT id, title, content_text FROM pages").all<{id: string; title: string; content_text: string}>();
  for (const page of pages.results) await env.FEED_DB.batch(characterIndexStatements(env.FEED_DB, "page", page.id, page.title, page.content_text));
});

describe("public tags", () => {
  it("renders custom tag slots with filtered items, directory pagination, and the site's shell", async () => {
    const store = new ThemeStore(env.FEED_DB);
    const savedSubscriptions = (await db.getContent()).settings?.subscribeMethods ?? {};
    const previous = (await store.getState()).activeThemeId;
    const manifest = {...BUNDLED_DEFAULT_THEME_MANIFEST, packageId: `test.tags.${crypto.randomUUID()}`};
    delete manifest.previewFixture;
    manifest.files = {...manifest.files};
    manifest.files.webTag = "archive.mustache";
    manifest.files.webTags = "directory.mustache";
    const theme = await store.installVersion({
      source: {kind: "local-directory"},
      manifest,
      bundle: {...BUNDLED_DEFAULT_THEME_BUNDLE,
        webBodyStart: "<header>site: {{title}}</header>",
        webFeed: "<main>feed fallback {{title}}</main>",
        webTag: "<main>archive: {{_microfeed.tag.name}} / {{_microfeed.tag.description}} / {{_microfeed.tag.published_item_count}}{{#items}}<article>{{title}}</article>{{/items}}</main>",
        webTags: '<main>directory: {{tags.title}}{{#tags.items}}<p>{{name}}: {{published_item_count}}</p>{{/tags.items}}{{#tags.next_url}}<a href="{{tags.next_url}}">more tags</a>{{/tags.next_url}}{{^tags.items}}empty directory{{/tags.items}}{{#tags.rss_enabled}}RSS enabled{{/tags.rss_enabled}}</main>',
      },
    });
    try {
      await store.activate(theme.id);
      const tag = await saveTag(env.FEED_DB, ORIGIN, {name: "00 World", description: "<script>plain text</script>"});
      await createItem(crud, {title: "Visible member", tag_ids: [tag.id]}, "tagtest-theme-public");
      await createItem(crud, {title: "Hidden member", status: "unpublished", tag_ids: [tag.id]}, "tagtest-theme-private");
      const archive = await publicTagPage(new Request(tag.url), tag.slug);
      expect(archive).not.toBeInstanceOf(Response);
      if (archive instanceof Response) throw new Error("Expected an archive render");
      expect(archive.bodyHtml).toContain("archive: 00 World");
      expect(archive.bodyHtml).toContain("&lt;script&gt;");
      expect(archive.bodyHtml).toContain("Visible member");
      expect(archive.bodyHtml).not.toContain("Hidden member");
      expect(archive.bodyHtml).not.toContain("feed fallback");
      expect(archive.bodyStart).toContain("<header>site:");
      expect(archive.bodyStart).not.toContain("00 World");
      expect(archive.metadataHtml).toContain(`href="${tag.url}"`);

      for (let index = 1; index <= 50; index++) await saveTag(env.FEED_DB, ORIGIN, {name: `${String(index).padStart(2, "0")} Topic`});
      const directory = await publicTagPage(new Request(`${ORIGIN}/tags/`), "");
      if (directory instanceof Response) throw new Error("Expected a directory render");
      expect(directory.bodyHtml).toContain("directory: Tags");
      expect(directory.bodyHtml).toContain("00 World: 1");
      expect(directory.bodyHtml).not.toContain("50 Topic");
      const next = /href="([^"]+)">more tags/.exec(directory.bodyHtml)?.[1];
      expect(next).toBeTruthy();
      // Follow the decoded attribute, as a browser does, rather than the HTML source.
      const nextUrl = next!.replaceAll("&#x2F;", "/").replaceAll("&#x3D;", "=").replaceAll("&amp;", "&");
      expect(new URL(nextUrl).pathname).toBe("/tags/");
      const second = await publicTagPage(new Request(nextUrl), "");
      if (second instanceof Response) throw new Error("Expected the second directory page");
      expect(second.bodyHtml).toContain("50 Topic: 0");
      expect(second.bodyHtml).not.toContain("00 World");
      await db._updateOrAddSetting({subscribeMethods: {methods: [{type: "rss", editable: false, enabled: false}]}}, "subscribeMethods");
      const disabled = await publicTagPage(new Request(`${ORIGIN}/tags/`), "");
      if (disabled instanceof Response) throw new Error("Expected a directory render");
      expect(disabled.bodyHtml).not.toContain("RSS enabled");
      await env.FEED_DB.batch([
        env.FEED_DB.prepare("DELETE FROM item_tags"),
        env.FEED_DB.prepare("DELETE FROM tag_paths"),
        env.FEED_DB.prepare("DELETE FROM tags"),
      ]);
      const empty = await publicTagPage(new Request(`${ORIGIN}/tags/`), "");
      if (empty instanceof Response) throw new Error("Expected an empty directory render");
      expect(empty.bodyHtml).toContain("empty directory");
    } finally {
      await db._updateOrAddSetting({subscribeMethods: savedSubscriptions}, "subscribeMethods");
      if (previous) await store.activate(previous); else await store.deactivate();
      await store.deleteVersion(theme.id);
    }
  });

  it("handles Admin tag CRUD without feed context from AJAX middleware", async () => {
    const context = (method = "GET", body?: unknown, tagId?: string) => ({
      locals: {},
      params: {adminPath: "admin", ...(tagId ? {tagId} : {})},
      request: new Request(`${ORIGIN}/admin/ajax/tags/${tagId ? `by-id/${tagId}/` : ""}`, {
        method,
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      }),
    }) as unknown as APIContext;

    const empty = await listAdminTags(context());
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({items: []});

    const invalid = await createAdminTag(context("POST", {name: "🌍".repeat(51)}));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({error: "Tag name must be 50 characters or fewer.", field: "name"});

    const created = await createAdminTag(context("POST", {name: "Admin topic"}));
    expect(created.status).toBe(201);
    const tag = apiTagOutputSchema.parse(await created.json());
    expect(tag.url).toBe(`${ORIGIN}/tags/admin-topic/`);
    const read = await getAdminTag(context("GET", undefined, tag.id));
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({id: tag.id, name: "Admin topic"});

    const updated = await updateAdminTag(context("PUT", {name: "Renamed topic"}, tag.id));
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({id: tag.id, name: "Renamed topic", slug: tag.slug});
    expect(await (await listAdminTags(context())).json()).toMatchObject({items: [{id: tag.id, name: "Renamed topic"}]});

    expect((await deleteAdminTag(context("DELETE", undefined, tag.id))).status).toBe(200);
    const deleted = await getAdminTag(context("GET", undefined, tag.id));
    expect(deleted.status).toBe(404);
    expect(await deleted.json()).toEqual({error: "Tag not found."});
    expect(await (await listAdminTags(context())).json()).toEqual({items: []});
  });

  it("serves scoped feeds and page metadata, redirects old feed URLs, and respects offline/headless", async () => {
    const tag = await saveTag(env.FEED_DB, ORIGIN, {name: "Public topic", description: "<script>not markup</script>"});
    await createItem(crud, {title: "Published", tag_ids: [tag.id]}, "tagtest-public");
    await createItem(crud, {title: "Private", status: "unpublished", tag_ids: [tag.id]}, "tagtest-private");
    const json = await tagFeedResponse(new Request(tag.json_url), tag.slug, "json");
    expect(json.status).toBe(200);
    expect(await json.json()).toMatchObject({title: tag.name, home_page_url: tag.url, feed_url: tag.json_url,
      items: [{id: "tagtest-public"}], _microfeed: {tag: {id: tag.id}}});
    const rss = await tagFeedResponse(new Request(tag.rss_url), tag.slug, "rss");
    const rssText = await rss.text();
    expect(rssText).toContain(`href="${tag.rss_url}"`);
    expect(rssText).toContain("&lt;script&gt;not markup&lt;/script&gt;");
    expect(rssText).not.toContain("<script>not markup</script>");
    expect(await (await tagFeedResponse(new Request(tag.json_url, {method: "HEAD"}), tag.slug, "json")).text()).toBe("");
    const page = await publicTagPage(new Request(tag.url), tag.slug);
    expect(page).not.toBeInstanceOf(Response);
    if (!(page instanceof Response)) {
      expect(page.metadataHtml).toContain(`href="${tag.url}"`);
      expect(page.bodyHtml).toContain("&lt;script&gt;");
      expect(page.bodyHtml).not.toContain("<script>not markup");
      expect(page.bodyHtml).not.toContain("Private");
    }
    const renamed = await saveTag(env.FEED_DB, ORIGIN, {slug: "renamed"}, tag);
    for (const format of ["rss", "json"] as const) {
      const response = await tagFeedResponse(new Request(`${tag[`${format}_url`]}?limit=2`), tag.slug, format);
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe(`${renamed[`${format}_url`]}?limit=2`);
    }
    await db._updateOrAddSetting({access: {currentPolicy: "headless"}}, "access");
    expect((await publicTagPage(new Request(renamed.url), renamed.slug) as Response).status).toBe(404);
    expect((await tagFeedResponse(new Request(renamed.json_url), renamed.slug, "json")).status).toBe(200);
    await db._updateOrAddSetting({access: {currentPolicy: "offline"}}, "access");
    expect((await tagFeedResponse(new Request(renamed.json_url), renamed.slug, "json")).status).toBe(404);
  });

  it("enforces Bearer read/write scopes on every tag API route", async () => {
    await updateApiAccessSettings(env.FEED_DB, {enabled: true, publicDocsEnabled: false});
    const reader = await createApiKey(env.FEED_DB, {name: "Tag test reader", scopes: ["content:read"]});
    for (const path of ["/api/v1/tags/", "/api/v1/tags/topic/", "/api/v1/tags/by-id/stable/"]) {
      const request = (method: string) => new Request(ORIGIN + path, {method, headers: {authorization: `Bearer ${reader.apiKey}`}});
      expect(await decideApiRequest(env.FEED_DB, request("GET"), path)).toBe("allow-integration");
      expect(await decideApiRequest(env.FEED_DB, request("PUT"), path)).toBe("insufficient-scope");
      expect(await decideApiRequest(env.FEED_DB, new Request(ORIGIN + path), path)).toBe("unauthorized");
    }
  });
  it("normalizes unique names, preserves slugs on rename, and keeps historical public routes only", async () => {
    const tag = await saveTag(env.FEED_DB, ORIGIN, {name: "  Cafe\u0301 世界  "});
    expect(tag.name).toBe("Café 世界");
    expect(apiTagOutputSchema.safeParse(tag).success).toBe(true);
    await expect(saveTag(env.FEED_DB, ORIGIN, {name: "CAFÉ 世界"})).rejects.toThrow("already exists");
    const renamed = await saveTag(env.FEED_DB, ORIGIN, {name: "A new name"}, tag);
    expect(renamed.slug).toBe(tag.slug);
    const moved = await saveTag(env.FEED_DB, ORIGIN, {slug: "新名字"}, renamed);
    expect(await getTag(env.FEED_DB, ORIGIN, tag.slug)).toBeNull();
    expect(await resolveTagRoute(env.FEED_DB, ORIGIN, tag.slug)).toMatchObject({id: tag.id, slug: "新名字"});
    expect(await getTag(env.FEED_DB, ORIGIN, tag.id, true)).toMatchObject({url: moved.url});
    await expect(saveTag(env.FEED_DB, ORIGIN, {name: "Another", slug: tag.slug})).rejects.toThrow("reserved");
    await deleteTag(env.FEED_DB, moved);
    expect(await resolveTagRoute(env.FEED_DB, ORIGIN, tag.slug)).toBeNull();
    expect(await resolveTagRoute(env.FEED_DB, ORIGIN, moved.slug)).toBeNull();
  });

  it("replaces memberships atomically, preserves omissions, and clears without deleting items", async () => {
    const a = await saveTag(env.FEED_DB, ORIGIN, {name: "Alpha"});
    const b = await saveTag(env.FEED_DB, ORIGIN, {name: "Beta"});
    const id = await createItem(crud, {title: "Original", tag_slugs: [a.slug, b.slug, a.slug]}, "tagtest-one");
    expect((await db.getItemById(id))?.tags).toHaveLength(2);
    await updateItem(db, crud, id, {title: "Retained"});
    expect((await db.getItemById(id))?.tags).toHaveLength(2);
    await expect(updateItem(db, crud, id, {title: "Must not save", tag_slugs: [a.slug, "missing"]})).rejects.toThrow("do not exist");
    expect(await db.getItemById(id)).toMatchObject({title: "Retained", tags: expect.any(Array)});
    await expect(updateItem(db, crud, id, {tag_slugs: [], tag_ids: []})).rejects.toThrow("not both");
    await updateItem(db, crud, id, {tag_ids: [b.id]});
    expect((await db.getItemById(id))?.tags.map((tag: {id: string}) => tag.id)).toEqual([b.id]);
    await deleteTag(env.FEED_DB, b);
    expect(await db.getItemById(id)).toMatchObject({title: "Retained", tags: []});
    await updateItem(db, crud, id, {tag_ids: [a.id]});
    await updateItem(db, crud, id, {tag_ids: []});
    expect((await db.getItemById(id))?.tags).toEqual([]);
  });

  it("filters before pagination and counts only published items across visibility transitions", async () => {
    const tag = await saveTag(env.FEED_DB, ORIGIN, {name: "Archive"});
    const other = await saveTag(env.FEED_DB, ORIGIN, {name: "Empty public tag"});
    for (const [id, status, date] of [["tagtest-first", "published", 1000], ["tagtest-last", "published", 3000], ["tagtest-unlisted", "unlisted", 4000], ["tagtest-draft", "unpublished", 5000]] as const) {
      await createItem(crud, {title: id, status, date_published_ms: date, tag_ids: [tag.id, other.id]}, id);
    }
    const content = await db.getContent({limit: 1, queryKwargs: {status: 1, tag_id: tag.id}});
    expect(content.items).toHaveLength(1);
    expect(content.items[0].id).toBe("tagtest-last");
    expect(await getTag(env.FEED_DB, ORIGIN, tag.id, true)).toMatchObject({published_item_count: 2});
    await updateItem(db, crud, "tagtest-last", {status: "unpublished"});
    await updateItem(db, crud, "tagtest-unlisted", {status: "published"});
    expect(await getTag(env.FEED_DB, ORIGIN, tag.id, true)).toMatchObject({published_item_count: 2});
    const empty = await saveTag(env.FEED_DB, ORIGIN, {name: "Zero"});
    expect(await listTags(env.FEED_DB, ORIGIN, 100)).toMatchObject({items: expect.arrayContaining([expect.objectContaining({id: empty.id, published_item_count: 0})])});
    const first = await listTags(env.FEED_DB, ORIGIN, 1);
    expect(first.next_cursor).toBeTruthy();
    const next = await listTags(env.FEED_DB, ORIGIN, 1, first.next_cursor);
    expect(next.items[0]?.id).not.toBe(first.items[0]?.id);
    const publicFeed = await db.getPublicJsonData(await db.getContent({queryKwargs: {status: 1, tag_id: tag.id}, limit: 20}));
    expect(apiFeedSchema.safeParse(publicFeed).success).toBe(true);
    expect(publicFeed.items).toHaveLength(2);
    expect(publicFeed.items[0].tags).toEqual(expect.arrayContaining(["Archive", "Empty public tag"]));
    const rss = new FeedPublicRssBuilder(publicFeed, ORIGIN).getRssData();
    expect(rss).toContain("<category>Archive</category>");
    expect(rss).not.toContain("tagtest-draft");
  });

  it("searches tag text independently using multilingual indexing and exempts tags from item filters", async () => {
    const tag = await saveTag(env.FEED_DB, ORIGIN, {name: "中文笔记", description: "我喜欢学习中文"});
    await createItem(crud, {title: "Unrelated item", tag_ids: [tag.id]}, "tagtest-independent");
    const result = await searchContent(env.FEED_DB, new Request(`${ORIGIN}/search.json?q=中文`), {
      fields: ["title", "content"], limit: 20, query: "中文", statuses: ["unpublished"],
      types: ["item", "page", "tag"], datePublishedMsGt: Date.now() + 86400000,
    });
    expect(result.items.map(item => item.id)).toEqual([tag.id]);
    expect(result.items[0]).toMatchObject({type: "tag", slug: tag.slug, web_url: tag.url});
    await deleteTag(env.FEED_DB, tag);
    expect((await searchContent(env.FEED_DB, new Request(`${ORIGIN}/search.json`), {
      fields: ["title"], limit: 20, query: "中文", statuses: ["published"], types: ["tag"],
    })).items).toEqual([]);
  });

  it("validates API name boundaries and resolves stable IDs without accepting old slugs", async () => {
    const call = (body: unknown, params = {}) => ({locals: {feedDb: db}, params,
      request: new Request(`${ORIGIN}/api/v1/tags/`, {method: "POST", body: JSON.stringify(body)})}) as unknown as APIContext;
    const bad = await createApiTag(call({name: "🌍".repeat(51)}));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({error: "Tag name must be 50 characters or fewer.", field: "name"});
    const response = await createApiTag(call({name: "🌍".repeat(50)}));
    expect(response.status).toBe(201);
    const tag = await response.json() as {id: string; slug: string};
    expect((await updateApiTag(call({slug: "new-slug"}, {tagId: tag.id}))).status).toBe(200);
    expect((await getApiTag(call(null, {slug: tag.slug}))).status).toBe(404);
    expect((await getApiTag(call(null, {tagId: tag.id}))).status).toBe(200);
    const listed = apiTagListResponseSchema.parse(await (await listApiTags(call(null))).json());
    expect(listed.items).toEqual([expect.objectContaining({id: tag.id, slug: "new-slug", published_item_count: 0})]);
    expect((await deleteApiTag(call(null, {slug: "new-slug"}))).status).toBe(200);
    expect((await getApiTag(call(null, {tagId: tag.id}))).status).toBe(404);
    expect(await (await listApiTags(call(null))).json()).toEqual({items: []});
  });

  it("emits one tag event without item fanout and reports membership-only changes as tags", async () => {
    const tag = await saveTag(env.FEED_DB, ORIGIN, {name: "Events"});
    const id = await createItem(crud, {title: "Stable"}, "tagtest-events");
    const before = await db.getItemById(id);
    const after = await updateItem(db, crud, id, {tag_ids: [tag.id]});
    const events = contentMutationWebhookInputs({kind: "item", mutation: "updated", id, before, after: after!});
    expect(events).toHaveLength(1);
    expect(events[0]?.changedFields).toEqual(["tags"]);
    const updated = await saveTag(env.FEED_DB, ORIGIN, {name: "Events renamed"}, tag);
    expect(contentMutationWebhookInputs({kind: "tag", mutation: "updated", id: tag.id, before: {...tag}, after: {...updated}})).toHaveLength(1);
    for (const type of ["tag.created", "tag.updated", "tag.deleted"] as const) {
      expect(apiWebhookEventSchema.safeParse(webhookGeneratedEnvelope(type)).success).toBe(true);
    }
  });

  it("validates assignments without mutating items or memberships", async () => {
    const tag = await saveTag(env.FEED_DB, ORIGIN, {name: "Validation"});
    const call = (body: unknown) => ({locals: {feedDb: db}, request: new Request(`${ORIGIN}/api/v1/items/validate/`,
      {method: "POST", body: JSON.stringify(body)})}) as unknown as APIContext;
    expect((await validateApiItem(call({title: "Valid", tag_slugs: [tag.slug]}))).status).toBe(200);
    expect((await validateApiItem(call({title: "Unknown", tag_ids: ["missing"]}))).status).toBe(400);
    expect((await validateApiItem(call({tag_ids: [], tag_slugs: []}))).status).toBe(400);
    expect(await env.FEED_DB.prepare("SELECT count(*) AS n FROM item_tags").first()).toEqual({n: 0});
  });

  it("delivers signed tag lifecycle events with stable resource links and no item fanout", async () => {
    const queued: string[] = [];
    const runtime = {...env, MICROFEED_CLOUDFLARE_ACCOUNT_ID: "account", MICROFEED_INSTANCE_ID: "tag-test",
      WEBHOOK_QUEUE: {sendBatch: async (messages: Array<{body: WebhookQueueMessage}>) => {
        queued.push(...messages.map(message => message.body.deliveryId));
      }}} as unknown as Env;
    const {secret} = await createWebhookEndpoint(runtime, {name: "Tag lifecycle", url: "https://automation.example/webhook",
      events: ["tag.created", "tag.updated", "tag.deleted", "item.updated"]}, ORIGIN);
    const request = new Request(`${ORIGIN}/api/v1/tags/`);
    const commit = (mutation: "created" | "updated" | "deleted", before?: import("@/shared/Tags").TagRecord) =>
      contentMutationWebhookCommit<import("@/shared/Tags").TagRecord>(runtime, request, {
        before: before ? {...before} : null, context: {origin: "api"}, kind: "tag", mutation,
        id: tag => tag.id, mapResult: tag => ({...tag}),
      });
    const tag = await saveTag(env.FEED_DB, ORIGIN, {name: "Delivery"}, undefined, commit("created"));
    for (let index = 0; index < 3; index++) await createItem(crud, {title: `Member ${index}`, tag_ids: [tag.id]}, `tagtest-delivery-${index}`);
    expect(queued).toHaveLength(1); // Counts alone do not emit tag.updated.
    const before = (await getTag(env.FEED_DB, ORIGIN, tag.id, true))!;
    const renamed = await saveTag(env.FEED_DB, ORIGIN, {name: "Renamed", slug: "moved"}, before, commit("updated", before));
    await deleteTag(env.FEED_DB, renamed, commit("deleted", renamed));
    expect(queued).toHaveLength(3); // Rename/delete never emit per-member item.updated.
    const requests: Request[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init)); return new Response(null, {status: 204});
    }));
    const types: string[] = [];
    for (const deliveryId of queued) {
      const ack = vi.fn();
      await processWebhookMessage(runtime, {body: {deliveryId}, ack, retry: vi.fn()} as unknown as Message<WebhookQueueMessage>);
      expect(ack).toHaveBeenCalledOnce();
      const delivered = requests.at(-1)!;
      const bytes = await delivered.text();
      expect(delivered.headers.get("webhook-signature")).toBe(await standardWebhookSignature(secret,
        deliveryId, Number(delivered.headers.get("webhook-timestamp")), bytes));
      const event = apiWebhookEventSchema.parse(JSON.parse(bytes));
      types.push(event.type);
      expect(event.subject).toMatchObject({id: tag.id, type: "tag", api_path: `/api/v1/tags/by-id/${tag.id}/`});
      expect(event.data).toMatchObject({object: {id: tag.id}});
    }
    expect(types).toEqual(["tag.created", "tag.updated", "tag.deleted"]);
    expect((await db.getItemById("tagtest-delivery-0"))?.tags).toEqual([]);
  });
});
