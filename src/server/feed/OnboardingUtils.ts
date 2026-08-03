import {ONBOARDING_TYPES} from "@/shared/Constants";
import {
  accessApplicationDashboardUrl,
  r2BucketDomainsDashboardUrl,
  r2OverviewDashboardUrl,
  workerDomainsDashboardUrl,
} from "@/shared/CloudflareDashboard";
import {
  isR2CustomDomainUrl,
  suggestedR2CustomDomainUrl,
} from "@/shared/StringUtils";
import type {
  AdminProtectionStatus,
  OnboardingCheck,
  OnboardingResult,
} from "@/types";

interface OnboardingOptions {
  accountId?: string;
  publicBucketUrl?: string;
  r2BucketName?: string;
  r2Ready?: boolean;
  r2SetupMode?: "automatic" | "disabled";
  workerName?: string;
}

export default class OnboardingChecker {
  private readonly adminProtection: AdminProtectionStatus;
  private readonly options: OnboardingOptions;
  private readonly request: Request;

  constructor(
    request: Request,
    adminProtection: AdminProtectionStatus = {
      builtInLogin: false,
      cloudflareAccess: false,
    },
    options: OnboardingOptions = {},
  ) {
    this.request = request;
    this.adminProtection = adminProtection;
    this.options = options;
  }

  private initResult(ready = false, required = true): OnboardingCheck {
    return {
      ready,
      required,
    };
  }

  getResult(): OnboardingResult {
    const result: Record<number, OnboardingCheck> = {};

    const urlObj = new URL(this.request.url);
    const r2Ready = this.options.r2Ready !== false;
    const mediaDomain = this.initResult(
      !r2Ready ||
        isR2CustomDomainUrl(this.options.publicBucketUrl),
      false,
    );
    mediaDomain.bucketName = this.options.r2BucketName;
    mediaDomain.dashboardUrl = r2BucketDomainsDashboardUrl(
      this.options.accountId,
      this.options.r2BucketName,
    ) ?? undefined;
    mediaDomain.suggestedUrl = suggestedR2CustomDomainUrl(urlObj.hostname);
    result[ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL] = mediaDomain;

    const mediaStorage = this.initResult(r2Ready, false);
    mediaStorage.bucketName = this.options.r2BucketName;
    mediaStorage.dashboardUrl = r2OverviewDashboardUrl(
      this.options.accountId,
    ) ?? undefined;
    mediaStorage.mediaStorageState = r2Ready
      ? "ready"
      : this.options.r2SetupMode === "disabled"
        ? "disabled"
        : "pending";
    result[ONBOARDING_TYPES.MEDIA_STORAGE] = mediaStorage;

    const protectedAdminDash = this.initResult(
      this.adminProtection.builtInLogin ||
        this.adminProtection.cloudflareAccess,
      false,
    );
    protectedAdminDash.adminProtection = this.adminProtection;
    protectedAdminDash.dashboardUrl =
      accessApplicationDashboardUrl(this.options.accountId) ??
        undefined;
    result[ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD] =
      protectedAdminDash;

    const customDomain = this.initResult(false, false);
    if (!urlObj.host.endsWith("workers.dev")) {
      customDomain.ready = true;
    }
    customDomain.dashboardUrl = workerDomainsDashboardUrl(
      this.options.accountId,
      this.options.workerName,
    ) ?? undefined;
    customDomain.workerName = this.options.workerName;
    result[ONBOARDING_TYPES.CUSTOM_DOMAIN] = customDomain;

    const finalResult: OnboardingResult = {
      requiredOk: true,
      allOk: true,
      result,
    };
    Object.values(result).forEach((check) => {
      if (!check.ready) {
        if (check.required) {
          finalResult.requiredOk = false;
        }
        finalResult.allOk = false;
      }
    });
    return finalResult;
  }
}
