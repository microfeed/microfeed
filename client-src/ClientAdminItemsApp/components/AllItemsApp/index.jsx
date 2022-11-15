import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import {unescapeHtml, ADMIN_URLS} from "../../../../common-src/StringUtils";
import {NAV_ITEMS, NAV_ITEMS_DICT} from "../../../../common-src/Constants";

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
    return (<AdminNavApp currentPage={NAV_ITEMS.ALL_ITEMS}>
      <form className="lh-page-card mx-4 grid grid-cols-1 gap-4">
        <div>
          {NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name}
        </div>
        {itemList.map((item) => {
          return (<div key={`item-${item.id}`}>
            <a href={ADMIN_URLS.editItem(item.id)}>{item.title || 'Untitled'}</a>
          </div>);
        })}
      </form>
    </AdminNavApp>);
  }
}
