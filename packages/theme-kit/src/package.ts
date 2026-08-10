import {createHash} from "node:crypto";
import {lstat, readFile, realpath} from "node:fs/promises";
import path from "node:path";

import type {
  ThemeBundleV1,
  ThemeManifestV1,
} from "../../../src/shared/themes/ThemeContract";
import {
  THEME_MAX_ASSET_BYTES,
  THEME_MAX_TEMPLATE_BYTES,
  THEME_MAX_TOTAL_ASSET_BYTES,
  themeManifestV1Schema,
} from "../../../src/shared/themes/ThemeContract";
import {validateThemePackage} from "../../../src/shared/themes/ThemeValidation";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export interface LoadedThemePackage {
  assetFiles: Array<{bytes: Uint8Array; contentType: string; path: string; sha256: string}>;
  bundle: ThemeBundleV1;
  directory: string;
  manifest: ThemeManifestV1;
}

async function safeFile(
  root: string,
  relativePath: string,
  maximumBytes: number,
): Promise<string> {
  const filename = path.resolve(root, relativePath);
  const relative = path.relative(root, filename);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe package path: ${relativePath}`);
  }
  const info = await lstat(filename);
  if (info.isSymbolicLink()) throw new Error(`Symlinks are not allowed: ${relativePath}`);
  if (!info.isFile()) throw new Error(`Declared path is not a file: ${relativePath}`);
  if (info.size > maximumBytes) {
    throw new Error(
      `${relativePath} is ${info.size} bytes and exceeds the ${maximumBytes}-byte limit.`,
    );
  }
  const resolved = await realpath(filename);
  const resolvedRelative = path.relative(await realpath(root), resolved);
  if (resolvedRelative.startsWith("..") || path.isAbsolute(resolvedRelative)) {
    throw new Error(`Package path escapes its directory: ${relativePath}`);
  }
  return filename;
}

async function readTextFile(filename: string, displayPath: string): Promise<string> {
  const bytes = await readFile(filename);
  try {
    return new TextDecoder("utf-8", {fatal: true}).decode(bytes);
  } catch {
    throw new Error(`Theme text file is not valid UTF-8: ${displayPath}`);
  }
}

export async function loadThemePackage(directory: string): Promise<LoadedThemePackage> {
  const root = path.resolve(directory);
  const manifestFilename = await safeFile(
    root,
    "microfeed-theme.json",
    THEME_MAX_TEMPLATE_BYTES,
  );
  const manifest = themeManifestV1Schema.parse(
    JSON.parse(await readTextFile(manifestFilename, "microfeed-theme.json")),
  );
  const fileEntries = await Promise.all(Object.entries(manifest.files).map(
    async ([key, relativePath]) => [
      key,
      await readTextFile(
        await safeFile(root, relativePath, THEME_MAX_TEMPLATE_BYTES),
        relativePath,
      ),
    ] as const,
  ));
  const assetFiles: LoadedThemePackage["assetFiles"] = [];
  let totalAssetBytes = 0;
  for (const relativePath of manifest.assets) {
    const contentType = CONTENT_TYPES[path.extname(relativePath).toLowerCase()];
    if (!contentType) throw new Error(`Unsupported theme asset type: ${relativePath}`);
    const filename = await safeFile(root, relativePath, THEME_MAX_ASSET_BYTES);
    totalAssetBytes += (await lstat(filename)).size;
    if (totalAssetBytes > THEME_MAX_TOTAL_ASSET_BYTES) {
      throw new Error(
        `Theme assets exceed the ${THEME_MAX_TOTAL_ASSET_BYTES}-byte total limit.`,
      );
    }
    const bytes = new Uint8Array(await readFile(filename));
    assetFiles.push({
      bytes,
      contentType,
      path: relativePath,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const bundle = {
    ...Object.fromEntries(fileEntries),
    assets: assetFiles.map((asset) => ({
      contentType: asset.contentType,
      key: asset.path,
      path: asset.path,
      sha256: asset.sha256,
      size: asset.bytes.byteLength,
    })),
  } as ThemeBundleV1;
  const validated = validateThemePackage(manifest, bundle);
  return {...validated, assetFiles, directory: root};
}
