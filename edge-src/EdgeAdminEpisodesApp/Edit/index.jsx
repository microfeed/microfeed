import React from 'react';
import AdminWholeHtml from "../../components/AdminWholeHtml";

export default class AdminEpisodesEditApp extends React.Component {
  render() {
    const {feedContent, episodeId} = this.props;
    return (
      <AdminWholeHtml
        title="Edit Episode | Admin"
        description=""
        webpackJsList={['edit_episode_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      >
        <div id="lh-data-params" data-episode-id={episodeId} />
      </AdminWholeHtml>
    );
  }
}
