import React from 'react';
import clsx from "clsx";
import SettingsBase from "../SettingsBase";
import {PUBLIC_URLS, randomShortUUID} from "../../../../common-src/StringUtils";
import { PlusCircleIcon, TrashIcon, ArrowSmallUpIcon, ArrowSmallDownIcon } from '@heroicons/react/24/outline';
import AdminInput from "../../../components/AdminInput";
import AdminSwitch from "../../../components/AdminSwitch";
import ExternalLink from "../../../components/ExternalLink";
import {PREDEFINED_SUBSCRIBE_METHODS, SETTINGS_CATEGORIES} from '../../../../common-src/Constants';
import NewSubscribeDialog from "./components/NewSubscribeDialog";
import ExplainText from "../../../components/ExplainText";
import {
  SETTINGS_CONTROLS,
  CONTROLS_TEXTS_DICT
} from "../FormExplainTexts";
import {isChineseLanguage} from "../../../../common-src/I18n";

function initMethodsDict() {
  return {
    methods: [
      {...PREDEFINED_SUBSCRIBE_METHODS.rss, id: randomShortUUID(), editable: false, enabled: true},
      {...PREDEFINED_SUBSCRIBE_METHODS.json, id: randomShortUUID(), editable: false, enabled: true},
    ],
  };
}

function MethodRow({method, updateMethodByAttr, index, firstIndex, lastIndex, moveCard, isZh}) {
  const { id, type, editable, enabled, image, deleted } = method;
  const name = isZh && method.nameZh ? method.nameZh : method.name;
  let { url } = method;

  if (!url && !editable) {
    switch (type) {
      case 'rss':
        url = PUBLIC_URLS.rssFeed();
        break;
      case 'json':
        url = PUBLIC_URLS.jsonFeed();
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
    <div className="flex-none mr-4 flex items-center justify-end">
      <img src={image} className={clsx('w-14', enabled ? '' : 'opacity-50')} alt={name} />
    </div>
    <div className="flex-1">
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-4">
          <AdminInput
            value={name}
            disabled={!editable || !enabled}
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
        <div>
          <AdminSwitch
            label={isZh ? '显示' : 'Show'}
            customLabelClass={clsx('text-xs', enabled ? 'text-black' : 'text-muted-color')}
            enabled={enabled}
            setEnabled={(checked) => updateMethodByAttr(id, 'enabled', checked)}
          />
        </div>
        <div className="ml-4">
          {editable && <div>
            {!deleted ? <div><a
              href="#"
              className="text-red-500 text-xs"
              onClick={(e) => {
                e.preventDefault();
                updateMethodByAttr(id, 'deleted', true);
              }}>
              <div className="flex items-center">
                <div className="mr-1"><TrashIcon className="w-4"/></div>
                <div>{isZh ? '删除' : 'Delete'}</div>
              </div>
            </a></div> : <div className="text-xs text-muted-color">
              <i>{isZh ? '点击“更新”后才会真正删除。或者 ' : 'This will be deleted after you click "Update". Or '}<a
                href="#"
                className="text-brand-light text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  updateMethodByAttr(id, 'deleted', false);
                }}>{isZh ? '撤销' : 'undo'}</a>{isZh ? '。' : '.'}</i>
            </div>}
          </div>}
        </div>
      </div>
    </div>
  </div>);
}

function AddNewMethod({isOpenNewMethod, setIsOpenNewMethod, addNewMethod, language}) {
  const isZh = isChineseLanguage(language);
  return (<div>
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        setIsOpenNewMethod(true);
      }}
    >
      <div className="flex items-center justify-center">
        <div className="w-4 mr-1"><PlusCircleIcon/></div>
        <div>{isZh ? '新增订阅方式' : 'Add subscribe method'}</div>
      </div>
    </a>
    <div className="mt-1 text-xs text-muted-color text-center">
      {isZh ? '例如：苹果播客、Spotify、Listen Notes 等' : 'For example: Apple Podcasts, Spotify, Listen Notes...'}
    </div>
    <NewSubscribeDialog
      isOpen={isOpenNewMethod}
      setIsOpen={setIsOpenNewMethod}
      addNewMethod={addNewMethod}
      language={language}
    />
  </div>);
}

export default class SubscribeSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.updateMethodsDict = this.updateMethodsDict.bind(this);
    this.updateMethodByAttr = this.updateMethodByAttr.bind(this);
    this.addNewMethod = this.addNewMethod.bind(this);
    this.moveCard = this.moveCard.bind(this);

    const currentType = SETTINGS_CATEGORIES.SUBSCRIBE_METHODS;
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
      isOpenNewMethod: false,
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

  addNewMethod(newMethod) {
    const methods = this.state.methodsDict.methods || [];
    methods.push(newMethod);
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
      this.props.setChanged();
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
    const {currentType, methodsDict, isOpenNewMethod} = this.state;
    const {submitting, submitForType, feed} = this.props;
    const methods = methodsDict.methods || [];
    const language = feed.channel.language || 'en-us';
    const isZh = isChineseLanguage(language);

    return (<SettingsBase
      titleComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[SETTINGS_CONTROLS.SUBSCRIBE_METHODS]}/>}
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
      <div className="mb-4">
        {methods.map((method, i) => <MethodRow
          method={method}
          key={`${method.id}-row`}
          updateMethodByAttr={this.updateMethodByAttr}
          index={i}
          firstIndex={i === 0}
          lastIndex={i === methods.length - 1}
          moveCard={this.moveCard}
          isZh={isZh}
        />)}
      </div>
      <AddNewMethod
        isOpenNewMethod={isOpenNewMethod}
        setIsOpenNewMethod={(isOpen) => this.setState({isOpenNewMethod: isOpen})}
        addNewMethod={this.addNewMethod}
        language={language}
      />
    </SettingsBase>);
  }
}
