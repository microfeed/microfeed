import React from 'react';
import {ADMIN_URLS, PUBLIC_URLS} from "../../../../../../common-src/StringUtils";
import {getPublicBaseUrl} from "../../../../../common/ClientUrlUtils";
import ExternalLink from "../../../../../components/ExternalLink";

const DISTRIBUTION_BUNDLE = [
  {
    label: 'rss',
    url: PUBLIC_URLS.rssFeed(getPublicBaseUrl()),
    summary: 'Submit this rss link to podcast apps / websites.',
    details: (<div className="grid grid-cols-1 gap-4 py-2">
      <div>
        The schema of this rss feed is following the <a href="https://help.apple.com/itc/podcasts_connect/#/itcb54353390">Apple Podcasts rss spec</a>.
      </div>
      <div>
        You can disable the rss feed in <a href={ADMIN_URLS.settings()}>Settings / Subscribe Methods</a>.
      </div>
    </div>),
  },
  {
    label: 'web',
    url: PUBLIC_URLS.webFeed(getPublicBaseUrl()),
    summary: 'Share this web link to your audience via social media / email.',
    details: (<div className="grid grid-cols-1 gap-4 py-2">
      <div>
        You can customize the styling and add some custom code in <a href={ADMIN_URLS.settings()}>Settings / Custom code</a>.
      </div>
      <div>
        You can disable the entire website in <a href={ADMIN_URLS.settings()}>Settings / Access control</a>.
      </div>
    </div>),
  },
  {
    label: 'json',
    url: PUBLIC_URLS.jsonFeed(getPublicBaseUrl()),
    summary: 'Write code to fetch structured data and set up automation.',
    details: (<div className="grid grid-cols-1 gap-4 py-2">
      <div>
        The schema of this json feed is following the <a href="https://www.jsonfeed.org/">
        jsonfeed.org</a> spec. See the OpenAPI spec of microfeed's JSON feed: <a href="/json/openapi.yaml">
        YAML</a> or <a href="/json/openapi.html">HTML</a>.
      </div>
      <div>
        You can disable the json feed in <a href={ADMIN_URLS.settings()}>Settings / Subscribe methods</a>.
      </div>
    </div>),
  },
];

export default class DistributionApp extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
    };
  }

  render() {
    return (<div className="lh-page-card">
      <div className="lh-page-title">
        Distribution
      </div>
      <div className="grid grid-cols-1 gap-8 mt-8">
        {DISTRIBUTION_BUNDLE.map((bundle) => (<div
          key={`b-${bundle.label}`}
          className="grid grid-cols-12 gap-4"
        >
          <div className="col-span-2">
            <ExternalLink url={bundle.url} text={bundle.label} />
          </div>
          <div className="col-span-10">
            <div className="select-all bg-gray-200 py-2 px-4 rounded-sm">
              {bundle.url}
            </div>
            <div className="mt-2 text-helper-color text-sm">
              <details>
                <summary className="hover:cursor-pointer hover:opacity-50">{bundle.summary}</summary>
                <div className="mt-4 bg-gray-100 px-2 py-1 rounded-sm">
                  {bundle.details}
                </div>
              </details>
            </div>
          </div>
        </div>))}
      </div>
    </div>);
  }
}
