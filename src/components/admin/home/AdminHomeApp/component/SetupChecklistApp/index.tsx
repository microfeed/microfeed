import {ArrowRightCircleIcon, CheckCircleIcon} from "@heroicons/react/20/solid";
import React from "react";

import {ONBOARDING_TYPES} from "@/shared/Constants";
import {ADMIN_URLS} from "@/shared/StringUtils";
import type {AdminProtectionStatus} from "@/types";

function CheckListItem({
  children,
  onboardState,
  title,
}: any) {
  return (
    <div className="flex">
      <div className="mr-4">
        {onboardState.ready
          ? <CheckCircleIcon className="w-6 text-green-500" />
          : <ArrowRightCircleIcon className="w-6 text-muted-color" />}
      </div>
      <details className="w-full" open={!onboardState.ready}>
        <summary className="cursor-pointer mb-4 font-semibold hover:opacity-50">
          {title}
        </summary>
        <div className="mb-8 text-helper-color">{children}</div>
      </details>
    </div>
  );
}

export function AdminProtectionDescription({
  builtInLogin,
  cloudflareAccess,
}: AdminProtectionStatus) {
  if (builtInLogin && cloudflareAccess) {
    return (
      <>
        Your dashboard is protected by the built-in email and password login.{" "}
        Cloudflare Access authentication was also detected on this request,
        providing a second gate.
      </>
    );
  }

  if (builtInLogin) {
    return (
      <>
        Your dashboard is protected by the built-in email and password login.{" "}
        Cloudflare Access was not detected on this request. To add it as an
        optional second gate, run <code>yarn admin access</code> from your
        deployment checkout.
      </>
    );
  }

  if (cloudflareAccess) {
    return (
      <>
        Cloudflare Access authentication was detected on this request. The
        built-in email and password login is disabled.
      </>
    );
  }

  return (
    <>
      No admin protection was detected. The built-in email and password login
      is disabled, and Cloudflare Access authentication was not detected on
      this request. Anyone who can reach the admin dashboard may be able to
      change your content. Run <code>yarn admin auth setup</code> to add a
      login or <code>yarn admin access</code> to configure Cloudflare Access.
    </>
  );
}

export default class SetupChecklistApp extends React.Component<any, any> {
  render() {
    const {onboardingResult} = this.props;
    const access = onboardingResult.result[
      ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD
    ];
    const customDomain = onboardingResult.result[
      ONBOARDING_TYPES.CUSTOM_DOMAIN
    ];
    const adminProtection = access.adminProtection ?? {
      builtInLogin: false,
      cloudflareAccess: false,
    };

    return (
      <div className="lh-page-card">
        <div className="lh-page-title">Setup checklist</div>
        {onboardingResult.allOk && (
          <div className="text-helper-color border border-green-700 bg-green-100 text-green-700 rounded-sm p-2">
            <i>You are all set!</i>
            <div className="mt-2">
              Start publishing at{" "}
              <a href={ADMIN_URLS.newItem()}>
                Add new item <span className="lh-icon-arrow-right" />
              </a>
            </div>
          </div>
        )}
        <div className="mt-8">
          <CheckListItem
            onboardState={access}
            title="Admin protection"
          >
            <AdminProtectionDescription {...adminProtection} />
          </CheckListItem>
          <CheckListItem
            onboardState={customDomain}
            title="Use a custom domain"
          >
            Run <code>yarn admin domain</code> from your deployment
            checkout. The command updates the Worker configuration, deploys,
            and verifies the domain and TLS.
          </CheckListItem>
        </div>
      </div>
    );
  }
}
