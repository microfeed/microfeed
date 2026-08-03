import React from 'react';
import type {FeedContent, OnboardingResult} from "@/types";
import AdminPageApp from "@/components/admin/shared/AdminPageApp";
import WhatsNewApp from "./component/WhatsNewApp";
import DistributionApp from "./component/DistributionApp";
import SetupChecklistApp from "./component/SetupChecklistApp";

interface Props {
  feedContent: FeedContent;
  onboardingResult: OnboardingResult;
}

export default class AdminHomeApp extends React.Component<Props, any> {
  constructor(props: Props) {
    super(props);

    this.state = {
      feed: props.feedContent,
      onboardingResult: props.onboardingResult,
    };
  }

  render() {
    const {feed, onboardingResult} = this.state;

    return (<AdminPageApp>
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
    </AdminPageApp>);
  }
}
