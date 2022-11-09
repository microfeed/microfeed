import React from 'react';
import { RadioGroup } from '@headlessui/react'
import SettingsBase from '../SettingsBase';
import clsx from "clsx";

function AccessOption({value, header, description}) {
  return (<RadioGroup.Option value={value}>
    {({checked}) => (
      <div className={clsx(checked ? 'bg-blue-200' : '')}>
        <div>{header}</div>
        <div>{description}</div>
      </div>
    )}
  </RadioGroup.Option>);
}

export default class PodcastAccessSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    this.onUpdateAccess = this.onUpdateAccess.bind(this);

    const currentType = 'access';
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

  onUpdateAccess(props) {
    this.setState((prevState) => ({
      access: {
        ...prevState.access,
        ...props,
      },
    }));
  }

  render() {
    const {currentType, access} = this.state;
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
      <RadioGroup
        value={access.currentPolicy}
        onChange={(value) => this.onUpdateAccess({currentPolicy: value})}
      >
        <AccessOption
          value="public"
          header="Public"
          description="something something"
        />
        <AccessOption
          value="passcode"
          header="Passcode"
          description="something2 something"
        />
        <AccessOption
          value="offline"
          header="Offline"
          description="something3 something"
        />
      </RadioGroup>
    </SettingsBase>);
  }
}
