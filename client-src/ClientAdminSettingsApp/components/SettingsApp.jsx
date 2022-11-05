import React from 'react';
import AdminNavApp from '../../components/AdminNavApp';
import TrackingSettingsApp from "./TrackingSettingsApp";
import PodcastAccessSettingsApp from "./PodcastAccessSettingsApp";
import SubscribeSettingsApp from "./SubscribeSettingsApp";
import SocialAccountSettingsApp from "./SocialAccountSettingsApp";
import BrandingSettingsApp from "./BrandingSettingsApp";
import CodeInjectionSettingsApp from "./CodeInjectionSettingsApp";

export default class SettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    }
  }

  render() {
    return (<AdminNavApp currentPage="settings">
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <TrackingSettingsApp />
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
