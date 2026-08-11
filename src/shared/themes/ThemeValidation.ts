import semver from "semver";
import {SyntaxValidator} from "fast-xml-validator";

import {
  THEME_FILE_KEYS,
  THEME_MAX_ASSET_BYTES,
  THEME_MAX_ASSETS,
  THEME_MAX_TEMPLATE_BYTES,
  THEME_MAX_TEXT_BYTES,
  THEME_MAX_TOTAL_ASSET_BYTES,
  themeBundleV1Schema,
  themeManifestV1Schema,
  type ThemeBundleV1,
  type ThemeManifestV1,
} from "./ThemeContract";
import {
  parseThemeBundle,
  renderThemeTemplate,
  themeContext,
} from "./ThemeRenderer";

export interface ValidatedThemePackage {
  bundle: ThemeBundleV1;
  manifest: ThemeManifestV1;
}

export class ThemeValidationError extends Error {
  readonly diagnostics: string[];

  constructor(diagnostics: string[]) {
    super(diagnostics.join("\n"));
    this.name = "ThemeValidationError";
    this.diagnostics = diagnostics;
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function validateThemePackage(
  manifestInput: unknown,
  bundleInput: unknown,
  microfeedVersion?: string,
): ValidatedThemePackage {
  const manifestResult = themeManifestV1Schema.safeParse(manifestInput);
  const bundleResult = themeBundleV1Schema.safeParse(bundleInput);
  const diagnostics: string[] = [];
  if (!manifestResult.success) {
    diagnostics.push(...manifestResult.error.issues.map(
      (issue) => `manifest.${issue.path.join(".")}: ${issue.message}`,
    ));
  }
  if (!bundleResult.success) {
    diagnostics.push(...bundleResult.error.issues.map(
      (issue) => `bundle.${issue.path.join(".")}: ${issue.message}`,
    ));
  }
  if (!manifestResult.success || !bundleResult.success) {
    throw new ThemeValidationError(diagnostics);
  }

  const {data: manifest} = manifestResult;
  const {data: bundle} = bundleResult;
  if (!semver.valid(manifest.version)) {
    diagnostics.push("manifest.version: Use a valid semantic version.");
  }
  if (!semver.validRange(manifest.microfeed)) {
    diagnostics.push("manifest.microfeed: Use a valid semantic-version range.");
  } else if (
    microfeedVersion &&
    !semver.satisfies(microfeedVersion, manifest.microfeed, {
      includePrerelease: true,
    })
  ) {
    diagnostics.push(
      `manifest.microfeed: ${manifest.microfeed} does not include microfeed ${microfeedVersion}.`,
    );
  }

  let totalTemplateBytes = 0;
  for (const key of THEME_FILE_KEYS) {
    const size = byteLength(bundle[key]);
    totalTemplateBytes += size;
    if (size > THEME_MAX_TEMPLATE_BYTES) {
      diagnostics.push(
        `bundle.${key}: ${size} bytes exceeds the ${THEME_MAX_TEMPLATE_BYTES}-byte limit.`,
      );
    }
  }
  if (totalTemplateBytes > THEME_MAX_TEXT_BYTES) {
    diagnostics.push(
      `bundle: ${totalTemplateBytes} template bytes exceeds the ${THEME_MAX_TEXT_BYTES}-byte limit.`,
    );
  }

  if (manifest.assets.length > THEME_MAX_ASSETS) {
    diagnostics.push(`manifest.assets: At most ${THEME_MAX_ASSETS} assets are allowed.`);
  }
  const manifestAssets = new Set(manifest.assets);
  const bundleAssets = new Set(bundle.assets.map((asset) => asset.path));
  if (manifestAssets.size !== manifest.assets.length) {
    diagnostics.push("manifest.assets: Asset paths must be unique.");
  }
  if (bundleAssets.size !== bundle.assets.length) {
    diagnostics.push("bundle.assets: Asset paths must be unique.");
  }
  const templatePaths = new Set(Object.values(manifest.files));
  for (const path of manifestAssets) {
    if (templatePaths.has(path)) {
      diagnostics.push(
        `manifest.assets: ${path} cannot also be one of the six template files.`,
      );
    }
    if (!bundleAssets.has(path)) {
      diagnostics.push(`manifest.assets: Declared asset ${path} is missing from the bundle.`);
    }
  }
  for (const path of bundleAssets) {
    if (!manifestAssets.has(path)) {
      diagnostics.push(`bundle.assets: ${path} is not declared in the manifest.`);
    }
  }
  const totalAssetBytes = bundle.assets.reduce((sum, asset) => {
    if (asset.size > THEME_MAX_ASSET_BYTES) {
      diagnostics.push(
        `bundle.assets.${asset.path}: ${asset.size} bytes exceeds the ${THEME_MAX_ASSET_BYTES}-byte limit.`,
      );
    }
    return sum + asset.size;
  }, 0);
  if (totalAssetBytes > THEME_MAX_TOTAL_ASSET_BYTES) {
    diagnostics.push(
      `bundle.assets: ${totalAssetBytes} bytes exceeds the ${THEME_MAX_TOTAL_ASSET_BYTES}-byte limit.`,
    );
  }

  try {
    parseThemeBundle(bundle);
  } catch (error) {
    diagnostics.push(
      `bundle: Invalid Mustache syntax: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    const renderedStylesheet = renderThemeTemplate(bundle.rssStylesheet, themeContext({
      items: [],
      version: "https://jsonfeed.org/version/1.1",
    }, {
      assetBaseUrl: "",
      packageId: manifest.packageId,
      version: manifest.version,
    }));
    SyntaxValidator.validate(renderedStylesheet);
  } catch (error) {
    diagnostics.push(
      `bundle.rssStylesheet: Invalid XSL/XML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (diagnostics.length > 0) {
    throw new ThemeValidationError(diagnostics);
  }
  return {bundle, manifest};
}
