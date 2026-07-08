import {ITEMS_SORT_ORDERS} from "../../common-src/Constants";
import {buildPaginationQuery, paginateRows} from "./Paginator";

describe("Paginator", () => {
  test("builds cursor-aware query specs for both sort orders", () => {
    expect(buildPaginationQuery({
      queryKwargs: {status__in: [1, 4]},
      sortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
      nextCursor: 123,
      limit: 2,
    })).toEqual({
      queryKwargs: {
        status__in: [1, 4],
        "pub_date__<": "1970-01-01T00:00:00.123Z",
      },
      orderBy: ["pub_date desc", "id"],
      limit: 2,
      sortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
      cursorDirection: "next",
    });

    expect(buildPaginationQuery({
      queryKwargs: {status__in: [1, 4]},
      sortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
      prevCursor: 123,
      limit: 2,
    })).toEqual({
      queryKwargs: {
        status__in: [1, 4],
        "pub_date__>": "1970-01-01T00:00:00.123Z",
      },
      orderBy: ["pub_date", "id"],
      limit: 2,
      sortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
      cursorDirection: "prev",
    });

    expect(buildPaginationQuery({
      queryKwargs: {status__in: [1, 4]},
      sortOrder: ITEMS_SORT_ORDERS.OLDEST_FIRST,
      nextCursor: 123,
      limit: 2,
    })).toEqual({
      queryKwargs: {
        status__in: [1, 4],
        "pub_date__>": "1970-01-01T00:00:00.123Z",
      },
      orderBy: ["pub_date", "id"],
      limit: 2,
      sortOrder: ITEMS_SORT_ORDERS.OLDEST_FIRST,
      cursorDirection: "next",
    });

    expect(buildPaginationQuery({
      queryKwargs: {status__in: [1, 4]},
      sortOrder: ITEMS_SORT_ORDERS.OLDEST_FIRST,
      prevCursor: 123,
      limit: 2,
    })).toEqual({
      queryKwargs: {
        status__in: [1, 4],
        "pub_date__<": "1970-01-01T00:00:00.123Z",
      },
      orderBy: ["pub_date desc", "id"],
      limit: 2,
      sortOrder: ITEMS_SORT_ORDERS.OLDEST_FIRST,
      cursorDirection: "prev",
    });
  });

  test("paginates rows in sort order and emits boundary cursors", () => {
    const rows = [
      {id: "a", pub_date: "2026-07-01T00:00:00.000Z"},
      {id: "b", pub_date: "2026-07-02T00:00:00.000Z"},
    ];

    expect(paginateRows(rows, {
      limit: 2,
      sortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
    })).toEqual({
      results: [
        {id: "b", pub_date: "2026-07-02T00:00:00.000Z"},
        {id: "a", pub_date: "2026-07-01T00:00:00.000Z"},
      ],
      items_sort_order: ITEMS_SORT_ORDERS.NEWEST_FIRST,
      items_next_cursor: Date.parse("2026-07-01T00:00:00.000Z"),
    });

    expect(paginateRows(rows, {
      limit: 2,
      sortOrder: ITEMS_SORT_ORDERS.OLDEST_FIRST,
      cursorDirection: "prev",
    })).toEqual({
      results: [
        {id: "a", pub_date: "2026-07-01T00:00:00.000Z"},
        {id: "b", pub_date: "2026-07-02T00:00:00.000Z"},
      ],
      items_sort_order: ITEMS_SORT_ORDERS.OLDEST_FIRST,
      items_next_cursor: Date.parse("2026-07-02T00:00:00.000Z"),
      items_prev_cursor: Date.parse("2026-07-01T00:00:00.000Z"),
    });

    expect(paginateRows([], {
      limit: 2,
      sortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
      cursorDirection: "next",
    })).toEqual({
      results: [],
      items_sort_order: ITEMS_SORT_ORDERS.NEWEST_FIRST,
    });

    expect(paginateRows([
      {id: "c", pub_date: "2026-07-03T00:00:00.000Z"},
    ], {
      limit: 2,
      sortOrder: ITEMS_SORT_ORDERS.NEWEST_FIRST,
      cursorDirection: "prev",
    })).toEqual({
      results: [
        {id: "c", pub_date: "2026-07-03T00:00:00.000Z"},
      ],
      items_sort_order: ITEMS_SORT_ORDERS.NEWEST_FIRST,
      items_prev_cursor: Date.parse("2026-07-03T00:00:00.000Z"),
    });
  });
});
