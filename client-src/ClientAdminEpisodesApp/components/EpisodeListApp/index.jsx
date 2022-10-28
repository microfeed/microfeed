import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';

export default class EpisodeListApp extends React.Component {
  constructor(props) {
    super(props);

    const feed = JSON.parse(document.getElementById('feed-content').innerHTML);
    const {episodes} = feed;
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
    return (<AdminNavApp currentPage="all_episodes">
      <form className="lh-page-card mx-4 grid grid-cols-1 gap-4">
        <div>
          All episodes
        </div>
        {episodeList.map((eps) => {
          return (<div key={`eps-${eps.id}`}>
            <a href={`/admin/episodes/${eps.id}/`}>{eps.title}</a>
          </div>);
        })}
      </form>
    </AdminNavApp>);
  }
}
