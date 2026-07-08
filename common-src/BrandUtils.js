import {OUR_BRAND} from "./Constants";

/**
 * Neutral, non-"microfeed" fallback defaults for brand fields. These are the
 * values shown when an admin has not configured their own brand. `OUR_BRAND`
 * (in Constants.js) is the single source of these neutral defaults.
 */
export const DEFAULT_BRAND = {
  brandName: OUR_BRAND.brandName,
  brandDomain: OUR_BRAND.domain,
  brandLogo: "",
};

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

/**
 * Resolve brand fields from settings, falling back to neutral defaults.
 *
 * Accepts either the full settings object (with a `webGlobalSettings` key) or
 * the webGlobalSettings sub-object directly, so callers on both sides of the
 * wire can use it. Returns {brandName, brandDomain, brandLogo}; the returned
 * values never contain "microfeed".
 */
export function resolveBrand(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  const webGlobalSettings = source.webGlobalSettings && typeof source.webGlobalSettings === "object"
    ? source.webGlobalSettings
    : source;

  return {
    brandName: firstNonEmpty(webGlobalSettings.brandName, DEFAULT_BRAND.brandName),
    brandDomain: firstNonEmpty(webGlobalSettings.brandDomain, DEFAULT_BRAND.brandDomain),
    brandLogo: firstNonEmpty(webGlobalSettings.brandLogo, DEFAULT_BRAND.brandLogo),
  };
}

export default resolveBrand;
