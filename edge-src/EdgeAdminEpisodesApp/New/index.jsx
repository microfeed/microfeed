import React from 'react';
import WholeHtml from "../../components/WholeHtml";

export default class AdminEpisodesNewApp extends React.Component {
  render() {
    const {feedContent} = this.props;
    return (
      <WholeHtml
        title="Create New Episode | Admin"
        description=""
        webpackJsList={['edit_episode_js']}
        webpackCssList={['admin_styles_css']}
      >
        <script
          id="feed-content"
          type="application/json"
          // data-episode-id=""
          dangerouslySetInnerHTML={{__html: JSON.stringify(feedContent)}}
        />
      </WholeHtml>
    );
  }
}
