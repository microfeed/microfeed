import React from 'react';
import AdminWholeHtml from "../../components/AdminWholeHtml";
import {resolveBrand} from "../../../common-src/BrandUtils";

export default class AdminItemsEditApp extends React.Component {
  render() {
    const {feedContent, itemId, contentType, onboardingResult} = this.props;
    return (
      <AdminWholeHtml
        title={`Edit item (id = ${itemId}) | ${resolveBrand((feedContent || {}).settings).brandDomain}`}
        description=""
        webpackJsList={['edit_item_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
        onboardingResult={onboardingResult}
      >
        <div id="lh-data-params" data-item-id={itemId} data-content-type={contentType} />
      </AdminWholeHtml>
    );
  }
}
