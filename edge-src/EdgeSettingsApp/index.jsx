import React from 'react';
import AdminWholeHtml from "../components/AdminWholeHtml";
import {NAV_ITEMS_DICT, NAV_ITEMS} from "../../common-src/Constants";
import {resolveBrand} from "../../common-src/BrandUtils";

export default class AdminSettingsApp extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {feedContent, onboardingResult} = this.props;
    return (
      <AdminWholeHtml
        title={`${NAV_ITEMS_DICT[NAV_ITEMS.SETTINGS].name} | ${resolveBrand((feedContent || {}).settings).brandDomain}`}
        description=""
        webpackJsList={['settings_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
        onboardingResult={onboardingResult}
      />
    );
  }
}
