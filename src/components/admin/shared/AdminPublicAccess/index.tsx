import {useId} from "react";
import {BracesIcon, GlobeIcon, RssIcon} from "lucide-react";

import type {AdminPublicLinks} from "@/components/admin/admin-shell-types";
import {cn} from "@/lib/utils";
import {ADMIN_URLS} from "@/shared/StringUtils";
import AdminCopyableUrl from "../AdminCopyableUrl";

interface Props {
  className?: string;
  links: AdminPublicLinks;
}

export function publicAccessItems(links: AdminPublicLinks) {
  return [
    {
      icon: GlobeIcon,
      label: "web feed",
      url: links.website,
      summary: "Share this web link to your audience via social media / email.",
      details: (<div className="grid grid-cols-1 gap-4 py-2">
        <div>
          You can customize the styling and add shared website code in <a href={ADMIN_URLS.settings()}>Settings / Website appearance &amp; code</a>.
        </div>
        <div>
          You can disable the entire website in <a href={ADMIN_URLS.settings()}>Settings / Access control</a>.
        </div>
      </div>),
    },
    {
      icon: RssIcon,
      label: "rss feed",
      url: links.rss,
      summary: "Submit this rss link to podcast apps / websites.",
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
      icon: BracesIcon,
      label: "json feed",
      url: links.json,
      summary: "Write code to fetch structured data and set up automation.",
      details: (<div className="grid grid-cols-1 gap-4 py-2">
        <div>
          The schema of this json feed is following the <a href="https://www.jsonfeed.org/">
          jsonfeed.org</a> spec. See the generated schema and examples in <a href={ADMIN_URLS.apiExplorer()}>
          API Explorer</a>.
        </div>
        <div>
          You can disable the json feed in <a href={ADMIN_URLS.settings()}>Settings / Subscribe methods</a>.
        </div>
      </div>),
    },
  ];
}

export default function AdminPublicAccess({className, links}: Props) {
  const titleId = useId();
  const items = publicAccessItems(links);

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs",
        className,
      )}
    >
      <h2 className="mb-4 text-lg font-semibold tracking-tight" id={titleId}>
        Public access
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-8">
        {items.map(({details, icon: Icon, label, summary, url}) => (
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-12"
            key={label}
          >
            <div className="flex items-center gap-2 font-medium sm:col-span-2 sm:self-start sm:py-2">
              <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
              <span>{label}</span>
            </div>
            <div className="min-w-0 sm:col-span-10">
              <AdminCopyableUrl label={label} url={url} />
              <div className="mt-2 text-sm text-muted-foreground">
                <details>
                  <summary className="cursor-pointer hover:opacity-50">
                    {summary}
                  </summary>
                  <div className="mt-4 rounded-[10px] bg-muted/70 px-3 py-2">
                    {details}
                  </div>
                </details>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
