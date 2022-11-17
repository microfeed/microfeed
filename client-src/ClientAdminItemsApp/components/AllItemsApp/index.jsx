import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import {unescapeHtml, ADMIN_URLS, secondsToHHMMSS, PUBLIC_URLS} from "../../../../common-src/StringUtils";
import {
  ENCLOSURE_CATEGORIES,
  ENCLOSURE_CATEGORIES_DICT,
  ITEM_STATUSES,
  ITEM_STATUSES_DICT,
  NAV_ITEMS,
  NAV_ITEMS_DICT
} from "../../../../common-src/Constants";
import {msToDatetimeLocalString} from '../../../../common-src/TimeUtils';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import clsx from "clsx";
import ExternalLink from "../../../components/ExternalLink";

const columnHelper = createColumnHelper();
const columns = [
  columnHelper.accessor('id', {
    header: 'Item id',
    cell: info => info.getValue(),
    enableSorting: false,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: info => <div className={clsx('font-semibold', info.getValue() === ITEM_STATUSES.PUBLISHED ? 'text-brand-light' : '')}>
      {ITEM_STATUSES_DICT[info.getValue()].name}</div>,
    enableSorting: false,
  }),
  columnHelper.accessor('pubDateMs', {
    header: 'Published date',
    cell: info => msToDatetimeLocalString(info.getValue()),
  }),
  columnHelper.accessor('title', {
    header: 'Title',
    cell: info => info.getValue(),
    enableSorting: false,
  }),
  columnHelper.accessor('mediaFile', {
    header: 'Media file',
    cell: info => info.getValue(),
    enableSorting: false,
  }),
];

function ItemListTable({data}) {
  const [
    sorting,
    setSorting,
  ] = React.useState([
    {id: 'pubDateMs', desc: true},
  ])
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // debugTable: true,
  });
  return (<div>
    <table className="border-collapse border border-slate-400 text-helper-color text-sm">
      <thead>
      {table.getHeaderGroups().map(headerGroup => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map(header => (
            <th
              key={header.id}
              className={clsx('border border-slate-300 bg-black text-white py-2 px-4',
                header.column.getCanSort() ? 'cursor-pointer' : 'select-none')}
            >
              <div onClick={header.column.getToggleSortingHandler()}>
              {flexRender(header.column.columnDef.header, header.getContext())}
              {{
                asc: ' 🔼',
                desc: ' 🔽',
              }[header.column.getIsSorted()] ?? null}
              </div>
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
    {/*<pre>{JSON.stringify(sorting, null, 2)}</pre>*/}
  </div>);
}

export default class AllItemsApp extends React.Component {
  constructor(props) {
    super(props);

    const feed = JSON.parse(unescapeHtml(document.getElementById('feed-content').innerHTML));
    const items = feed.items || [];
    const itemList = [];
    Object.keys(items).forEach((itemId) => {
      const item = items[itemId];
      item.id = itemId;
      itemList.push(item);
    });
    this.state = {
      feed,
      itemList,
    };
  }

  componentDidMount() {
  }

  render() {
    const {itemList} = this.state;
    const data = itemList.map((item) => ({
      id: (<div>
        <div>{item.id}</div>
        <div className="mt-2">
          <a
            className="block"
            href={ADMIN_URLS.editItem(item.id)}
          >Edit this item <span className="lh-icon-arrow-right"/></a>
        </div>
      </div>),
      status: item.status || ITEM_STATUSES.PUBLISHED,
      pubDateMs: item.pubDateMs,
      title: <div>
        <div className="line-clamp-2">{item.title}</div>
        <div className="mt-2">
          <ExternalLink url={PUBLIC_URLS.itemWeb(item.id, item.title)} text="Public page" />
        </div>
      </div>,
      mediaFile: <div>
        {item.mediaFile ? <div>
          <ExternalLink url={item.mediaFile.url} text={ENCLOSURE_CATEGORIES_DICT[item.mediaFile.category].name}/>
          {[ENCLOSURE_CATEGORIES.AUDIO, ENCLOSURE_CATEGORIES.VIDEO].includes(item.mediaFile.category) &&
            <div className="text-xs mt-1">
              {secondsToHHMMSS(item.mediaFile.durationSecond)}
            </div>}
        </div> : <div>-</div>}
      </div>
    }));

    return (<AdminNavApp currentPage={NAV_ITEMS.ALL_ITEMS}>
      <form className="lh-page-card mx-4 grid grid-cols-1 gap-4">
        <div className="lh-page-title">
          {NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name}
        </div>
        <div>
          <ItemListTable data={data} />
        </div>
      </form>
    </AdminNavApp>);
  }
}
