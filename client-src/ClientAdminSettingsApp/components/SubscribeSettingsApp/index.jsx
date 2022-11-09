import React from 'react';
import SettingsBase from "../SettingsBase";

export default class SubscribeSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentType: 'subscribeMethods',
    };
  }

  render() {
    const {currentType} = this.state;
    const {submitting, submitForType} = this.props;
    return (<SettingsBase
      title="Subscribe methods"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={() => {
        // this.props.onSubmit(e, currentType, {
        //   urls,
        // });
      }}
    >
      Subscribe
    </SettingsBase>);
  }
}
