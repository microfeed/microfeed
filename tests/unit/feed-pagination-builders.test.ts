import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

import FeedPublicJsonBuilder from "@/server/feed/FeedPublicJsonBuilder";
import FeedPublicRssBuilder from "@/server/feed/FeedPublicRssBuilder";
import {ITEMS_SORT_ORDERS} from "@/shared/Constants";
import {encodeItemCursor, ITEM_ORDERS, ITEM_SORTS} from "@/shared/ItemPagination";

const baseUrl = "https://feed.example.com";
const request = new Request(`${baseUrl}/json/`);

function publicJson(
  pagination: Record<string, unknown>,
  pageRequest: Request = request,
) {
  return new FeedPublicJsonBuilder(
    {
      channel: {title: "Pagination feed"},
      items: [],
      settings: {},
      ...pagination,
    },
    baseUrl,
    pageRequest,
  ).getJsonData() as any;
}

describe("public feed pagination links", () => {
  it("emits canonical metadata and escaped JSON and RSS links", () => {
    const nextCursor = encodeItemCursor(1_800_000_000_123, "item-a");
    const prevCursor = encodeItemCursor(1_700_000_000_000, "item-b");
    const json = publicJson({
      items_next_cursor: nextCursor,
      items_order: ITEM_ORDERS.ASC,
      items_prev_cursor: prevCursor,
      items_sort: ITEM_SORTS.UPDATED_AT,
    });

    expect(json.next_url).toBe(
      `${baseUrl}/json/?next_cursor=${nextCursor}&sort=updated_at&order=asc`,
    );
    expect(json._microfeed).toMatchObject({
      items_next_cursor: nextCursor,
      items_order: "asc",
      items_prev_cursor: prevCursor,
      items_sort: "updated_at",
      next_url: json.next_url,
      prev_url:
        `${baseUrl}/json/?prev_cursor=${prevCursor}&sort=updated_at&order=asc`,
    });
    expect(json._microfeed.items_sort_order).toBeUndefined();

    const rss = new FeedPublicRssBuilder(json, baseUrl).getRssData();
    expect(rss).toContain(
      `next_cursor=${nextCursor}&amp;sort=updated_at&amp;order=asc`,
    );
    expect(rss).toContain(
      `prev_cursor=${prevCursor}&amp;sort=updated_at&amp;order=asc`,
    );
  });

  it("emits only deprecated sort metadata for explicit legacy mode", () => {
    const json = publicJson({
      items_next_cursor: 1_800_000_000_123,
      items_sort_order: ITEMS_SORT_ORDERS.NEWEST_FIRST,
    });

    expect(json.next_url).toBe(
      `${baseUrl}/json/?next_cursor=1800000000123&sort=newest_first`,
    );
    expect(json._microfeed.items_sort_order).toBe("newest_first");
    expect(json._microfeed.items_sort).toBeUndefined();
    expect(json._microfeed.items_order).toBeUndefined();
  });

  it("emits absolute RSS enclosure URLs for same-site attachments", () => {
    const rss = new FeedPublicRssBuilder({
      _microfeed: {},
      items: [{
        _microfeed: {date_published_ms: 1_800_000_000_123},
        attachments: [{
          mime_type: "image/png",
          size_in_bytes: 80633,
          url: "/media/production/media/original.png",
        }],
        id: "photo-id",
        title: "Photo",
      }],
      title: "Media feed",
    }, baseUrl).getRssData();

    expect(rss).toContain(
      'enclosure url="https://feed.example.com/media/production/media/original.png"',
    );
    expect(rss).toContain('length="80633"');
  });

  it("uses generated pagination URLs in the default web theme", async () => {
    const filename = fileURLToPath(new URL(
      "../../themes/default/web-feed.mustache",
      import.meta.url,
    ));
    const theme = await readFile(filename, "utf8");

    expect(theme).toContain('href="{{_microfeed.next_url}}"');
    expect(theme).toContain('href="{{_microfeed.prev_url}}"');
    expect(theme).not.toContain("sort={{_microfeed.items_sort_order}}");

    const nextCursor = encodeItemCursor(1_800_000_000_123, "item-a");
    const webJson = publicJson({
      items_next_cursor: nextCursor,
      items_order: ITEM_ORDERS.DESC,
      items_sort: ITEM_SORTS.PUBLISHED_AT,
    }, new Request(`${baseUrl}/`));
    expect(webJson.next_url).toContain(`${baseUrl}/json/`);
    expect(webJson._microfeed.next_url).toBe(
      `${baseUrl}/?next_cursor=${nextCursor}&sort=published_at&order=desc`,
    );
  });
});
