import React from "react";
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'

export default function ExternalLink({url, text, linkClass, iconClass}) {
  return (
    <a href={url} target="_blank" rel="noopener noreferer" title={text} className={linkClass || ''}>
      <div className="flex items-center">
        <div className="">
          {text}
        </div>
        <div className="ml-1 flex-none">
          <ArrowTopRightOnSquareIcon className={iconClass || 'w-4'}/>
        </div>
      </div>
    </a>
  );
}
