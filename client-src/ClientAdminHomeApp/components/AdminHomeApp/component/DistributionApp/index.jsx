import React from 'react';
import {ADMIN_URLS, PUBLIC_URLS} from "../../../../../../common-src/StringUtils";
import {getPublicBaseUrl} from "../../../../../common/ClientUrlUtils";
import ExternalLink from "../../../../../components/ExternalLink";
import {pickDocumentText} from "../../../../../common/LanguageUtils";

const DISTRIBUTION_BUNDLE = [
  {
    label: 'rss',
    url: PUBLIC_URLS.rssFeed(getPublicBaseUrl()),
  },
  {
    label: 'web',
    url: PUBLIC_URLS.webFeed(getPublicBaseUrl()),
  },
  {
    label: 'json',
    url: PUBLIC_URLS.jsonFeed(getPublicBaseUrl()),
  },
];

export default class DistributionApp extends React.Component {
  render() {
    return (<div className="lh-page-card">
      <div className="lh-page-title">
        {pickDocumentText('分发链接', 'Distribution')}
      </div>
      <div className="grid grid-cols-1 gap-8 mt-8">
        {DISTRIBUTION_BUNDLE.map((bundle) => (<div
          key={`b-${bundle.label}`}
          className="grid grid-cols-12 gap-4"
        >
          <div className="col-span-2">
            <ExternalLink url={bundle.url} text={bundle.label} />
          </div>
          <div className="col-span-10">
            <div className="select-all bg-gray-200 py-2 px-4 rounded-sm">
              {bundle.url}
            </div>
            <div className="mt-2 text-helper-color text-sm">
              <details>
                <summary className="hover:cursor-pointer hover:opacity-50">
                  {bundle.label === 'rss' && pickDocumentText('把这个 RSS 链接提交到播客应用或网站。', 'Submit this rss link to podcast apps / websites.')}
                  {bundle.label === 'web' && pickDocumentText('通过社交媒体或邮件把这个网页链接分享给受众。', 'Share this web link to your audience via social media / email.')}
                  {bundle.label === 'json' && pickDocumentText('用于获取结构化数据并接入自动化流程。', 'Write code to fetch structured data and set up automation.')}
                </summary>
                <div className="mt-4 bg-gray-100 px-2 py-1 rounded-sm">
                  {bundle.label === 'rss' && <div className="grid grid-cols-1 gap-4 py-2">
                    <div>{pickDocumentText('这个 RSS feed 的结构遵循 ', 'The schema of this rss feed follows the ')}<a href="https://help.apple.com/itc/podcasts_connect/#/itcb54353390">Apple Podcasts RSS spec</a>{pickDocumentText('。', '.')}</div>
                    <div>{pickDocumentText('你可以在 ', 'You can disable the rss feed in ')}<a href={ADMIN_URLS.settings()}>{pickDocumentText('设置 / 订阅方式', 'Settings / Subscribe methods')}</a>{pickDocumentText(' 中关闭 RSS feed。', '.')}</div>
                  </div>}
                  {bundle.label === 'web' && <div className="grid grid-cols-1 gap-4 py-2">
                    <div>{pickDocumentText('你可以在 ', 'You can customize the styling and add custom code in ')}<a href={ADMIN_URLS.settings()}>{pickDocumentText('设置 / 自定义代码', 'Settings / Custom code')}</a>{pickDocumentText(' 中调整样式并加入自定义代码。', '.')}</div>
                    <div>{pickDocumentText('你也可以在 ', 'You can disable the entire website in ')}<a href={ADMIN_URLS.settings()}>{pickDocumentText('设置 / 访问控制', 'Settings / Access control')}</a>{pickDocumentText(' 中关闭整个网站。', '.')}</div>
                  </div>}
                  {bundle.label === 'json' && <div className="grid grid-cols-1 gap-4 py-2">
                    <div>{pickDocumentText('这个 JSON feed 的结构遵循 ', 'The schema of this json feed follows the ')}<a href="https://www.jsonfeed.org/">jsonfeed.org</a>{pickDocumentText(' 规范。你也可以查看 microfeed JSON feed 的 OpenAPI 说明：', ' spec. See the OpenAPI spec of microfeed JSON feed: ')}<a href="/json/openapi.yaml">YAML</a> {pickDocumentText('或', 'or')} <a href="/json/openapi.html">HTML</a>{pickDocumentText('。', '.')}</div>
                    <div>{pickDocumentText('你可以在 ', 'You can disable the json feed in ')}<a href={ADMIN_URLS.settings()}>{pickDocumentText('设置 / 订阅方式', 'Settings / Subscribe methods')}</a>{pickDocumentText(' 中关闭 JSON feed。', '.')}</div>
                  </div>}
                </div>
              </details>
            </div>
          </div>
        </div>))}
      </div>
    </div>);
  }
}
