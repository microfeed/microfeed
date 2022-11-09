import React from 'react';
import AdminWholeHtml from "../components/AdminWholeHtml";
import {escapeHtml} from "../../common-src/StringUtils";

export default class AdminSettingsApp extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const {feedContent, theme} = this.props;
    const currentThemeTmplJson = {
      themeName: theme.name(),
      rssStylesheet: theme.getRssStylesheetTmpl(),
      episodeWeb: theme.getEpisodeWebTmpl(),
      feedWeb: theme.getFeedWebTmpl(),
      webFooter: theme.getWebFooterTmpl(),
      webHeader: theme.getWebHeaderTmpl(),
    };
    return (
      <AdminWholeHtml
        title="Rss Styling Settings | Admin"
        description=""
        webpackJsList={['styling_settings_js']}
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
