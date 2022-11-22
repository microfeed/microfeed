import React from 'react';
import SettingsBase from '../SettingsBase';
import AdminCodeEditor from "../../../components/AdminCodeEditor";
import AdminImageUploaderApp from "../../../components/AdminImageUploaderApp";

export default class WebGlobalSettingsApp extends React.Component {
  constructor(props) {
    super(props);

    const currentType = 'webGlobalSettings';
    const {feed} = props;

    let headerCode = '';
    let footerCode = '';
    let favicon = '';
    if (feed.settings && feed.settings[currentType]) {
      headerCode = feed.settings[currentType].headerCode || '';
      footerCode = feed.settings[currentType].footerCode || '';
      favicon = feed.settings[currentType].favicon || {};
    }
    this.state = {
      headerCode,
      footerCode,
      currentType,
      favicon,
    };
  }

  render() {
    const {currentType, headerCode, footerCode, favicon} = this.state;
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
          favicon,
        });
      }}
    >
      <details>
        <summary className="lh-page-subtitle cursor-pointer">Favicon</summary>
        <div className="flex">
          <AdminImageUploaderApp
            mediaType="favicon"
            currentImageUrl={favicon.url}
            imageSizeNotOkayFunc={(width, height) => {
              return (width > 256 && height > 256) || (width < 48 && height < 48);
            }}
            imageSizeNotOkayMsgFunc={(width, height) => {
              if (width > 256 && height > 256) {
                return `Image too big: ${parseInt(width)} x ${parseInt(height)} pixels. ` +
                  "You'd better upload a smaller image for favicon.";
              } else if (width < 48 && height < 48) {
                return `Image too small: ${parseInt(width)} x ${parseInt(height)} pixels. ` +
                  "You'd better upload a bigger image for favicon.";
              }
              return '';
            }}
            onImageUploaded={(cdnUrl, contentType) => this.setState({
              favicon: {
                url: cdnUrl,
                contentType,
              },
            })}
          />
        </div>
      </details>
      <details className="mt-4">
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