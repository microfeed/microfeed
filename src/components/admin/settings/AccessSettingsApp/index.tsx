import React from 'react';
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
import SettingsBase from '../SettingsBase';
import {SETTINGS_CATEGORIES} from "@/shared/Constants";

export default class AccessSettingsApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);

    this.onUpdateAccess = this.onUpdateAccess.bind(this);

    const currentType = SETTINGS_CATEGORIES.ACCESS;
    const {feed} = props;
    let access = {currentPolicy: 'public', passcode: 'secret'};
    if (feed.settings && feed.settings[currentType]) {
      access = feed.settings[currentType];
    }
    this.state = {
      currentType,
      access,
    };
  }

  onUpdateAccess(props: any) {
    this.setState((prevState: any) => ({
      access: {
        ...prevState.access,
        ...props,
      },
    }), () => {
      this.props.setChanged();
    });
  }

  render() {
    const {currentType, access} = this.state;
    const {submitting, submitForType} = this.props;
    return (<SettingsBase
      title="Access control"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={(e: any) => {
        e.preventDefault();
        this.props.onSubmit(e, currentType, {
          ...access,
        });
      }}
    >
      <AdminRadioGroup
        ariaLabel="Access policy"
        name="access-policy"
        value={access.currentPolicy}
        onValueChange={(value) => this.onUpdateAccess({currentPolicy: value})}
        variant="cards"
        options={[
          {
            value: "public",
            label: "Public",
            description: "Make the entire site publicly accessible, including all non-Admin web pages, rss feed and json feed.",
          },
          {
            value: "offline",
            label: "Offline",
            description: "Make the entire site offline. All non-Admin web pages, rss feed and json feed will be 404-ed.",
          },
        ]}
      />
    </SettingsBase>);
  }
}
