import React from 'react';
import Requests from '../../../common/requests';
import AdminNavApp from '../../../components/AdminNavApp';

export default class EditPodcastApp extends React.Component {
  constructor(props) {
    super(props);

    this.onUpdateFeed = this.onUpdateFeed.bind(this);
    this.onUpdatePodcastMeta = this.onUpdatePodcastMeta.bind(this);
    this.onSubmit = this.onSubmit.bind(this);

    const feed = JSON.parse(document.getElementById('feed-content').innerHTML);

    this.state = {
      feed,
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

  onUpdatePodcastMeta(e, keyName) {
    this.onUpdateFeed({[keyName]: e.target.value});
  }

  onSubmit(e) {
    e.preventDefault();
    const {feed} = this.state;
    Requests.post('/admin/ajax/feed/', feed)
      .then((data) => console.log(data));
  }

  render() {
    const {feed} = this.state;
    return (<AdminNavApp>
      <form>
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
        <div>
          <button type="submit" className="lh-btn lh-btn-brand-dark" onClick={this.onSubmit}>
            Update
          </button>
        </div>
      </form>
    </AdminNavApp>);
  }
}
