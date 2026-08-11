import {mediaPrefix} from "@/server/media/R2Utils";
import type {ThemeBundleV1} from "@/shared/themes/ThemeContract";

export function themeAssetBaseUrl(
  runtimeEnv: Pick<Env, "DEPLOYMENT_ENVIRONMENT">,
  requestUrl: string,
  assetOwnerThemeId: string | null | undefined,
  assets: ThemeBundleV1["assets"] = [],
): string {
  if (!assetOwnerThemeId) return "";
  const firstAsset = assets[0];
  if (firstAsset) {
    const relativeAsset = firstAsset.path.replace(/^assets\//u, "");
    if (relativeAsset && firstAsset.key.endsWith(relativeAsset)) {
      const baseKey = firstAsset.key.slice(0, -relativeAsset.length);
      return new URL(`/media/${baseKey}`, requestUrl).toString();
    }
  }
  return new URL(
    `/media/${mediaPrefix(runtimeEnv, requestUrl)}/themes/${encodeURIComponent(assetOwnerThemeId)}/assets/`,
    requestUrl,
  ).toString();
}
