import React from 'react';
import AdminWholeHtml from "../components/AdminWholeHtml";

export default class AdminEpisodesApp extends React.Component {
  render() {
    const {feedContent} = this.props;
    return (
      <AdminWholeHtml
        title="Episodes | Admin"
        description=""
        webpackJsList={['all_episodes_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      />
    );
  }
}
