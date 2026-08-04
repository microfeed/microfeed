import React from 'react';
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
import SettingsBase from '../SettingsBase';
import {
  CHANNEL_STATUSES,
  CHANNEL_STATUSES_DICT,
  SETTINGS_CATEGORIES,
} from "@/shared/Constants";
import type {AccessPolicy} from "@/types";

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

  onUpdateAccess(currentPolicy: AccessPolicy) {
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
        onValueChange={(value) => this.onUpdateAccess(value as AccessPolicy)}
        variant="cards"
        options={[
          {
            value: CHANNEL_STATUSES.PUBLIC,
            label: CHANNEL_STATUSES_DICT[CHANNEL_STATUSES.PUBLIC].name,
            description: CHANNEL_STATUSES_DICT[CHANNEL_STATUSES.PUBLIC].description,
          },
          {
            value: CHANNEL_STATUSES.HEADLESS,
            label: CHANNEL_STATUSES_DICT[CHANNEL_STATUSES.HEADLESS].name,
            description: CHANNEL_STATUSES_DICT[CHANNEL_STATUSES.HEADLESS].description,
          },
          {
            value: CHANNEL_STATUSES.OFFLINE,
            label: CHANNEL_STATUSES_DICT[CHANNEL_STATUSES.OFFLINE].name,
            description: CHANNEL_STATUSES_DICT[CHANNEL_STATUSES.OFFLINE].description,
          },
        ]}
      />
    </SettingsBase>);
  }
}
