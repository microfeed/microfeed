import React from 'react';
import SettingsBase from '../SettingsBase';

export default class PodcastAccessSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    const currentType = 'access';
    this.state = {
      currentType,
    };
  }

  render() {
    const {currentType} = this.state;
    const {submitting, submitForType} = this.props;
    return (<SettingsBase
      title="Access control"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={() => {
        // this.props.onSubmit(e, currentType, {
        //   urls,
        // });
      }}
    >
      access
    </SettingsBase>);
  }
}
