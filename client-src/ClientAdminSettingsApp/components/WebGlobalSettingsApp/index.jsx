import React from 'react';
import SettingsBase from '../SettingsBase';
import AdminCodeEditor from "../../../components/AdminCodeEditor";

export default class WebGlobalSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    const currentType = 'webGlobalSettings';
    const {feed} = props;

    let headerCode = '';
    let footerCode = '';
    if (feed.settings && feed.settings[currentType]) {
      headerCode = feed.settings[currentType].headerCode || '';
      footerCode = feed.settings[currentType].footerCode || '';
    }
    this.state = {
      headerCode,
      footerCode,
      currentType,
    };
  }

  render() {
    const {currentType, headerCode, footerCode} = this.state;
    const {submitting, submitForType} = this.props;
    return (<SettingsBase
      title="Web global settings"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
      onSubmit={(e) => {
        this.props.onSubmit(e, currentType, {
          headerCode,
          footerCode,
        });
      }}
    >
      <details>
        <summary className="lh-page-subtitle cursor-pointer">Site Header</summary>
        <div className="text-xs text-muted-color mb-4">Code here will be placed right before the <b>{'</head>'}</b> tag on every public web page of the site.</div>
        <AdminCodeEditor
          code={headerCode}
          language="html"
          minHeight="30vh"
          onChange={(e) => this.setState({headerCode: e.target.value})}
        />
      </details>
      <details className="mt-4">
        <summary className="lh-page-subtitle cursor-pointer">Site Footer</summary>
        <div className="text-xs text-muted-color mb-4">
          Code here will be placed right before the <b>{'</body>'}</b> tag on every public web page of the site. You can put a Google Analytics tag or any 3rd-party js code here.
        </div>
        <AdminCodeEditor
          code={footerCode}
          minHeight="30vh"
          language="html"
          onChange={(e) => this.setState({footerCode: e.target.value})}
        />
      </details>
    </SettingsBase>);
  }
}
