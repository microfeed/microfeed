import React from 'react';
import {NAV_ITEMS} from "../../../../common-src/Constants";
import AdminNavApp from "../../../components/AdminNavApp";
import WhatsNewApp from "./component/WhatsNewApp";
import DistributionApp from "./component/DistributionApp";
import SetupChecklistApp from "./component/SetupChecklistApp";
import {unescapeHtml} from "../../../../common-src/StringUtils";
// import {unescapeHtml} from "../../../../common-src/StringUtils";

export default class AdminHomeApp extends React.Component {
  constructor(props) {
    super(props);

    const onboardingResult = JSON.parse(unescapeHtml(document.getElementById('onboarding-result').innerHTML));
    const feed = JSON.parse(unescapeHtml(document.getElementById('feed-content').innerHTML));

    this.state = {
      feed,
      onboardingResult,
    };
  }

  render() {
    const {feed, onboardingResult} = this.state;

    return (<AdminNavApp
      currentPage={NAV_ITEMS.ADMIN_HOME}
      onboardingResult={onboardingResult}
    >
      <form className="grid grid-cols-12 gap-4">
        <div className="col-span-8 grid grid-cols-1 gap-4">
          <div>
            <SetupChecklistApp feed={feed} onboardingResult={onboardingResult} />
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
