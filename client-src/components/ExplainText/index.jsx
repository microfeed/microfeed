import React, {useState} from "react";
import { ArrowRightCircleIcon, ArrowUpCircleIcon } from '@heroicons/react/24/outline'
import clsx from "clsx";
import AdminDialog from "../AdminDialog";
import ExternalLink from "../ExternalLink";
import {PUBLIC_URLS} from "../../../common-src/StringUtils";

export default function ExplainText({bundle}) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = isOpen ? ArrowUpCircleIcon : ArrowRightCircleIcon;
  return (
    <div className="mb-2">
      <a
        href="#"
        className={clsx('lh-page-subtitle')}
        onClick={(e) => {
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
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        title={bundle.modalTitle || bundle.linkName}
      >
        <div className="py-4">
          {bundle && <div className="grid grid-cols-1 gap-4 text-sm">
            <div>{bundle.text}</div>
            <div>
              <div><ExternalLink text='in rss' url={PUBLIC_URLS.rssFeed()} /></div>
              <code>{bundle.rss}</code>
            </div>
            <div>
              <div><ExternalLink text='in json' url={PUBLIC_URLS.jsonFeed()} /></div>
              <code>{bundle.json}</code>
            </div>
          </div>}
        </div>
      </AdminDialog>
    </div>
  );
}
