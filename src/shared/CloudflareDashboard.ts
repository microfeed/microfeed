function normalizedDashboardIdentifier(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? encodeURIComponent(normalized) : null;
}

export const CLOUDFLARE_ACCESS_SELF_HOSTED_APPLICATION_PATH =
  "one/access-controls/apps/self-hosted/add";

export function accessApplicationDashboardUrl(accountId: string): string;
export function accessApplicationDashboardUrl(
  accountId: string | undefined,
): string | null;
export function accessApplicationDashboardUrl(
  accountId: string | undefined,
): string | null {
  const normalizedAccountId = normalizedDashboardIdentifier(accountId);
  return normalizedAccountId
    ? `https://dash.cloudflare.com/${normalizedAccountId}/` +
      CLOUDFLARE_ACCESS_SELF_HOSTED_APPLICATION_PATH
    : null;
}

export function r2BucketDomainsDashboardUrl(
  accountId: string | undefined,
  bucketName: string | undefined,
): string | null {
  const normalizedAccountId = normalizedDashboardIdentifier(accountId);
  const normalizedBucketName = normalizedDashboardIdentifier(bucketName);
  if (!normalizedAccountId || !normalizedBucketName) {
    return null;
  }

  return `https://dash.cloudflare.com/${normalizedAccountId}/` +
    `r2/default/buckets/${normalizedBucketName}/` +
    "settings#domains";
}

export function r2OverviewDashboardUrl(
  accountId: string | undefined,
): string | null {
  const normalizedAccountId = normalizedDashboardIdentifier(accountId);
  return normalizedAccountId
    ? `https://dash.cloudflare.com/${normalizedAccountId}/r2/overview`
    : null;
}

export function workerDomainsDashboardUrl(
  accountId: string | undefined,
  workerName: string | undefined,
): string | null {
  const normalizedAccountId = normalizedDashboardIdentifier(accountId);
  const normalizedWorkerName = normalizedDashboardIdentifier(workerName);
  if (!normalizedAccountId || !normalizedWorkerName) {
    return null;
  }

  return `https://dash.cloudflare.com/${normalizedAccountId}/workers/` +
    `services/view/${normalizedWorkerName}/production/domains`;
}
