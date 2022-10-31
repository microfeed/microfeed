import React from 'react';
import AdminNavApp from '../../components/AdminNavApp';

export default class SettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    }
  }

  render() {
    return (<AdminNavApp currentPage="settings">
      settings
    </AdminNavApp>);
  }
}
