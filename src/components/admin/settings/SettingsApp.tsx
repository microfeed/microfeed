import React from 'react';
import AdminPageApp from '@/components/admin/shared/AdminPageApp';
import TrackingSettingsApp from "./TrackingSettingsApp";
import AccessSettingsApp from "./AccessSettingsApp";
import SubscribeSettingsApp from "./SubscribeSettingsApp";
import CustomCodeSettingsApp from "./CustomCodeSettingsApp";
import WebGlobalSettingsApp from "./WebGlobalSettingsApp";
import Requests from "@/client/requests";
import {ADMIN_URLS} from "@/shared/StringUtils";
import {showToast} from "@/client/ToastUtils";
import {ONBOARDING_TYPES} from "@/shared/Constants";
import {
  preventCloseWhenChanged,
} from "@/client/BrowserUtils";
import ApiSettingsApp from "./ApiSettingsApp";
import type {FeedContent, OnboardingResult} from "@/types";

const SUBMIT_STATUS__START = 1;

interface Props {
  feedContent: FeedContent;
  onboardingResult: OnboardingResult;
}

export default class SettingsApp extends React.Component<Props, any> {
  private cleanupNavigationGuard?: () => void;

  constructor(props: Props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);
    this.setChanged = this.setChanged.bind(this);

    this.state = {
      feed: props.feedContent,
      submitStatus: null,
      changed: false,
    }
  }

  componentDidMount() {
    this.cleanupNavigationGuard = preventCloseWhenChanged(() => this.state.changed);
  }

  componentWillUnmount() {
    this.cleanupNavigationGuard?.();
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
    const {submitStatus, feed, submitForType} = this.state;
    const {onboardingResult} = this.props;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    const mediaStorage = onboardingResult.result[
      ONBOARDING_TYPES.MEDIA_STORAGE
    ];
    const mediaStorageReady = mediaStorage?.ready !== false;
    return (<AdminPageApp>
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="h-full">
            <TrackingSettingsApp
              submitting={submitting}
              submitForType={submitForType}
              feed={feed}
              onSubmit={this.onSubmit}
              setChanged={this.setChanged}
            />
          </div>
          <div className="h-full">
            <AccessSettingsApp
              submitting={submitting}
              submitForType={submitForType}
              feed={feed}
              onSubmit={this.onSubmit}
              setChanged={this.setChanged}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="h-full">
            <SubscribeSettingsApp
              submitting={submitting}
              submitForType={submitForType}
              feed={feed}
              onSubmit={this.onSubmit}
              setChanged={this.setChanged}
            />
          </div>
          <div className="h-full">
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
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="h-full">
            <CustomCodeSettingsApp
              submitting={submitting}
              submitForType={submitForType}
              feed={feed}
            />
          </div>
          <div className="h-full">
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
    </AdminPageApp>);
  }
}
