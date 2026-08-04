import {ExternalLinkIcon} from "lucide-react";
import clsx from "clsx";

export default function ExternalLink({url, text, linkClass, iconClass}: any) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={text}>
      <div className={clsx('flex items-center', linkClass || '')}>
        <div className="inline break-all">
          {text}
        </div>
        <div className="ml-1 inline items-center flex">
          <ExternalLinkIcon className={clsx(iconClass || 'w-4', 'inline')}/>
        </div>
      </div>
    </a>
  );
}
