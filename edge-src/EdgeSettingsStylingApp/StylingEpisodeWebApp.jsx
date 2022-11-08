import React from 'react';
import AdminWholeHtml from "../components/AdminWholeHtml";

export default class AdminSettingsApp extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {feedContent} = this.props;
    return (
      <AdminWholeHtml
        title="Episode Web Styling Settings | Admin"
        description=""
        webpackJsList={['episode_web_styling_settings_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      />
    );
  }
}
