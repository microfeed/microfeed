import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, describe, expect, it, vi} from "vitest";

import AllItemsApp from "@/components/admin/items/AllItemsApp";
import {STATUSES} from "@/shared/Constants";
import {ITEM_ORDERS, ITEM_SORTS} from "@/shared/ItemPagination";
import type {FeedItem} from "@/types";

const ITEMS: FeedItem[] = [
  {
    createdAtMs: Date.UTC(2026, 7, 4, 16, 0),
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
    updatedAtMs: Date.UTC(2026, 7, 4, 18, 0),
  },
  {
    createdAtMs: Date.UTC(2026, 7, 3, 16, 0),
    id: "item-very-long",
    pubDateMs: Date.UTC(2026, 7, 3, 17, 0),
    status: STATUSES.PUBLISHED,
    title: "An intentionally very long item title that should remain constrained to the title column instead of expanding the table",
    updatedAtMs: Date.UTC(2026, 7, 3, 18, 0),
  },
];

function renderItemsList(
  search = "?status=published&sort=updated_at&order=desc",
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
        items_next_cursor: "cursor_value",
        items_order: ITEM_ORDERS.DESC,
        items_sort: ITEM_SORTS.UPDATED_AT,
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
  it("renders the requested filters and six-column layout", () => {
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
    expect(output.match(/<th\b/gu)).toHaveLength(6);
    expect(output).toContain(">Title</th>");
    expect(output).toContain("Published at");
    expect(output).toContain("Created at");
    expect(output).toContain("Updated at");
    expect(output).toContain(">Media</th>");
    expect(output).toContain(">Actions</th>");
  });

  it("keeps the active filter visibly selected in dark mode", () => {
    const output = renderItemsList(
      "?status=unlisted&sort=updated_at&order=desc",
    );

    expect(output).toMatch(
      /aria-current="page"[^>]+dark:bg-brand-light\/20[^>]+>Unlisted<\/a>/u,
    );
    expect(output.match(/aria-current="page"/gu)).toHaveLength(1);
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
      "?status=published&amp;sort=updated_at&amp;order=asc",
    );
    expect(output).toContain(
      "?status=published&amp;sort=published_at&amp;order=desc",
    );
    expect(output).toContain(
      "?status=published&amp;sort=created_at&amp;order=desc",
    );
    expect(output).toContain(
      "?status=published&amp;next_cursor=cursor_value&amp;sort=updated_at&amp;order=desc",
    );
  });

  it("keeps the empty-state create action text white", () => {
    const output = renderItemsList(
      "?status=unlisted&sort=updated_at&order=desc",
      [],
    );

    expect(output).toContain("No unlisted items yet.");
    expect(output).toContain("Add a new item");
    expect(output).toContain("mt-4 !text-white hover:!text-white");
  });
});
