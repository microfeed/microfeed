import React from 'react';
import {ONBOARDING_TYPES, OUR_BRAND} from "../../../../../../common-src/Constants";
import {CheckCircleIcon, ArrowRightCircleIcon} from "@heroicons/react/20/solid";
import AdminInput from "../../../../../components/AdminInput";

function CheckListItem({title, onboardState, children}) {
  return (<div className="flex">
    <div className="mr-4">
      {onboardState.ready ? <CheckCircleIcon className="w-8 text-green-500" /> :
        <ArrowRightCircleIcon className="w-8 text-muted-color" />}
    </div>
    <details className="w-full" open>
      <summary className="cursor-pointer mb-4">
        {title}
      </summary>
      {children}
    </details>
  </div>);
}

function SetupPublicBucketUrl({onboardState}) {
  return (<CheckListItem onboardState={onboardState} title="Setup R2 public bucket url">
    <div className="flex">
      <div className="mr-4 flex-1">
        <AdminInput
          placeholder="e.g., https://cdn.example.com"
        />
      </div>
      <div className="flex-none">
        <button className="lh-btn lh-btn-brand-dark">Update</button>
      </div>
    </div>
    <div className="mt-4 rounded bg-gray-100 p-2 text-sm grid grid-cols-1 gap-2">
      <details open>
        <summary className="cursor-pointer font-semibold">
          Where to find your R2 public bucket url?
        </summary>
        <div className="my-8 text-helper-color">
          <div>
            Go to <a href={onboardState.r2BucketWebSettingsUrl} target="_blank" rel="noopener noreferrer">
              Cloudflare Dashboard / R2 Bucket Settings <span className="lh-icon-arrow-right" /></a>
          </div>
          <div className="mt-4">
            <div>
              <span className="text-red-700">[Recommended]</span> Add a custom domain (e.g., media-cdn.microfeed.org). Then copy this custom domain here (e.g., https://media-cdn.microfeed.org).
            </div>
            <div className="mt-2">
              <img src="/assets/howto/get-r2-public-bucket-url-howto2.png" className="w-full" />
            </div>
          </div>
          <div className="mt-4">
            <div>
              <span className="text-red-400">[Ok, but not recommended]</span> If you don't have a custom domain, you can also use Cloudflare's r2.dev domain - Click "Allow Access". Then copy "Public Bucket URL" here (e.g., https://pub-xxxx.r2.dev).
            </div>
            <div className="mt-2">
              <img src="/assets/howto/get-r2-public-bucket-url-howto1.png" className="w-full" />
            </div>
          </div>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-semibold">
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
        <summary className="cursor-pointer font-semibold">
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

function ProtectedAdminDashboard({onboardState}) {
  return (<CheckListItem onboardState={onboardState} title="Add Login to Admin Dashboard">
    <div>
      Protect
    </div>
  </CheckListItem>);
}

function CustomDomain({onboardState}) {
  return (<CheckListItem onboardState={onboardState} title="Use Custom Domain">
    <div>
      custom
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
    const {onboardingResult} = this.props;
    return (<div className="lh-page-card">
      <div className="lh-page-subtitle">
        Setup checklist
      </div>
      <div className="mt-8 grid grid-cols-1 gap-8">
        <SetupPublicBucketUrl onboardState={onboardingResult.result[ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL]}/>
        <ProtectedAdminDashboard onboardState={onboardingResult.result[ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD]}/>
        <CustomDomain onboardState={onboardingResult.result[ONBOARDING_TYPES.CUSTOM_DOMAIN]}/>
      </div>
    </div>);
  }
}
