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
        title="Rss Styling Settings | Admin"
        description=""
        webpackJsList={['rss_styling_settings_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      />
    );
  }
}
