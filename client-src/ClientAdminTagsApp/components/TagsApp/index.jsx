import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import {NAV_ITEMS} from "../../../../common-src/Constants";
import {unescapeHtml} from "../../../../common-src/StringUtils";
import TagManager from "../../TagManager";

export default class TagsApp extends React.Component {
  constructor(props) {
    super(props);

    const $onboardingResult = document.getElementById('onboarding-result');
    const onboardingResult = $onboardingResult
      ? JSON.parse(unescapeHtml($onboardingResult.innerHTML))
      : {requiredOk: true};

    this.state = {
      onboardingResult,
    };
  }

  render() {
    const {onboardingResult} = this.state;
    return (<AdminNavApp
      currentPage={NAV_ITEMS.TAGS}
      onboardingResult={onboardingResult}
    >
      <TagManager/>
    </AdminNavApp>);
  }
}
