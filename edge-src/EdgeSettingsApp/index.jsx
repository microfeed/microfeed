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
        title="Settings | Admin"
        description=""
        webpackJsList={['settings_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      />
    );
  }
}
