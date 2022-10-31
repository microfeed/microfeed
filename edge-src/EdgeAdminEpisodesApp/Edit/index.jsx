import React from 'react';
import WholeHtml from "../../components/WholeHtml";

export default class AdminEpisodesEditApp extends React.Component {
  render() {
    const {feedContent, episodeId} = this.props;
    return (
      <WholeHtml
        title="Edit Episode | Admin"
        description=""
        webpackJsList={['edit_episode_js']}
        webpackCssList={['admin_styles_css']}
      >
        <script
          id="feed-content"
          type="application/json"
          data-episode-id={episodeId}
          dangerouslySetInnerHTML={{__html: JSON.stringify(feedContent)}}
        />
      </WholeHtml>
    );
  }
}
