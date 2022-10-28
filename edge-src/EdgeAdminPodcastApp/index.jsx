import React from 'react';
import WholeHtml from "../components/WholeHtml";

export default class AdminPodcastApp extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {feedContent} = this.props;
    return (
      <WholeHtml
        title="Edit Podcast | Admin"
        description=""
        webpackJsList={['edit_podcast_js']}
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
