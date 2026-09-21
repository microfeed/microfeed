import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";
import FeedDb from "@/server/feed/FeedDb";
import {searchContent, ItemSearchUnavailableError, type ItemSearchOptions} from "@/server/items/search";
import {characterIndexStatements} from "@/server/items/character-index";
import {createPage, updatePage, deletePage} from "@/server/pages/service";
import {getAdminItemSearch} from "@/pages/[adminPath]/ajax/search/index";
import {GET as searchJson} from "@/pages/search.json";
import {searchApiItems} from "@/server/api/handlers";
import {apiSearchResponseSchema} from "@/shared/ApiSchemas";
import type {APIContext} from "astro";

const request = new Request("https://feed.example.com/api/v1/search/");
let db: FeedDb;

async function save(id: string, title: string, body = "", status = 1) {
  await db.putContent({item: {
    id: `character-${id}`, title, description: body, status,
    pubDateMs: Date.parse("2026-08-01T00:00:00.000Z"),
  }});
}

function search(query: string, overrides: Partial<ItemSearchOptions> = {}) {
  return searchContent(env.FEED_DB, request, {
    query, fields: ["title", "content"], limit: 20, statuses: ["published"],
    ...overrides,
  });
}

beforeEach(async () => {
  await env.FEED_DB.prepare("DELETE FROM items WHERE id LIKE 'character-%'").run();
  await env.FEED_DB.prepare("DELETE FROM page_paths WHERE slug LIKE 'character-%'").run();
  await env.FEED_DB.prepare("DELETE FROM pages WHERE slug LIKE 'character-%'").run();
  db = new FeedDb(env, request);
  await db.getContent();
  // Simulate the deployment backfill for migration-seeded Pages.
  const rows = await env.FEED_DB.prepare("SELECT * FROM site_search_documents").all<{
    content_type: "item" | "page"; content_id: string; title: string; content_text: string;
  }>();
  for (const row of rows.results) await env.FEED_DB.batch(characterIndexStatements(
    env.FEED_DB, row.content_type, row.content_id, row.title, row.content_text,
  ));
  await env.FEED_DB.prepare("UPDATE site_search_metadata SET ready = 1 WHERE id = 1").run();
});

describe("D1 multilingual search", () => {
  it.each([
    ["我喜欢学习中文和人工智能", "中文"],
    ["我喜欢学习中文和人工智能", "人工智能"],
    ["今日は東京で日本語を勉強します", "東京"],
    ["한국어검색테스트", "검색"],
    ["ภาษาไทยสำหรับทุกคน", "ภาษาไทย"],
    ["开头𠀀𠀁结尾", "𠀀𠀁"],
    ["日本のか\u3099く", "がく"],
  ])("finds %s by %s", async (title, query) => {
    await save("literal", title);
    const result = await search(query);
    expect(result.items.map((item) => item.id)).toEqual(["character-literal"]);
    expect(result.items[0]?.match_type).toBe("exact");
    expect(result.items[0]?.highlights.title.some((segment) => segment.matched)).toBe(true);
  });

  it.each([
    ["中文", "人工智能"], ["東京", "日本語"], ["검색", "한국어"], ["คน", "ภาษาไทย"],
  ])("finds %s and longer substrings at every position", async (short, long) => {
    for (const term of [short, long]) {
      for (const [position, title] of [`${term}开末`, `开${term}末`, `开末${term}`].entries()) {
        await save(`position-${position}`, title);
      }
      expect((await search(term)).items.map((item) => item.id).sort()).toEqual([
        "character-position-0", "character-position-1", "character-position-2",
      ]);
    }
  });

  it("combines word and literal clauses across fields and chunks", async () => {
    await save("mixed", "OpenAI 中文", "开".repeat(3000) + "人工智能");
    await save("wrong", "OpenAI 中文", "人工，然后工智和智能");
    expect((await search('OpenAI 中文 "人工智能"')).items.map((item) => item.id))
      .toEqual(["character-mixed"]);
    expect((await search("中文 人工智能", {fields: ["title"]})).items).toEqual([]);
    expect((await search("人工智能", {fields: ["content"]})).items.map((item) => item.id))
      .toEqual(["character-mixed"]);
    expect((await search("OpenAl 中文")).items).toEqual([]);
  });

  it("indexes a large normalized Unicode body inside the content transaction", async () => {
    await save("bulk", "Bulk body", "开".repeat(17000) + "𠀀𠀁か\u3099く" + "中".repeat(3000) + "\u0000中文" + "末".repeat(17000));
    for (const query of ["𠀀𠀁", "がく", "中文", "开𠀀"]) {
      expect((await search(query, {fields: ["content"]})).items.map((item) => item.id))
        .toEqual(["character-bulk"]);
    }
  });

  it.each([["Café français", "cafe"], ["Привет мир", "мир"], ["مرحبا بالعالم", "مرحبا"]])(
    "preserves word matching for %s", async (title, query) => {
      await save("word", title);
      expect((await search(query)).items.map((item) => item.id)).toEqual(["character-word"]);
    },
  );

  it("paginates once per document and favors title matches", async () => {
    await save("title", "中文", "");
    await save("body", "Body", "中文".repeat(2500));
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const result = await search("中文", {limit: 1, nextCursor: cursor});
      seen.push(...result.items.map((item) => item.id));
      cursor = result.next_cursor;
    } while (cursor);
    expect(seen).toEqual(["character-title", "character-body"]);
  });

  it("accepts a maximum-length query with many literal clauses", async () => {
    await save("many", "中文");
    expect((await search("中文 ".repeat(66).trim())).items.map((item) => item.id))
      .toEqual(["character-many"]);
  });

  it("retains metadata updates, reindexes edits, and removes deleted content", async () => {
    await save("edit", "中文内容");
    await env.FEED_DB.prepare("UPDATE items SET updated_at = '2026-09-01', data = json_set(data, '$.image', 'cover.png') WHERE id = 'character-edit'").run();
    expect((await search("中文")).items).toHaveLength(1);
    await save("edit", "日本語内容");
    expect((await search("中文")).items).toEqual([]);
    expect((await search("日本語")).items).toHaveLength(1);
    await save("edit", "日本語内容", "", 3);
    expect((await search("日本語")).items).toEqual([]);
  });

  it("refuses an incomplete old-writer projection", async () => {
    await save("old", "中文内容");
    await env.FEED_DB.prepare("UPDATE items SET data = json_set(data, '$.title', '新中文内容') WHERE id = 'character-old'").run();
    await expect(search("中文")).rejects.toBeInstanceOf(ItemSearchUnavailableError);
  });

  it("searches draft Pages through the service and excludes them publicly", async () => {
    const page = await createPage(db, request, {title: "中文页面", slug: "character-page", show_in_navigation: false});
    expect((await search("中文", {types: ["page"], statuses: ["unpublished"]})).items.map((item) => item.id)).toEqual([page.id]);
    expect((await search("中文", {types: ["page"]})).items).toEqual([]);
    await updatePage(db, request, page.id, {title: "日本語ページ"});
    expect((await search("中文", {types: ["page"], statuses: ["unpublished"]})).items).toEqual([]);
    await deletePage(db, page.id);
    expect((await search("日本語", {types: ["page"], statuses: ["unpublished"]})).items).toEqual([]);
  });

  it("keeps the API shape and one-character compatibility while enforcing the UI minimum", async () => {
    await save("api", "中文内容");
    expect((await search("中")).items).toHaveLength(1);
    const admin = await getAdminItemSearch(new Request("https://feed.example.com/admin/ajax/search?q=中文"), env, "admin");
    expect((await admin.json() as {items: unknown[]}).items).toHaveLength(1);
    const short = await getAdminItemSearch(new Request("https://feed.example.com/admin/ajax/search?q=𠀀"), env, "admin");
    expect((await short.json() as {items: unknown[]}).items).toEqual([]);
    expect((await searchJson({request: new Request("https://feed.example.com/search.json?q=𠀀")} as APIContext)).status).toBe(400);
    const response = await searchApiItems({
      request: new Request("https://feed.example.com/api/v1/search/?q=中文"),
      locals: {feedDb: db},
    } as APIContext);
    expect(response.status).toBe(200);
    expect(apiSearchResponseSchema.safeParse(await response.json()).success).toBe(true);
  });
});
