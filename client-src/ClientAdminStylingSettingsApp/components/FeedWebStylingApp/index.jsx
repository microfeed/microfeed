import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import {ADMIN_URLS} from "../../../../common-src/StringUtils";

export default class FeedWebStylingApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    }
  }

  render() {
    return (<AdminNavApp currentPage="settings" upperLevel={{name: 'Settings', url: ADMIN_URLS.settings()}}>
      <form className="grid grid-cols-2 gap-4">
        <div className="col-span-1 lh-page-card">
          <div className="flex">
            <div className="flex-1 lh-page-title">Edit HTML for Feed Web</div>
            <div className="">
              <button className="lh-btn lh-btn-brand-dark">Update</button>
            </div>
          </div>
          <div>
            code editor
          </div>
        </div>
        <div className="col-span-1 lh-page-card">
          <div>Preview</div>
          <div>Preview area</div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
