import React from 'react';
import {ADMIN_URLS} from "../../../../common-src/StringUtils";

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
    }
  }

  render() {
    return (<form className="lh-page-card">
      <h2 className="lh-page-title">
        Styling
      </h2>
      <div className="grid grid-cols-1 gap-4">
        <NavBlock
          url={ADMIN_URLS.sylingSettings()}
          text="Edit RSS and Web Styling"
        />
      </div>
    </form>);
  }
}
