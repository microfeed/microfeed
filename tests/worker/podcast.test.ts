import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";
import type {APIContext, APIRoute} from "astro";
import FeedDb from "@/server/feed/FeedDb";
import FeedCrudManager from "@/server/feed/FeedCrudManager";
import FeedPublicRssBuilder from "@/server/feed/FeedPublicRssBuilder";
import {createItem, updateItem, deleteItem} from "@/server/items/service";
import {createApiItem, updateApiItem, updateApiPrimaryChannel} from "@/server/api/handlers";
import {jsonFeedResponse, podcastChaptersResponse, rssFeedResponse} from "@/server/feed/responses";
import {apiFeedSchema} from "@/shared/ApiSchemas";

const origin = "https://podcast.example.com";
const request = new Request(origin);
let db: FeedDb;
let crud: FeedCrudManager;
const channelPodcast = {people: [{name: "Regular host", role: "host", group: "cast", href: `${origin}/host`, img: `${origin}/host.jpg`}],
  funding: [{label: "Support the show", url: `${origin}/support`}, {label: "Membership", url: `${origin}/join`}],
  license: {identifier: "cc-by-4.0"}, locked: true};
const itemPodcast = {people: [{name: "Guest", role: "guest"}],
  transcripts: [{url: `${origin}/episode.vtt`, type: "text/vtt", language: "en"}, {url: `${origin}/episode.srt`, type: "application/x-subrip", language: "fr"}],
  chapters: [{startTime: 0, title: "Introduction"}, {startTime: 90.5, title: "Interview", img: `${origin}/chapter.jpg`, url: `${origin}/topic`}],
  license: {identifier: "Custom license", url: `${origin}/license`}};

beforeEach(async () => {
  await env.FEED_DB.exec("DELETE FROM items; DELETE FROM item_paths;");
  await env.FEED_DB.exec("UPDATE channels SET data = json_remove(data, '$.podcast');");
  db = new FeedDb(env, request);
  await db.getContent();
  await db._updateOrAddSetting({access: {currentPolicy: "public"}}, "access");
  await db._updateOrAddSetting({subscribeMethods: {methods: []}}, "subscribeMethods");
  crud = new FeedCrudManager(await db.getContent(), db, request);
});
const call = (route: APIRoute, body: unknown, itemId?: string) => route({
  locals: {feedDb: db, feedCrud: crud}, params: {itemId, channelId: "primary"},
  request: new Request(`${origin}/api/v1/items/`, {method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify(body)}),
} as unknown as APIContext);
const chapters = (slug: string, method = "GET") => podcastChaptersResponse(new Request(`${origin}/i/${slug}/chapters.json`, {method}), slug);

describe("podcast persistence and feed contracts", () => {
  it("round trips every field through API, JSON Feed, and RSS without changing existing metadata", async () => {
    expect((await call(updateApiPrimaryChannel, {_microfeed: {podcast: channelPodcast}})).status).toBe(200);
    const response = await call(createApiItem, {title: "Episode", content_html: "<p>Show notes</p>", status: "published", _microfeed: {podcast: itemPodcast}});
    expect(response.status).toBe(201);
    const {id} = await response.json() as {id: string};
    expect((await db.getItemById(id))?.podcast).toEqual(itemPodcast);
    const jsonResponse = await jsonFeedResponse(new Request(`${origin}/json/`));
    expect(jsonResponse.status).toBe(200);
    const json = await jsonResponse.json() as any;
    expect(apiFeedSchema.safeParse(json).success).toBe(true);
    expect(json._microfeed.podcast).toEqual(channelPodcast);
    expect(json.items[0]._microfeed.podcast).toEqual(itemPodcast);
    expect(json.items[0]).toMatchObject({title: "Episode", content_html: "<p>Show notes</p>"});
    const rss = new FeedPublicRssBuilder(json, origin).getRssData();
    expect(rss).toContain("xmlns:podcast='https://podcastindex.org/namespace/1.0'");
    expect(rss).toContain("<podcast:locked>yes</podcast:locked>");
    expect(rss.match(/<podcast:funding /g)).toHaveLength(2);
    expect(rss.match(/<podcast:transcript /g)).toHaveLength(2);
    expect(rss).toContain(`${origin}/i/${id}/chapters.json`);
    expect(rss).toContain("Show notes");
    const body = await (await chapters(id)).json();
    expect(body).toEqual({version: "1.2.0", chapters: itemPodcast.chapters});
  });

  it("merges partial edits, replaces lists, and clears individual fields or all podcast metadata", async () => {
    await crud.upsertChannel({_microfeed: {podcast: channelPodcast}});
    const id = await createItem(crud, {title: "Episode", _microfeed: {podcast: itemPodcast}});
    await updateItem(db, crud, id, {_microfeed: {podcast: {transcripts: [{url: `${origin}/new.vtt`, type: "text/vtt"}]}}});
    expect((await db.getItemById(id))?.podcast).toMatchObject({people: itemPodcast.people, chapters: itemPodcast.chapters, transcripts: [{url: `${origin}/new.vtt`, type: "text/vtt"}]});
    expect((await call(updateApiItem, {_microfeed: {podcast: {people: null, license: null, chapters: []}}}, id)).status).toBe(200);
    const cleared = (await db.getItemById(id))?.podcast;
    expect(cleared).not.toHaveProperty("people");
    expect(cleared).not.toHaveProperty("license");
    expect(cleared?.transcripts).toHaveLength(1);
    expect((await chapters(id)).status).toBe(404);
    await updateItem(db, crud, id, {_microfeed: {podcast: null}});
    expect((await db.getItemById(id))?.podcast).toBeUndefined();
    await crud.upsertChannel({_microfeed: {podcast: {locked: false, funding: null}}});
    expect(crud.feedContent.channel.podcast).toMatchObject({locked: false, people: channelPodcast.people});
    expect(crud.feedContent.channel.podcast).not.toHaveProperty("funding");
    await crud.upsertChannel({_microfeed: {podcast: null}});
    expect(crud.feedContent.channel.podcast).toBeUndefined();
  });

  it("rejects invalid API and admin saves without corrupting existing entries", async () => {
    const id = await createItem(crud, {_microfeed: {podcast: itemPodcast}});
    for (const podcast of [{locked: true}, {chapters: [{startTime: -1, title: "Bad"}]}, {people: [{name: ""}]}, {transcripts: [{url: "javascript:alert(1)", type: "text/vtt"}]}]) {
      expect((await call(updateApiItem, {_microfeed: {podcast}}, id)).status).toBe(400);
    }
    expect((await call(updateApiPrimaryChannel, {_microfeed: {podcast: {transcripts: []}}})).status).toBe(400);
    const item = await db.getItemById(id);
    await expect(crud.saveInternalItem({...item, podcast: {chapters: [{startTime: 1, title: ""}]}})).rejects.toThrow();
    expect((await db.getItemById(id))?.podcast).toEqual(itemPodcast);
  });
});

describe("public chapter documents", () => {
  it("protects drafts/deleted items, serves published and unlisted aliases, and supports HEAD", async () => {
    const id = await createItem(crud, {title: "Episode", status: "unpublished", _microfeed: {slug: "first-address", podcast: itemPodcast}});
    expect((await chapters(id)).status).toBe(404);
    await updateItem(db, crud, id, {status: "published"});
    await updateItem(db, crud, id, {_microfeed: {slug: "new-address"}});
    for (const alias of [id, "first-address", "new-address"]) {
      const response = await chapters(alias);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json+chapters");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(await response.json()).toEqual({version: "1.2.0", chapters: itemPodcast.chapters});
    }
    const head = await chapters(id, "HEAD");
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    await updateItem(db, crud, id, {status: "unlisted"});
    expect((await chapters(id)).status).toBe(200);
    await deleteItem(db, crud, id);
    expect((await chapters(id)).status).toBe(404);
    expect((await chapters("missing")).status).toBe(404);
  });
  it("follows feed availability and RSS settings, including headless sites", async () => {
    const id = await createItem(crud, {title: "Episode", status: "published", _microfeed: {podcast: itemPodcast}});
    await db._updateOrAddSetting({access: {currentPolicy: "offline"}}, "access");
    expect((await chapters(id)).status).toBe(404);
    expect(await (await chapters(id, "HEAD")).text()).toBe("");
    await db._updateOrAddSetting({access: {currentPolicy: "headless"}}, "access");
    expect((await chapters(id)).status).toBe(200);
    await db._updateOrAddSetting({subscribeMethods: {methods: [{type: "rss", editable: false, enabled: false}]}}, "subscribeMethods");
    expect((await chapters(id)).status).toBe(404);
    expect((await rssFeedResponse(new Request(`${origin}/rss/`))).status).toBe(404);
  });
});
