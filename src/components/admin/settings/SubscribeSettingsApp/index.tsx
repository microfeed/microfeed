import React from 'react';
import clsx from "clsx";
import SettingsBase from "../SettingsBase";
import {PUBLIC_URLS, randomShortUUID} from "@/shared/StringUtils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CirclePlusIcon,
  Trash2Icon,
} from "lucide-react";
import AdminInput from "@/components/admin/shared/AdminInput";
import AdminSwitch from "@/components/admin/shared/AdminSwitch";
import ExternalLink from "@/components/admin/shared/ExternalLink";
import {PREDEFINED_SUBSCRIBE_METHODS, SETTINGS_CATEGORIES} from '@/shared/Constants';
import NewSubscribeDialog from "./components/NewSubscribeDialog";
import ExplainText from "@/components/admin/shared/ExplainText";
import {
  SETTINGS_CONTROLS,
  CONTROLS_TEXTS_DICT
} from "../FormExplainTexts";
import {Button} from "@/components/ui/button";

function initMethodsDict() {
  return {
    methods: [
      {...PREDEFINED_SUBSCRIBE_METHODS.rss, id: randomShortUUID(), editable: false, enabled: true},
      {...PREDEFINED_SUBSCRIBE_METHODS.json, id: randomShortUUID(), editable: false, enabled: true},
    ],
  };
}

function MethodRow({method, updateMethodByAttr, index, firstIndex, lastIndex, moveCard}: any) {
  const { id, name, type, editable, enabled, image, deleted } = method;
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

  return (<div className={clsx('flex flex-wrap items-start gap-y-3 border-b py-4 sm:flex-nowrap')}>
    <div className="flex-none mr-2 flex items-center justify-start">
      <Button
        aria-label={`Move ${name} up`}
        className={firstIndex ? 'text-muted-foreground' : ''}
        disabled={firstIndex}
        size="icon-sm"
        type="button"
        variant="ghost"
        onClick={(e: any) => moveCard(e, index, index - 1)}
      >
        <ArrowUpIcon className="w-4" />
      </Button>
      <Button
        aria-label={`Move ${name} down`}
        className={lastIndex ? 'text-muted-foreground' : ''}
        disabled={lastIndex}
        size="icon-sm"
        type="button"
        variant="ghost"
        onClick={(e: any) => moveCard(e, index, index + 1)}
      >
        <ArrowDownIcon className="w-4" />
      </Button>
    </div>
    <div className="flex-none mr-4 flex items-center justify-end">
      <img src={image} className={clsx('w-14', enabled ? '' : 'opacity-50')} alt={name} />
    </div>
    <div className="min-w-0 flex-[1_1_18rem]">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
        <div className="md:col-span-4">
          <AdminInput
            value={name}
            disabled={!editable || !enabled}
            onChange={(e: any) => updateMethodByAttr(id, 'name', e.target.value)}
            customClass="text-xs p-1"
          />
        </div>
        <div className="md:col-span-8">
          <div className="flex-1 flex items-center">
            <AdminInput
              value={url}
              disabled={!editable || !enabled}
              onChange={(e: any) => updateMethodByAttr(id, 'url', e.target.value)}
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
            labelClassName={clsx('text-xs', enabled ? 'text-foreground' : 'text-muted-foreground')}
            checked={enabled}
            onCheckedChange={(checked) => updateMethodByAttr(id, 'enabled', checked)}
          />
        </div>
        <div className="ml-4">
          {editable && <div>
            {!deleted ? <div><Button
              type="button"
              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              variant="ghost"
              onClick={() => {
                updateMethodByAttr(id, 'deleted', true);
              }}>
              <Trash2Icon className="w-4"/>
              Delete
            </Button></div> : <div className="text-xs text-muted-color">
              <i>Click "Update" to sync up and actually delete it. Or <a
                href="#"
                className="text-brand-light text-xs"
                onClick={(e: any) => {
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

function AddNewMethod({isOpenNewMethod, setIsOpenNewMethod, addNewMethod}: any) {
  return (<div>
    <Button
      className="mx-auto"
      type="button"
      variant="ghost"
      onClick={() => {
        setIsOpenNewMethod(true);
      }}
    >
      <CirclePlusIcon aria-hidden="true" className="size-4 shrink-0" />
      <span>Add new subscribe method</span>
    </Button>
    <div className="mt-1 text-xs text-muted-color text-center">e.g., Apple Podcasts, Spotify, Listen Notes...</div>
    <NewSubscribeDialog
      isOpen={isOpenNewMethod}
      setIsOpen={setIsOpenNewMethod}
      addNewMethod={addNewMethod}
    />
  </div>);
}

export default class SubscribeSettingsApp extends React.Component<any, any> {
  constructor(props: any) {
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

  updateMethodByAttr(methodId: any, attrName: any, attrValue: any) {
    const {methods} = this.state.methodsDict;
    methods.forEach((method: any) => {
      if (method.id !== methodId) {
        return;
      }
      method[attrName] = attrValue;
    });
    this.updateMethodsDict(methods);
  }

  addNewMethod(newMethod: any) {
    const methods = this.state.methodsDict.methods || [];
    methods.push(newMethod);
    this.updateMethodsDict(methods);
  }

  updateMethodsDict(methods: any, callback?: any) {
    this.setState((prevState: any) => ({
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

  moveCard(e: any, oldIndex: any, newIndex: any) {
    e.preventDefault();
    const {methods} = this.state.methodsDict;
    const element = methods.splice(oldIndex, 1)[0];
    methods.splice(newIndex, 0, element);
    this.updateMethodsDict(methods);
  }

  render() {
    const {currentType, methodsDict, isOpenNewMethod} = this.state;
    const {submitting, submitForType} = this.props;
    const methods = methodsDict.methods || [];
    return (<SettingsBase
      titleComponent={<ExplainText bundle={CONTROLS_TEXTS_DICT[SETTINGS_CONTROLS.SUBSCRIBE_METHODS]}/>}
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={(e: any) => {
        e.preventDefault();
        const newMethods = methods.filter((m: any) => !m.deleted);
        this.updateMethodsDict(newMethods, () => {
          this.props.onSubmit(e, currentType, {
            ...methodsDict,
            methods: newMethods,
          });
        });
      }}
    >
      <div className="mb-4">
        {methods.map((method: any, i: any) => <MethodRow
          method={method}
          key={`${method.id}-row`}
          updateMethodByAttr={this.updateMethodByAttr}
          index={i}
          firstIndex={i === 0}
          lastIndex={i === methods.length - 1}
          moveCard={this.moveCard}
        />)}
      </div>
      <AddNewMethod
        isOpenNewMethod={isOpenNewMethod}
        setIsOpenNewMethod={(isOpen: any) => this.setState({isOpenNewMethod: isOpen})}
        addNewMethod={this.addNewMethod}
      />
    </SettingsBase>);
  }
}
