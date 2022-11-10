import React from 'react';
import { RadioGroup } from '@headlessui/react'
import clsx from "clsx";
import { CheckIcon } from '@heroicons/react/20/solid'
import SettingsBase from '../SettingsBase';

function AccessOption({value, header, description}) {
  return (<RadioGroup.Option value={value}>
    {({checked}) => (
      <div className={clsx('border p-2 hover:cursor-pointer',
        checked ? 'border-brand-light' : '')}>
        <div className="flex">
          <div className="flex-none mr-4">
            <CheckIcon className={clsx(checked ? 'bg-brand-light border-white' : '',
              'w-6 border rounded-full text-white')} />
          </div>
          <div>
            <div className={clsx('text-sm font-semibold')}>
              {header}
            </div>
            <div className={clsx('text-xs', 'text-muted-color')}>
              {description}
            </div>
          </div>
        </div>
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
      onSubmit={(e) => {
        e.preventDefault();
        this.props.onSubmit(e, currentType, {
          ...access,
        });
      }}
    >
      <RadioGroup
        value={access.currentPolicy}
        onChange={(value) => this.onUpdateAccess({currentPolicy: value})}
      >
        <div className="grid grid-cols-1 gap-4">
          <AccessOption
            value="public"
            header="Public"
            description="Make the entire site publicly accessible, including all non-Admin web pages, rss feed and json feed."
          />
          {/*<AccessOption*/}
          {/*  value="passcode"*/}
          {/*  header="Passcode"*/}
          {/*  description="something2 something"*/}
          {/*/>*/}
          <AccessOption
            value="offline"
            header="Offline"
            description="Make the entire site offline. All non-Admin web pages, rss feed and json feed will be 404-ed."
          />
        </div>
      </RadioGroup>
    </SettingsBase>);
  }
}
