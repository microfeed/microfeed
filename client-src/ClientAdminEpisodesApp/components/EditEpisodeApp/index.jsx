import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminInput from "../../../components/AdminInput";
import Requests from "../../../common/requests";
import {randomShortUUID, ADMIN_URLS} from '../../../../common-src/StringUtils';
import AudioUploaderApp from './components/AudioUploaderApp';
import AdminImageUploaderApp from "../../../components/AdminImageUploaderApp";

const SUBMIT_STATUS__START = 1;

export default class EditEpisodeApp extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.onUpdateEpisodeMeta = this.onUpdateEpisodeMeta.bind(this);

    const $feedContent = document.getElementById('feed-content');
    const episodeId = $feedContent.getAttribute('data-episode-id');
    const feed = JSON.parse($feedContent.innerHTML);
    this.state = {
      feed,
      submitStatus: null,
      episodeId: episodeId || randomShortUUID(),
    };
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

  onUpdateEpisodeMeta(episodeId, attrDict) {
    let existingEpisode = this.state.feed.episodes[episodeId];
    if (!existingEpisode) {
      existingEpisode = {};
    }
    existingEpisode = {
      ...existingEpisode,
      ...attrDict,
    };
    const episodesBundle = {
      ...this.state.feed.episodes,
      [episodeId]: {...existingEpisode},
    };
    this.onUpdateFeed({'episodes': episodesBundle});
  }

  onSubmit(e) {
    e.preventDefault();
    const {feed, episodeId} = this.state;
    this.setState({submitStatus: SUBMIT_STATUS__START});
    Requests.post(ADMIN_URLS.ajaxFeed(), feed)
      .then(() => {
        this.setState({submitStatus: null}, () => {
          if (episodeId) {
            location.href = ADMIN_URLS.pageEditEpisode(episodeId);
          }
        });
      });
  }

  render() {
    const {submitStatus, feed, episodeId} = this.state;
    const episode = feed.episodes[episodeId] || {};
    const submitting = submitStatus === SUBMIT_STATUS__START;

    let buttonText = 'Create';
    let currentPage = 'new_episode';
    if (episode && Object.keys(episode).length > 0) {
      buttonText = 'Update';
      currentPage = 'all_episodes';
    }
    return (<AdminNavApp currentPage={currentPage}>
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 grid grid-cols-1 gap-4">
          <div className="lh-page-card">
            <AudioUploaderApp
              audio={episode.audio}
              audioDurationSecond={episode.audioDurationSecond}
              audioFileSizeByte={episode.audioFileSizeByte}
              audioFileType={episode.audioFileType}
              onUploaded={(cdnUrl, duration, size, type) => {
                this.onUpdateEpisodeMeta(episodeId, {
                  'audio': cdnUrl,
                  'audioDurationSecond': duration,
                  'audioFileSizeByte': size,
                  'audioFileType': type,
                });
              }}
            />
          </div>
          <div className="lh-page-card">
            <h2 className="lh-page-title">Episode metadata</h2>
            <div className="flex">
              <div>
                <AdminImageUploaderApp
                  mediaType="eps"
                  currentImageUrl={episode.image}
                  onImageUploaded={(cdnUrl) => this.onUpdateEpisodeMeta(episodeId, {'image': cdnUrl})}
                />
              </div>
              <div className="ml-8 flex-1">
                <AdminInput
                  label="Episode title"
                  value={episode.title}
                  onChange={(e) => this.onUpdateEpisodeMeta(episodeId, {'title': e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-3">
          <div className="lh-page-card">
            <button
              type="submit"
              className="lh-btn lh-btn-brand-dark lh-btn-lg"
              onClick={this.onSubmit}
              disabled={submitting}
            >
              {submitting ? '...' : buttonText}
            </button>
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
