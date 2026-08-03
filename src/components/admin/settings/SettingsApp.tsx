import React from 'react';
import AdminNavApp from '@/components/admin/shared/AdminNavApp';
import TrackingSettingsApp from "./TrackingSettingsApp";
import AccessSettingsApp from "./AccessSettingsApp";
import SubscribeSettingsApp from "./SubscribeSettingsApp";
import CustomCodeSettingsApp from "./CustomCodeSettingsApp";
import WebGlobalSettingsApp from "./WebGlobalSettingsApp";
import Requests from "@/client/requests";
import {ADMIN_URLS} from "@/shared/StringUtils";
import {showToast} from "@/client/ToastUtils";
import {NAV_ITEMS, ONBOARDING_TYPES} from "@/shared/Constants";
import {
  preventCloseWhenChanged,
  readJsonScript,
} from "@/client/BrowserUtils";
import ApiSettingsApp from "./ApiSettingsApp";

const SUBMIT_STATUS__START = 1;

export default class SettingsApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.setChanged = this.setChanged.bind(this);

    const feed = readJsonScript<any>('feed-content');
    const onboardingResult = readJsonScript('onboarding-result');

    this.state = {
      feed,
      onboardingResult,
      submitStatus: null,
      changed: false,
    }
  }

  componentDidMount() {
    preventCloseWhenChanged(() => this.state.changed);
  }

  setChanged() {
    this.setState({changed: true});
  }

  onSubmit(e: any, bundleKey: any, bundle: any) {
    e.preventDefault();
    this.setState({submitForType: bundleKey, submitStatus: SUBMIT_STATUS__START});
    Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {settings: {[bundleKey]: bundle}})
      .then(() => {
        this.setState({submitStatus: null, submitForType: null, changed: false}, () => {
          showToast('Updated!', 'success');
        });
      }).catch((error: any) => {
      this.setState({submitStatus: null, submitForType: null}, () => {
        if (!error.response) {
          showToast('Network error. Please refresh the page and try again.', 'error');
        } else {
          showToast('Failed. Please try again.', 'error');
        }
      });
    });
  }

  render() {
    const {submitStatus, feed, submitForType, onboardingResult} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    const mediaStorage = onboardingResult.result[
      ONBOARDING_TYPES.MEDIA_STORAGE
    ];
    const mediaStorageReady = mediaStorage?.ready !== false;
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
              mediaStorage={mediaStorage}
              mediaStorageReady={mediaStorageReady}
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
          <div className="col-span-1 h-full">
            <ApiSettingsApp
              submitting={submitting}
              submitForType={submitForType}
              feed={feed}
              onSubmit={this.onSubmit}
              setChanged={this.setChanged}
            />
          </div>
        </div>
      </div>
    </AdminNavApp>);
  }
}
