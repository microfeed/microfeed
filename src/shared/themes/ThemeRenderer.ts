import Mustache from "mustache";

import {getBuiltInTemplateVariables} from "../TemplateVariables";
import type {
  ThemeBundleV1,
  ThemeContext,
  ThemeManifestV1,
} from "./ThemeContract";
import {THEME_FILE_KEYS} from "./ThemeContract";

export interface ThemeRuntimeMetadata {
  assetBaseUrl: string;
  packageId: string;
  version: string;
}

export function themeContext(
  publicFeed: Record<string, unknown>,
  metadata: ThemeRuntimeMetadata,
  item?: Record<string, unknown>,
): ThemeContext {
  return {
    ...publicFeed,
    ...getBuiltInTemplateVariables(),
    _theme: {
      asset_base_url: metadata.assetBaseUrl,
      package_id: metadata.packageId,
      version: metadata.version,
    },
    ...(item ? {item} : {}),
  } as ThemeContext;
}

export function parseThemeBundle(bundle: ThemeBundleV1): void {
  for (const key of THEME_FILE_KEYS) {
    Mustache.parse(bundle[key]);
  }
}

export function renderThemeTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  return Mustache.render(template, context);
}

export function renderThemeSlot(
  bundle: ThemeBundleV1,
  slot: Exclude<keyof ThemeBundleV1, "assets">,
  context: Record<string, unknown>,
): string {
  return renderThemeTemplate(bundle[slot], context);
}

export function canonicalThemePackage(
  manifest: ThemeManifestV1,
  bundle: ThemeBundleV1,
): string {
  const orderedBundle = Object.fromEntries(Object.entries({
    ...bundle,
    assets: bundle.assets.map(({key: _key, ...asset}) => asset),
  }).sort(([left], [right]) => left.localeCompare(right)));
  return JSON.stringify({manifest, bundle: orderedBundle});
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const source = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value;
  const bytes = new Uint8Array(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
