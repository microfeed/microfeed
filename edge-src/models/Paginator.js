import {ITEMS_SORT_ORDERS} from "../../common-src/Constants";
import {msToRFC3339, rfc3399ToMs} from "../../common-src/TimeUtils";

function isNewestFirst(sortOrder) {
  return sortOrder === ITEMS_SORT_ORDERS.NEWEST_FIRST;
}

function normalizeLimit(limit) {
  if (limit === undefined || limit === null) {
    return undefined;
  }
  if (limit < 0) {
    return undefined;
  }
  return limit;
}

export function buildPaginationQuery({
  queryKwargs = {},
  sortOrder = ITEMS_SORT_ORDERS.NEWEST_FIRST,
  nextCursor,
  prevCursor,
  limit,
} = {}) {
  const pagingQueryKwargs = {...queryKwargs};
  let orderBy = isNewestFirst(sortOrder) ? ["pub_date desc", "id"] : ["pub_date", "id"];
  let cursorDirection;

  if (nextCursor !== undefined && nextCursor !== null) {
    cursorDirection = "next";
    pagingQueryKwargs[isNewestFirst(sortOrder) ? "pub_date__<" : "pub_date__>"] = msToRFC3339(nextCursor);
  } else if (prevCursor !== undefined && prevCursor !== null) {
    cursorDirection = "prev";
    orderBy = isNewestFirst(sortOrder) ? ["pub_date", "id"] : ["pub_date desc", "id"];
    pagingQueryKwargs[isNewestFirst(sortOrder) ? "pub_date__>" : "pub_date__<"] = msToRFC3339(prevCursor);
  }

  return {
    queryKwargs: pagingQueryKwargs,
    orderBy,
    limit: normalizeLimit(limit),
    sortOrder,
    cursorDirection,
  };
}

function compareRows(left, right, sortOrder) {
  const leftMs = rfc3399ToMs(left.pub_date);
  const rightMs = rfc3399ToMs(right.pub_date);
  if (leftMs !== rightMs) {
    return isNewestFirst(sortOrder) ? rightMs - leftMs : leftMs - rightMs;
  }

  if (left.id < right.id) {
    return -1;
  }
  if (left.id > right.id) {
    return 1;
  }
  return 0;
}

export function paginateRows(rows, {
  limit,
  sortOrder = ITEMS_SORT_ORDERS.NEWEST_FIRST,
  cursorDirection,
} = {}) {
  const sortedRows = [...(rows || [])].sort((left, right) => compareRows(left, right, sortOrder));
  const page = {
    results: sortedRows,
    items_sort_order: sortOrder,
  };

  if (sortedRows.length > 0 && limit !== undefined && limit !== null && sortedRows.length >= limit) {
    page.items_next_cursor = rfc3399ToMs(sortedRows[sortedRows.length - 1].pub_date);
  }

  if (sortedRows.length > 0 && cursorDirection) {
    page.items_prev_cursor = rfc3399ToMs(sortedRows[0].pub_date);
  }

  return page;
}

export default {
  buildPaginationQuery,
  paginateRows,
};
