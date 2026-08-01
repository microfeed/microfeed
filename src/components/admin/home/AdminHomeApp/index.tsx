import React from 'react';
import {NAV_ITEMS} from "@/shared/Constants";
import AdminNavApp from "@/components/admin/shared/AdminNavApp";
import WhatsNewApp from "./component/WhatsNewApp";
import DistributionApp from "./component/DistributionApp";
import SetupChecklistApp from "./component/SetupChecklistApp";
import {readJsonScript} from "@/client/BrowserUtils";

export default class AdminHomeApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    const onboardingResult = readJsonScript('onboarding-result');
    const feed = readJsonScript('feed-content');

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
      <div className="grid grid-cols-12 gap-4">
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
      </div>
    </AdminNavApp>);
  }
}
