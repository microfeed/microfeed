import React from 'react';
import {NAV_ITEMS} from "../../../../common-src/Constants";
import AdminNavApp from "../../../components/AdminNavApp";
import WhatsNewApp from "./component/WhatsNewApp";
import DistributionApp from "./component/DistributionApp";
import FinishSetupApp from "./component/FinishSetupApp";

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
          <div>
            <FinishSetupApp />
          </div>
          <div>
            <DistributionApp />
          </div>
        </div>
        <div className="col-span-4 grid grid-cols-1 gap-4">
          <div>
            <WhatsNewApp />
          </div>
        </div>
      </form>
    </AdminNavApp>);
  }
}
