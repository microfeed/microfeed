import React from 'react';
import AdminNavApp from '../../components/AdminNavApp';
import TrackingSettingsApp from "./TrackingSettingsApp";
import AccessSettingsApp from "./AccessSettingsApp";
import SubscribeSettingsApp from "./SubscribeSettingsApp";
import CustomCodeSettingsApp from "./CustomCodeSettingsApp";
import WebGlobalSettingsApp from "./WebGlobalSettingsApp";
import Requests from "../../common/requests";
import {ADMIN_URLS, unescapeHtml} from "../../../common-src/StringUtils";
import {showToast} from "../../common/ToastUtils";
import {NAV_ITEMS} from "../../../common-src/Constants";

const SUBMIT_STATUS__START = 1;

export default class SettingsApp extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.setChanged = this.setChanged.bind(this);

    const $feedContent = document.getElementById('feed-content');
    const feed = JSON.parse(unescapeHtml($feedContent.innerHTML));
    const onboardingResult = JSON.parse(unescapeHtml(document.getElementById('onboarding-result').innerHTML));

    this.state = {
      feed,
      onboardingResult,
      submitStatus: null,
      changed: false,
    }
  }

  setChanged() {
    this.setState({changed: true});
  }

  onSubmit(e, bundleKey, bundle) {
    e.preventDefault();
    this.setState({submitForType: bundleKey, submitStatus: SUBMIT_STATUS__START});
    Requests.post(ADMIN_URLS.ajaxFeed(), {settings: {[bundleKey]: bundle}})
      .then(() => {
        this.setState({submitStatus: null, submitForType: null}, () => {
          showToast('Updated!', 'success');
        });
      });
  }

  render() {
    const {submitStatus, feed, submitForType, onboardingResult} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminNavApp
      currentPage={NAV_ITEMS.SETTINGS}
      onboardingResult={onboardingResult}
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1 h-full">
            <TrackingSettingsApp
              submitting={submitting}
              submitForType={submitForType}
              feed={feed}
              onSubmit={this.onSubmit}
              setChanged={this.setChanged}
            />
          </div>
          <div className="col-span-1 h-full">
            <AccessSettingsApp
              submitting={submitting}
              submitForType={submitForType}
              feed={feed}
              onSubmit={this.onSubmit}
              setChanged={this.setChanged}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1 h-full">
            <SubscribeSettingsApp
              submitting={submitting}
              submitForType={submitForType}
              feed={feed}
              onSubmit={this.onSubmit}
              setChanged={this.setChanged}
            />
          </div>
          <div className="col-span-1 h-full">
            <WebGlobalSettingsApp
              submitting={submitting}
              submitForType={submitForType}
              feed={feed}
              onSubmit={this.onSubmit}
              setChanged={this.setChanged}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1 h-full">
            <CustomCodeSettingsApp
              submitting={submitting}
              submitForType={submitForType}
              feed={feed}
            />
          </div>
        </div>
      </div>
    </AdminNavApp>);
  }
}
