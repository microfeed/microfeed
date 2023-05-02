import React from 'react';
import SettingsBase from "../SettingsBase";
import AdminSwitch from "../../../components/AdminSwitch";
import clsx from "clsx";
import {randomHex, randomShortUUID} from "../../../../common-src/StringUtils";
import AdminInput from "../../../components/AdminInput";
import {SETTINGS_CATEGORIES} from "../../../../common-src/Constants";

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
    const {currentType, apiBundle} = this.state;
    const {submitting, submitForType} = this.props;
    const app = apiBundle.apps[0];
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
        <div className="">
          <AdminSwitch
            label="API Enabled"
            customLabelClass={clsx('', apiBundle.enabled ? 'text-black' : 'text-muted-color')}
            enabled={apiBundle.enabled} setEnabled={(checked) => this.setApiEnabled(checked)}
          />
        </div>
        <div className="flex items-center mt-4">
          <div
            className={clsx('flex-none text-sm', !apiBundle.enabled && 'text-muted-color')}
          >
            API Key:
          </div>
          <div className="flex-1 mx-2">
            <AdminInput
              disabled
              value={app.token}
              customClass={clsx('text-sm p-1 select-all', !apiBundle.enabled && 'text-muted-color')}
            />
          </div>
          <div className="flex-none">
            <button
              type="button"
              className="lh-btn lh-btn-secondary lh-btn-sm"
              onClick={(e) => {
                e.preventDefault();
                const ok = confirm('Are you sure you want to reset the API key?');
                if (ok) {
                  this.updateApiApps({...app, token: randomHex()});
                }
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </SettingsBase>);
  }
}
