import {env} from "cloudflare:workers";
import {beforeEach, describe, expect, it} from "vitest";

import FeedDb from "@/server/feed/FeedDb";
import {
  assignItemSeries,
  createSeries,
  deleteSeries,
  getSeriesById,
  listSeries,
  SeriesConflictError,
  SeriesRequestError,
  seriesForItems,
  updateSeries,
} from "@/server/series/service";
import {SERIES_KINDS} from "@/shared/Series";
import {STATUSES} from "@/shared/Constants";

const ORIGIN = "https://feed.example.com";

async function database(pathname = "/"): Promise<FeedDb> {
  const request = new Request(`${ORIGIN}${pathname}`);
  const db = new FeedDb(env, request);
  await db.getContent();
  return db;
}

async function saveItem(
  db: FeedDb,
  id: string,
  title: string,
  series?: unknown,
): Promise<void> {
  await db.putContent({
    item: {
      description: `<p>${title}</p>`,
      id,
      pubDateMs: Date.parse("2026-08-01T10:00:00.000Z"),
      series,
      status: STATUSES.PUBLISHED,
      title,
    },
  });
}

beforeEach(async () => {
  await env.FEED_DB.prepare("DELETE FROM item_series").run();
  await env.FEED_DB.prepare("DELETE FROM series").run();
  await env.FEED_DB.prepare("DELETE FROM items WHERE id LIKE 'ser-%'").run();
});

describe("series service", () => {
  it("creates, lists, updates, and deletes series scoped by kind", async () => {
    const db = await database();
    const created = await createSeries(db.FEED_DB, {
      kind: SERIES_KINDS.POST,
      name: "Building in Public",
    });
    expect(created.name).toBe("Building in Public");
    expect(created.slug).toBe("building-in-public");
    expect(created.kind).toBe(SERIES_KINDS.POST);
    expect(created.id).toBeTruthy();

    const listed = await listSeries(db.FEED_DB);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      kind: SERIES_KINDS.POST,
      name: "Building in Public",
      slug: "building-in-public",
    });

    const updated = await updateSeries(db.FEED_DB, created.id, {
      description: "A series about shipping.",
      name: "Building in Public 2",
    });
    expect(updated.name).toBe("Building in Public 2");
    expect(updated.slug).toBe("building-in-public");
    expect(updated.description).toBe("A series about shipping.");

    await deleteSeries(db.FEED_DB, created.id);
    expect(await listSeries(db.FEED_DB)).toHaveLength(0);
    expect(await getSeriesById(db.FEED_DB, created.id)).toBeNull();
  });

  it("filters series by kind", async () => {
    const db = await database();
    await createSeries(db.FEED_DB, {kind: SERIES_KINDS.POST, name: "Essays"});
    await createSeries(db.FEED_DB, {
      kind: SERIES_KINDS.PODCAST,
      name: "Podcast Series",
    });

    const posts = await listSeries(db.FEED_DB, SERIES_KINDS.POST);
    expect(posts.map((entry) => entry.name)).toEqual(["Essays"]);
    const podcasts = await listSeries(db.FEED_DB, SERIES_KINDS.PODCAST);
    expect(podcasts.map((entry) => entry.name)).toEqual(["Podcast Series"]);
  });

  it("rejects duplicate names and slugs within a kind", async () => {
    const db = await database();
    await createSeries(db.FEED_DB, {kind: SERIES_KINDS.POST, name: "Essays"});
    await expect(createSeries(db.FEED_DB, {
      kind: SERIES_KINDS.POST,
      name: "essays",
    })).rejects.toBeInstanceOf(SeriesConflictError);
    await expect(createSeries(db.FEED_DB, {
      kind: SERIES_KINDS.POST,
      name: "Notes",
      slug: "essays",
    })).rejects.toBeInstanceOf(SeriesConflictError);
  });

  it("allows the same name and slug across different kinds", async () => {
    const db = await database();
    const post = await createSeries(db.FEED_DB, {
      kind: SERIES_KINDS.POST,
      name: "Season One",
    });
    const podcast = await createSeries(db.FEED_DB, {
      kind: SERIES_KINDS.PODCAST,
      name: "Season One",
    });
    expect(post.slug).toBe("season-one");
    expect(podcast.slug).toBe("season-one");
    expect(post.id).not.toBe(podcast.id);
  });

  it("rejects empty names and invalid kinds", async () => {
    const db = await database();
    await expect(createSeries(db.FEED_DB, {kind: SERIES_KINDS.POST, name: "  "}))
      .rejects.toBeInstanceOf(SeriesRequestError);
    await expect(createSeries(db.FEED_DB, {
      kind: "video" as never,
      name: "Bad",
    })).rejects.toBeInstanceOf(SeriesRequestError);
  });

  it("assigns an item to a series with a number and clears it", async () => {
    const db = await database();
    const series = await createSeries(db.FEED_DB, {
      kind: SERIES_KINDS.POST,
      name: "Essays",
    });

    await assignItemSeries(db.FEED_DB, "ser-item-1", {
      id: series.id,
      series_number: 3,
    });
    const byItem = await seriesForItems(db.FEED_DB, ["ser-item-1"]);
    expect(byItem.get("ser-item-1")).toMatchObject({
      series: {id: series.id, name: "Essays"},
      series_number: 3,
    });

    await assignItemSeries(db.FEED_DB, "ser-item-1", null);
    expect(await seriesForItems(db.FEED_DB, ["ser-item-1"]))
      .not.toHaveProperty("ser-item-1");
  });

  it("ignores invalid series numbers", async () => {
    const db = await database();
    const series = await createSeries(db.FEED_DB, {
      kind: SERIES_KINDS.POST,
      name: "Essays",
    });
    await assignItemSeries(db.FEED_DB, "ser-item-2", {
      id: series.id,
      series_number: -5,
    });
    const byItem = await seriesForItems(db.FEED_DB, ["ser-item-2"]);
    expect(byItem.get("ser-item-2")?.series_number).toBeNull();
  });
});

describe("item series persistence", () => {
  it("round-trips series through putContent and getContent", async () => {
    const db = await database();
    const series = await createSeries(db.FEED_DB, {
      kind: SERIES_KINDS.POST,
      name: "Essays",
    });

    await saveItem(db, "ser-item-3", "Hello", {
      id: series.id,
      series_number: 2,
    });
    const content = await db.getContent({
      limit: 10,
      queryKwargs: {id: "ser-item-3"},
      searchParams: new URLSearchParams(),
    });
    const item = content.items?.[0];
    expect(item).toBeTruthy();
    expect(item.series).toMatchObject({
      id: series.id,
      kind: SERIES_KINDS.POST,
      name: "Essays",
      slug: "essays",
      series_number: 2,
    });
  });

  it("clears the series assignment when saving an item without one", async () => {
    const db = await database();
    const series = await createSeries(db.FEED_DB, {
      kind: SERIES_KINDS.POST,
      name: "Essays",
    });
    await saveItem(db, "ser-item-4", "First", {id: series.id});
    await saveItem(db, "ser-item-4", "Second", null);
    const content = await db.getContent({
      limit: 10,
      queryKwargs: {id: "ser-item-4"},
      searchParams: new URLSearchParams(),
    });
    expect(content.items?.[0]?.series).toBeNull();
  });

  it("exposes series in the public JSON feed", async () => {
    const db = await database();
    const series = await createSeries(db.FEED_DB, {
      kind: SERIES_KINDS.POST,
      description: "A series about writing.",
      name: "Essays",
    });
    await saveItem(db, "ser-item-5", "Public post", {
      id: series.id,
      series_number: 4,
    });

    const publicFeed = await db.getPublicJsonData(
      await db.getContent({
        limit: 10,
        queryKwargs: {id: "ser-item-5"},
        searchParams: new URLSearchParams(),
      }),
      true,
    );
    const item = publicFeed.items?.[0];
    expect(item.series).toEqual({
      id: series.id,
      kind: SERIES_KINDS.POST,
      name: "Essays",
      slug: "essays",
      description: "A series about writing.",
      series_number: 4,
    });
  });
});
