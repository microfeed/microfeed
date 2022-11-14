import React from 'react';
import AdminWholeHtml from "../../components/AdminWholeHtml";
import {NAV_ITEMS, NAV_ITEMS_DICT} from "../../../common-src/Constants";

export default class AdminItemsNewApp extends React.Component {
  render() {
    const {feedContent} = this.props;
    return (
      <AdminWholeHtml
        title={`${NAV_ITEMS_DICT[NAV_ITEMS.NEW_ITEM].name} | Admin`}
        description=""
        webpackJsList={['edit_item_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      />
    );
  }
}
