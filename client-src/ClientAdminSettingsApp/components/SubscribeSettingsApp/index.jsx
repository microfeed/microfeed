import React from 'react';
import SettingsBase from "../SettingsBase";
import {PUBLIC_URLS} from "../../../../common-src/StringUtils";
import { PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import AdminInput from "../../../components/AdminInput";
import AdminSwitch from "../../../components/AdminSwitch";
import ExternalLink from "../../../components/ExternalLink";

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

function MethodRow({method, updateMethodsDict}) {
  const { name, editable, enabled } = method;
  let { url } = method;
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
    <div className="col-span-2 flex items-center justify-start">
      <ExternalLink url={url} text={name} />
    </div>
    <div className="col-span-6 flex items-center justify-start">
      <AdminInput value={url} disabled={!editable} customClass="text-xs p-1" />
    </div>
    <div className="col-span-2 flex items-center justify-center">
      <AdminSwitch enabled={enabled} setEnabled={(checked) => updateMethodsDict(name, 'enabled', checked)} />
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
    this.updateMethodsDict = this.updateMethodsDict.bind(this);

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

  updateMethodsDict(methodName, attrName, attrValue) {
    const {methods} = this.state.methodsDict;
    methods.forEach((method) => {
      if (method.name !== methodName) {
        return;
      }
      method[attrName] = attrValue;
    });
    this.setState((prevState) => ({
      methodsDict: {
        ...prevState.methodsDict,
        methods: [
          ...methods,
        ],
      },
    }));
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
      onSubmit={(e) => {
        e.preventDefault();
        this.props.onSubmit(e, currentType, {
          methods,
        });
      }}
    >
      <div className="mb-8 grid grid-cols-1 gap-4">
        {methods.map((method) => <MethodRow
          method={method}
          key={`${method.name}-row`}
          updateMethodsDict={this.updateMethodsDict}
        />)}
      </div>
      <AddNewMethod />
    </SettingsBase>);
  }
}
