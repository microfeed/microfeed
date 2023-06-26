import React, {useState} from 'react';
import {ONBOARDING_TYPES, OUR_BRAND, SETTINGS_CATEGORIES} from "../../../../../../common-src/Constants";
import {CheckCircleIcon, ArrowRightCircleIcon} from "@heroicons/react/20/solid";
import AdminInput from "../../../../../components/AdminInput";
import Requests from "../../../../../common/requests";
import {ADMIN_URLS, isValidUrl} from "../../../../../../common-src/StringUtils";
import {showToast} from "../../../../../common/ToastUtils";

const SUBMIT_STATUS__START = 1;

function CheckListItem({title, onboardState, children}) {
  return (<div className="flex">
    <div className="mr-4">
      {onboardState.ready ? <CheckCircleIcon className="w-6 text-green-500" /> :
        <ArrowRightCircleIcon className="w-6 text-muted-color" />}
    </div>
    <details className="w-full" open={!onboardState.ready}>
      <summary className="cursor-pointer mb-4 font-semibold hover:opacity-50">
        {title} {onboardState.required && <span className="text-red-500">*</span>}
      </summary>
      <div className="mb-8">
        {children}
      </div>
    </details>
  </div>);
}

function SetupPublicBucketUrl({onboardState, webGlobalSettings, cloudflareUrls}) {
  const publicBucketUrl = webGlobalSettings.publicBucketUrl || '';
  const [url, setUrl] = useState(publicBucketUrl);
  const [submitStatus, setSubmitStatus] = useState(null);
  const submitting = submitStatus === SUBMIT_STATUS__START;
  return (<CheckListItem onboardState={onboardState} title="R2のpublic bucketのURLをセットアップする。">
    <div className="flex">
      <div className="mr-4 flex-1">
        <AdminInput
          type="url"
          placeholder="e.g., https://cdn.example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="flex-none">
        <button
          type="button"
          disabled={submitting}
          className="lh-btn lh-btn-brand-dark"
          onClick={(e) => {
            e.preventDefault();
            if (!isValidUrl(url)) {
              showToast('Invalid url. A valid url should start with http:// or https://, ' +
                'for example, https://media-cdn.microfeed.org',
                'error', 5000);
              return;
            }
            setSubmitStatus(SUBMIT_STATUS__START);
            Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {
              settings: {
                [SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS]: {
                  ...webGlobalSettings,
                  publicBucketUrl: url,
                },
              }
            }).then(() => {
              showToast('Updated!', 'success');
              setTimeout(() => {
                location.href = '';
              }, 1500);
            }).catch((error) => {
              setSubmitStatus(null);
              if (!error.response) {
                showToast('Network error. Please refresh the page and try again.', 'error');
              } else {
                showToast('Failed. Please try again.', 'error');
              }
            });
          }}
        >
          {submitting ? 'Updating...' : 'Update'}
        </button>
      </div>
    </div>
    <div className="mt-4 rounded bg-gray-100 p-2 text-sm grid grid-cols-1 gap-2">
      <details>
        <summary className="cursor-pointer font-semibold hover:opacity-50">
          R2のpublic bucketのURLはどこにありますか?
        </summary>
        <div className="my-8 text-helper-color">
          <div>
            <a href={cloudflareUrls.r2BucketSettingsUrl} target="_blank" rel="noopener noreferrer">
              Cloudflare Dashboard / R2 Bucket Settings に移動する。<span className="lh-icon-arrow-right"/></a>
          </div>
          <div className="mt-4">
            <div>
              <span className="text-brand-light font-bold">[Recommended]</span> カスタムドメインを追加します（例:media-cdn.microfeed.org）。次に、このカスタムドメインをここにコピーします（例:https://media-cdn.microfeed.org）。
            </div>
            <div className="mt-2">
              <img src="/assets/howto/get-r2-public-bucket-url-howto2.png" className="w-full" />
            </div>
          </div>
          <div className="mt-4">
            <div>
              <span className="text-brand-light">[Ok, but not recommended]</span> カスタムドメインを持っていない場合は、Cloudflareのr2.devドメインも使用できます。"Allow Access "をクリックします。そして、ここに「Public Bucket URL」をコピーします（例:https://pub-xxxx.r2.dev）。
            </div>
            <div className="mt-2">
              <img src="/assets/howto/get-r2-public-bucket-url-howto1.png" className="w-full" />
            </div>
          </div>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold hover:opacity-50">
          R2のpublic bucketのURLは何に使用されますか?
        </summary>
        <div className="my-8 text-helper-color">
          <div>
            あなたはCloudflare R2にメディアファイル（例:オーディオ、ビデオ、画像、ドキュメント...）を保存することになります。これらのメディアファイルを公開するためには、R2 public bucket URLを提供する必要があります。
          </div>
          <div className="mt-2">
            R2 public bucket URLを https://cdn.example.com とすると、メディアファイル（オーディオなど）は https://cdn.example.com/some-audio.mp3 のようなリンクでアクセスすることになります。
          </div>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold hover:opacity-50">
        このURLが有効かどうかをどうやって確かめますか？
        </summary>
        <div className="my-8 text-helper-color">
          <div>
            このR2 public bucketのurlを開くと、以下のような404ページが表示されます。 (例: <a href={OUR_BRAND.exampleCdnUrl} target="_blank">https://media-cdn.microfeed.org</a>):
          </div>
          <div className="mt-2">
            <img src="/assets/howto/get-r2-public-bucket-url-howto3.png" className="w-full" />
          </div>
        </div>
      </details>
    </div>
  </CheckListItem>);
}

function ProtectedAdminDashboard({onboardState, cloudflareUrls}) {
  return (<CheckListItem onboardState={onboardState} title="管理者用のダッシュボードにログインする。">
    <div className="mt-4 rounded bg-gray-100 p-2 text-sm grid grid-cols-1 gap-2 text-helper-color">
      <div className="mb-2">
        <a href="https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/" target="_blank">
        Cloudflare Zero Trust</a> を使用してログインし、許可されたユーザーだけがこの管理ダッシュボードにアクセスできます。
      </div>
      <details>
        <summary className="cursor-pointer hover:opacity-50 text-black font-semibold">
          ステップ1:アクセスグループを追加する。
        </summary>
        <div className="mt-4">
          <a href={cloudflareUrls.addAccessGroupUrl} target="_blank">Cloudflare Dashboard / アクセスグループの追加にアクセスする。<span className="lh-icon-arrow-right"/></a>
        </div>
        <div className="my-4">
          Cloudflare Zero Trustを初めてご利用になる場合は、まず無料プランのご契約が必要な場合があります。
        </div>
        <div className="mt-4">
          管理ダッシュボードにアクセスするために許可されたメールアドレスを指定する必要があります。
        </div>
        <div className="mt-2">
          <img src="/assets/howto/add-access-group.png" className="w-full border"/>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer hover:opacity-50 text-black font-semibold">
          ステップ2:<b>{cloudflareUrls.pagesDevUrl}/admin</b>を保護するためのセルフホストアプリを作成する。
        </summary>
        <div className="mt-4">
          <a href={cloudflareUrls.addAppUrl} target="_blank">
          Cloudflare Dashboardに移動する / セルフホストアプリを作成する<span className="lh-icon-arrow-right"/>
        </a>
        </div>
        <div className="mt-4">
          ここで Self-hosted を選択する。
        </div>
        <div className="mt-2">
          <img src="/assets/howto/select-self-hosted-app.png" className="w-full border"/>
        </div>
        <div className="mt-4">
          <b>{cloudflareUrls.pagesDevUrl}/admin</b> の情報を記入する。
        </div>
        <div className="mt-2 text-red-500">
          {'注意: 番号のついた矢印を順番にたどってください。そうしないと、"Path "が編集できない場合があります。' +
          'もし"the zone does not exist"というメッセージが表示されたら、それを無視して次に進んでください。' +
          '私達はCloudflareがUIを改善し、より分かりやすくなることを期待しています。 :)'
          }
        </div>
        <div className="mt-2">
          <img src="/assets/howto/add-app1.png" className="w-full border"/>
        </div>
        <div className="mt-4">
          ポリシー名を追加し、アプリを追加するまでずっと「次へ」をクリックします
        </div>
        <div className="my-4">
          <img src="/assets/howto/add-app2.png" className="w-full border"/>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer hover:opacity-50 text-black font-semibold">
          ステップ:動くかどうかを確認する。
        </summary>
        <div className="mt-4">
          現在のページを更新すると、あなたのEメールでログインできるようになります。
        </div>
        <div className="my-4">
          <img src="/assets/howto/app-access-login.png" className="w-full border"/>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer hover:opacity-50 text-black font-semibold">
          おまけ:<b>*.{cloudflareUrls.pagesDevUrl}</b>のセルフホストアプリを作成する。
        </summary>
        <div className="mt-4">
          <b>*.{cloudflareUrls.pagesDevUrl}</b>のために2番目のセルフホストアプリを作成すると、すべての
        <a href="https://developers.cloudflare.com/pages/platform/preview-deployments/" target="_blank">preview
        deployments</a>を保護することができます。
        </div>
        <div className="mt-4">
          <a href={cloudflareUrls.addAppUrl} target="_blank">
          Cloudflare Dashboardに移動する / セルフホストアプリを作成する<span className="lh-icon-arrow-right"/>
        </a>
        </div>
        <div className="my-4">
          サブドメインにアスタリスク（*）を付ける：
        </div>
        <div className="my-4">
          <img src="/assets/howto/protect-preview.png" className="w-full border"/>
        </div>
      </details>
    </div>
  </CheckListItem>);
}

function CustomDomain({onboardState, cloudflareUrls}) {
  return (<CheckListItem onboardState={onboardState} title="カスタムドメインを使用する。">
    <div className="mt-4 rounded bg-gray-100 p-2 text-sm grid grid-cols-1 gap-2 text-helper-color">
      <div className="mb-2">
        カスタムドメインを使用すると、ボット管理、アクセス、キャッシュなどのCloudflareの機能を利用することができます。
      </div>
      <details>
        <summary className="cursor-pointer hover:opacity-50 text-black font-semibold">
          ステップ1:このサイトのカスタムドメインをセットアップする。
        </summary>
        <div className="mt-4">
          <a href={cloudflareUrls.pagesCustomDomainUrl} target="_blank">Cloudflare Dashboard / Pages Settingsに移動する。<span
          className="lh-icon-arrow-right"/></a>
        </div>
        <div className="my-4">
          <img src="/assets/howto/pages-custom-domain.png" className="w-full border"/>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer hover:opacity-50 text-black font-semibold">
          ステップ2:管理者用ダッシュボードを保護するためのセルフホストアプリを作成する。
        </summary>
        <div className="mt-4">
          新しく追加したカスタムドメインからこの管理ダッシュボードにアクセスしたい場合、
          管理URLのセルフホストアプリを作成する必要があります。{cloudflareUrls.pagesDevUrl}, 
          を使う代わりに、今回は新しいカスタムドメインを使用します。
        </div>
        <div className="mt-4">
          <a href={cloudflareUrls.addAppUrl} target="_blank">
            Cloudflare Dashboard / Add an application にアクセスする。<span className="lh-icon-arrow-right"/>
          </a>
        </div>
        <div className="my-4">
          <img src="/assets/howto/add-app3.png" className="w-full border"/>
        </div>
      </details>
    </div>
  </CheckListItem>);
}

export default class SetupChecklistApp extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
    };
  }

  render() {
    const {feed, onboardingResult} = this.props;
    const {settings} = feed;
    const webGlobalSettings = settings[SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS] || {};

    return (<div className="lh-page-card">
      <div className="lh-page-title">
        セットアップチェックリスト
      </div>
      {onboardingResult.allOk && <div className="text-helper-color border border-green-700 bg-green-100 text-green-700 rounded p-2">
        <i>セットが完了しました!</i>
        <div className="mt-2">
          新しいアイテムを追加して <a href={ADMIN_URLS.newItem()}>発行を開始する <span className="lh-icon-arrow-right" /></a>
        </div>
      </div>}
      <div className="mt-8">
        <SetupPublicBucketUrl
          onboardState={onboardingResult.result[ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL]}
          webGlobalSettings={webGlobalSettings}
          cloudflareUrls={onboardingResult.cloudflareUrls}
        />
        <ProtectedAdminDashboard
          onboardState={onboardingResult.result[ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD]}
          cloudflareUrls={onboardingResult.cloudflareUrls}
        />
        <CustomDomain
          onboardState={onboardingResult.result[ONBOARDING_TYPES.CUSTOM_DOMAIN]}
          cloudflareUrls={onboardingResult.cloudflareUrls}
        />
      </div>
      <div className="text-right mt-4 text-sm text-helper-color">
        <span className="text-red-500">*</span> 必須
      </div>
    </div>);
  }
}
