import React from 'react';
import {ADMIN_URLS, PUBLIC_URLS} from "../../../../../../common-src/StringUtils";
import {getPublicBaseUrl} from "../../../../../common/ClientUrlUtils";
import ExternalLink from "../../../../../components/ExternalLink";

const DISTRIBUTION_BUNDLE = [
  {
    label: 'rss',
    url: PUBLIC_URLS.rssFeed(getPublicBaseUrl()),
    summary: 'このRSSリンクをポッドキャストアプリ/ウェブサイトに送信する。',
    details: (<div className="grid grid-cols-1 gap-4 py-2">
      <div>
        このRSSフィードのスキーマは<a href="https://help.apple.com/itc/podcasts_connect/#/itcb54353390">Apple PodcastsのRSS</a>仕様に従っています。
      </div>
      <div>
        <a href={ADMIN_URLS.settings()}>設定/購読方法</a>でRSSフィードを無効にできます。
      </div>
    </div>),
  },
  {
    label: 'web',
    url: PUBLIC_URLS.webFeed(getPublicBaseUrl()),
    summary: 'このウェブリンクをソーシャルメディア/電子メールでオーディエンスに共有する。',
    details: (<div className="grid grid-cols-1 gap-4 py-2">
      <div>
        <a href={ADMIN_URLS.settings()}>設定/カスタムコード</a>でスタイルをカスタマイズし、カスタムコードを追加できます。
      </div>
      <div>
        <a href={ADMIN_URLS.settings()}>設定/アクセスコントロール</a>でウェブサイト全体を無効にすることができます。
      </div>
    </div>),
  },
  {
    label: 'json',
    url: PUBLIC_URLS.jsonFeed(getPublicBaseUrl()),
    summary: '構造化されたデータを取得し、自動化を設定するコードを記述する。',
    details: (<div className="grid grid-cols-1 gap-4 py-2">
      <div>
        この json フィードのスキーマは、<a href="https://www.jsonfeed.org/">
        jsonfeed.org</a> 仕様に従っています。マイクロフィードの JSON フィードの OpenAPI 仕様<a href="/json/openapi.yaml">
        （YAML</a> または <a href="/json/openapi.html">HTML）</a>を参照してください。
      </div>
      <div>
        jsonフィードは、<a href={ADMIN_URLS.settings()}>設定/サブスクライブメソッド</a>で無効にできます。
      </div>
    </div>),
  },
];

export default class DistributionApp extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
    };
  }

  render() {
    return (<div className="lh-page-card">
      <div className="lh-page-title">
        ディストリビューション
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
            <div className="select-all bg-gray-200 py-2 px-4 rounded">
              {bundle.url}
            </div>
            <div className="mt-2 text-helper-color text-sm">
              <details>
                <summary className="hover:cursor-pointer hover:opacity-50">{bundle.summary}</summary>
                <div className="mt-4 bg-gray-100 px-2 py-1 rounded">
                  {bundle.details}
                </div>
              </details>
            </div>
          </div>
        </div>))}
      </div>
    </div>);
  }
}
