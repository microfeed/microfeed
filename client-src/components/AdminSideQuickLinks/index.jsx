import React from 'react';
import ExternalLink from "../ExternalLink";
import {PUBLIC_URLS} from "../../../common-src/StringUtils";

export function SideQuickLink({url, text}) {
  return (<ExternalLink url={url} text={text} linkClass="text-sm" iconClass="w-3"/>);
}

export function AdminSideQuickLinks({AdditionalLink}) {
  return (<div className="lh-page-card mt-4 px-4">
    <div className="lh-page-subtitle">Public pages</div>
    <div className="flex justify-between flex-wrap gap-2">
      {AdditionalLink}
      <SideQuickLink url={PUBLIC_URLS.webFeed()} text="web feed" />
      <SideQuickLink url={PUBLIC_URLS.rssFeed()} text="rss feed" />
      <SideQuickLink url={PUBLIC_URLS.jsonFeed()} text="json feed" />
    </div>
  </div>);
}
