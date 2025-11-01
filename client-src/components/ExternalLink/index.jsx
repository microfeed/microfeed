import React from "react";
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import clsx from "clsx";

export default function ExternalLink({url, text, linkClass, iconClass}) {
  return (
    <a href={url} target="_blank" rel="noopener noreferer" title={text}>
      <div className={clsx('flex', linkClass || '')}>
        <div className="inline break-all">
          {text}
        </div>
        <div className="ml-1 inline items-center flex">
          <ArrowTopRightOnSquareIcon className={clsx(iconClass || 'w-4', 'inline')}/>
        </div>
      </div>
    </a>
  );
}
