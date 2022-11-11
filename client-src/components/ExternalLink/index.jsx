import React from "react";
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import clsx from "clsx";

export default function ExternalLink({url, text, linkClass, iconClass}) {
  return (
    <a href={url} target="_blank" rel="noopener noreferer" title={text} className={linkClass || ''}>
      <div className="">
        <div className="inline break-all">
          {text}
        </div>
        <div className="ml-1 inline">
          <ArrowTopRightOnSquareIcon className={clsx(iconClass || 'w-4', 'inline')}/>
        </div>
      </div>
    </a>
  );
}
