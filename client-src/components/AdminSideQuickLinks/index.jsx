import React from 'react';
import ExternalLink from "../ExternalLink";
import {PUBLIC_URLS} from "../../../common-src/StringUtils";

export function SideQuickLink({url, text}) {
  return (<ExternalLink url={url} text={text} linkClass="text-sm" iconClass="w-3"/>);
}

export function AdminSideQuickLinks({AdditionalLink}) {
  return (<div className="lh-page-card mt-4 px-4">
    <div className="flex justify-between flex-wrap gap-2">
      {AdditionalLink}
      <SideQuickLink url={PUBLIC_URLS.feedWeb()} text="Feed Web" />
      <SideQuickLink url={PUBLIC_URLS.feedRss()} text="Feed RSS" />
      <SideQuickLink url={PUBLIC_URLS.feedJson()} text="Feed JSON" />
    </div>
  </div>);
}
