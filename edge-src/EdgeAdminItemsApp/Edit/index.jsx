import React from 'react';
import AdminWholeHtml from "../../components/AdminWholeHtml";

export default class AdminItemsEditApp extends React.Component {
  render() {
    const {feedContent, itemId} = this.props;
    return (
      <AdminWholeHtml
        title="Edit item | Admin"
        description=""
        webpackJsList={['edit_item_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      >
        <div id="lh-data-params" data-item-id={itemId} />
      </AdminWholeHtml>
    );
  }
}
