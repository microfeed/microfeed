import React from 'react';
import AdminWholeHtml from "../components/AdminWholeHtml";
import {NAV_ITEMS, NAV_ITEMS_DICT, OUR_BRAND} from "../../common-src/Constants";

export default class AdminItemsApp extends React.Component {
  render() {
    const {feedContent} = this.props;
    return (
      <AdminWholeHtml
        title={`${NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name} | ${OUR_BRAND.domain}`}
        description=""
        webpackJsList={['all_items_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      />
    );
  }
}
