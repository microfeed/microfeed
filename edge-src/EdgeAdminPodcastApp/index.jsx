import React from 'react';
import AdminWholeHtml from "../components/AdminWholeHtml";

export default class AdminPodcastApp extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {feedContent} = this.props;
    return (
      <AdminWholeHtml
        title="Edit Podcast | Admin"
        description=""
        webpackJsList={['edit_podcast_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      />
    );
  }
}
