import React, {useState} from 'react';
import {ONBOARDING_TYPES, OUR_BRAND, SETTINGS_CATEGORIES} from "../../../../../../common-src/Constants";
import {CheckCircleIcon, ArrowRightCircleIcon} from "@heroicons/react/20/solid";
import AdminInput from "../../../../../components/AdminInput";
import Requests from "../../../../../common/requests";
import {ADMIN_URLS} from "../../../../../../common-src/StringUtils";
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
        {onboardState.required ? '[Required]' : ''} {title}
      </summary>
      {children}
    </details>
  </div>);
}

function SetupPublicBucketUrl({onboardState, webGlobalSettings, cloudflareUrls}) {
  const publicBucketUrl = webGlobalSettings.publicBucketUrl || '';
  const [url, setUrl] = useState(publicBucketUrl);
  const [submitStatus, setSubmitStatus] = useState(null);
  const submitting = submitStatus === SUBMIT_STATUS__START;
  return (<CheckListItem onboardState={onboardState} title="Setup R2 public bucket url">
    <div className="flex">
      <div className="mr-4 flex-1">
        <AdminInput
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
            setSubmitStatus(SUBMIT_STATUS__START);
            Requests.post(ADMIN_URLS.ajaxFeed(), {
              settings: {
                [SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS]: {
                  ...webGlobalSettings,
                  publicBucketUrl: url,
                },
              }
            })
              .then(() => {
                showToast('Updated!', 'success');
                setTimeout(() => {
                  location.href = '';
                }, 1500);
              });
          }}
        >
          {submitting ? 'Updating...' : 'Update'}
        </button>
      </div>
    </div>
    <div className="mt-4 rounded bg-gray-100 p-2 text-sm grid grid-cols-1 gap-2">
      <details open>
        <summary className="cursor-pointer font-semibold hover:opacity-50">
          Where to find your R2 public bucket url?
        </summary>
        <div className="my-8 text-helper-color">
          <div>
            Go to <a href={cloudflareUrls.r2BucketSettingsUrl} target="_blank" rel="noopener noreferrer">
              Cloudflare Dashboard / R2 Bucket Settings <span className="lh-icon-arrow-right" /></a>
          </div>
          <div className="mt-4">
            <div>
              <span className="text-brand-light font-bold">[Recommended]</span> Add a custom domain (e.g., media-cdn.microfeed.org). Then copy this custom domain here (e.g., https://media-cdn.microfeed.org).
            </div>
            <div className="mt-2">
              <img src="/assets/howto/get-r2-public-bucket-url-howto2.png" className="w-full" />
            </div>
          </div>
          <div className="mt-4">
            <div>
              <span className="text-brand-light">[Ok, but not recommended]</span> If you don't have a custom domain, you can also use Cloudflare's r2.dev domain - Click "Allow Access". Then copy "Public Bucket URL" here (e.g., https://pub-xxxx.r2.dev).
            </div>
            <div className="mt-2">
              <img src="/assets/howto/get-r2-public-bucket-url-howto1.png" className="w-full" />
            </div>
          </div>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold hover:opacity-50">
          What is R2 public bucket url used for?
        </summary>
        <div className="my-8 text-helper-color">
          <div>
            You will store media files (e.g., audio, video, image, document...) on Cloudflare R2. In order to serve those media files to the public, you have to provide a R2 public bucket url.
          </div>
          <div className="mt-2">
            Assuming the R2 public bucket url is https://cdn.example.com, a media file (e.g., audio) will be accessed via a link like https://cdn.example.com/some-audio.mp3
          </div>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold hover:opacity-50">
          How to make sure this url is valid?
        </summary>
        <div className="my-8 text-helper-color">
          <div>
            When you open this R2 public bucket url, you will see a 404 page like this (e.g., <a href={OUR_BRAND.exampleCdnUrl} target="_blank">https://media-cdn.microfeed.org</a>):
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
  return (<CheckListItem onboardState={onboardState} title="Add Login to Admin Dashboard">
    <div className="mt-4 rounded bg-gray-100 p-2 text-sm grid grid-cols-1 gap-2 text-helper-color">
      <div>
        Step 1: <a href={cloudflareUrls.addAccessGroupUrl} target="_blank">
        Add an access group <span className="lh-icon-arrow-right"/>
      </a>
      </div>
      <div>
        You need to specify what emails are allowed to access this admin dashboard:
      </div>
      <div>
        <img src="/assets/howto/add-access-group.png" className="w-full border" />
      </div>

      <div className="mt-8">
        Step 2: <a href={cloudflareUrls.addAppUrl} target="_blank">
        Create a self-hosted app to protect admin dashboard <span className="lh-icon-arrow-right"/>
      </a>
      </div>
      <div className="mt-4">
        Select "Self-hosted" here:
      </div>
      <div className="mt-2">
        <img src="/assets/howto/select-self-hosted-app.png" className="w-full border" />
      </div>
      <div className="mt-4">
        Fill info for <b>{cloudflareUrls.pagesDevUrl}/admin</b>:
      </div>
      <div className="mt-2">
        <img src="/assets/howto/add-app1.png" className="w-full border" />
      </div>
      <div className="mt-4">
        Add policy name, then click "Next" all the way until you add the app:
      </div>
      <div className="mt-2">
        <img src="/assets/howto/add-app2.png" className="w-full border" />
      </div>
      <div className="mt-4">
      Step 3: Refresh current page and you should be able to login with your email:
      </div>
      <div className="mt-2">
        <img src="/assets/howto/app-access-login.png" className="w-full border" />
      </div>
      <div className="mt-4">
        Bonus: You may want to create a 2nd self-hosted app for <b>*.{cloudflareUrls.pagesDevUrl}</b>, which will protect all <a href="https://developers.cloudflare.com/pages/platform/preview-deployments/" target="_blank">preview deployments</a>.
      </div>
    </div>
  </CheckListItem>);
}

function CustomDomain({onboardState, cloudflareUrls}) {
  return (<CheckListItem onboardState={onboardState} title="Use Custom Domain">
    <div className="mt-4 rounded bg-gray-100 p-2 text-sm grid grid-cols-1 gap-2 text-helper-color">
      <div>
        Using custom domain, you can benefit from Cloudflare features such as bot management, Access, and Cache.
      </div>
      <div className="mt-4">
        Step 1: <a href={cloudflareUrls.pagesCustomDomainUrl} target="_blank">Setup custom domain here <span className="lh-icon-arrow-right" /></a>
      </div>
      <div className="mt-2">
        <img src="/assets/howto/pages-custom-domain.png" className="w-full border" />
      </div>
      <div className="mt-4">
        If you want to access this admin dashboard from your newly added custom domain, you have to create a self-hosted app for the admin url. Instead of using {cloudflareUrls.pagesDevUrl}, use your new custom domain this time.
      </div>
      <div className="mt-4">
        Step 2: <a href={cloudflareUrls.addAppUrl} target="_blank">
        Create a self-hosted app to protect admin dashboard <span className="lh-icon-arrow-right"/>
      </a>
      </div>
      <div className="mt-2">
        <img src="/assets/howto/add-app1.png" className="w-full border" />
      </div>
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

    onboardingResult.result[ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD].ready = false;
    // onboardingResult.result[ONBOARDING_TYPES.CUSTOM_DOMAIN].ready = false;
    return (<div className="lh-page-card">
      <div className="lh-page-subtitle">
        Setup checklist
      </div>
      <div className="mt-8 grid grid-cols-1 gap-8">
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
    </div>);
  }
}
