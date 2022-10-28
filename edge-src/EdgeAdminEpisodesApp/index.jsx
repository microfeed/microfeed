import React from 'react';
import WholeHtml from "../components/WholeHtml";

export default class AdminEpisodesApp extends React.Component {
  render() {
    const {feedContent} = this.props;
    return (
      <WholeHtml
        title="Episodes | Admin"
        description=""
        webpackJsList={['all_episodes_js']}
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
