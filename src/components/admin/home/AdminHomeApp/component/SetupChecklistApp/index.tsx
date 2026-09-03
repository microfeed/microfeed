import {CircleArrowRightIcon, CircleCheckIcon} from "lucide-react";
import React, {useEffect, useState} from "react";

import {showToast} from "@/client/ToastUtils";
import Requests from "@/client/requests";
import {Button} from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {ONBOARDING_TYPES} from "@/shared/Constants";
import {managementCommand} from "@/shared/ManagementCli";
import {
  ADMIN_URLS,
  normalizeR2CustomDomainUrl,
} from "@/shared/StringUtils";
import type {
  AdminProtectionStatus,
  FeedContent,
  OnboardingCheck,
  OnboardingResult,
} from "@/types";

function CloudflareValue({children}: {children: React.ReactNode}) {
  return (
    <code className="font-semibold text-cloudflare-orange">{children}</code>
  );
}

function CheckListItem({
  children,
  onboardState,
  title,
}: any) {
  return (
    <div className="flex">
      <div className="mr-4">
        {onboardState.ready
          ? <CircleCheckIcon className="w-6 text-green-500" />
          : <CircleArrowRightIcon className="w-6 text-muted-color" />}
      </div>
      <details className="w-full" open={!onboardState.ready}>
        <summary className="cursor-pointer mb-4 font-semibold hover:opacity-50">
          {title}
        </summary>
        <div className="mb-8 text-sm text-helper-color">{children}</div>
      </details>
    </div>
  );
}

interface AdminProtectionDescriptionProps extends AdminProtectionStatus {
  dashboardUrl?: string;
}

function CloudflareAccessLink({dashboardUrl}: {dashboardUrl?: string}) {
  const label = "Cloudflare Zero Trust Access";
  return dashboardUrl
    ? (
      <a
        className="font-medium underline"
        href={dashboardUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        {label}
      </a>
    )
    : label;
}

export function AdminProtectionDescription({
  builtInLogin,
  cloudflareAccess,
  dashboardUrl,
}: AdminProtectionDescriptionProps) {
  if (builtInLogin && cloudflareAccess) {
    return (
      <>
        Your dashboard is protected by the built-in email and password login.{" "}
        <CloudflareAccessLink dashboardUrl={dashboardUrl} /> authentication was
        also detected on this request, providing a second gate.
      </>
    );
  }

  if (builtInLogin) {
    return (
      <>
        Your dashboard is protected by the built-in email and password login.{" "}
        <CloudflareAccessLink dashboardUrl={dashboardUrl} /> was not detected
        on this request. To add it as an optional second gate, run{" "}
        <CloudflareValue>{managementCommand("access")}</CloudflareValue>.
      </>
    );
  }

  if (cloudflareAccess) {
    return (
      <>
        <CloudflareAccessLink dashboardUrl={dashboardUrl} /> authentication was
        detected on this request. The built-in email and password login is
        disabled.
      </>
    );
  }

  return (
    <>
      No dashboard protection was detected. The built-in email and password login
      is disabled, and{" "}
      <CloudflareAccessLink dashboardUrl={dashboardUrl} /> authentication was
      not detected on this request. Anyone who can reach the admin dashboard
      may be able to change your content. Run{" "}
      <CloudflareValue>{managementCommand("auth setup")}</CloudflareValue> to
      add a login or{" "}
      <CloudflareValue>{managementCommand("access")}</CloudflareValue> to configure
      Cloudflare Access.
    </>
  );
}

interface SiteCustomDomainDescriptionProps {
  dashboardUrl?: string;
  workerName?: string;
}

const CUSTOM_DOMAIN_DOCUMENTATION_URL =
  "https://docs.microfeed.org/manage/domains-and-access/";

export function SiteCustomDomainDescription({
  dashboardUrl,
  workerName,
}: SiteCustomDomainDescriptionProps) {
  return (
    <>
      {dashboardUrl
        ? (
          <>
            <a
              className="font-medium underline"
              href={dashboardUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open the{" "}
              {workerName
                ? <CloudflareValue>{workerName}</CloudflareValue>
                : "Worker"}{" "}
              domain settings
            </a>{" "}
            in Cloudflare to add a custom hostname.{" "}
          </>
        )
        : (
          <>
            Open this installation&apos;s Worker in Cloudflare and go to its
            domain settings to add a custom hostname.{" "}
          </>
        )}
      We recommend starting in the Cloudflare dashboard. You can also update
      the custom domain with{" "}
      <CloudflareValue>{managementCommand("domain")}</CloudflareValue>.{" "}
      <a
        className="font-medium underline"
        href={CUSTOM_DOMAIN_DOCUMENTATION_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        Learn more about custom domains.
      </a>
    </>
  );
}

interface MediaDeliveryDescriptionProps {
  bucketName?: string;
  configured?: boolean;
  dashboardUrl?: string;
  error?: string;
  mediaDomainUrl: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  suggestedUrl?: string;
}

export function MediaDeliveryDescription({
  bucketName,
  configured = false,
  dashboardUrl,
  error,
  mediaDomainUrl,
  onChange,
  onSubmit,
  saving,
  suggestedUrl,
}: MediaDeliveryDescriptionProps) {
  const suggestion = suggestedUrl ?? "https://media.example.com/";
  const normalizedSuggestion = normalizeR2CustomDomainUrl(suggestion);
  const suggestedHostname = normalizedSuggestion
    ? new URL(normalizedSuggestion).hostname
    : "media.example.com";

  return (
    <div className="space-y-4">
      {configured
        ? (
          <p>
            Uploaded images, audio, video, and documents are configured to use
            this R2 custom domain.
          </p>
        )
        : (
          <p>
            Uploaded images, audio, video, and documents are currently served
            through the Cloudflare Worker. This works, but uncached requests can
            be slower and can count toward both Worker and R2 billable usage.
          </p>
        )}
      <p>
        Connecting a custom domain directly to this R2 bucket allows
        Cloudflare to cache media closer to visitors. Media can load faster,
        and fewer requests need to reach R2, which can lower future bills.
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          {dashboardUrl
            ? (
              <a
                className="font-medium underline"
                href={dashboardUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open the{" "}
                {bucketName
                  ? <CloudflareValue>{bucketName}</CloudflareValue>
                  : "R2"}{" "}
                bucket domain settings
              </a>
            )
            : (
              <span>
                Open this installation&apos;s R2 bucket in the Cloudflare
                dashboard, then open <strong>Settings</strong>.
              </span>
            )}
        </li>
        <li>
          Under <strong>Custom Domains</strong>, connect a separate hostname
          such as <CloudflareValue>{suggestedHostname}</CloudflareValue>, then
          wait for its status to become Active.
        </li>
        <li>Copy that hostname into the field below and save it.</li>
      </ol>
      <p>
        Do not use the Public Development URL ending in{" "}
        <CloudflareValue>r2.dev</CloudflareValue>. Cloudflare rate-limits that
        URL and does not provide production edge caching on it.
      </p>
      <form className="space-y-3" onSubmit={onSubmit}>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="r2-custom-domain">R2 custom domain</FieldLabel>
          <Input
            aria-describedby="r2-custom-domain-help"
            aria-invalid={Boolean(error)}
            autoCapitalize="none"
            autoCorrect="off"
            disabled={saving}
            id="r2-custom-domain"
            inputMode="url"
            onChange={(event) => onChange(event.target.value)}
            placeholder={suggestion}
            spellCheck={false}
            type="text"
            value={mediaDomainUrl}
          />
          <FieldDescription id="r2-custom-domain-help">
            Use the complete HTTPS address. You can also paste just the
            hostname; microfeed will add <code>https://</code>.
          </FieldDescription>
          <FieldError>{error}</FieldError>
        </Field>
        <Button disabled={saving} type="submit">
          {saving ? "Saving..." : "Save media domain"}
        </Button>
      </form>
    </div>
  );
}

export function MediaStorageDescription({
  bucketName,
  dashboardUrl,
  state,
}: {
  bucketName?: string;
  dashboardUrl?: string;
  state: "disabled" | "pending" | "ready";
}) {
  if (state === "ready") {
    return (
      <>
        R2 media uploads are enabled with bucket{" "}
        {bucketName
          ? <CloudflareValue>{bucketName}</CloudflareValue>
          : "configured for this instance"}.
      </>
    );
  }
  if (state === "disabled") {
    return (
      <>
        Media uploads are disabled for this instance. Text publishing and
        external URLs continue to work. To opt in later, run{" "}
        <CloudflareValue>{managementCommand("deploy --enable-r2")}</CloudflareValue>.
      </>
    );
  }
  return (
    <>
      This installation is running without media uploads while its Cloudflare
      R2 subscription is pending.{" "}
      {dashboardUrl
        ? (
          <a
            className="font-medium underline"
            href={dashboardUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Activate R2 in Cloudflare
          </a>
        )
        : "Activate R2 in the Cloudflare dashboard"}
      , complete billing setup if Cloudflare requests it, then run{" "}
      <CloudflareValue>{managementCommand("deploy --enable-r2")}</CloudflareValue>.
    </>
  );
}

interface SetupChecklistProps {
  feed: FeedContent;
  onboardingResult: OnboardingResult;
  onCompletionChange?: (complete: boolean) => void;
}

export default function SetupChecklistApp({
  feed,
  onboardingResult,
  onCompletionChange,
}: SetupChecklistProps) {
  const access: OnboardingCheck = onboardingResult.result[
    ONBOARDING_TYPES.PROTECTED_ADMIN_DASHBOARD
  ] ?? {ready: false, required: false};
  const customDomain: OnboardingCheck = onboardingResult.result[
    ONBOARDING_TYPES.CUSTOM_DOMAIN
  ] ?? {ready: false, required: false};
  const mediaDomain: OnboardingCheck = onboardingResult.result[
    ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL
  ] ?? {ready: false, required: false};
  const mediaStorage: OnboardingCheck = onboardingResult.result[
    ONBOARDING_TYPES.MEDIA_STORAGE
  ] ?? {mediaStorageState: "ready", ready: true, required: false};
  const currentMediaUrl = normalizeR2CustomDomainUrl(
    feed.settings?.webGlobalSettings?.publicBucketUrl,
  );
  const [mediaDomainUrl, setMediaDomainUrl] = useState(
    currentMediaUrl || mediaDomain.suggestedUrl || "",
  );
  const [mediaDomainSaved, setMediaDomainSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const effectiveMediaDomain = {
    ...mediaDomain,
    ready: mediaDomain.ready || mediaDomainSaved,
  };
  const effectiveAllOk = Object.entries(onboardingResult.result).every(
    ([type, check]) =>
      Number(type) === ONBOARDING_TYPES.VALID_PUBLIC_BUCKET_URL
        ? effectiveMediaDomain.ready
        : check.ready,
  );
  const adminProtection = access.adminProtection ?? {
    builtInLogin: false,
    cloudflareAccess: false,
  };

  useEffect(() => {
    onCompletionChange?.(effectiveAllOk);
  }, [effectiveAllOk, onCompletionChange]);

  async function saveMediaDomain(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUrl = normalizeR2CustomDomainUrl(mediaDomainUrl);
    if (!normalizedUrl) {
      setError(
        "Enter a custom HTTPS hostname such as https://media.example.com/. " +
          "Public r2.dev URLs are not supported.",
      );
      return;
    }
    if (new URL(normalizedUrl).hostname === window.location.hostname) {
      setError(
        "Use a separate hostname for R2, such as media.example.com, rather " +
          "than the domain serving microfeed itself.",
      );
      return;
    }

    setError("");
    setSaving(true);
    const currentWebSettings = feed.settings?.webGlobalSettings ?? {};
    try {
      await Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {
        settings: {
          webGlobalSettings: {
            ...currentWebSettings,
            publicBucketUrl: normalizedUrl,
          },
        },
      });
      setMediaDomainUrl(normalizedUrl);
      setMediaDomainSaved(true);
      showToast("Media domain updated!", "success");
    } catch (requestError: any) {
      setError(
        requestError.response
          ? "The media domain could not be saved. Please try again."
          : "Network error. Please refresh the page and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs">
      <div className="mb-4 text-lg font-semibold tracking-tight">Setup checklist</div>
      {effectiveAllOk && (
        <div className="rounded-[10px] border border-green-700/40 bg-green-500/10 p-3 text-green-700 dark:text-green-300">
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
          title="Dashboard protection"
        >
          <AdminProtectionDescription
            {...adminProtection}
            dashboardUrl={access.dashboardUrl}
          />
        </CheckListItem>
        <CheckListItem
          onboardState={customDomain}
          title="Use a custom domain for this site"
        >
          <SiteCustomDomainDescription
            dashboardUrl={customDomain.dashboardUrl}
            workerName={customDomain.workerName}
          />
        </CheckListItem>
        <CheckListItem
          onboardState={mediaStorage}
          title="Enable media storage"
        >
          <MediaStorageDescription
            bucketName={mediaStorage.bucketName}
            dashboardUrl={mediaStorage.dashboardUrl}
            state={mediaStorage.mediaStorageState ?? "ready"}
          />
        </CheckListItem>
        {mediaStorage.ready && <CheckListItem
          onboardState={effectiveMediaDomain}
          title="Use a custom domain for media files"
        >
          <MediaDeliveryDescription
            bucketName={mediaDomain.bucketName}
            configured={Boolean(currentMediaUrl || mediaDomainSaved)}
            dashboardUrl={mediaDomain.dashboardUrl}
            error={error}
            mediaDomainUrl={mediaDomainUrl}
            onChange={(value) => {
              setMediaDomainUrl(value);
              setError("");
            }}
            onSubmit={saveMediaDomain}
            saving={saving}
            suggestedUrl={mediaDomain.suggestedUrl}
          />
        </CheckListItem>}
      </div>
    </div>
  );
}
