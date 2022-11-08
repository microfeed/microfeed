import React from 'react';
import AdminWholeHtml from "../../components/AdminWholeHtml";

export default class AdminEpisodesNewApp extends React.Component {
  render() {
    const {feedContent} = this.props;
    return (
      <AdminWholeHtml
        title="Create New Episode | Admin"
        description=""
        webpackJsList={['edit_episode_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      />
    );
  }
}
