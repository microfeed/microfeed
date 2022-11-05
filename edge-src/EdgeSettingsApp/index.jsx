import React from 'react';
import WholeHtml from "../components/WholeHtml";

export default class AdminSettingsApp extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {feedContent} = this.props;
    return (
      <WholeHtml
        title="Settings | Admin"
        description=""
        webpackJsList={['settings_js']}
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
