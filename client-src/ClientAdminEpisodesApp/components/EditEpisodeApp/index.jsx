import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminInput from "../../../components/AdminInput";
import Requests from "../../../common/requests";
import {randomShortUUID} from '../../../../common-src/CodeUtils';

const SUBMIT_STATUS__START = 1;

export default class EditEpisodeApp extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.onUpdateEpisodeMeta = this.onUpdateEpisodeMeta.bind(this);

    const feed = JSON.parse(document.getElementById('feed-content').innerHTML);
    this.state = {
      feed,
      submitStatus: null,
      episodeId: props.episodeId || randomShortUUID(),
    }
  }

  componentDidMount() {
  }

  onUpdateFeed(props) {
    this.setState(prevState => ({
      feed: {
        ...prevState.feed,
        ...props,
      },
    }))
  }

  onUpdateEpisodeMeta(episodeId, keyName, value) {
    let existingEpisode = this.state.feed.episodes[episodeId];
    if (!existingEpisode) {
      existingEpisode = {};
    }
    existingEpisode[keyName] = value;
    const episodesBundle = {
      ...this.state.feed.episodes,
      [episodeId]: {...existingEpisode},
    };
    this.onUpdateFeed({'episodes': episodesBundle});
  }

  onSubmit(e) {
    e.preventDefault();
    const {feed} = this.state;
    this.setState({submitStatus: SUBMIT_STATUS__START});
    Requests.post('/admin/ajax/feed/', feed)
      .then((data) => {
        this.setState({submitStatus: null});
        console.log(data);
      });
  }

  render() {
    const {submitStatus, feed, episodeId} = this.state;
    const episode = feed.episodes[episodeId] || {};
    const submitting = submitStatus === SUBMIT_STATUS__START;

    return (<AdminNavApp currentPage="new_episode">
      <form className="lh-page-card mx-4 grid grid-cols-1 gap-4">
        <div>
          Upload audio
        </div>
        <div>
          <AdminInput
            label="Episode title"
            value={episode.title}
            onChange={(e) => this.onUpdateEpisodeMeta(episodeId, 'title', e.target.value)}
          />
        </div>
        <div className="text-center">
          <button
            type="submit"
            className="lh-btn lh-btn-brand-dark lh-btn-lg"
            onClick={this.onSubmit}
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </AdminNavApp>);
  }
}
