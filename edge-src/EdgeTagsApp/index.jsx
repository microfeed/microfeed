import React from 'react';
import AdminWholeHtml from "../components/AdminWholeHtml";
import {NAV_ITEMS_DICT, NAV_ITEMS} from "../../common-src/Constants";
import {resolveBrand} from "../../common-src/BrandUtils";

export default class AdminTagsApp extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {feedContent, onboardingResult} = this.props;
    return (
      <AdminWholeHtml
        title={`${NAV_ITEMS_DICT[NAV_ITEMS.TAGS].name} | ${resolveBrand((feedContent || {}).settings).brandDomain}`}
        description=""
        webpackJsList={['tags_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
        onboardingResult={onboardingResult}
      />
    );
  }
}
