import React from 'react';
import AdminPageApp from '@/components/admin/shared/AdminPageApp';
import TrackingSettingsApp from "./TrackingSettingsApp";
import AccessSettingsApp from "./AccessSettingsApp";
import SubscribeSettingsApp from "./SubscribeSettingsApp";
import CustomCodeSettingsApp from "./CustomCodeSettingsApp";
import FaviconSettingsApp from "./FaviconSettingsApp";
import ItemsSettingsApp, {
  ITEMS_PER_PAGE_SUBMIT_KEY,
} from "./ItemsSettingsApp";
import MediaFileStorageSettingsApp, {
  MEDIA_FILE_STORAGE_SUBMIT_KEY,
} from "./MediaFileStorageSettingsApp";
import Requests from "@/client/requests";
import {ADMIN_URLS} from "@/shared/StringUtils";
import {showToast} from "@/client/ToastUtils";
import {ONBOARDING_TYPES, SETTINGS_CATEGORIES} from "@/shared/Constants";
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
    this.updateSettingsState = this.updateSettingsState.bind(this);

    this.state = {
      feed: props.feedContent,
      submitStatus: null,
      changedSections: [],
    }
  }

  componentDidMount() {
    this.cleanupNavigationGuard = preventCloseWhenChanged(
      () => this.state.changedSections.length > 0,
    );
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

  setChanged(sectionKey: string) {
    this.setState((previousState: any) => ({
      changedSections: previousState.changedSections.includes(sectionKey)
        ? previousState.changedSections
        : [...previousState.changedSections, sectionKey],
    }));
  }

  updateSettingsState(bundleKey: string, bundle: Record<string, unknown>) {
    this.setState((previousState: any) => ({
      feed: {
        ...previousState.feed,
        settings: {
          ...previousState.feed.settings,
          [bundleKey]: {
            ...(previousState.feed.settings?.[bundleKey] ?? {}),
            ...bundle,
          },
        },
      },
    }));
  }

  async onSubmit(
    e: any,
    bundleKey: any,
    bundle: any,
    deleteImageUrls: string[] = [],
    submitKey: string = bundleKey,
  ) {
    e?.preventDefault?.();
    const updatedBundle = {
      ...(this.state.feed.settings?.[bundleKey] ?? {}),
      ...bundle,
    };
    this.setState({submitForType: submitKey, submitStatus: SUBMIT_STATUS__START});
    try {
      await Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {
        deleteImageUrls,
        settings: {[bundleKey]: updatedBundle},
      });
      this.setState((previousState: any) => ({
        changedSections: previousState.changedSections.filter(
          (sectionKey: string) => sectionKey !== submitKey,
        ),
        feed: {
          ...previousState.feed,
          settings: {
            ...previousState.feed.settings,
            [bundleKey]: updatedBundle,
          },
        },
        submitForType: null,
        submitStatus: null,
      }), () => showToast('Updated!', 'success'));
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
            setChanged={() => this.setChanged(SETTINGS_CATEGORIES.ANALYTICS)}
          />
        </section>
        <section className="scroll-mt-6" id="access-control">
          <AccessSettingsApp
            submitting={submitting}
            submitForType={submitForType}
            feed={feed}
            onSubmit={this.onSubmit}
            setChanged={() => this.setChanged(SETTINGS_CATEGORIES.ACCESS)}
          />
        </section>
        <section className="scroll-mt-6" id="subscribe-methods">
          <SubscribeSettingsApp
            submitting={submitting}
            submitForType={submitForType}
            feed={feed}
            onSubmit={this.onSubmit}
            setChanged={() => this.setChanged(SETTINGS_CATEGORIES.SUBSCRIBE_METHODS)}
          />
        </section>
        <section className="scroll-mt-6" id="media-file-storage">
          <MediaFileStorageSettingsApp
            submitting={submitting}
            submitForType={submitForType}
            feed={feed}
            onSubmit={this.onSubmit}
            setChanged={() => this.setChanged(MEDIA_FILE_STORAGE_SUBMIT_KEY)}
          />
        </section>
        <section className="scroll-mt-6" id="items-settings">
          <ItemsSettingsApp
            submitting={submitting}
            submitForType={submitForType}
            feed={feed}
            onSubmit={this.onSubmit}
            setChanged={() => this.setChanged(ITEMS_PER_PAGE_SUBMIT_KEY)}
          />
        </section>
        <section className="scroll-mt-6" id="favicon">
          <FaviconSettingsApp
            submitting={submitting}
            submitForType={submitForType}
            feed={feed}
            mediaStorage={mediaStorage}
            mediaStorageReady={mediaStorageReady}
            onSubmit={this.onSubmit}
            onSettingsChanged={this.updateSettingsState}
          />
        </section>
        <section className="scroll-mt-6" id="custom-code">
          <CustomCodeSettingsApp
            submitting={submitting}
            submitForType={submitForType}
            feed={feed}
          />
        </section>
        <div aria-hidden="true" className="h-[50vh]" />
      </div>
    </AdminPageApp>);
  }
}
