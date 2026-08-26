import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {useMemo, useState, type MouseEvent} from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  PencilIcon,
} from "lucide-react";

import AdminPageApp from "@/components/admin/shared/AdminPageApp";
import {
  AdminCollectionError,
  AdminCollectionLoading,
} from "@/components/admin/shared/AdminCollectionState";
import {useAdminCollection} from "@/client/useAdminCollection";
import {buttonVariants} from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {cn} from "@/lib/utils";
import {
  ENCLOSURE_CATEGORIES,
  ENCLOSURE_CATEGORIES_DICT,
  ITEM_STATUSES_DICT,
  STATUSES,
} from "@/shared/Constants";
import {
  buildItemsListUrl,
  ITEM_STATUS_FILTERS,
  type ItemStatusFilter,
  normalizeItemStatusFilter,
} from "@/shared/ItemList";
import {
  ITEM_ORDERS,
  ITEM_SORTS,
  type ItemOrder,
  type ItemSort,
  itemSortDefinition,
} from "@/shared/ItemPagination";
import {isValidMediaFile} from "@/shared/MediaFileUtils";
import {
  ADMIN_URLS,
  PUBLIC_URLS,
  secondsToHHMMSS,
  urlJoinWithRelative,
} from "@/shared/StringUtils";
import type {
  AdminItemListResponse,
  AdminItemSummary,
} from "@/shared/AdminCollections";

interface MediaFile {
  category?: string;
  durationSecond?: number;
  url?: string;
}

interface ItemTableRow {
  createdAtMs?: number;
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
  itemsPerPage: number;
  publicBucketUrl: string;
}

type ListNavigationHandler = (
  event: MouseEvent<HTMLAnchorElement>,
  href: string,
) => void;

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

function statusName(status: number): string {
  const name = ITEM_STATUSES_DICT[
    status as keyof typeof ITEM_STATUSES_DICT
  ]?.name ?? "unknown";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function validDate(value: number | undefined): Date | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return new Date(value as number);
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatFullTimestamp(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "long",
  }).format(date);
}

function ItemDate({value}: {value?: number}) {
  const date = validDate(value);
  if (!date) {
    return <span aria-label="Date unavailable">—</span>;
  }

  const fullTimestamp = formatFullTimestamp(date);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <time
            aria-label={fullTimestamp}
            className="block min-w-0 cursor-help whitespace-normal break-words leading-snug"
            dateTime={date.toISOString()}
            suppressHydrationWarning
            tabIndex={0}
          >
            {formatShortDate(date)}
          </time>
        }
      />
      <TooltipContent>{fullTimestamp}</TooltipContent>
    </Tooltip>
  );
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
        className="inline-flex min-w-0 flex-wrap items-center gap-1.5"
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

function tableRows(
  items: AdminItemSummary[],
  publicBucketUrl: string,
): ItemTableRow[] {
  return items.map((item) => {
    const image = String(item.image ?? "").trim();
    return {
      createdAtMs: item.createdAtMs,
      id: item.id,
      imageUrl: image
        ? urlJoinWithRelative(publicBucketUrl, image) ?? undefined
        : undefined,
      mediaFile: item.mediaFile,
      pubDateMs: item.pubDateMs,
      publicBucketUrl,
      status: item.status,
      title: item.title,
      updatedAtMs: item.updatedAtMs,
    };
  });
}

function ItemStatusFilters({
  activeFilter,
  loading,
  navigate,
  order,
  sort,
}: {
  activeFilter: ItemStatusFilter;
  loading: boolean;
  navigate: ListNavigationHandler;
  order: ItemOrder;
  sort: ItemSort;
}) {
  return (
    <nav
      aria-label="Filter items by status"
      className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4"
    >
      {ITEM_STATUS_FILTERS.map((statusFilter) => {
        const active = statusFilter === activeFilter;
        const href = buildItemsListUrl({order, sort, statusFilter});
        return (
          <a
            aria-current={active ? "page" : undefined}
            aria-disabled={loading ? "true" : undefined}
            className={cn(
              buttonVariants({size: "lg", variant: "outline"}),
              "w-full text-sm sm:text-base",
              active &&
                "border-brand-light bg-brand-light/10 text-brand-dark ring-1 ring-brand-light/20 hover:bg-brand-light/15 dark:border-brand-light dark:bg-brand-light/20 dark:text-white dark:ring-brand-light/50 dark:hover:bg-brand-light/25",
              loading && "cursor-not-allowed opacity-70",
            )}
            href={href}
            key={statusFilter}
            onClick={(event) => navigate(event, href)}
          >
            {FILTER_LABELS[statusFilter]}
          </a>
        );
      })}
    </nav>
  );
}

export function ItemListTable({
  data,
  listing,
  loading = false,
  navigate = () => {},
}: {
  data: ItemTableRow[];
  listing: AdminItemListResponse;
  loading?: boolean;
  navigate?: ListNavigationHandler;
}) {
  const activeFilter = normalizeItemStatusFilter(listing.statusFilter);
  const sort = itemSortDefinition(listing.sort);
  const order = listing.order;
  const nextUrl = listing.nextCursor === undefined
    ? undefined
    : buildItemsListUrl({
        nextCursor: listing.nextCursor,
        order,
        sort: sort.sort,
        statusFilter: activeFilter,
      });
  const prevUrl = listing.prevCursor === undefined
    ? undefined
    : buildItemsListUrl({
        prevCursor: listing.prevCursor,
        order,
        sort: sort.sort,
        statusFilter: activeFilter,
      });

  const sortableHeader = (
    field: ItemSort,
    label: string,
  ) => {
    const active = field === sort.sort;
    const descending = order === ITEM_ORDERS.DESC;
    const nextOrder = active && descending
      ? ITEM_ORDERS.ASC
      : ITEM_ORDERS.DESC;
    const sortUrl = buildItemsListUrl({
      order: nextOrder,
      sort: field,
      statusFilter: activeFilter,
    });
    return (
      <a
        aria-label={active
          ? `${label}, sorted ${descending ? "descending" : "ascending"}. Sort ${descending ? "ascending" : "descending"}.`
          : `${label}. Sort descending.`}
        className={cn(
          "inline-flex min-w-0 flex-wrap items-center gap-1.5",
          loading && "cursor-not-allowed",
        )}
        href={sortUrl}
        onClick={(event) => navigate(event, sortUrl)}
        aria-disabled={loading ? "true" : undefined}
      >
        {label}
        {active && (descending
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
      header: () => sortableHeader(ITEM_SORTS.PUBLISHED_AT, "Published at"),
      cell: (info) => <ItemDate value={info.getValue()} />,
    }),
    columnHelper.accessor("createdAtMs", {
      header: () => sortableHeader(ITEM_SORTS.CREATED_AT, "Created at"),
      cell: (info) => <ItemDate value={info.getValue()} />,
    }),
    columnHelper.accessor("updatedAtMs", {
      header: () => sortableHeader(ITEM_SORTS.UPDATED_AT, "Updated at"),
      cell: (info) => <ItemDate value={info.getValue()} />,
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
      <ItemStatusFilters
        activeFilter={activeFilter}
        loading={loading}
        navigate={navigate}
        order={order}
        sort={sort.sort}
      />
      <div className="overflow-x-auto rounded-[14px] border bg-card">
        <table className="w-full min-w-[64rem] table-fixed border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    aria-sort={
                      (header.column.id === "pubDateMs" && sort.sort === ITEM_SORTS.PUBLISHED_AT) ||
                        (header.column.id === "createdAtMs" && sort.sort === ITEM_SORTS.CREATED_AT) ||
                        (header.column.id === "updatedAtMs" && sort.sort === ITEM_SORTS.UPDATED_AT)
                        ? order === ITEM_ORDERS.DESC ? "descending" : "ascending"
                        : undefined
                    }
                    className={cn(
                      "border-b bg-muted/45 px-5 py-3 text-left text-sm font-semibold text-muted-foreground",
                      header.column.id === "title" && "w-[29%]",
                      header.column.id === "pubDateMs" && "w-[13%] break-words",
                      header.column.id === "createdAtMs" && "w-[13%] break-words",
                      header.column.id === "updatedAtMs" && "w-[13%] break-words",
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
                <td className="px-5 py-12 text-center" colSpan={6}>
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
                      ["createdAtMs", "pubDateMs", "updatedAtMs"].includes(cell.column.id) &&
                        "min-w-0 whitespace-normal break-words",
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
              aria-disabled={loading ? "true" : undefined}
              className={cn(
                buttonVariants({size: "sm", variant: "outline"}),
                loading && "cursor-not-allowed",
              )}
              href={prevUrl}
              onClick={(event) => navigate(event, prevUrl)}
            >
              <ChevronLeftIcon aria-hidden="true" />
              Previous
            </a>
          )}
          {nextUrl && (
            <a
              aria-disabled={loading ? "true" : undefined}
              className={cn(
                buttonVariants({size: "sm", variant: "outline"}),
                loading && "cursor-not-allowed",
              )}
              href={nextUrl}
              onClick={(event) => navigate(event, nextUrl)}
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

function collectionUrl(search: string, itemsPerPage: number): string {
  const parameters = new URLSearchParams(search);
  parameters.set("limit", String(itemsPerPage));
  return `${ADMIN_URLS.ajaxItems()}?${parameters.toString()}`;
}

export default function AllItemsApp({itemsPerPage, publicBucketUrl}: Props) {
  const [search, setSearch] = useState(() =>
    typeof window === "undefined" ? "" : window.location.search
  );
  const endpoint = collectionUrl(search, itemsPerPage);
  const {data: listing, error, loading, retry} =
    useAdminCollection<AdminItemListResponse>(
      endpoint,
      "Could not load items.",
    );
  const data = useMemo(
    () => tableRows(listing?.items ?? [], publicBucketUrl),
    [listing, publicBucketUrl],
  );
  const navigate: ListNavigationHandler = (event, href) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    if (
      event.defaultPrevented || event.button !== 0 || event.metaKey ||
      event.ctrlKey || event.shiftKey || event.altKey
    ) {
      return;
    }
    event.preventDefault();
    const destination = new URL(href, window.location.href);
    if (destination.search === search) return;
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${destination.search}${window.location.hash}`,
    );
    setSearch(destination.search);
  };

  return (
    <AdminPageApp>
      {!listing && !error && <AdminCollectionLoading label="Loading items" />}
      {!listing && error && (
        <AdminCollectionError message={error} retry={retry} />
      )}
      {listing && (
        <div>
          {error && (
            <div className="mb-4">
              <AdminCollectionError message={error} retry={retry} />
            </div>
          )}
          <div
            aria-busy={loading}
            className={cn(
              "transition-opacity",
              loading && "opacity-60",
            )}
          >
            <ItemListTable
              data={data}
              listing={listing}
              loading={loading}
              navigate={navigate}
            />
          </div>
        </div>
      )}
    </AdminPageApp>
  );
}
