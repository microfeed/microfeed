import React from 'react';
import AdminWholeHtml from "../components/AdminWholeHtml";
import {NAV_ITEMS, NAV_ITEMS_DICT} from "../../common-src/Constants";

export default class AdminPodcastApp extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {feedContent} = this.props;
    return (
      <AdminWholeHtml
        title={`${NAV_ITEMS_DICT[NAV_ITEMS.EDIT_CHANNEL].name} | Admin`}
        description=""
        webpackJsList={['edit_channel_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      />
    );
  }
}
