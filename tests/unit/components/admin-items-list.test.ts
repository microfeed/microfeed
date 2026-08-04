import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, describe, expect, it, vi} from "vitest";

import AllItemsApp from "@/components/admin/items/AllItemsApp";
import {ITEMS_SORT_ORDERS, STATUSES} from "@/shared/Constants";
import type {FeedItem} from "@/types";

const ITEMS: FeedItem[] = [
  {
    id: "item-123",
    image: "images/item-123.png",
    mediaFile: {
      category: "audio",
      durationSecond: 65,
      url: "audio/example.mp3",
    },
    pubDateMs: Date.UTC(2026, 7, 4, 17, 0),
    status: STATUSES.PUBLISHED,
    title: "A published item",
  },
  {
    id: "item-very-long",
    pubDateMs: Date.UTC(2026, 7, 3, 17, 0),
    status: STATUSES.PUBLISHED,
    title: "An intentionally very long item title that should remain constrained to the title column instead of expanding the table",
  },
];

function renderItemsList(
  search = "?status=published&sort=newest_first",
  items: FeedItem[] = ITEMS,
) {
  vi.stubGlobal("window", {
    location: {
      hostname: "feed.example.com",
      search,
    },
  });

  return renderToStaticMarkup(
    React.createElement(AllItemsApp, {
      feedContent: {
        items,
        items_next_cursor: 123,
        items_sort_order: ITEMS_SORT_ORDERS.NEWEST_FIRST,
        settings: {
          webGlobalSettings: {
            publicBucketUrl: "https://media.example.com/",
          },
        },
      },
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("admin items list", () => {
  it("renders the requested filters and four-column layout", () => {
    const output = renderItemsList();

    expect(output.indexOf(">All items</a>")).toBeLessThan(
      output.indexOf(">Published</a>"),
    );
    expect(output.indexOf(">Published</a>")).toBeLessThan(
      output.indexOf(">Unlisted</a>"),
    );
    expect(output.indexOf(">Unlisted</a>")).toBeLessThan(
      output.indexOf(">Unpublished</a>"),
    );
    expect(output.match(/<th\b/gu)).toHaveLength(4);
    expect(output).toContain(">Title</th>");
    expect(output).toContain("Published at");
    expect(output).toContain(">Media</th>");
    expect(output).toContain(">Actions</th>");
  });

  it("links the title and renders status, public page, media, and edit action", () => {
    const output = renderItemsList();

    expect(output).toContain("A published item</a>");
    expect(output).toContain(">Published</span>");
    expect(output).not.toContain("ID item-123");
    expect(output).toContain('src="https://media.example.com/images/item-123.png"');
    expect(output).toContain('data-item-image="image"');
    expect(output).toContain('data-item-image="placeholder"');
    expect(output).toContain("table-fixed");
    expect(output).toContain("max-w-full truncate");
    expect(output).toContain("Audio");
    expect(output).toContain("00:01:05");
    expect(output).toContain("Edit this item");
    expect(output).toContain("!text-white hover:!text-white");
    expect(output).toContain("Public page");
    expect(output.match(/Public page/gu)).toHaveLength(2);
  });

  it("exposes descending sort state and preserves the status filter", () => {
    const output = renderItemsList();

    expect(output).toContain('aria-sort="descending"');
    expect(output).toContain(
      "?status=published&amp;sort=oldest_first",
    );
    expect(output).toContain(
      "?status=published&amp;next_cursor=123&amp;sort=newest_first",
    );
  });

  it("keeps the empty-state create action text white", () => {
    const output = renderItemsList(
      "?status=unlisted&sort=newest_first",
      [],
    );

    expect(output).toContain("No unlisted items yet.");
    expect(output).toContain("Add a new item");
    expect(output).toContain("mt-4 !text-white hover:!text-white");
  });
});
