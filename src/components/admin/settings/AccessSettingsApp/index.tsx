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

  onUpdateAccess(currentPolicy: string) {
    const access = {...this.state.access, currentPolicy};
    this.setState({access}, () => {
      this.props.setChanged();
      void this.props.onSubmit(
        {preventDefault() {}},
        this.state.currentType,
        access,
      );
    });
  }

  render() {
    const {currentType, access} = this.state;
    const {submitting} = this.props;
    return (<SettingsBase
      title="Access control"
      currentType={currentType}
    >
      <AdminRadioGroup
        alignment="start"
        ariaLabel="Access policy"
        disabled={submitting}
        name="access-policy"
        value={access.currentPolicy}
        onValueChange={(value) => this.onUpdateAccess(value)}
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
