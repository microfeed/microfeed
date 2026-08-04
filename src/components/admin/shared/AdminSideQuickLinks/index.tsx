import ExternalLink from "../ExternalLink";
import {PUBLIC_URLS} from "@/shared/StringUtils";

export function SideQuickLink({url, text}: any) {
  return (<div className="mr-4">
    <ExternalLink url={url} text={text} linkClass="text-sm" iconClass="w-3"/>
  </div>);
}

export function AdminSideQuickLinks({AdditionalLinksDiv}: any) {
  return (<div className="mt-4 rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
    <div className="mb-2 text-sm font-semibold text-foreground">Public access</div>
    <div className="grid grid-cols-1 gap-2">
      {AdditionalLinksDiv}
      <div className="flex flex-wrap gap-y-2">
        <SideQuickLink url={PUBLIC_URLS.webFeed()} text="web feed"/>
        <SideQuickLink url={PUBLIC_URLS.jsonFeed()} text="json feed"/>
        <SideQuickLink url={PUBLIC_URLS.rssFeed()} text="rss feed"/>
      </div>
    </div>
  </div>);
}
