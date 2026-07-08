import React from 'react';
import AdminNavApp from '../../../components/AdminNavApp';
import MediaExplorer from '../../../components/MediaExplorer';
import {NAV_ITEMS} from '../../../../common-src/Constants';
import {unescapeHtml} from '../../../../common-src/StringUtils';

export default class MediaApp extends React.Component {
  constructor(props) {
    super(props);

    const $onboardingResult = document.getElementById('onboarding-result');
    const onboardingResult = $onboardingResult
      ? JSON.parse(unescapeHtml($onboardingResult.innerHTML))
      : {requiredOk: true};

    this.state = {onboardingResult};
  }

  render() {
    const {onboardingResult} = this.state;
    return (<AdminNavApp
      currentPage={NAV_ITEMS.MEDIA}
      onboardingResult={onboardingResult}
    >
      <div className="m-4 lg:m-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Media manager</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Browse every file in storage by folder. Upload new files, replace a file in place
            (all links keep pointing to it), rename, and delete unused files to reclaim space.
            Linked files are protected from deletion. “Sync” pulls in files added outside the manager.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6">
          <MediaExplorer />
        </div>
      </div>
    </AdminNavApp>);
  }
}
