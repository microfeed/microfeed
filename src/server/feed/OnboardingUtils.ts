import {ONBOARDING_TYPES} from "@/shared/Constants";
import type {
  AdminProtectionStatus,
  OnboardingCheck,
  OnboardingResult,
} from "@/types";

export default class OnboardingChecker {
  private readonly adminProtection: AdminProtectionStatus;
  private readonly request: Request;

  constructor(
    request: Request,
    adminProtection: AdminProtectionStatus = {
      builtInLogin: false,
      cloudflareAccess: false,
    },
  ) {
    this.request = request;
    this.adminProtection = adminProtection;
  }

  private initResult(ready = false, required = true): OnboardingCheck {
    return {
      ready,
      required,
    };
  }

  getResult(): OnboardingResult {
    const result: Record<number, OnboardingCheck> = {};

    result[ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL] =
      this.initResult(true, false);

    const protectedAdminDash = this.initResult(
      this.adminProtection.builtInLogin ||
        this.adminProtection.cloudflareAccess,
      false,
    );
    protectedAdminDash.adminProtection = this.adminProtection;
    result[ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD] =
      protectedAdminDash;

    const customDomain = this.initResult(false, false);
    const urlObj = new URL(this.request.url);
    if (!urlObj.host.endsWith("workers.dev")) {
      customDomain.ready = true;
    }
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
