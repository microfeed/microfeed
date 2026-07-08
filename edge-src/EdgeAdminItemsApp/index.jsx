import React from 'react';
import AdminWholeHtml from "../components/AdminWholeHtml";
import {NAV_ITEMS, NAV_ITEMS_DICT} from "../../common-src/Constants";
import {resolveBrand} from "../../common-src/BrandUtils";

export default class AdminItemsApp extends React.Component {
  render() {
    const {feedContent, onboardingResult} = this.props;
    return (
      <AdminWholeHtml
        title={`${NAV_ITEMS_DICT[NAV_ITEMS.ALL_ITEMS].name} | ${resolveBrand((feedContent || {}).settings).brandDomain}`}
        description=""
        webpackJsList={['all_items_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
        onboardingResult={onboardingResult}
      />
    );
  }
}
