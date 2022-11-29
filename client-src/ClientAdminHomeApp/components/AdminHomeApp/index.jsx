import React from 'react';
import {NAV_ITEMS, OUR_BRAND} from "../../../../common-src/Constants";
import AdminNavApp from "../../../components/AdminNavApp";

export default class AdminHomeApp extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
    };
  }

  render() {
    return (<AdminNavApp currentPage={NAV_ITEMS.ADMIN_HOME}>
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-8 grid grid-cols-1 gap-4">
          <div className="lh-page-card">
            <div className="lh-page-subtitle">
              Finish setup
            </div>
          </div>
          <div className="lh-page-card">
            <div className="lh-page-subtitle">
              Distribution
            </div>
          </div>
        </div>
        <div className="col-span-4 lh-page-card">
          <div className="lh-page-subtitle">
            What's new from <a href={`https://${OUR_BRAND.domain}`}>{OUR_BRAND.domain}</a>?
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
