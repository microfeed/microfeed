import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  PencilIcon,
} from "lucide-react";

import AdminPageApp from "@/components/admin/shared/AdminPageApp";
import {buttonVariants} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {
  ENCLOSURE_CATEGORIES,
  ENCLOSURE_CATEGORIES_DICT,
  ITEM_STATUSES_DICT,
  STATUSES,
} from "@/shared/Constants";
import {
  buildItemsListUrl,
  ITEM_LIST_SORT_ORDERS,
  ITEM_STATUS_FILTERS,
  type ItemStatusFilter,
  itemListSortDefinition,
  normalizeItemStatusFilter,
} from "@/shared/ItemList";
import {isValidMediaFile} from "@/shared/MediaFileUtils";
import {
  ADMIN_URLS,
  PUBLIC_URLS,
  resolvePublicBucketUrl,
  secondsToHHMMSS,
  urlJoinWithRelative,
} from "@/shared/StringUtils";
import type {FeedContent, FeedItem} from "@/types";

interface MediaFile {
  category?: string;
  durationSecond?: number;
  url?: string;
}

interface ItemTableRow {
  id: string;
  imageUrl?: string;
  mediaFile?: MediaFile;
  pubDateMs?: number;
  publicBucketUrl: string;
  status: number;
  title: string;
  updatedAtMs?: number;
}

interface Props {
  feedContent: FeedContent;
}

const FILTER_LABELS: Record<ItemStatusFilter, string> = {
  all: "All items",
  published: "Published",
  unlisted: "Unlisted",
  unpublished: "Unpublished",
};

const STATUS_CLASSES: Record<number, string> = {
  [STATUSES.PUBLISHED]:
    "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  [STATUSES.UNLISTED]:
    "bg-amber-500/12 text-amber-700 dark:text-amber-300",
  [STATUSES.UNPUBLISHED]:
    "bg-rose-500/12 text-rose-700 dark:text-rose-300",
};

const columnHelper = createColumnHelper<ItemTableRow>();

function currentStatusFilter(): ItemStatusFilter {
  if (typeof window === "undefined") {
    return "all";
  }
  return normalizeItemStatusFilter(
    new URLSearchParams(window.location.search).get("status"),
  );
}

function statusName(status: number): string {
  const name = ITEM_STATUSES_DICT[
    status as keyof typeof ITEM_STATUSES_DICT
  ]?.name ?? "unknown";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function formatPublishedAt(value: number | undefined): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value as number));
}

function ItemThumbnail({imageUrl}: {imageUrl?: string}) {
  return (
    <div
      className="relative size-12 shrink-0 overflow-hidden rounded-[10px] border bg-muted"
      data-item-image={imageUrl ? "image" : "placeholder"}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-brand-light/25 via-muted to-brand-dark/15"
      >
        <span className="absolute -right-2 -top-2 size-8 rounded-full bg-brand-light/25" />
        <span className="absolute -bottom-3 -left-2 size-10 rotate-12 rounded-[10px] bg-background/70" />
      </div>
      {imageUrl && (
        <img
          alt=""
          className="relative size-full object-cover"
          decoding="async"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          src={imageUrl}
        />
      )}
    </div>
  );
}

function MediaCell({row}: {row: ItemTableRow}) {
  const {mediaFile, publicBucketUrl} = row;
  if (!isValidMediaFile(mediaFile)) {
    return <span aria-label="No media">—</span>;
  }

  const category = mediaFile?.category ?? "";
  const details = ENCLOSURE_CATEGORIES_DICT[
    category as keyof typeof ENCLOSURE_CATEGORIES_DICT
  ];
  const mediaUrl = category === ENCLOSURE_CATEGORIES.EXTERNAL_URL
    ? mediaFile?.url ?? ""
    : urlJoinWithRelative(publicBucketUrl, mediaFile?.url ?? "") ?? "";
  const mediaName = details?.name ?? "media";
  const displayName = `${mediaName.charAt(0).toUpperCase()}${mediaName.slice(1)}`;
  const showsDuration = [
    ENCLOSURE_CATEGORIES.AUDIO,
    ENCLOSURE_CATEGORIES.VIDEO,
  ].includes(category);

  return (
    <div>
      <a
        className="inline-flex items-center gap-1.5"
        href={mediaUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        {displayName}
        <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
      </a>
      {showsDuration && (
        <div className="mt-1 text-xs text-muted-foreground">
          {secondsToHHMMSS(mediaFile?.durationSecond)}
        </div>
      )}
    </div>
  );
}

function tableRows(items: FeedItem[], publicBucketUrl: string): ItemTableRow[] {
  return items.map((item) => {
    const image = String(item.image ?? "").trim();
    return {
      id: String(item.id ?? ""),
      imageUrl: image
        ? urlJoinWithRelative(publicBucketUrl, image) ?? undefined
        : undefined,
      mediaFile: item.mediaFile as MediaFile | undefined,
      pubDateMs: typeof item.pubDateMs === "number"
        ? item.pubDateMs
        : Number(item.pubDateMs),
      publicBucketUrl,
      status: typeof item.status === "number" ? item.status : STATUSES.PUBLISHED,
      title: String(item.title ?? "").trim() || "Untitled",
      updatedAtMs: typeof item.updatedAtMs === "number"
        ? item.updatedAtMs
        : Number(item.updatedAtMs),
    };
  });
}

function ItemStatusFilters({
  activeFilter,
  sortOrder,
}: {
  activeFilter: ItemStatusFilter;
  sortOrder: string;
}) {
  return (
    <nav
      aria-label="Filter items by status"
      className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4"
    >
      {ITEM_STATUS_FILTERS.map((statusFilter) => {
        const active = statusFilter === activeFilter;
        return (
          <a
            aria-current={active ? "page" : undefined}
            className={cn(
              buttonVariants({size: "lg", variant: "outline"}),
              "w-full text-sm sm:text-base",
              active &&
                "border-brand-light bg-brand-light/10 text-brand-dark ring-1 ring-brand-light/20 hover:bg-brand-light/15 dark:border-brand-light dark:bg-brand-light/20 dark:text-white dark:ring-brand-light/50 dark:hover:bg-brand-light/25",
            )}
            href={buildItemsListUrl({sortOrder, statusFilter})}
            key={statusFilter}
          >
            {FILTER_LABELS[statusFilter]}
          </a>
        );
      })}
    </nav>
  );
}

function ItemListTable({data, feed}: {data: ItemTableRow[]; feed: FeedContent}) {
  const activeFilter = currentStatusFilter();
  const sort = itemListSortDefinition(feed.items_sort_order);
  const sortOrder = sort.order;
  const nextUrl = feed.items_next_cursor === undefined
    ? undefined
    : buildItemsListUrl({
        nextCursor: feed.items_next_cursor,
        sortOrder,
        statusFilter: activeFilter,
      });
  const prevUrl = feed.items_prev_cursor === undefined
    ? undefined
    : buildItemsListUrl({
        prevCursor: feed.items_prev_cursor,
        sortOrder,
        statusFilter: activeFilter,
      });

  const sortableHeader = (
    field: "published" | "updated",
    label: string,
  ) => {
    const active = field === "updated"
      ? sort.column === "updated_at"
      : sort.column === "pub_date";
    const descendingOrder = field === "updated"
      ? ITEM_LIST_SORT_ORDERS.UPDATED_DESC
      : ITEM_LIST_SORT_ORDERS.PUBLISHED_DESC;
    const ascendingOrder = field === "updated"
      ? ITEM_LIST_SORT_ORDERS.UPDATED_ASC
      : ITEM_LIST_SORT_ORDERS.PUBLISHED_ASC;
    const nextSortOrder = active && sort.descending
      ? ascendingOrder
      : descendingOrder;
    const sortUrl = buildItemsListUrl({
      sortOrder: nextSortOrder,
      statusFilter: activeFilter,
    });
    return (
      <a
        aria-label={active
          ? `${label}, sorted ${sort.descending ? "descending" : "ascending"}. Sort ${sort.descending ? "ascending" : "descending"}.`
          : `${label}. Sort descending.`}
        className="inline-flex items-center gap-1.5"
        href={sortUrl}
      >
        {label}
        {active && (sort.descending
          ? <ArrowDownIcon aria-hidden="true" className="size-4" />
          : <ArrowUpIcon aria-hidden="true" className="size-4" />)}
      </a>
    );
  };

  const columns = [
    columnHelper.accessor("title", {
      header: "Title",
      cell: ({row}) => {
        const item = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <ItemThumbnail imageUrl={item.imageUrl} />
            <div className="min-w-0 flex-1">
              <a
                className="block max-w-full truncate text-base font-semibold text-foreground"
                href={ADMIN_URLS.editItem(item.id)}
                title={item.title}
              >
                {item.title}
              </a>
              <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-semibold",
                    STATUS_CLASSES[item.status] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {statusName(item.status)}
                </span>
                <a
                  className="inline-flex min-w-0 items-center gap-1 !text-muted-foreground hover:!text-brand-light"
                  href={PUBLIC_URLS.webItem(item.id, item.title)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span className="truncate">Public page</span>
                  <ExternalLinkIcon aria-hidden="true" className="size-3" />
                </a>
              </div>
            </div>
          </div>
        );
      },
    }),
    columnHelper.accessor("pubDateMs", {
      header: () => sortableHeader("published", "Published at"),
      cell: (info) => formatPublishedAt(info.getValue()),
    }),
    columnHelper.accessor("updatedAtMs", {
      header: () => sortableHeader("updated", "Updated at"),
      cell: (info) => formatPublishedAt(info.getValue()),
    }),
    columnHelper.accessor("mediaFile", {
      header: "Media",
      cell: ({row}) => <MediaCell row={row.original} />,
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      cell: ({row}) => {
        const item = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <a
              className={cn(
                buttonVariants({size: "sm"}),
                "!text-white hover:!text-white",
              )}
              href={ADMIN_URLS.editItem(item.id)}
            >
              <PencilIcon aria-hidden="true" />
              Edit this item
            </a>
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <ItemStatusFilters activeFilter={activeFilter} sortOrder={sortOrder} />
      <div className="overflow-x-auto rounded-[14px] border bg-card">
        <table className="w-full min-w-[64rem] table-fixed border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    aria-sort={
                      (header.column.id === "pubDateMs" && sort.column === "pub_date") ||
                        (header.column.id === "updatedAtMs" && sort.column === "updated_at")
                        ? sort.descending ? "descending" : "ascending"
                        : undefined
                    }
                    className={cn(
                      "border-b bg-muted/45 px-5 py-3 text-left text-sm font-semibold text-muted-foreground",
                      header.column.id === "title" && "w-[36%]",
                      header.column.id === "pubDateMs" && "w-[16%] whitespace-nowrap",
                      header.column.id === "updatedAtMs" && "w-[16%] whitespace-nowrap",
                      header.column.id === "mediaFile" && "w-[12%]",
                      header.column.id === "actions" && "w-[20%]",
                    )}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td className="px-5 py-12 text-center" colSpan={5}>
                  <div className="font-medium text-foreground">
                    No {activeFilter === "all" ? "" : `${activeFilter} `}items yet.
                  </div>
                  <a
                    className={cn(
                      buttonVariants({size: "sm"}),
                      "mt-4 !text-white hover:!text-white",
                    )}
                    href={ADMIN_URLS.newItem()}
                  >
                    Add a new item
                  </a>
                </td>
              </tr>
            ) : table.getRowModel().rows.map((row) => (
              <tr className="border-b last:border-b-0" key={row.original.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    className={cn(
                      "px-5 py-4 align-middle text-foreground",
                      ["pubDateMs", "updatedAtMs"].includes(cell.column.id) &&
                        "whitespace-nowrap",
                    )}
                    key={cell.id}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(prevUrl || nextUrl) && (
        <nav
          aria-label="Items pagination"
          className="mt-6 flex items-center justify-center gap-2"
        >
          {prevUrl && (
            <a
              className={buttonVariants({size: "sm", variant: "outline"})}
              href={prevUrl}
            >
              <ChevronLeftIcon aria-hidden="true" />
              Previous
            </a>
          )}
          {nextUrl && (
            <a
              className={buttonVariants({size: "sm", variant: "outline"})}
              href={nextUrl}
            >
              Next
              <ChevronRightIcon aria-hidden="true" />
            </a>
          )}
        </nav>
      )}
    </div>
  );
}

export default function AllItemsApp({feedContent}: Props) {
  const feed = feedContent;
  const items = feed.items ?? [];
  const publicBucketUrl = resolvePublicBucketUrl(
    feed.settings?.webGlobalSettings?.publicBucketUrl,
    window.location.hostname,
  );
  const data = tableRows(items, publicBucketUrl);

  return (
    <AdminPageApp>
      <ItemListTable data={data} feed={feed} />
    </AdminPageApp>
  );
}
