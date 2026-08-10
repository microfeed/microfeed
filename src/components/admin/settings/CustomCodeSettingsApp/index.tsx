import React from 'react';
import {ADMIN_URLS} from "@/shared/StringUtils";
import SettingsBase from '../SettingsBase';
import {SETTINGS_CATEGORIES} from "@/shared/Constants";

function NavBlock({url, text}: any) {
  return (<div>
    <a href={url}>
      {text} <span className="lh-icon-arrow-right"/>
    </a>
  </div>);
}

export default class CustomCodeSettingsApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = {
      currentType: SETTINGS_CATEGORIES.CUSTOM_CODE,
    }
  }

  render() {
    const {submitting, submitForType} = this.props;
    const {currentType} = this.state;
    return (<SettingsBase
      title="Custom code"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
    >
      <NavBlock
        url={ADMIN_URLS.codeEditorSettings()}
        text="Edit shared html code across web pages"
      />
      <div className="text-xs text-muted-color mt-2">
        {'Code inside <head></head> and at top & bottom of <body></body>'}
      </div>

      <div className="mt-8">
        <div className="mb-2 font-semibold text-foreground">Themes</div>
        <NavBlock
          url={ADMIN_URLS.themesSettings()}
          text="Manage versioned themes"
        />
        <div className="text-xs text-muted-color mt-2">
          Install, customize, preview, publish, activate, and roll back immutable versions.
        </div>
      </div>
    </SettingsBase>);
  }
}
