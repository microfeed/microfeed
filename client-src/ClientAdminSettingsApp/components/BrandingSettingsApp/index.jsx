import React from 'react';
import {PUBLIC_URLS, ADMIN_URLS} from "../../../../common-src/StringUtils";
import {getPublicBaseUrl} from '../../../common/ClientUrlUtils';

function NavBlock({url, text, publicUrl}) {
  return (<div>
    <a href={url}>
      <div>
        <div className="mb-2">{text} <span className="lh-icon-arrow-right"/></div>
        <div className="text-muted-color text-xs">{publicUrl}</div>
      </div>
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
          url={ADMIN_URLS.rssStylingSettings()}
          text="Feed RSS Styling"
          publicUrl={PUBLIC_URLS.feedRss(getPublicBaseUrl())}
        />
        <NavBlock
          url={ADMIN_URLS.feedWebStylingSettings()}
          text="Feed Web Styling"
          publicUrl={getPublicBaseUrl()}
        />
        <NavBlock
          url={ADMIN_URLS.episodeWebStylingSettings()}
          text="Episode Web Styling"
          publicUrl={PUBLIC_URLS.pageEpisode('123456789ab', 'an episode', getPublicBaseUrl())}
        />
      </div>
    </form>);
  }
}
