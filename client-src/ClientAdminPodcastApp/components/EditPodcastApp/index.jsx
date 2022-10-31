import React from 'react';
import Requests from '../../../common/requests';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminImageUploaderApp from '../../../components/AdminImageUploaderApp';
import AdminInput from "../../../components/AdminInput";
import AdminTextarea from "../../../components/AdminTextarea";

const SUBMIT_STATUS__START = 1;

export default class EditPodcastApp extends React.Component {
  constructor(props) {
    super(props);

    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.onUpdatePodcastMeta = this.onUpdatePodcastMeta.bind(this);
    this.onSubmit = this.onSubmit.bind(this);

    const feed = JSON.parse(document.getElementById('feed-content').innerHTML);

    this.state = {
      feed,
      submitStatus: null,
    }
  }

  onUpdateFeed(props) {
    this.setState(prevState => ({
      feed: {
        ...prevState.feed,
        ...props,
      },
    }))
  }

  onUpdatePodcastMeta(keyName, value) {
    this.onUpdateFeed({[keyName]: value});
  }

  onSubmit(e) {
    e.preventDefault();
    const {feed} = this.state;
    this.setState({submitStatus: SUBMIT_STATUS__START});
    Requests.post('/admin/ajax/feed/', feed)
      .then(() => {
        this.setState({submitStatus: null});
      });
  }

  render() {
    const {feed, submitStatus} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminNavApp>
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-9 lh-page-card">
          <div className="flex">
            <div className="flex-none">
              <AdminImageUploaderApp
                mediaType="pod"
                currentImageUrl={feed.image}
                onImageUploaded={(cdnUrl) => this.onUpdatePodcastMeta('image', cdnUrl)}
              />
            </div>
            <div className="flex-1 ml-8 grid grid-cols-1 gap-3">
              <AdminInput
                label="Podcast title"
                value={feed.title}
                onChange={(e) => this.onUpdatePodcastMeta('title', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <AdminInput
                  label="Publisher"
                  value={feed.publisher}
                  onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
                />
                <AdminInput
                  label="Website"
                  value={feed.publisher}
                  onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <AdminInput
                  label="Category"
                  value=""
                  onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
                />
                <AdminInput
                  label="Language"
                  value=""
                  onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
                />
                <AdminInput
                  label="Explicit"
                  value=""
                  onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t">
            <AdminTextarea
              label="Episode description"
              value={feed.description}
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
        </div>
      </form>
    </AdminNavApp>);
  }
}
