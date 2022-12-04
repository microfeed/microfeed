import React from 'react';
import AdminWholeHtml from "../../components/AdminWholeHtml";
import {OUR_BRAND} from "../../../common-src/Constants";

export default class AdminItemsEditApp extends React.Component {
  render() {
    const {feedContent, itemId, onboardingResult} = this.props;
    return (
      <AdminWholeHtml
        title={`Edit item (id = ${itemId}) | ${OUR_BRAND.domain}`}
        description=""
        webpackJsList={['edit_item_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
        onboardingResult={onboardingResult}
      >
        <div id="lh-data-params" data-item-id={itemId} />
      </AdminWholeHtml>
    );
  }
}
