import {ONBOARDING_TYPES} from "./Constants";
import {isValidUrl, urlJoin} from "./StringUtils";

export default class OnboardingChecker {
  constructor(feed, request, env) {
    this.feed = feed || {};
    this.request = request;

    this.cookie = request.headers.get('cookie') || '';
    if (env['DEPLOYMENT_ENVIRONMENT'] === 'development') {
      this.cookie = `CF_Authorization=something; ${this.cookie || ''}`;
    }
    this.env = env;
  }

  _getCookie(name) {
    const value = `; ${this.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop().split(';').shift();
    }
  }

  _initResult(ready=false, required=true) {
    return {
      ready,
      required,
    }
  }
  getResult() {
    const settings = this.feed.settings || {};
    const webGlobalSettings = settings.webGlobalSettings || {};

    const result = {};

    const validPublicBucketUrl = this._initResult(false, true);
    if (isValidUrl(webGlobalSettings.publicBucketUrl)) {
      validPublicBucketUrl.ready = true;
    }
    result[ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL] = validPublicBucketUrl;

    const protectedAdminDash = this._initResult(false, false);
    if (this._getCookie('CF_Authorization')) {
      protectedAdminDash.ready = true;
    }
    result[ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD] = protectedAdminDash;

    const customDomain = this._initResult(false, false);
    const urlObj = new URL(this.request.url);
    if (!urlObj.host.endsWith('pages.dev')) {
      customDomain.ready = true;
    }
    result[ONBOARDING_TYPES.CUSTOM_DOMAIN] = customDomain;

    const accessSettingsUrl = `https://one.dash.cloudflare.com/${this.env['CLOUDFLARE_ACCOUNT_ID']}/access`;
    const finalResult = {
      requiredOk: true,
      allOk: true,
      result,
      cloudflareUrls: {
        r2BucketSettingsUrl: `https://dash.cloudflare.com/${this.env['CLOUDFLARE_ACCOUNT_ID']}/r2/overview/buckets/${this.env['R2_PUBLIC_BUCKET']}/settings`,
        addAccessGroupUrl: urlJoin(accessSettingsUrl, '/groups/add'),
        addAppUrl: urlJoin(accessSettingsUrl, '/apps/add'),
        pagesCustomDomainUrl: `https://dash.cloudflare.com/${this.env['CLOUDFLARE_ACCOUNT_ID']}/pages/view/${this.env['CLOUDFLARE_PROJECT_NAME']}/domains`,
        pagesDevUrl: `${this.env['CLOUDFLARE_PROJECT_NAME']}.pages.dev`,
      },
    };
    Object.keys(result).forEach((k) => {
      if (!result[k].ready) {
        if (result[k].required) {
          finalResult['requiredOk'] = false;
        }
        finalResult['allOk'] = false;
      }
    });
    return finalResult;
  }
}
