import React, { useMemo, useState } from "react";
import clsx from "clsx";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ADMIN_URLS } from "../../../../common-src/StringUtils";
import { ITEM_STATUSES_STRINGS_DICT, ITEM_STATUSES_DICT, ITEMS_SORT_ORDERS } from "../../../../common-src/Constants";
import { msToDatetimeLocalString } from "../../../../common-src/TimeUtils";
import { listTypes } from "../../../../edge-src/registry/ContentTypeRegistry";
import AdminRadio from "../../../components/AdminRadio";
import TypeBadge from "./TypeBadge";
import ItemFilters from "./ItemFilters";
import Requests from "../../../common/requests";
import { showToast } from "../../../common/ToastUtils";

const columnHelper = createColumnHelper();

function buildColumns(selectedIds, onToggleRow) {
  return [
    columnHelper.display({
      id: "select",
      header: "",
      cell: (info) => (
        <input
          type="checkbox"
          aria-label={`select row ${info.row.original.id}`}
          checked={selectedIds.has(info.row.original.id)}
          onChange={() => onToggleRow(info.row.original.id)}
        />
      ),
    }),
    columnHelper.accessor("contentType", {
      header: "Type",
      cell: (info) => <TypeBadge contentType={info.getValue()} />,
    }),
    columnHelper.accessor("title", {
      header: "Title",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("statusLabel", {
      header: "Status",
      cell: (info) => (
        <div
          className={clsx(
            "text-center font-semibold",
            info.row.original.status === "published" ? "text-brand-light" : ""
          )}
        >
          {info.getValue()}
        </div>
      ),
    }),
    columnHelper.accessor("datePublishedMs", {
      header: "Published date",
      cell: (info) => (
        <div className="text-center">
          {info.getValue() ? msToDatetimeLocalString(info.getValue()) : "-"}
        </div>
      ),
    }),
  ];
}

function statusLabelFor(status) {
  const statusCode = ITEM_STATUSES_STRINGS_DICT[status];
  if (statusCode !== undefined && ITEM_STATUSES_DICT[statusCode]) {
    return ITEM_STATUSES_DICT[statusCode].name;
  }
  return status;
}

function collectTagOptions(items) {
  const seen = new Set();
  items.forEach((item) => {
    (item.tags || []).forEach((tagValue) => seen.add(tagValue));
  });
  return Array.from(seen).sort();
}

function ItemTable({ rows, selectedIds, onToggleRow, onToggleSelectAll }) {
  const columns = useMemo(() => buildColumns(selectedIds, onToggleRow), [selectedIds, onToggleRow]);
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.has(row.id));

  return (
    <table className="border-collapse text-helper-color text-sm w-full">
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th
                key={header.id}
                className="uppercase border border-slate-300 bg-brand-dark text-white py-2 px-4"
              >
                {header.column.id === "select" ? (
                  <input
                    type="checkbox"
                    aria-label="select all (filtered)"
                    checked={allSelected}
                    onChange={() => onToggleSelectAll(rows.map((row) => row.id), !allSelected)}
                  />
                ) : (
                  flexRender(header.column.columnDef.header, header.getContext())
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className={clsx(
                  "border border-slate-300 py-2 px-4 break-all",
                  cell.column.id === "title" ? "max-w-md" : ""
                )}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BulkActionBar({ selectedCount, tagIdsInput, onTagIdsInputChange, onAction }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-300 bg-slate-50 py-2 px-4">
      <span className="text-sm font-semibold text-helper-color">
        {selectedCount} selected
      </span>
      <button
        type="button"
        className="rounded-md bg-brand-light px-3 py-1.5 text-sm font-semibold text-white"
        onClick={() => onAction("publish")}
      >
        Publish
      </button>
      <button
        type="button"
        className="rounded-md bg-slate-500 px-3 py-1.5 text-sm font-semibold text-white"
        onClick={() => onAction("unpublish")}
      >
        Unpublish
      </button>
      <button
        type="button"
        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white"
        onClick={() => onAction("delete")}
      >
        Delete
      </button>
      <input
        type="text"
        aria-label="tag ids"
        placeholder="tag ids (comma separated)"
        value={tagIdsInput}
        onChange={(e) => onTagIdsInputChange(e.target.value)}
        className="rounded-md border border-gray-300 py-1.5 px-2 text-sm"
      />
      <button
        type="button"
        className="rounded-md bg-brand-dark px-3 py-1.5 text-sm font-semibold text-white"
        onClick={() => onAction("tag")}
      >
        Tag
      </button>
    </div>
  );
}

export default function ItemListView({ items, feed = {}, reloadPage = () => window.location.reload() }) {
  const [contentType, setContentType] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [tagIdsInput, setTagIdsInput] = useState("");

  const typeOptions = useMemo(() => listTypes().map((typeDef) => typeDef.name), []);
  const tagOptions = useMemo(() => collectTagOptions(items), [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (contentType && item.content_type !== contentType) {
        return false;
      }
      if (status && item.status !== status) {
        return false;
      }
      if (tag && !(item.tags || []).includes(tag)) {
        return false;
      }
      return true;
    });
  }, [items, contentType, status, tag]);

  const handleToggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (ids, shouldSelect) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (shouldSelect) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  };

  const handleBulkAction = async (action) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      return;
    }

    const body = { action, ids };
    if (action === "tag") {
      body.tagIds = tagIdsInput
        .split(",")
        .map((tagId) => tagId.trim())
        .filter(Boolean);
    }

    try {
      const response = await Requests.axiosPost("/admin/ajax/items/bulk", body);
      const { succeeded = [], skipped = [] } = response.data || {};
      showToast(`${succeeded.length} updated, ${skipped.length} skipped`, "success");
      setSelectedIds(new Set());
      reloadPage();
    } catch (error) {
      showToast("Bulk action failed. Please try again.", "error");
    }
  };

  const rows = filteredItems.map((item) => ({
    id: item.id,
    contentType: item.content_type,
    status: item.status,
    statusLabel: statusLabelFor(item.status),
    datePublishedMs: item.date_published_ms,
    title: (
      <a className="block line-clamp-2 text-lg" href={ADMIN_URLS.editItem(item.id)}>
        {item.title || "untitled"}
      </a>
    ),
  }));

  let nextUrl;
  let prevUrl;
  if (feed.items_next_cursor) {
    nextUrl = `?next_cursor=${feed.items_next_cursor}&sort=${feed.items_sort_order}`;
  }
  if (feed.items_prev_cursor) {
    prevUrl = `?prev_cursor=${feed.items_prev_cursor}&sort=${feed.items_sort_order}`;
  }
  const newestFirst = feed.items_sort_order !== ITEMS_SORT_ORDERS.OLDEST_FIRST;

  if (items.length === 0) {
    return (
      <div>
        <div className="mb-8">No items yet.</div>
        <a href={ADMIN_URLS.newItem()}>
          Add a new item now <span className="lh-icon-arrow-right" />
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <AdminRadio
          groupName="sort-order"
          buttons={[
            {
              name: "Newest first",
              value: ITEMS_SORT_ORDERS.NEWEST_FIRST,
              checked: newestFirst,
            },
            {
              name: "Oldest first",
              value: ITEMS_SORT_ORDERS.OLDEST_FIRST,
              checked: !newestFirst,
            },
          ]}
          onChange={(e) => {
            location.href = `?sort=${e.target.value}`;
          }}
        />
      </div>
      <ItemFilters
        typeOptions={typeOptions}
        tagOptions={tagOptions}
        contentType={contentType}
        status={status}
        tag={tag}
        onContentTypeChange={setContentType}
        onStatusChange={setStatus}
        onTagChange={setTag}
      />
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          tagIdsInput={tagIdsInput}
          onTagIdsInputChange={setTagIdsInput}
          onAction={handleBulkAction}
        />
      )}
      {rows.length > 0 ? (
        <ItemTable
          rows={rows}
          selectedIds={selectedIds}
          onToggleRow={handleToggleRow}
          onToggleSelectAll={handleToggleSelectAll}
        />
      ) : (
        <div className="py-8 text-center text-helper-color">
          No items match the selected filters.
        </div>
      )}
      <div className="mt-8 flex justify-center">
        {prevUrl && (
          <div className="mx-2">
            <a href={prevUrl}>
              <span className="lh-icon-arrow-left" /> Prev
            </a>
          </div>
        )}
        {nextUrl && (
          <div className="mx-2">
            <a href={nextUrl}>
              Next <span className="lh-icon-arrow-right" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
