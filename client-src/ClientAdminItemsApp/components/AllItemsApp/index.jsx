import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import {
  unescapeHtml,
  ADMIN_URLS,
  secondsToHHMMSS,
  PUBLIC_URLS,
  urlJoinWithRelative
} from "../../../../common-src/StringUtils";
import {
  ENCLOSURE_CATEGORIES,
  ENCLOSURE_CATEGORIES_DICT,
  STATUSES,
  ITEM_STATUSES_DICT,
  NAV_ITEMS,
  NAV_ITEMS_DICT, ITEMS_SORT_ORDERS
} from "../../../../common-src/Constants";
import {msToDatetimeLocalString} from '../../../../common-src/TimeUtils';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import clsx from "clsx";
import ExternalLink from "../../../components/ExternalLink";
import AdminRadio from "../../../components/AdminRadio";

const columnHelper = createColumnHelper();
const columns = [
  columnHelper.accessor('id', {
    header: 'Item id',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: info => <div className={clsx('font-semibold', info.getValue() === STATUSES.PUBLISHED ? 'text-brand-light' : '')}>
      {ITEM_STATUSES_DICT[info.getValue()].name}</div>,
  }),
  columnHelper.accessor('pubDateMs', {
    header: 'Published date',
    cell: info => msToDatetimeLocalString(info.getValue()),
  }),
  columnHelper.accessor('title', {
    header: 'Title',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('mediaFile', {
    header: 'Media file',
    cell: info => info.getValue(),
  }),
];

function ItemListTable({data, feed}) {
  let nextUrl;
  let prevUrl;
  if (feed.items_next_cursor) {
    nextUrl = `?next_cursor=${feed.items_next_cursor}&sort=${feed.items_sort_order}`;
  }
  if (feed.items_prev_cursor) {
    prevUrl = `?prev_cursor=${feed.items_prev_cursor}&sort=${feed.items_sort_order}`;
  }
  const newestFirst = feed.items_sort_order === ITEMS_SORT_ORDERS.NEWEST_FIRST;
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (<div>
    <div className="mb-4">
      <AdminRadio
        groupName="sort-order"
        buttons={[
          {
            name: 'Newest first',
            value: ITEMS_SORT_ORDERS.NEWEST_FIRST,
            checked: newestFirst,
          },
          {
            name: 'Oldest first',
            value: ITEMS_SORT_ORDERS.OLDEST_FIRST,
            checked: !newestFirst,
          },
        ]}
        onChange={(e) => {
          location.href = `?sort=${e.target.value}`;
        }}
      />
    </div>
    <table className="border-collapse border border-slate-400 text-helper-color text-sm w-full">
      <thead>
      {table.getHeaderGroups().map(headerGroup => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map(header => (
            <th
              key={header.id}
              className={clsx('border border-slate-300 bg-black text-white py-2 px-4')}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
            </th>
          ))}
        </tr>
      ))}
      </thead>
      <tbody>
      {table.getRowModel().rows.map(row => (
        <tr key={`item-${row.id}`}>
          {row.getVisibleCells().map(cell => (
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

export default class AllItemsApp extends React.Component {
  constructor(props) {
    super(props);

    const feed = JSON.parse(unescapeHtml(document.getElementById('feed-content').innerHTML));
    const onboardingResult = JSON.parse(unescapeHtml(document.getElementById('onboarding-result').innerHTML));

    const items = feed.items || [];
    this.state = {
      feed,
      onboardingResult,
      items,
    };
  }

  componentDidMount() {
  }

  render() {
    const {items, feed, onboardingResult} = this.state;
    const {settings} = feed;
    const {webGlobalSettings} = settings;
    const publicBucketUrl = webGlobalSettings.publicBucketUrl || '/';
    const data = items.map((item) => ({
      id: (<div>
        <div>{item.id}</div>
        <div className="mt-2">
          <a
            className="block"
            href={ADMIN_URLS.editItem(item.id)}
          >Edit this item <span className="lh-icon-arrow-right"/></a>
        </div>
      </div>),
      status: item.status || STATUSES.PUBLISHED,
      pubDateMs: item.pubDateMs,
      title: <div>
        <div className="line-clamp-2">{item.title}</div>
        <div className="mt-2">
          <ExternalLink url={PUBLIC_URLS.webItem(item.id, item.title)} text="Public page" />
        </div>
      </div>,
      mediaFile: <div>
        {item.mediaFile ? <div>
          <ExternalLink
            url={urlJoinWithRelative(publicBucketUrl, item.mediaFile.url)}
            text={ENCLOSURE_CATEGORIES_DICT[item.mediaFile.category].name}
          />
          {[ENCLOSURE_CATEGORIES.AUDIO, ENCLOSURE_CATEGORIES.VIDEO].includes(item.mediaFile.category) &&
            <div className="text-xs mt-1">
              {secondsToHHMMSS(item.mediaFile.durationSecond)}
            </div>}
        </div> : <div>-</div>}
      </div>
    }));

    return (<AdminNavApp
      currentPage={NAV_ITEMS.ALL_ITEMS}
      onboardingResult={onboardingResult}
    >
      <form className="lh-page-card grid grid-cols-1 gap-4">
        <div className="lh-page-title">
          {NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name}
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
    </AdminNavApp>);
  }
}
