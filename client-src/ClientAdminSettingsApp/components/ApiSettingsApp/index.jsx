import React from 'react';
import SettingsBase from "../SettingsBase";
import AdminSwitch from "../../../components/AdminSwitch";
import clsx from "clsx";
import {randomHex, randomShortUUID} from "../../../../common-src/StringUtils";
import AdminInput from "../../../components/AdminInput";
import {SETTINGS_CATEGORIES} from "../../../../common-src/Constants";
import {isChineseLanguage} from "../../../../common-src/I18n";

export default class ApiSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    this.setApiEnabled = this.setApiEnabled.bind(this);
    this.updateApiApps = this.updateApiApps.bind(this);

    const currentType = SETTINGS_CATEGORIES.API_SETTINGS;
    const {feed} = props;

    let apiBundle = {
      enabled: false,
      apps: [{
        id: randomShortUUID(),
        name: 'Default',
        token: randomHex(),
        createdAtMs: new Date().getTime(),
      }],
    };

    if (feed.settings && feed.settings[currentType]) {
      apiBundle = feed.settings[currentType];
    }

    this.state = {
      feed,
      currentType,
      apiBundle,
    };
  }

  setApiEnabled(checked) {
    this.setState({apiBundle: {...this.state.apiBundle, enabled: checked}}, () => {
      this.props.setChanged();
    });
  }

  updateApiApps(app) {
    const {apiBundle} = this.state;
    const newApps = apiBundle.apps.map((a) => {
      if (a.id === app.id) {
        return app;
      }
      return a;
    });
    this.setState({apiBundle: {...apiBundle, apps: newApps}}, () => {
      this.props.setChanged();
    });
  }

  render() {
    const {currentType, apiBundle, feed} = this.state;
    const {submitting, submitForType} = this.props;
    const app = apiBundle.apps[0];
    const isZh = isChineseLanguage(feed.channel.language);
    const t = (zhText, enText) => isZh ? zhText : enText;

    return (<SettingsBase
      title="API"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={(e) => {
        e.preventDefault();
        this.props.onSubmit(e, currentType, {
          ...apiBundle,
        });
      }}
    >
      <div className="mb-4">
        <div>
          <AdminSwitch
            label={t('启用 API', 'Enable API')}
            customLabelClass={clsx('', apiBundle.enabled ? 'text-black' : 'text-muted-color')}
            enabled={apiBundle.enabled}
            setEnabled={(checked) => this.setApiEnabled(checked)}
          />
          <div className="text-muted-color text-xs mt-2">
            {t('你可以通过 API 管理 feed 内容，例如新建、更新和删除条目。', 'You can manage feed content through the API, such as creating, updating, and deleting items.')}
          </div>
        </div>
        <div className="flex items-center mt-8">
          <div className={clsx('flex-none text-sm', !apiBundle.enabled && 'text-muted-color')}>
            {t('API 密钥：', 'API key:')}
          </div>
          <div className="flex-1 mx-2">
            <AdminInput
              disabled
              value={app.token}
              customClass={clsx('text-sm p-1 select-all', !apiBundle.enabled && 'text-muted-color')}
              description={t(
                `把请求头 X-MicrofeedAPI-Key 设置为这个 API 密钥，例如：curl -H "X-MicrofeedAPI-Key: ${app.token}" ...`,
                `Set the request header X-MicrofeedAPI-Key to this API key, for example: curl -H "X-MicrofeedAPI-Key: ${app.token}" ...`,
              )}
            />
          </div>
          <div className="flex-none">
            <button
              type="button"
              disabled={!apiBundle.enabled}
              className="lh-btn lh-btn-secondary lh-btn-sm"
              onClick={(e) => {
                e.preventDefault();
                const ok = confirm(t('确定要重置 API 密钥吗？', 'Are you sure you want to reset the API key?'));
                if (ok) {
                  this.updateApiApps({...app, token: randomHex()});
                }
              }}
            >
              {t('重置', 'Reset')}
            </button>
          </div>
        </div>
        <div className="text-xs mt-8">
          {t('如何使用 API 密钥？', 'How to use the API key?')}
        </div>
        <div className="mt-2 text-xs text-helper-color">
          {t('把请求头 X-MicrofeedAPI-Key 设置为 API 密钥，例如：curl -H "X-MicrofeedAPI-Key: <API_KEY>" ...', 'Set the request header X-MicrofeedAPI-Key to your API key, for example: curl -H "X-MicrofeedAPI-Key: <API_KEY>" ...')}
        </div>
        <div className="mt-8">
          <a href="/json/openapi.html" target="_blank" rel="noopener noreferrer">
            {t('microfeed API 文档', 'microfeed API docs')} <span className="lh-icon-arrow-right"/>
          </a>
        </div>
        <div className="mt-4">
          <a href="/json/openapi.yaml" target="_blank" rel="noopener noreferrer">
            {t('YAML 格式 OpenAPI 规范', 'YAML OpenAPI spec')} <span className="lh-icon-arrow-right" />
          </a>
        </div>
      </div>
    </SettingsBase>);
  }
}
