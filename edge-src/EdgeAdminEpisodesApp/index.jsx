import React from 'react';
import WholeHtml from "../components/WholeHtml";

export default class AdminEpisodesApp extends React.Component {
  render() {
    return (
      <WholeHtml
        title="Episodes | Admin"
        description=""
        webpackJsList={[]}
        webpackCssList={['admin_styles_css']}
      >
      </WholeHtml>
    );
  }
}
