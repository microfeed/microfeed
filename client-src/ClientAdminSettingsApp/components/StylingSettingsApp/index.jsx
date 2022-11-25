import React from 'react';
import {ADMIN_URLS} from "../../../../common-src/StringUtils";
import SettingsBase from '../SettingsBase';

function NavBlock({url, text}) {
  return (<div>
    <a href={url}>
      {text} <span className="lh-icon-arrow-right"/>
    </a>
  </div>);
}

export default class BrandingSettingsApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      currentType: 'styles',
    }
  }

  render() {
    const {submitting, submitForType} = this.props;
    const {currentType} = this.state;
    return (<SettingsBase
      title="Code and Styles"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
    >
      <NavBlock
        url={ADMIN_URLS.sylingSettings()}
        text="Edit web code shared across pages"
      />

      <div className="mt-8">
        <div className="lh-page-subtitle">Themes</div>
        <NavBlock
          url={`${ADMIN_URLS.sylingSettings()}?theme=custom`}
          text="Edit web and rss styling"
        />
        <div className="text-xs text-muted-color mt-2">
          microfeed will support multiple themes / templates in the future.
        </div>
      </div>
    </SettingsBase>);
  }
}
