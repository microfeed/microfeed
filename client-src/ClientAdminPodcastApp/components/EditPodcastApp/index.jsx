import React from 'react';
import Requests from '../../../common/requests';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminImageUploaderApp from '../../../components/AdminImageUploaderApp';
import AdminInput from "../../../components/AdminInput";

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
      <form className="lh-page-card mx-4 grid grid-cols-1 gap-4">
        <div className="flex">
          <div className="flex-none">
            <AdminImageUploaderApp
              mediaType="pod"
              currentImageUrl={feed.image}
              onImageUploaded={(cdnUrl) => this.onUpdatePodcastMeta('image', cdnUrl)}
            />
          </div>
          <div className="flex-1 ml-8">
            <AdminInput
              label="Podcast title"
              value={feed.title}
              onChange={(e) => this.onUpdatePodcastMeta('title', e.target.value)}
            />
            <AdminInput
              label="Publisher"
              value={feed.publisher}
              onChange={(e) => this.onUpdatePodcastMeta('publisher', e.target.value)}
            />
          </div>
        </div>
        <div className="text-center">
          <button
            type="submit"
            className="lh-btn lh-btn-brand-dark lh-btn-lg"
            onClick={this.onSubmit}
            disabled={submitting}
          >
            {submitting ? 'Updating...' : 'Update'}
          </button>
        </div>
      </form>
    </AdminNavApp>);
  }
}
