import React from 'react';
import SettingsBase from "../SettingsBase";

export default class SocialAccountSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentType: 'socialAccounts',
    }
  }

  render() {
    const {currentType} = this.state;
    const {submitting, submitForType} = this.props;
    return (<SettingsBase
      title="Social accounts"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={() => {
        // this.props.onSubmit(e, currentType, {
        //   urls,
        // });
      }}
    >
      social
    </SettingsBase>);
  }
}
