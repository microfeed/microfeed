import React, {useState} from "react";
import { ArrowRightCircleIcon, ArrowUpCircleIcon } from '@heroicons/react/24/outline';
import clsx from "clsx";
import AdminDialog from "../AdminDialog";
import ExternalLink from "../ExternalLink";
import {PUBLIC_URLS} from "../../../common-src/StringUtils";
import {getDocumentLanguage} from "../../common/LanguageUtils";
import {isChineseLanguage} from "../../../common-src/I18n";

export default function ExplainText({bundle, customClass}) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = isOpen ? ArrowUpCircleIcon : ArrowRightCircleIcon;
  const isZh = isChineseLanguage(getDocumentLanguage());
  const linkName = isZh ? (bundle.linkNameZh || bundle.linkName) : bundle.linkName;
  const modalTitle = isZh ? (bundle.modalTitleZh || bundle.modalTitle || bundle.linkName) : (bundle.modalTitle || bundle.linkName);
  const text = isZh ? (bundle.textZh || bundle.text) : bundle.text;

  return (
    <div className="flex">
      <a
        href="#"
        className={clsx(customClass || 'lh-page-subtitle')}
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(true);
        }}
      >
        <div className="flex items-center">
          <div>{linkName}</div>
          <div className="ml-2"><Icon className="w-4" /></div>
        </div>
      </a>
      <AdminDialog
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        title={modalTitle}
      >
        <div className="py-2">
          {bundle && <div className="text-helper-color grid grid-cols-1 gap-4 text-sm">
            <div className="leading-relaxed" dangerouslySetInnerHTML={{__html: text}} />
            {bundle.rss ? <div>
              <div><ExternalLink text={isZh ? '在 RSS 中查看' : 'in rss'} url={PUBLIC_URLS.rssFeed()} /></div>
              <code className="m-code">{bundle.rss}</code>
              <div className="text-xs mt-2 text-muted-color">
                {isZh ? (
                  <>更多 Podcasts RSS 说明见 <a className="text-helper-color" href="https://help.apple.com/itc/podcasts_connect/#/itcb54353390" target="_blank" rel="noopener noreferrer">apple.com</a>。</>
                ) : (
                  <>Learn more about Podcasts RSS at <a className="text-helper-color" href="https://help.apple.com/itc/podcasts_connect/#/itcb54353390" target="_blank" rel="noopener noreferrer">apple.com</a>.</>
                )}
              </div>
            </div> : <em>{isZh ? `${linkName} 不会出现在 RSS feed 中` : `${linkName} is not in rss feed`}</em>}
            {bundle.json ? <div>
              <div><ExternalLink text={isZh ? '在 JSON 中查看' : 'in json'} url={PUBLIC_URLS.jsonFeed()} /></div>
              <code className="m-code">{bundle.json}</code>
              <div className="text-xs mt-2 text-muted-color">
                {isZh ? (
                  <>更多 JSON Feed 说明见 <a className="text-helper-color" href="https://www.jsonfeed.org/" target="_blank" rel="noopener noreferrer">jsonfeed.org</a>。microfeed 的 JSON feed OpenAPI 说明见 <a className="text-helper-color" href="/json/openapi.yaml" target="_blank" rel="noopener noreferrer">YAML</a> 或 <a className="text-helper-color" href="/json/openapi.html" target="_blank" rel="noopener noreferrer">HTML</a>。</>
                ) : (
                  <>Learn more about JSON Feed at <a className="text-helper-color" href="https://www.jsonfeed.org/" target="_blank" rel="noopener noreferrer">jsonfeed.org</a>. See the OpenAPI spec of microfeed's JSON feed: <a className="text-helper-color" href="/json/openapi.yaml" target="_blank" rel="noopener noreferrer">YAML</a> or <a className="text-helper-color" href="/json/openapi.html" target="_blank" rel="noopener noreferrer">HTML</a>.</>
                )}
              </div>
            </div> : <em>{isZh ? `${linkName} 不会出现在 JSON feed 中` : `${linkName} is not in json feed`}</em>}
          </div>}
        </div>
      </AdminDialog>
    </div>
  );
}
