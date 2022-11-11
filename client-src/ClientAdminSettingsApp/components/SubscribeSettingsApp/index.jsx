import React from 'react';
import SettingsBase from "../SettingsBase";
import {PUBLIC_URLS} from "../../../../common-src/StringUtils";
import { PlusCircleIcon, TrashIcon, ArrowSmallUpIcon, ArrowSmallDownIcon } from '@heroicons/react/24/outline';
import AdminInput from "../../../components/AdminInput";
import AdminSwitch from "../../../components/AdminSwitch";
import ExternalLink from "../../../components/ExternalLink";
import clsx from "clsx";

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
      {
        name: 'apple podcasts',
        url: '',
        enabled: false,
        editable: true,
      },
      {
        name: 'spotify',
        url: '',
        enabled: false,
        editable: true,
      },
    ],
  };
}

function MethodRow({method, updateMethodsDict, index, firstIndex, lastIndex, moveCard}) {
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

  return (<div className={clsx('grid grid-cols-12 gap-2 py-2')}>
    <div className="col-span-1 flex items-center justify-start">
      <button
        className={firstIndex ? 'text-muted-color' : 'hover:opacity-50'}
        disabled={firstIndex}
        onClick={(e) => moveCard(e, index, index - 1)}
      >
        <ArrowSmallUpIcon className="w-4" />
      </button>
      <button
        className={clsx(lastIndex ? 'text-muted-color' : 'hover:opacity-50')}
        disabled={lastIndex}
        onClick={(e) => moveCard(e, index, index + 1)}
      >
        <ArrowSmallDownIcon className="w-4" />
      </button>
    </div>
    <div className="col-span-2 flex items-center justify-end">
      <ExternalLink url={url} text={name} />
    </div>
    <div className="col-span-5 flex items-center justify-start">
      <AdminInput
        value={url}
        disabled={!editable || !enabled}
        onChange={(e) => updateMethodsDict(name, 'url', e.target.value)}
        customClass="text-xs p-1"
      />
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
    this.moveCard = this.moveCard.bind(this);

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

  moveCard(e, oldIndex, newIndex) {
    e.preventDefault();
    const {methods} = this.state.methodsDict;
    const element = methods.splice(oldIndex, 1)[0];
    methods.splice(newIndex, 0, element);
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
      <div className="mb-8">
        {methods.map((method, i) => <MethodRow
          method={method}
          key={`${method.name}-row`}
          updateMethodsDict={this.updateMethodsDict}
          index={i}
          firstIndex={i === 0}
          lastIndex={i === methods.length - 1}
          moveCard={this.moveCard}
        />)}
      </div>
      <AddNewMethod />
    </SettingsBase>);
  }
}
