import {useState} from "react";
import {CircleArrowRightIcon, CircleArrowUpIcon} from "lucide-react";
import clsx from "clsx";
import AdminDialog from "../AdminDialog";
import ExternalLink from "../ExternalLink";
import {ADMIN_URLS, PUBLIC_URLS} from "@/shared/StringUtils";

export default function ExplainText({bundle, customClass}: any) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = isOpen ? CircleArrowUpIcon : CircleArrowRightIcon;
  return (
    <div className="flex">
      <a
        href="#"
        className={clsx(customClass || 'mb-2 font-semibold text-foreground')}
        onClick={(e: any) => {
          e.preventDefault();
          setIsOpen(true);
        }}
      >
        <div className="flex items-center">
          <div>{bundle.linkName}</div>
          <div className="ml-2"><Icon className="w-4" /></div>
        </div>
      </a>
      <AdminDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={bundle.modalTitle || bundle.linkName}
      >
        <div className="py-2">
          {bundle && <div className="text-helper-color grid grid-cols-1 gap-4 text-sm">
            <div className="leading-relaxed" dangerouslySetInnerHTML={{__html: bundle.text}} />
            {bundle.rss ? <div>
              <div><ExternalLink text='in rss' url={PUBLIC_URLS.rssFeed()} /></div>
              <code className="m-code">{bundle.rss}</code>
              <div className="text-xs mt-2 text-muted-color">
                Learn more about Podcasts RSS at <a className="text-helper-color" href="https://help.apple.com/itc/podcasts_connect/#/itcb54353390" target="_blank" rel="noopener noreferrer">apple.com</a>.
              </div>
            </div> : <em>{bundle.linkName} is not in rss feed</em>}
            {bundle.json ? <div>
              <div><ExternalLink text='in json' url={PUBLIC_URLS.jsonFeed()} /></div>
              <code className="m-code">{bundle.json}</code>
              <div className="text-xs mt-2 text-muted-color">
                Learn more about JSON Feed at <a className="text-helper-color" href="https://www.jsonfeed.org/" target="_blank" rel="noopener noreferrer">
                jsonfeed.org</a>. See the generated schema and examples in <a className="text-helper-color" href={ADMIN_URLS.apiExplorer()}>
                API Explorer</a>.
              </div>
            </div> : <em>{bundle.linkName} is not in json feed</em>}
          </div>}
        </div>
      </AdminDialog>
    </div>
  );
}
