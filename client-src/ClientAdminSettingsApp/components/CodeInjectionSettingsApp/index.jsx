import React from 'react';
import AdminTextarea from "../../../components/AdminTextarea";
import SettingsBase from '../SettingsBase';

export default class CodeInjectionSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    const currentType = 'codeInjection';
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
      title="Web code injection"
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
      <div>
        <div className="lh-page-subtitle">Site Header</div>
        <div className="text-xs text-muted-color">Code here will be placed right before the <b>{'</head>'}</b> tag on every public web page of the site.</div>
        <AdminTextarea value={headerCode} onChange={(e) => this.setState({headerCode: e.target.value})}/>
      </div>
      <div className="mt-4">
        <div className="lh-page-subtitle">Site Footer</div>
        <div className="text-xs text-muted-color">
          Code here will be placed right before the <b>{'</body>'}</b> tag on every public web page of the site. You can put a Google Analytics tag or any 3rd-party js code here.
        </div>
        <AdminTextarea value={footerCode} onChange={(e) => this.setState({footerCode: e.target.value})}/>
      </div>
    </SettingsBase>);
  }
}
