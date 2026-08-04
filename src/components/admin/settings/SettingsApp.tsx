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
import {scrollToAdminSettingsHash} from "@/client/AdminSettingsScroll";
import type {FeedContent, OnboardingResult} from "@/types";

const SUBMIT_STATUS__START = 1;

interface Props {
  feedContent: FeedContent;
  onboardingResult: OnboardingResult;
}

export default class SettingsApp extends React.Component<Props, any> {
  private cleanupNavigationGuard?: () => void;
  private initialHashScrollFrame?: number;

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
    this.initialHashScrollFrame = window.requestAnimationFrame(() => {
      scrollToAdminSettingsHash();
    });
  }

  componentWillUnmount() {
    if (this.initialHashScrollFrame !== undefined) {
      window.cancelAnimationFrame(this.initialHashScrollFrame);
    }
    this.cleanupNavigationGuard?.();
  }

  setChanged() {
    this.setState({changed: true});
  }

  async onSubmit(
    e: any,
    bundleKey: any,
    bundle: any,
    deleteImageUrls: string[] = [],
  ) {
    e.preventDefault();
    this.setState({submitForType: bundleKey, submitStatus: SUBMIT_STATUS__START});
    try {
      await Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {
        deleteImageUrls,
        settings: {[bundleKey]: bundle},
      });
      this.setState({submitStatus: null, submitForType: null, changed: false}, () => {
        showToast('Updated!', 'success');
      });
      return true;
    } catch (error: any) {
      this.setState({submitStatus: null, submitForType: null}, () => {
        if (!error.response) {
          showToast('Network error. Please refresh the page and try again.', 'error');
        } else {
          showToast('Failed. Please try again.', 'error');
        }
      });
      return false;
    }
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
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5">
        <section className="scroll-mt-6" id="tracking-urls">
          <TrackingSettingsApp
            submitting={submitting}
            submitForType={submitForType}
            feed={feed}
            onSubmit={this.onSubmit}
            setChanged={this.setChanged}
          />
        </section>
        <section className="scroll-mt-6" id="access-control">
          <AccessSettingsApp
            submitting={submitting}
            submitForType={submitForType}
            feed={feed}
            onSubmit={this.onSubmit}
            setChanged={this.setChanged}
          />
        </section>
        <section className="scroll-mt-6" id="subscribe-methods">
          <SubscribeSettingsApp
            submitting={submitting}
            submitForType={submitForType}
            feed={feed}
            onSubmit={this.onSubmit}
            setChanged={this.setChanged}
          />
        </section>
        <section className="scroll-mt-6" id="web-settings">
          <WebGlobalSettingsApp
            submitting={submitting}
            submitForType={submitForType}
            feed={feed}
            mediaStorage={mediaStorage}
            mediaStorageReady={mediaStorageReady}
            onSubmit={this.onSubmit}
            setChanged={this.setChanged}
          />
        </section>
        <section className="scroll-mt-6" id="custom-code">
          <CustomCodeSettingsApp
            submitting={submitting}
            submitForType={submitForType}
            feed={feed}
          />
        </section>
      </div>
    </AdminPageApp>);
  }
}
