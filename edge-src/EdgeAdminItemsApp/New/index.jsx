import React from 'react';
import AdminWholeHtml from "../../components/AdminWholeHtml";
import {NAV_ITEMS, NAV_ITEMS_DICT} from "../../../common-src/Constants";
import {resolveBrand} from "../../../common-src/BrandUtils";

export default class AdminItemsNewApp extends React.Component {
  render() {
    const {feedContent, onboardingResult} = this.props;
    return (
      <AdminWholeHtml
        title={`${NAV_ITEMS_DICT[NAV_ITEMS.NEW_ITEM].name} | ${resolveBrand((feedContent || {}).settings).brandDomain}`}
        description=""
        webpackJsList={['edit_item_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
        onboardingResult={onboardingResult}
      />
    );
  }
}
