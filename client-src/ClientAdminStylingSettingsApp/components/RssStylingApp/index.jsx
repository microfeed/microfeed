import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import {ADMIN_URLS} from "../../../../common-src/StringUtils";

export default class RssStylingApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    }
  }

  render() {
    return (<AdminNavApp currentPage="settings" upperLevel={{name: 'Settings', url: ADMIN_URLS.settings()}}>
      rss styling
    </AdminNavApp>);
  }
}
