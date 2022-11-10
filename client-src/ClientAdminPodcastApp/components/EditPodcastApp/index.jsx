import React from 'react';
import Requests from '../../../common/requests';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminImageUploaderApp from '../../../components/AdminImageUploaderApp';
import AdminInput from "../../../components/AdminInput";
import AdminRadio from "../../../components/AdminRadio";
import AdminTextarea from "../../../components/AdminTextarea";
import {getPublicBaseUrl} from "../../../common/ClientUrlUtils";
import {PUBLIC_URLS, unescapeHtml} from '../../../../common-src/StringUtils';
import {showToast} from "../../../common/ToastUtils";
import ExternalLink from "../../../components/ExternalLink";

const SUBMIT_STATUS__START = 1;

function initPodcast() {
  return {
    link: getPublicBaseUrl(),
    language: 'en-us',
    explicit: false,
    category: [],
  };
}

export default class EditPodcastApp extends React.Component {
  constructor(props) {
    super(props);

    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.onUpdatePodcastMeta = this.onUpdatePodcastMeta.bind(this);
    this.onUpdatePodcastMetaToFeed = this.onUpdatePodcastMetaToFeed.bind(this);
    this.onSubmit = this.onSubmit.bind(this);

    const feed = JSON.parse(unescapeHtml(document.getElementById('feed-content').innerHTML));
    const podcast = feed.podcast || initPodcast();
    this.state = {
      feed,
      podcast,
      submitStatus: null,
    }
  }

  onUpdateFeed(props, onSucceed) {
    this.setState(prevState => ({
      feed: {
        ...prevState.feed,
        podcast: {
          ...prevState.podcast,
          ...props,
        },
      },
    }), () => onSucceed())
  }

  onUpdatePodcastMeta(keyName, value) {
    this.setState((prevState) => ({
      podcast: {
        ...prevState.podcast,
        [keyName]: value,
      },
    }));
  }

  onUpdatePodcastMetaToFeed(onSucceed) {
    this.onUpdateFeed(this.state.podcast, onSucceed);
  }

  onSubmit(e) {
    e.preventDefault();
    this.onUpdatePodcastMetaToFeed(() => {
      const {feed} = this.state;
      this.setState({submitStatus: SUBMIT_STATUS__START});
      Requests.post('/admin/ajax/feed/', feed)
        .then(() => {
          this.setState({submitStatus: null}, () => {
            showToast('Updated!', 'success');
          });
        })
        .catch(() => {
          this.setState({submitStatus: null}, () => {
            showToast('Failed to update. Please try again.', 'error');
          });
        });
    });
  }

  render() {
    const {feed, submitStatus, podcast} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminNavApp>
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 lh-page-card">
          <div className="flex">
            <div className="flex-none">
              <AdminImageUploaderApp
                mediaType="pod"
                currentImageUrl={podcast.image}
                onImageUploaded={(cdnUrl) => this.onUpdatePodcastMeta('image', cdnUrl)}
              />
            </div>
            <div className="flex-1 ml-8 grid grid-cols-1 gap-3">
              <AdminInput
                label="Podcast title"
                value={podcast.title}
                onChange={(e) => this.onUpdatePodcastMeta('title', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <AdminInput
                  label="Publisher"
                  value={podcast.publisher}
                  onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
                />
                <AdminInput
                  label="Website"
                  value={podcast.link}
                  onChange={(e) => this.onUpdatePodcastMeta('link', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <AdminInput
                  label="Category"
                  value={podcast.category.join(',')}
                  onChange={(e) => this.onUpdatePodcastMeta('category', e.target.value.split(','))}
                />
                <AdminInput
                  label="Language"
                  value={podcast.language}
                  onChange={(e) => this.onUpdatePodcastMeta('language', e.target.value)}
                />
                <AdminRadio
                  label="Explicit"
                  groupName="lh-explicit"
                  buttons={[{
                   'name': 'Yes',
                   'checked': podcast.explicit,
                  }, {
                    'name': 'No',
                   'checked': !podcast.explicit,
                  }]}
                  value={podcast.explicit}
                  onChange={(e) => this.onUpdatePodcastMeta('explicit', e.target.value === 'Yes')}
                />
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t">
            <AdminTextarea
              label="Podcast description"
              value={podcast.description}
              onChange={(e) => this.onUpdatePodcastMeta('description', e.target.value)}
            />
          </div>
          <div className="mt-8 pt-8 border-t grid grid-cols-1 gap-4">
            <div className="grid grid-cols-3 gap-4">
              <AdminInput
                label="<itunes:type>"
                value={feed.publisher}
                onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
              />
              <AdminInput
                label="<itunes:owner>"
                value=""
                onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
              />
              <AdminInput
                label="<copyright>"
                value=""
                onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <AdminInput
                label="<itunes:new-feed-url>"
                value={feed.publisher}
                onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
              />
              <AdminInput
                label="<itunes:block>"
                value=""
                onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
              />
              <AdminInput
                label="<itunes:complete>"
                value=""
                onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <AdminInput
                label="<itunes:title>"
                value=""
                onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="col-span-3">
          <div className="text-center lh-page-card">
            <button
              type="submit"
              className="lh-btn lh-btn-brand-dark lh-btn-lg"
              onClick={this.onSubmit}
              disabled={submitting}
            >
              {submitting ? 'Updating...' : 'Update'}
            </button>
          </div>
          <div className="text-center lh-page-card mt-4 flex justify-center">
            <ExternalLink url={PUBLIC_URLS.feedWeb()} text="Web" />
            <div className="w-4" />
            <ExternalLink url={PUBLIC_URLS.feedRss()} text="RSS" />
            <div className="w-4" />
            <ExternalLink url={PUBLIC_URLS.feedJson()} text="JSON" />
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
