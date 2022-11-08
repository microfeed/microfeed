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
        title="Feed Web Styling Settings | Admin"
        description=""
        webpackJsList={['']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      />
    );
  }
}
