import React from 'react';
import AdminWholeHtml from "../components/AdminWholeHtml";
import {escapeHtml} from "../../common-src/StringUtils";
import {OUR_BRAND} from "../../common-src/Constants";

export default class EdgeCustomCodeEditorApp extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {feedContent, theme} = this.props;
    const currentThemeTmplJson = {
      themeName: theme.name(),
      rssStylesheet: theme.getRssStylesheetTmpl(),
      webItem: theme.getWebItemTmpl(),
      webFeed: theme.getWebFeedTmpl(),
      webBodyStart: theme.getWebBodyStartTmpl(),
      webBodyEnd: theme.getWebBodyEndTmpl(),
      webHeader: theme.getWebHeaderTmpl(),
    };
    return (
      <AdminWholeHtml
        title={`Code Editor | ${OUR_BRAND.domain}`}
        description=""
        webpackJsList={['custom_code_editor_js']}
        webpackCssList={['admin_styles_css']}
        feedContent={feedContent}
      >
      <script
        id="theme-tmpl-json"
        type="application/json"
        dangerouslySetInnerHTML={{__html: escapeHtml(JSON.stringify(currentThemeTmplJson))}}
      />
      </AdminWholeHtml>
    );
  }
}
