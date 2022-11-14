import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import {unescapeHtml, ADMIN_URLS} from "../../../../common-src/StringUtils";
import {NAV_ITEMS, NAV_ITEMS_DICT} from "../../../../common-src/Constants";

export default class EpisodeListApp extends React.Component {
  constructor(props) {
    super(props);

    const feed = JSON.parse(unescapeHtml(document.getElementById('feed-content').innerHTML));
    const episodes = feed.episodes || [];
    const episodeList = [];
    Object.keys(episodes).forEach((epsId) => {
      const eps = episodes[epsId];
      eps.id = epsId;
      episodeList.push(eps);
    });
    this.state = {
      feed,
      episodeList,
    };
  }

  componentDidMount() {
  }

  render() {
    const {episodeList} = this.state;
    return (<AdminNavApp currentPage={NAV_ITEMS.ALL_ITEMS}>
      <form className="lh-page-card mx-4 grid grid-cols-1 gap-4">
        <div>
          {NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name}
        </div>
        {episodeList.map((eps) => {
          return (<div key={`eps-${eps.id}`}>
            <a href={ADMIN_URLS.editItem(eps.id)}>{eps.title || 'Untitled'}</a>
          </div>);
        })}
      </form>
    </AdminNavApp>);
  }
}
