import React from 'react';
import AdminNavApp from '../../components/AdminNavApp';
import TrackingSettingsApp from "./TrackingSettingsApp";
import PodcastAccessSettingsApp from "./PodcastAccessSettingsApp";
import SubscribeSettingsApp from "./SubscribeSettingsApp";
import SocialAccountSettingsApp from "./SocialAccountSettingsApp";
import BrandingSettingsApp from "./BrandingSettingsApp";
import CodeInjectionSettingsApp from "./CodeInjectionSettingsApp";
import Requests from "../../common/requests";
import {ADMIN_URLS} from "../../../common-src/StringUtils";
import {showToast} from "../../common/ToastUtils";

const SUBMIT_STATUS__START = 1;

export default class SettingsApp extends React.Component {
  constructor(props) {
    super(props);

    this.onSubmit = this.onSubmit.bind(this);

    const $feedContent = document.getElementById('feed-content');
    const feed = JSON.parse($feedContent.innerHTML);
    this.state = {
      feed,
      submitStatus: null,
      submitForType: null,
    }
  }

  onSubmit(e, bundleKey, bundle) {
    e.preventDefault();
    const {feed} = this.state;
    if (!feed.settings) {
      feed.settings = {};
    }
    feed.settings[bundleKey] = bundle;
    this.setState({submitForType: bundleKey, submitStatus: SUBMIT_STATUS__START});
    Requests.post(ADMIN_URLS.ajaxFeed(), feed)
      .then(() => {
        this.setState({submitStatus: null, submitForType: null}, () => {
          showToast('Updated!', 'success');
        });
      });
  }

  render() {
    const {submitStatus, feed, submitForType} = this.state;
    const submitting = submitStatus === SUBMIT_STATUS__START;
    return (<AdminNavApp currentPage="settings">
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <TrackingSettingsApp
              submitting={submitting}
              submitForType={submitForType}
              feed={feed}
              onSubmit={this.onSubmit}
            />
          </div>
          <div className="col-span-1">
            <PodcastAccessSettingsApp />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <SubscribeSettingsApp />
          </div>
          <div className="col-span-1">
            <SocialAccountSettingsApp />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <BrandingSettingsApp />
          </div>
          <div className="col-span-1">
            <CodeInjectionSettingsApp />
          </div>
        </div>
      </div>
    </AdminNavApp>);
  }
}
