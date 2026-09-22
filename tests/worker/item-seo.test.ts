import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";
import FeedDb from "@/server/feed/FeedDb";
import FeedCrudManager from "@/server/feed/FeedCrudManager";
import FeedPublicRssBuilder from "@/server/feed/FeedPublicRssBuilder";
import {createItem, deleteItem, updateItem} from "@/server/items/service";
import {resolveItemRoute} from "@/server/items/urls";
import {effectiveSocialImage, resolveMetadata} from "@/server/seo/metadata";
import {apiFeedSchema} from "@/shared/ApiSchemas";
import {legacyItemPath} from "@/shared/ItemUrls";
import {jsonFeedResponse, rssFeedResponse} from "@/server/feed/responses";
import {createApiItem, updateApiItem, updateApiPrimaryChannel} from "@/server/api/handlers";
import {scheduleBestEffortMediaDeletion} from "@/server/media/deletions";
import {renderSiteFileForRequest} from "@/server/site-files/templates";
import {defaultSiteFileTemplate} from "@/shared/SiteFileTemplates";
import type {APIContext, APIRoute} from "astro";

const origin = "https://seo.example.com";
const request = new Request(origin);
let db: FeedDb;
let crud: FeedCrudManager;
beforeEach(async () => {
  await env.FEED_DB.exec("DELETE FROM items; DELETE FROM item_paths;");
  await env.FEED_DB.exec("UPDATE channels SET data = json_remove(data, '$.seo', '$.authorIdentities', '$.publisherIdentity');");
  db = new FeedDb(env, request);
  crud = new FeedCrudManager(await db.getContent(), db, request);
});

async function publicItem(id: string) {
  return db.getPublicJsonData({...crud.feedContent, items: [await db.getItemById(id)]}, true);
}

describe("durable item URLs", () => {
  it("follows draft titles, freezes on unlisting, reserves history, and hides deleted items", async () => {
    const id = await createItem(crud, {title: "学习 中文", status: "unpublished"});
    expect((await db.getItemById(id))?.publicPath).toBe("/i/学习-中文/");
    await updateItem(db, crud, id, {title: "Café"});
    expect((await db.getItemById(id))?.publicPath).toBe("/i/café/");
    expect(await env.FEED_DB.prepare("SELECT 1 FROM item_paths WHERE path = ?").bind("/i/学习-中文/").first()).toBeNull();
    await updateItem(db, crud, id, {status: "unlisted"});
    await updateItem(db, crud, id, {title: "Changed"});
    expect((await db.getItemById(id))?.publicPath).toBe("/i/café/");
    await updateItem(db, crud, id, {_microfeed: {slug: "新地址"}});
    await updateItem(db, crud, id, {_microfeed: {slug: "最新地址"}});
    expect(await resolveItemRoute(env.FEED_DB, encodeURIComponent("cafe\u0301"))).toBe(id);
    expect(await resolveItemRoute(env.FEED_DB, "新地址")).toBe(id);
    expect((await publicItem(id)).items[0]._microfeed.web_url).toBe(`${origin}/i/${encodeURIComponent("最新地址")}/`);
    await deleteItem(db, crud, id);
    expect(await db.getItemById(id)).toBeNull();
    await expect(createItem(crud, {title: "Other", _microfeed: {slug: "café"}})).rejects.toMatchObject({status: 409});
  });

  it("preserves legacy canonical paths through title edits and keeps ID aliases", async () => {
    const id = "Seolegacy01";
    await env.FEED_DB.prepare("INSERT INTO items (id, status, data, pub_date) VALUES (?, 1, ?, ?)")
      .bind(id, JSON.stringify({title: "Legacy title"}), new Date().toISOString()).run();
    await updateItem(db, crud, id, {title: "New title"});
    expect((await db.getItemById(id))?.publicPath).toBe(legacyItemPath({id, title: "Legacy title"}));
    expect(await resolveItemRoute(env.FEED_DB, id)).toBe(id);
    expect(await resolveItemRoute(env.FEED_DB, `arbitrary-${id}`)).toBe(id);
    await updateItem(db, crud, id, {_microfeed: {slug: "legacy-clean"}});
    expect(await resolveItemRoute(env.FEED_DB, `legacy-title-${id}`)).toBe(id);
  });

  it("resolves automatic collisions and atomically rejects competing custom claims", async () => {
    const ids = await Promise.all(Array.from({length: 3}, async () => {
      const own = new FeedCrudManager(await db.getContent(), db, request);
      return createItem(own, {title: "同名"});
    }));
    const paths = await Promise.all(ids.map(async (id) => (await db.getItemById(id))?.publicPath));
    expect(new Set(paths).size).toBe(3);
    const claims = await Promise.allSettled(ids.slice(0, 2).map(async (id) => {
      const own = new FeedCrudManager(await db.getContent(), db, request);
      return updateItem(db, own, id, {title: "Claim winner", _microfeed: {slug: "shared"}});
    }));
    expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(1);
    const loser = claims.findIndex((claim) => claim.status === "rejected");
    expect((await db.getItemById(ids[loser]!))?.title).toBe("同名");
  });

  it("rejects unsafe slugs and takeover of historical raw IDs", async () => {
    const id = "legacyid001";
    await createItem(crud, {title: "Old"}, id);
    await deleteItem(db, crud, id);
    for (const slug of [id, `prefix-${id}`]) {
      await expect(createItem(crud, {_microfeed: {slug}})).rejects.toMatchObject({status: 409});
    }
    for (const slug of ["a/b", "%E0%A4%A", "x?y", "x#z", "x\u0000y", "a\\b", "\u0301bad"]) {
      await expect(createItem(crud, {_microfeed: {slug}})).rejects.toMatchObject({status: 400});
    }
    expect(await resolveItemRoute(env.FEED_DB, "%2fprivate")).toBeNull();
    expect(await resolveItemRoute(env.FEED_DB, "%E0%A4%A")).toBeNull();
  });
});

describe("SEO feed contracts", () => {
  it("supports authenticated create/update/clear and returns 409 for custom URL conflicts", async () => {
    const call = (route: APIRoute, body: unknown, itemId?: string) => route({
      locals: {feedDb: db, feedCrud: crud}, params: {itemId, channelId: "primary"},
      request: new Request(`${origin}/api/v1/items/`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)}),
    } as unknown as APIContext);
    const response = await call(createApiItem, {title: "API article", _microfeed: {slug: "api-中文", seo: {title: "API SEO"}}});
    expect(response.status).toBe(201);
    const {id} = await response.json() as {id: string};
    expect((await call(updateApiItem, {_microfeed: {seo: {canonical_url: "not-a-url"}}}, id)).status).toBe(400);
    expect((await call(createApiItem, {_microfeed: {slug: "api-中文"}})).status).toBe(409);
    const other = await createItem(crud, {title: "Other"});
    expect((await call(updateApiItem, {_microfeed: {slug: "api-中文"}}, other)).status).toBe(409);
    const updated = await call(updateApiItem, {_microfeed: {seo: {title: null, description: "Kept"}}}, id);
    expect(updated.status).toBe(200);
    expect((await updated.json() as any)._microfeed.seo).toEqual({description: "Kept"});
    expect((await call(updateApiPrimaryChannel, {_microfeed: {seo: {title: "Homepage"}, authors: [{name: "Writer"}]}})).status).toBe(200);
    expect(crud.feedContent.channel).toMatchObject({seo: {title: "Homepage"}, authorIdentities: [{name: "Writer"}]});
  });

  it("serves clean JSON/RSS and ID endpoints, protects drafts, and keeps explicit RSS links", async () => {
    const id = await createItem(crud, {title: "Feed route", status: "unpublished", url: "https://link.example/", _microfeed: {slug: "中文"}});
    await db._updateOrAddSetting({access: {currentPolicy: "public"}}, "access");
    expect((await jsonFeedResponse(new Request(`${origin}/i/中文/json/`), false, "中文")).status).toBe(404);
    await updateItem(db, crud, id, {status: "unlisted", _microfeed: {seo: {canonical_url: "https://source.example/"}}});
    expect((await jsonFeedResponse(new Request(`${origin}/i/中文/json/`), false, "中文")).status).toBe(200);
    expect((await jsonFeedResponse(new Request(`${origin}/i/${id}/json/`), false, id)).status).toBe(200);
    const rss = await rssFeedResponse(new Request(`${origin}/i/中文/rss/`), "中文");
    expect(rss.status).toBe(200);
    expect(await rss.text()).toContain("https://link.example/");
  });

  it("excludes other canonical URLs only from the generated sitemap context", async () => {
    const id = await createItem(crud, {title: "External canonical", _microfeed: {seo: {canonical_url: "https://source.example/"}}});
    const publicFeed = await publicItem(id);
    const loaded = {feedContent: crud.feedContent, publicFeed};
    const options = {contentType: "application/xml" as const, filename: "sitemap.xml", template: defaultSiteFileTemplate("sitemap")!};
    const generated = await renderSiteFileForRequest(db, request, {...options, allowLargeGeneratedSitemap: true}, loaded);
    expect(generated.content).not.toContain("external-canonical");
    const override = await renderSiteFileForRequest(db, request, options, loaded);
    expect(override.content.replaceAll("&#x2F;", "/")).toContain(publicFeed.items[0]._microfeed.web_url);
  });

  it("retains a shared social image while removing an unreferenced replacement", async () => {
    const used = "production/images/shared.jpg";
    const unused = "production/images/unused.jpg";
    const id = await createItem(crud, {_microfeed: {seo: {social_image: {url: `${origin}/media/${used}`, width: 1200, height: 630, mime_type: "image/jpeg"}}}});
    const feed = await publicItem(id);
    expect(feed.items[0]._microfeed.seo.social_image.url).toBe(`${origin}/media/${used}`);
    expect(apiFeedSchema.safeParse(feed).success).toBe(true);
    const deleted: string[][] = [];
    const bucket = {async delete(keys: string[]) { deleted.push(keys); }} as Pick<R2Bucket, "delete">;
    const tasks: Promise<unknown>[] = [];
    scheduleBestEffortMediaDeletion(bucket, [used, unused], (task) => tasks.push(task), env.FEED_DB);
    await Promise.all(tasks);
    expect(deleted).toEqual([[unused]]);
  });

  it("round trips and clears overrides while leaving RSS and content fields intact", async () => {
    crud.feedContent.channel.publisher = "Podcast Publisher";
    const id = await createItem(crud, {title: "Real title", content_html: "<p>Real body</p>", image: `${origin}/cover.png`});
    const before = await publicItem(id);
    const rssBefore = new FeedPublicRssBuilder(before, origin).getRssData();
    await crud.upsertChannel({_microfeed: {
      authors: [{name: "Default writer", type: "Person", url: "https://writer.example/"}],
      publisher: {type: "Organization", url: "https://publisher.example/"},
      seo: {title: "Search homepage", description: "Homepage summary"},
    }});
    await updateItem(db, crud, id, {language: "zh-Hans", _microfeed: {
      seo: {title: "Search title", description: "Search summary", canonical_url: "https://original.example/story/",
        social_image: {url: `${origin}/social.jpg`, width: 1200, height: 630, mime_type: "image/jpeg", alt: "Example"}},
      authors: [{name: "Item writer", type: "Person"}],
    }});
    const after = await publicItem(id);
    expect(apiFeedSchema.safeParse(after).success).toBe(true);
    expect(after.items[0]).toMatchObject({title: "Real title", content_html: "<p>Real body</p>", image: `${origin}/cover.png`, authors: [{name: "Item writer"}]});
    expect(new FeedPublicRssBuilder(after, origin).getRssData()).toBe(rssBefore);
    await updateItem(db, crud, id, {_microfeed: {seo: {title: null}}});
    expect((await db.getItemById(id))?.seo).toMatchObject({description: "Search summary"});
    expect((await db.getItemById(id))?.seo).not.toHaveProperty("title");
    await updateItem(db, crud, id, {_microfeed: {seo: null, authors: null}, language: null});
    const cleared = await publicItem(id);
    expect(cleared.items[0]._microfeed.seo).toBeUndefined();
    expect(cleared.items[0].authors).toEqual([{name: "Default writer", url: "https://writer.example/"}]);
  });
});

describe("server metadata", () => {
  it("uses every social-image fallback and configured publisher/media identities", async () => {
    const social = {url: `${origin}/channel-social.jpg`, width: 1200 as const, height: 630 as const, mime_type: "image/jpeg" as const};
    const feed = {title: "Channel", icon: `${origin}/channel-cover.png`, _microfeed: {seo: {social_image: social},
      publisher: {name: "Publisher", type: "Organization", url: "https://publisher.example/", same_as: ["https://example.com/official/"]},
      authors: [{name: "Default author", type: "Person"}]}};
    const item = {title: "Audio", image: `${origin}/item-cover.png`, language: "ja", attachments: [{url: `${origin}/audio.mp3`, mime_type: "audio/mpeg"}],
      _microfeed: {web_url: `${origin}/i/audio/`, is_audio: true, authors: [{name: "Item author"}], seo: {social_image: {...social, url: `${origin}/item-social.jpg`}}}};
    expect(effectiveSocialImage(feed, item)?.url).toBe(`${origin}/item-social.jpg`);
    const inherited = {...item, _microfeed: {...item._microfeed, seo: {}}};
    expect(effectiveSocialImage(feed, inherited)?.url).toBe(item.image);
    expect(effectiveSocialImage(feed, {...inherited, image: undefined})?.url).toBe(social.url);
    expect(effectiveSocialImage({...feed, _microfeed: {}}, {...inherited, image: undefined})?.url).toBe(feed.icon);
    const {headHtml} = await resolveMetadata({feed, item, origin, headHtml: ""});
    const graph = JSON.parse(headHtml.match(/<script type="application\/ld\+json">(.*?)<\/script>/su)![1]!)["@graph"];
    expect(graph[1]).toMatchObject({"@type": "AudioObject", inLanguage: "ja", contentUrl: item.attachments[0]!.url,
      author: [{name: "Item author"}], publisher: {"@type": "Organization", name: "Publisher", sameAs: feed._microfeed.publisher.same_as}});
    const homepage = await resolveMetadata({feed, origin, headHtml: ""});
    expect(homepage.headHtml).toContain('"@type":"WebSite"');
    expect(homepage.headHtml).not.toContain('"author":');
  });

  it("deduplicates managed tags, preserves unrelated head and custom JSON-LD, and escapes overrides", async () => {
    const feed = {title: "Visible", _microfeed: {seo: {title: '<script>bad</script>', description: 'quote " & <tag>'}}};
    const result = await resolveMetadata({feed, origin, headHtml: '<title>Custom</title><title>Duplicate</title><meta name="description" content="custom"><style>.a{color:red}</style><script type="application/ld+json">{"custom":true}</script>'});
    expect(result.headHtml.match(/<title>/gu)).toHaveLength(1);
    expect(result.headHtml).toContain('&lt;script&gt;bad&lt;/script&gt;');
    expect(result.headHtml).toContain('<style>.a{color:red}</style>');
    expect(result.headHtml).toContain('{"custom":true}');
    expect(result.headHtml).not.toContain('<script>bad');
  });

  it("inherits images and accurate identities, applies canonical URLs, and forces unlisted noindex", async () => {
    const id = await createItem(crud, {title: "Article", status: "unlisted", _microfeed: {seo: {canonical_url: "https://original.example/article/"}}});
    const feed = await publicItem(id);
    feed.icon = `${origin}/cover.png`;
    feed._microfeed.authors = [{name: "A writer"}];
    const result = await resolveMetadata({feed, item: feed.items[0], origin,
      headHtml: '<meta name="robots" content="index"><meta name="googlebot" content="index"><link rel="canonical" href="https://wrong.example/"><meta property="og:url" content="https://wrong.example/">'});
    expect(result.headHtml).toContain('name="robots" content="noindex"');
    expect(result.headHtml).not.toContain('content="index"');
    expect(result.headHtml).not.toContain('wrong.example');
    expect(result.headHtml).toContain('property="og:image" content="https://seo.example.com/cover.png"');
    const graph = JSON.parse(result.headHtml.match(/<script type="application\/ld\+json">(.*?)<\/script>/su)![1]!)["@graph"];
    expect(graph[1]).toMatchObject({"@type": "BlogPosting", headline: "Article", author: [{name: "A writer"}], url: "https://original.example/article/"});
    expect(graph[1].author[0]).not.toHaveProperty("@type");
    expect(graph[1]).not.toHaveProperty("publisher");
  });

  it("preserves custom metadata when overrides are cleared", async () => {
    const result = await resolveMetadata({feed: {title: "Visible"}, origin, headHtml: '<title>Theme title</title><title>Duplicate</title><meta name="description" content="Custom description"><link rel="canonical" href="https://canonical.example/">'});
    expect(result.headHtml.match(/<title>/gu)).toHaveLength(1);
    expect(result.headHtml).toContain('<title>Theme title</title>');
    expect(result.headHtml).toContain('property="og:url" content="https://canonical.example/"');
  });
});
