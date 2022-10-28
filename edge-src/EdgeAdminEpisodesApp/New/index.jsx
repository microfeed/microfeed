import React from 'react';
import WholeHtml from "../../components/WholeHtml";

export default class AdminEpisodesNewApp extends React.Component {
  render() {
    const {feedContent} = this.props;
    return (
      <WholeHtml
        title="Create New Episode | Admin"
        description=""
        webpackJsList={['new_episode_js']}
        webpackCssList={['admin_styles_css']}
      >
        <script
          id="feed-content"
          type="application/json"
          dangerouslySetInnerHTML={{__html: JSON.stringify(feedContent)}}
        />
      </WholeHtml>
    );
  }
}
