import React from 'react';
import Requests from '../../../common/requests';
import AdminNavApp from '../../../components/AdminNavApp';
import AdminImageUploaderApp from '../../../components/AdminImageUploaderApp';

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

  onUpdatePodcastMeta(e, keyName) {
    this.onUpdateFeed({[keyName]: e.target.value});
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
    const {feed, submitStatus} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminNavApp>
      <form className="lh-page-card mx-4 grid grid-cols-1 gap-4">
        <div className="flex">
          <div className="flex-none">
            <AdminImageUploaderApp />
          </div>
          <div className="flex-1 ml-8">
            <label>
              Podcast title
              <div>
                <input
                  type="text"
                  value={feed.title || ''}
                  onChange={(e) => this.onUpdatePodcastMeta(e, 'title')}
                />
              </div>
            </label>
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
