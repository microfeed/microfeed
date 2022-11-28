import React from 'react';
import {ADMIN_URLS} from "../../../../common-src/StringUtils";
import SettingsBase from '../SettingsBase';
import {SETTINGS_CATEGORIES} from "../../../../common-src/Constants";

function NavBlock({url, text}) {
  return (<div>
    <a href={url}>
      {text} <span className="lh-icon-arrow-right"/>
    </a>
  </div>);
}

export default class CustomCodeSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentType: SETTINGS_CATEGORIES.CUSTOM_CODE,
    }
  }

  render() {
    const {submitting, submitForType} = this.props;
    const {currentType} = this.state;
    return (<SettingsBase
      title="Custom Code"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
    >
      <NavBlock
        url={ADMIN_URLS.codeEditorSettings()}
        text="Edit shared code across web pages"
      />
      <div className="text-xs text-muted-color mt-2">
        {'Code inside <head></head> and at top & bottom of <body></body>'}
      </div>

      <div className="mt-8">
        <div className="lh-page-subtitle">Themes</div>
        <NavBlock
          url={`${ADMIN_URLS.codeEditorSettings()}?theme=custom`}
          text="Edit web and rss styling"
        />
        <div className="text-xs text-muted-color mt-2">
          <em>microfeed will support multiple themes / templates in the future</em>
        </div>
      </div>
    </SettingsBase>);
  }
}
