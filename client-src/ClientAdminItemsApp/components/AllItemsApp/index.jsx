import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import {unescapeHtml} from "../../../../common-src/StringUtils";
import {NAV_ITEMS, NAV_ITEMS_DICT} from "../../../../common-src/Constants";
import ItemListView from "./ItemListView";

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

  render() {
    const {items, feed, onboardingResult} = this.state;

    return (<AdminNavApp
      currentPage={NAV_ITEMS.ALL_ITEMS}
      onboardingResult={onboardingResult}
    >
      <form className="lh-page-card grid grid-cols-1 gap-4">
        <div className="lh-page-title">
          {NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name}
        </div>
        <div>
          <ItemListView items={items} feed={feed} />
        </div>
      </form>
    </AdminNavApp>);
  }
}
