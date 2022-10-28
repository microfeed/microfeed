import React from 'react';
import WholeHtml from "../../components/WholeHtml";

export default class AdminEpisodesNewApp extends React.Component {
  render() {
    return (
      <WholeHtml
        title="Create New Episode | Admin"
        description=""
        webpackJsList={['new_episode_js']}
        webpackCssList={['admin_styles_css']}
      >
      </WholeHtml>
    );
  }
}
