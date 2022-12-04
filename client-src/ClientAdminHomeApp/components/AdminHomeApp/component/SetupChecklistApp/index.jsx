import React from 'react';
// import {ONBOARDING_TYPES} from "../../../../../../common-src/Constants";

export default class SetupChecklistApp extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
    };
  }

  render() {
    // const {feed, onboardingResult} = this.props;
    // console.log(feed, onboardingResult);
    // onboardingResult[ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL]
    // onboardingResult[ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD]
    // onboardingResult[ONBOARDING_TYPES.CUSTOM_DOMAIN]
    return (<div className="lh-page-card">
      <div className="lh-page-subtitle">
        Setup checklist
      </div>
    </div>);
  }
}
