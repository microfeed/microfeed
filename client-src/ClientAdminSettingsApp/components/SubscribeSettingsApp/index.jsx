import React from 'react';
import SettingsBase from "../SettingsBase";
import {PUBLIC_URLS} from "../../../../common-src/StringUtils";
import { PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import AdminInput from "../../../components/AdminInput";
import AdminSwitch from "../../../components/AdminSwitch";

function initMethodsDict() {
  return {
    methods: [
      {
        name: 'rss',
        url: '', // dynamically set from PUBLIC_URLS; no need to save to feed.json
        enabled: true,
        editable: false,
      },
      {
        name: 'json',
        url: '',
        enabled: true,
        editable: false,
      },
    ],
  };
}

function MethodRow({method}) {
  let { name, url, editable, enabled } = method;
  switch (name) {
    case 'rss':
      url = PUBLIC_URLS.feedRss();
      break;
    case 'json':
      url = PUBLIC_URLS.feedJson();
      break;
    default:
      break;
  }
  return (<div className="grid grid-cols-12 gap-4">
    <div className="col-span-2">{name}</div>
    <div className="col-span-6">
      <AdminInput value={url} disabled={!editable} customClass="text-xs" />
    </div>
    <div className="col-span-2 flex items-center justify-center">
      <AdminSwitch enabled={enabled} />
    </div>
    <div className="col-span-2 flex items-center justify-end">
      {editable && <a href="#" className="text-red-500 text-xs">
        <div className="flex items-center">
          <div className="mr-1"><TrashIcon className="w-4" /></div>
          <div>delete</div>
        </div>
      </a>}
    </div>
  </div>);
}

function AddNewMethod() {
  return (<div>
    <a href="#">
      <div className="flex items-center justify-center">
        <div className="w-4 mr-1"><PlusCircleIcon/></div>
        <div>Add new Subscribe Method</div>
      </div>
    </a>
  </div>);
}

export default class SubscribeSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    const currentType = 'subscribeMethods';
    const {settings} = props.feed;
    let methodsDict;
    if (settings && settings[currentType]) {
      methodsDict = settings[currentType];
    } else {
      methodsDict = initMethodsDict();
    }
    this.state = {
      currentType,
      methodsDict,
    };
  }

  render() {
    const {currentType, methodsDict} = this.state;
    const {submitting, submitForType} = this.props;
    const {methods} = methodsDict;
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
      <div className="mb-4 grid grid-cols-1 gap-4">
        {methods.map((method) => <MethodRow
          method={method}
          key={`${method.name}-row`}
        />)}
      </div>
      <AddNewMethod />
    </SettingsBase>);
  }
}
