import {mediaPrefix} from "@/server/media/R2Utils";
import {resolvePublicBucketUrl} from "@/shared/StringUtils";
import type {ThemeBundleV1} from "@/shared/themes/ThemeContract";

function themeAssetUrl(
  requestUrl: string,
  publicBucketUrl: string | undefined,
  key: string,
): string {
  const request = new URL(requestUrl);
  const baseUrl = new URL(
    resolvePublicBucketUrl(publicBucketUrl, request.hostname),
    request,
  );
  if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
  return new URL(key, baseUrl).toString();
}

export function themeAssetBaseUrl(
  runtimeEnv: Pick<Env, "DEPLOYMENT_ENVIRONMENT">,
  requestUrl: string,
  assetOwnerThemeId: string | null | undefined,
  assets: ThemeBundleV1["assets"] = [],
  publicBucketUrl?: string,
): string {
  if (!assetOwnerThemeId) return "";
  const firstAsset = assets[0];
  if (firstAsset) {
    const relativeAsset = firstAsset.path.replace(/^assets\//u, "");
    if (relativeAsset && firstAsset.key.endsWith(relativeAsset)) {
      const baseKey = firstAsset.key.slice(0, -relativeAsset.length);
      return themeAssetUrl(requestUrl, publicBucketUrl, baseKey);
    }
  }
  return themeAssetUrl(
    requestUrl,
    publicBucketUrl,
    `${mediaPrefix(runtimeEnv, requestUrl)}/themes/${encodeURIComponent(assetOwnerThemeId)}/assets/`,
  );
}
