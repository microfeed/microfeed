import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';

export default class NewEpisodeApp extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
    }
  }

  componentDidMount() {
  }

  render() {
    return (<AdminNavApp currentPage="new_episode">
      <form className="lh-page-card mx-4 grid grid-cols-1 gap-4">
        <div>Upload audio</div>
        <div>Edit details</div>
      </form>
    </AdminNavApp>);
  }
}
