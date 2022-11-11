import React from 'react';
import SettingsBase from "../SettingsBase";
import {PUBLIC_URLS, randomShortUUID} from "../../../../common-src/StringUtils";
import { PlusCircleIcon, TrashIcon, ArrowSmallUpIcon, ArrowSmallDownIcon } from '@heroicons/react/24/outline';
import AdminInput from "../../../components/AdminInput";
import AdminSwitch from "../../../components/AdminSwitch";
import ExternalLink from "../../../components/ExternalLink";
import clsx from "clsx";
import Constants from '../../../../common-src/Constants';

function initMethodsDict() {
  return {
    methods: [
      {...Constants.PREDEFINED_SUBSCRIBE_METHODS.rss, id: randomShortUUID(), editable: false},
      {...Constants.PREDEFINED_SUBSCRIBE_METHODS.json, id: randomShortUUID(), editable: false},
    ],
  };
}

function MethodRow({method, updateMethodByAttr, index, firstIndex, lastIndex, moveCard}) {
  const { id, name, type, editable, enabled, image, deleted } = method;
  let { url } = method;
  if (!url && !editable) {
    switch (type) {
      case 'rss':
        url = PUBLIC_URLS.feedRss();
        break;
      case 'json':
        url = PUBLIC_URLS.feedJson();
        break;
      default:
        break;
    }
  }

  return (<div className={clsx('flex py-4 border-b')}>
    <div className="flex-none mr-2 flex items-center justify-start">
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
    <div className="flex-none mr-2 flex items-center justify-end">
      <img src={image} className="w-14" alt={name} />
    </div>
    <div className="flex-1">
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-4">
          <AdminInput
            value={name}
            onChange={(e) => updateMethodByAttr(id, 'name', e.target.value)}
            customClass="text-xs p-1"
          />
        </div>
        <div className="col-span-8">
          <div className="flex-1 flex items-center">
            <AdminInput
              value={url}
              disabled={!editable || !enabled}
              onChange={(e) => updateMethodByAttr(id, 'url', e.target.value)}
              customClass="text-xs p-1"
            />
            <div className="flex-none ml-1">
              <ExternalLink url={url} text="" linkClass="text-xs"/>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center">
        <div className="">
          <AdminSwitch
            label="Visible"
            customLabelClass={clsx('text-xs', enabled ? 'text-black' : 'text-muted-color')}
            enabled={enabled} setEnabled={(checked) => updateMethodByAttr(id, 'enabled', checked)}
          />
        </div>
        <div className="ml-4">
          {!editable && <div>
            {!deleted ? <div><a
              href="#"
              className="text-red-500 text-xs"
              onClick={(e) => {
                e.preventDefault();
                updateMethodByAttr(id, 'deleted', true);
              }}>
              <div className="flex items-center">
                <div className="mr-1"><TrashIcon className="w-4"/></div>
                <div>Delete</div>
              </div>
            </a></div> : <div className="text-xs text-muted-color">
              <i>Click "Update" to sync up and actually delete it. Or <a
                href="#"
                className="text-brand-light text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  updateMethodByAttr(id, 'deleted', false);
                }}>Undo</a>.</i>
            </div>}
          </div>}
        </div>
      </div>
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
    <div className="mt-1 text-xs text-muted-color text-center">e.g., Apple Podcasts, Spotify...</div>
  </div>);
}

export default class SubscribeSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.updateMethodsDict = this.updateMethodsDict.bind(this);
    this.updateMethodByAttr = this.updateMethodByAttr.bind(this);
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

  updateMethodByAttr(methodId, attrName, attrValue) {
    const {methods} = this.state.methodsDict;
    methods.forEach((method) => {
      if (method.id !== methodId) {
        return;
      }
      method[attrName] = attrValue;
    });
    this.updateMethodsDict(methods);
  }

  updateMethodsDict(methods, callback) {
    this.setState((prevState) => ({
      methodsDict: {
        ...prevState.methodsDict,
        methods: [
          ...methods,
        ],
      },
    }), () => {
      if (callback) {
        callback();
      }
    });
  }

  moveCard(e, oldIndex, newIndex) {
    e.preventDefault();
    const {methods} = this.state.methodsDict;
    const element = methods.splice(oldIndex, 1)[0];
    methods.splice(newIndex, 0, element);
    this.updateMethodsDict(methods);
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
        const newMethods = methods.filter(m => !m.deleted);
        this.updateMethodsDict(newMethods, () => {
          this.props.onSubmit(e, currentType, {
            ...methodsDict,
            methods: newMethods,
          });
        });
      }}
    >
      <div className="mb-8">
        {methods.map((method, i) => <MethodRow
          method={method}
          key={`${method.id}-row`}
          updateMethodByAttr={this.updateMethodByAttr}
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
