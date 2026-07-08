import React from 'react';
import AdminWholeHtml from "../components/AdminWholeHtml";
import {NAV_ITEMS, NAV_ITEMS_DICT} from "../../common-src/Constants";
import {resolveBrand} from "../../common-src/BrandUtils";

export default class EdgeMediaApp extends React.Component {
  render() {
    const {feedContent, onboardingResult} = this.props;
    return (
      <AdminWholeHtml
        title={`${NAV_ITEMS_DICT[NAV_ITEMS.MEDIA].name} | ${resolveBrand((feedContent || {}).settings).brandDomain}`}
        description=""
        webpackJsList={['media_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
        onboardingResult={onboardingResult}
      />
    );
  }
}
