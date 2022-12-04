import {ONBOARDING_TYPES} from "./Constants";
import {isValidUrl} from "./StringUtils";

export default class OnboardingChecker {
  constructor(feed, request, env) {
    this.feed = feed || {};
    this.request = request;

    this.cookie = request.cookie || '';
    if (env['DEPLOYMENT_ENVIRONMENT'] === 'development') {
      this.cookie = `CF_Authorization=something; ${this.cookie || ''}`;
    }
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

    const finalResult = {
      requiredOk: true,
      allOk: true,
      result,
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
