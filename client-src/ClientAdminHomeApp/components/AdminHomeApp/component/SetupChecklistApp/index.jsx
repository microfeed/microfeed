import React, {useState} from 'react';
import {ONBOARDING_TYPES, OUR_BRAND, SETTINGS_CATEGORIES} from "../../../../../../common-src/Constants";
import {CheckCircleIcon, ArrowRightCircleIcon} from "@heroicons/react/20/solid";
import AdminInput from "../../../../../components/AdminInput";
import Requests from "../../../../../common/requests";
import {ADMIN_URLS, isValidUrl} from "../../../../../../common-src/StringUtils";
import {showToast} from "../../../../../common/ToastUtils";
import {pickDocumentText} from "../../../../../common/LanguageUtils";

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

  return (<CheckListItem onboardState={onboardState} title={pickDocumentText('配置 R2 公共存储桶 URL', 'Set up R2 public bucket URL')}>
    <div className="flex">
      <div className="mr-4 flex-1">
        <AdminInput
          type="url"
          placeholder={pickDocumentText('例如：https://cdn.example.com', 'For example: https://cdn.example.com')}
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
              showToast(
                pickDocumentText(
                  'URL 无效。请填写以 http:// 或 https:// 开头的完整地址，例如：https://media-cdn.microfeed.org',
                  'Invalid URL. Please enter a full URL that starts with http:// or https://, for example: https://media-cdn.microfeed.org',
                ),
                'error',
                5000,
              );
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
              showToast(pickDocumentText('更新成功！', 'Updated!'), 'success');
              setTimeout(() => {
                location.href = '';
              }, 1500);
            }).catch((error) => {
              setSubmitStatus(null);
              if (!error.response) {
                showToast(pickDocumentText('网络错误，请刷新页面后重试。', 'Network error. Please refresh the page and try again.'), 'error');
              } else {
                showToast(pickDocumentText('更新失败，请重试。', 'Failed. Please try again.'), 'error');
              }
            });
          }}
        >
          {submitting ? pickDocumentText('更新中...', 'Updating...') : pickDocumentText('更新', 'Update')}
        </button>
      </div>
    </div>
    <div className="mt-4 rounded-sm bg-gray-100 p-2 text-sm grid grid-cols-1 gap-2 text-helper-color">
      <details>
        <summary className="cursor-pointer font-semibold hover:opacity-50 text-black">
          {pickDocumentText('去哪里找到 R2 公共存储桶 URL？', 'Where can I find the R2 public bucket URL?')}
        </summary>
        <div className="my-4">
          {pickDocumentText('前往 ', 'Go to ')}<a href={cloudflareUrls.r2BucketSettingsUrl} target="_blank" rel="noopener noreferrer">
            {pickDocumentText('Cloudflare 控制台 / R2 Bucket Settings', 'Cloudflare Dashboard / R2 Bucket Settings')} <span className="lh-icon-arrow-right" /></a>
        </div>
        <div>
          {pickDocumentText('推荐先绑定一个自定义域名，再把完整地址填到这里。也可以临时使用 Cloudflare 提供的 r2.dev 公共地址。', 'We recommend using a custom domain for the bucket and pasting the full URL here. You can also temporarily use the public r2.dev URL provided by Cloudflare.')}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold hover:opacity-50 text-black">
          {pickDocumentText('这个 URL 有什么用途？', 'What is this URL used for?')}
        </summary>
        <div className="my-4">
          {pickDocumentText('你的音频、视频、图片和文档等媒体文件会存放在 Cloudflare R2 中。这个公共 URL 会作为这些文件的访问前缀。', 'Your audio, video, image, and document files will be stored in Cloudflare R2. This public URL becomes the access prefix for those files.')}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold hover:opacity-50 text-black">
          {pickDocumentText('怎么确认这个 URL 是有效的？', 'How can I verify this URL?')}
        </summary>
        <div className="my-4">
          {pickDocumentText('直接打开这个地址时，通常会看到一个类似 404 的页面，这通常是正常的。只要后续具体文件地址可以打开即可。示例：', 'When you open the bucket root directly, you will usually see a 404-like page. That is normally fine as long as actual file URLs work. Example: ')}
          <a href={OUR_BRAND.exampleCdnUrl} target="_blank" rel="noopener noreferrer">{OUR_BRAND.exampleCdnUrl}</a>
        </div>
      </details>
    </div>
  </CheckListItem>);
}

function ProtectedAdminDashboard({onboardState, cloudflareUrls}) {
  return (<CheckListItem onboardState={onboardState} title={pickDocumentText('给管理后台添加登录保护', 'Protect the admin dashboard')}>
    <div className="mt-4 rounded-sm bg-gray-100 p-2 text-sm grid grid-cols-1 gap-2 text-helper-color">
      <div>
        {pickDocumentText('推荐使用 ', 'We recommend using ')}<a href="https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-apps/" target="_blank" rel="noopener noreferrer">Cloudflare Zero Trust</a>{pickDocumentText(' 为后台加登录保护。', ' to add sign-in protection to the admin dashboard.')}
      </div>
      <div>
        {pickDocumentText('步骤 1：创建一个 Access Group，定义哪些邮箱可以登录。', 'Step 1: Create an Access Group that defines which email addresses can log in.')}
      </div>
      <div>
        <a href={cloudflareUrls.addAccessGroupUrl} target="_blank" rel="noopener noreferrer">
          {pickDocumentText('打开 Cloudflare 控制台 / Add an access group', 'Open Cloudflare Dashboard / Add an access group')} <span className="lh-icon-arrow-right"/>
        </a>
      </div>
      <div>
        {pickDocumentText(`步骤 2：创建一个 self-hosted app，保护 ${cloudflareUrls.pagesDevUrl}/admin。`, `Step 2: Create a self-hosted app that protects ${cloudflareUrls.pagesDevUrl}/admin.`)}
      </div>
      <div>
        <a href={cloudflareUrls.addAppUrl} target="_blank" rel="noopener noreferrer">
          {pickDocumentText('打开 Cloudflare 控制台 / Create a self-hosted app', 'Open Cloudflare Dashboard / Create a self-hosted app')} <span className="lh-icon-arrow-right"/>
        </a>
      </div>
      <div>
        {pickDocumentText('步骤 3：刷新当前后台页面，确认登录拦截已经生效。', 'Step 3: Refresh this admin page and confirm the login protection is active.')}
      </div>
    </div>
  </CheckListItem>);
}

function CustomDomain({onboardState, cloudflareUrls}) {
  return (<CheckListItem onboardState={onboardState} title={pickDocumentText('使用自定义域名', 'Use a custom domain')}>
    <div className="mt-4 rounded-sm bg-gray-100 p-2 text-sm grid grid-cols-1 gap-2 text-helper-color">
      <div>
        {pickDocumentText('接入自定义域名后，你会更方便地使用 Cloudflare 的缓存、机器人管理和访问控制能力。', 'A custom domain makes it easier to use Cloudflare caching, bot management, and access control.')}
      </div>
      <div>
        <a href={cloudflareUrls.pagesCustomDomainUrl} target="_blank" rel="noopener noreferrer">
          {pickDocumentText('打开 Cloudflare 控制台 / Pages Settings', 'Open Cloudflare Dashboard / Pages Settings')} <span className="lh-icon-arrow-right"/>
        </a>
      </div>
      <div>
        {pickDocumentText('如果你还希望从自定义域名访问后台，记得为新的后台域名再创建一次 self-hosted app。', 'If you also want to access the admin dashboard from the custom domain, create another self-hosted app for the new admin URL.')}
      </div>
    </div>
  </CheckListItem>);
}

export default class SetupChecklistApp extends React.Component {
  render() {
    const {feed, onboardingResult} = this.props;
    const {settings} = feed;
    const webGlobalSettings = settings[SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS] || {};

    return (<div className="lh-page-card">
      <div className="lh-page-title">
        {pickDocumentText('初始化清单', 'Setup checklist')}
      </div>
      {onboardingResult.allOk && <div className="text-helper-color border border-green-700 bg-green-100 text-green-700 rounded-sm p-2">
        <i>{pickDocumentText('全部配置完成！', 'Everything is ready!')}</i>
        <div className="mt-2">
          {pickDocumentText('现在可以开始发布内容：', 'You can start publishing content now: ')}
          <a href={ADMIN_URLS.newItem()}>{pickDocumentText('新建内容', 'New item')} <span className="lh-icon-arrow-right" /></a>
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
        <span className="text-red-500">*</span> {pickDocumentText('必填', 'Required')}
      </div>
    </div>);
  }
}
