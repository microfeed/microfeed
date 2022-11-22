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
      title="Styles"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
    >
        <NavBlock
          url={ADMIN_URLS.sylingSettings()}
          text="Edit Web and RSS Styling"
        />
    </SettingsBase>);
  }
}
