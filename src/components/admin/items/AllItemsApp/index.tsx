import React from 'react';
import {navigate} from 'astro:transitions/client';
import AdminPageApp from '@/components/admin/shared/AdminPageApp';
import {
  ADMIN_URLS,
  secondsToHHMMSS,
  PUBLIC_URLS,
  resolvePublicBucketUrl,
  urlJoinWithRelative
} from "@/shared/StringUtils";
import {
  ENCLOSURE_CATEGORIES,
  ENCLOSURE_CATEGORIES_DICT,
  STATUSES,
  ITEM_STATUSES_DICT,
  NAV_ITEMS,
  NAV_ITEMS_DICT,
  ITEMS_SORT_ORDERS,
} from "@/shared/Constants";
import {msToDatetimeLocalString} from '@/shared/TimeUtils';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import clsx from "clsx";
import ExternalLink from "@/components/admin/shared/ExternalLink";
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
import {isValidMediaFile} from "@/shared/MediaFileUtils";
import type {FeedContent} from "@/types";

const columnHelper = createColumnHelper<any>();
const columns = [
  columnHelper.accessor('title', {
    header: 'Title',
    cell: (info: any) => info.getValue(),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info: any) => <div className={clsx('text-center font-semibold', info.getValue() === STATUSES.PUBLISHED ? 'text-brand-light' : '')}>
      {(ITEM_STATUSES_DICT[info.getValue()] as any).name}</div>,
  }),
  columnHelper.accessor('pubDateMs', {
    header: 'Published date',
    cell: (info: any) => <div className="text-center">{msToDatetimeLocalString(info.getValue())}</div>,
  }),
  columnHelper.accessor('mediaFile', {
    header: 'Media file',
    cell: (info: any) => info.getValue(),
  }),
];

function ItemListTable({data, feed}: any) {
  let nextUrl;
  let prevUrl;
  if (feed.items_next_cursor) {
    nextUrl = `?next_cursor=${feed.items_next_cursor}&sort=${feed.items_sort_order}`;
  }
  if (feed.items_prev_cursor) {
    prevUrl = `?prev_cursor=${feed.items_prev_cursor}&sort=${feed.items_sort_order}`;
  }
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (<div>
    <div className="mb-4">
      <AdminRadioGroup
        ariaLabel="Sort order"
        name="sort-order"
        value={feed.items_sort_order}
        options={[
          {
            label: 'Newest first',
            value: ITEMS_SORT_ORDERS.NEWEST_FIRST,
          },
          {
            label: 'Oldest first',
            value: ITEMS_SORT_ORDERS.OLDEST_FIRST,
          },
        ]}
        onValueChange={(value) => {
          void navigate(`?sort=${value}`);
        }}
      />
    </div>
    <table className="border-collapse text-helper-color text-sm w-full">
      <thead>
      {table.getHeaderGroups().map((headerGroup: any) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header: any) => (
            <th
              key={header.id}
              className={clsx('uppercase border border-slate-300 bg-brand-dark text-white py-2 px-4')}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
            </th>
          ))}
        </tr>
      ))}
      </thead>
      <tbody>
      {table.getRowModel().rows.map((row: any) => (
        <tr key={`item-${row.id}`}>
          {row.getVisibleCells().map((cell: any) => (
            <td key={cell.id} className={clsx("border border-slate-300 py-2 px-4 break-all",
              cell.column.id === 'title' ? 'max-w-md' : '')}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          ))}
        </tr>)
      )}
      </tbody>
    </table>
    <div className="mt-8 flex justify-center">
      {prevUrl && <div className="mx-2">
        <a href={prevUrl}><span className="lh-icon-arrow-left" /> Prev</a>
      </div>}
      {nextUrl && <div className="mx-2">
        <a href={nextUrl}>Next <span className="lh-icon-arrow-right" /></a>
      </div>}
    </div>
  </div>);
}

interface Props {
  feedContent: FeedContent;
}

export default class AllItemsApp extends React.Component<Props, any> {
  constructor(props: Props) {
    super(props);

    const feed = props.feedContent;

    const items = feed.items || [];
    this.state = {
      feed,
      items,
    };
  }

  componentDidMount() {
  }

  render() {
    const {items, feed} = this.state;
    const {settings} = feed;
    const {webGlobalSettings} = settings;
    const publicBucketUrl = resolvePublicBucketUrl(
      webGlobalSettings.publicBucketUrl,
      window.location.hostname,
    );
    const data = items.map((item: any) => ({
      status: item.status || STATUSES.PUBLISHED,
      pubDateMs: item.pubDateMs,
      title: <div>
        <div className="line-clamp-2 text-lg">
          <a className="block" href={ADMIN_URLS.editItem(item.id)}>{item.title || 'untitled'}</a>
        </div>
        <div className="mt-2 flex items-center">
          <div className="text-muted-color text-sm flex-1">
            id: {item.id}
          </div>
          <ExternalLink
            linkClass="text-xs text-helper-color
            hover:text-brand-light"
            url={PUBLIC_URLS.webItem(item.id, item.title)}
            text="Public page"
          />
          <div className="ml-4 flex-none">
            <a
              href={ADMIN_URLS.editItem(item.id)}
            ><span className="block text-xs text-helper-color hover:text-brand-light">
              Edit this item <span className="lh-icon-arrow-right"/></span></a>
          </div>
        </div>
      </div>,
      mediaFile: <div className="flex flex-col items-center">
        {isValidMediaFile(item.mediaFile) ? <div>
          <ExternalLink
            url={item.mediaFile.category === ENCLOSURE_CATEGORIES.EXTERNAL_URL ? item.mediaFile.url:
              urlJoinWithRelative(publicBucketUrl, item.mediaFile.url)}
            text={(ENCLOSURE_CATEGORIES_DICT[item.mediaFile.category] as any).name}
          />
          {[ENCLOSURE_CATEGORIES.AUDIO, ENCLOSURE_CATEGORIES.VIDEO].includes(item.mediaFile.category) &&
            <div className="text-xs mt-1">
              {secondsToHHMMSS(item.mediaFile.durationSecond)}
            </div>}
        </div> : <div>-</div>}
      </div>
    }));

    return (<AdminPageApp>
      <form className="lh-page-card grid grid-cols-1 gap-4">
        <div className="lh-page-title">
          {(NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS] as any).name}
        </div>
        <div>
          {data.length > 0 ? <ItemListTable data={data} feed={feed} /> : <div>
            <div className="mb-8">
              No items yet.
            </div>
            <a href={ADMIN_URLS.newItem()}>Add a new item now <span className="lh-icon-arrow-right" /></a>
          </div>}
        </div>
      </form>
    </AdminPageApp>);
  }
}
