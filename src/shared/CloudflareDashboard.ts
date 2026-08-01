export function r2BucketDomainsDashboardUrl(
  accountId: string | undefined,
  bucketName: string | undefined,
): string | null {
  const normalizedAccountId = accountId?.trim();
  const normalizedBucketName = bucketName?.trim();
  if (!normalizedAccountId || !normalizedBucketName) {
    return null;
  }

  return `https://dash.cloudflare.com/${encodeURIComponent(normalizedAccountId)}/` +
    `r2/default/buckets/${encodeURIComponent(normalizedBucketName)}/` +
    "settings#domains";
}
