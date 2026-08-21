import {createHash, randomBytes, randomUUID} from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  rmdir,
  writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {Miniflare} from "miniflare";
import * as z from "zod";

import {
  storedThemeFromRow,
  storedThemeSummaryFromRow,
  themeStateFromRow,
} from "@/shared/themes/ThemeRows";
import {themeKitCompatibilityRange} from "@/shared/ThemeKitVersion";
import {
  MICROFEED_PACKAGE_MANAGER,
  MICROFEED_VERSION,
} from "@/shared/Version";
import {
  assertUserThemePackageId,
  isReservedThemePackageId,
  LOCAL_THEME_PACKAGE_ID_PREFIX,
  THEME_MAX_ASSET_BYTES,
  THEME_MAX_CUSTOM_INSTALLED_VERSIONS,
  THEME_MAX_TEMPLATE_BYTES,
  THEME_MAX_TOTAL_ASSET_BYTES,
  THEME_FILE_KEYS_V1,
  themeContextSchema,
  themeManifestV1Schema,
  type StoredThemeVersion,
  type ThemeBundleV1,
  type ThemeFileKey,
  type ThemeManifestV1,
  type ThemePreviewFixture,
  type ThemeState,
  type ThemeVersionSummary,
} from "@/shared/themes/ThemeContract";
import {
  BUNDLED_FALLBACK_THEME,
  BUNDLED_THEME_CATALOG,
  bundledThemeCatalogEntryBySource,
  canonicalBundledThemeSource,
} from "@/shared/themes/BundledThemeCatalog";
import {
  canonicalThemePackage,
  sha256Hex,
} from "@/shared/themes/ThemeRenderer";
import {
  validateStoredThemePackage,
  validateThemePackage,
} from "@/shared/themes/ThemeValidation";
import {
  generatedExportedThemeRepositoryReadme,
  generatedInitializedThemeRepositoryReadme,
  generatedThemeReadme,
} from "../packages/theme-kit/src/readme";
import {
  loadThemePackage,
  type LoadedThemePackage,
} from "../packages/theme-kit/src/package";
import type {CommandRunner, MicrofeedConfig} from "./types";
import type {Flags} from "./commands";
import {CloudflareClient} from "./lib/cloudflare";
import {pruneSupersededBundledThemeVersions} from "./lib/bundled-theme-pruning";
import {
  cloudflareAccountId,
  defaultLocalInstance,
  isLocalOnly,
  isR2Ready,
  localPersistencePath,
  readConfig,
} from "./lib/config";
import {repositoryRoot, runCommand} from "./lib/process";

interface ThemeSourceMetadata {
  commit: string | null;
  kind: "bundled" | "github" | "local-directory";
  path: string | null;
  ref: string | null;
  url: string | null;
}

interface ResolvedThemeSource {
  loaded: LoadedThemePackage;
  source: ThemeSourceMetadata;
}

interface Target {
  client: CloudflareClient;
  config: MicrofeedConfig;
  local: boolean;
}

interface EffectiveTheme {
  assetOwnerThemeId: string | null;
  bundle: ThemeBundleV1;
  checksumSha256: string | null;
  fallbackReason: string | null;
  kind: "bundled-fallback" | "installed" | "legacy";
  manifest: ThemeManifestV1;
  previewFixture: ThemePreviewFixture | null;
  themeId: string | null;
}

interface ThemePackageFiles {
  assetOwnerThemeId: string | null;
  bundle: ThemeBundleV1;
  manifest: ThemeManifestV1;
  previewFixture: ThemePreviewFixture | null;
}

interface WriteThemePackageOptions {
  readme?: string;
  repositoryScaffold?: {readme: string};
}

const CANONICAL_THEME_FILES_V1 = {
  rssStylesheet: "rss-stylesheet.xsl",
  webBodyEnd: "web-body-end.mustache",
  webBodyStart: "web-body-start.mustache",
  webFeed: "web-feed.mustache",
  webHeader: "web-header.mustache",
  webItem: "web-item.mustache",
};

const CANONICAL_THEME_FILES_V2 = {
  ...CANONICAL_THEME_FILES_V1,
  webPage: "web-page.mustache",
  webSearch: "web-search.mustache",
};

function flagString(flags: Flags, name: string): string | undefined {
  return typeof flags[name] === "string" ? flags[name] : undefined;
}

function flagBoolean(flags: Flags, name: string): boolean {
  return flags[name] === true;
}

function writeOutput(flags: Flags, value: unknown, message: string): void {
  process.stdout.write(flagBoolean(flags, "json")
    ? `${JSON.stringify(value)}\n`
    : `${message}\n`);
}

async function resolveTarget(flags: Flags, runner: CommandRunner): Promise<Target> {
  const preview = flagBoolean(flags, "preview");
  if (preview && flagBoolean(flags, "local")) {
    throw new Error("Choose either --preview or --local, not both.");
  }
  const requested = flagString(flags, "instance") ?? process.env.MICROFEED_INSTANCE;
  const instanceName = requested ?? await defaultLocalInstance();
  const config = await readConfig(preview, instanceName ?? undefined);
  if (!config) {
    throw new Error("No saved microfeed instance was found. Pass --instance <name>.");
  }
  return {
    client: new CloudflareClient(runner),
    config,
    local: flagBoolean(flags, "local") || isLocalOnly(config),
  };
}

function environmentPrefix(config: MicrofeedConfig, local: boolean): string {
  if (local) return "development";
  return config.deploymentEnvironment === "preview" ? "preview" : "production";
}

function assetKey(environment: string, ownerId: string, assetPath: string): string {
  const relative = assetPath.replace(/^assets\//u, "");
  return `${environment}/themes/${ownerId}/assets/${relative}`;
}

async function bundledFallbackTheme(): Promise<EffectiveTheme> {
  const loaded = await loadThemePackage(path.join(repositoryRoot, "themes/default"));
  return {
    assetOwnerThemeId: null,
    bundle: loaded.bundle,
    checksumSha256: null,
    fallbackReason: null,
    kind: "bundled-fallback",
    manifest: loaded.manifest,
    previewFixture: loaded.previewFixture,
    themeId: null,
  };
}

function legacyTheme(
  customCode: unknown,
  fallback: EffectiveTheme,
): EffectiveTheme | null {
  if (!customCode || typeof customCode !== "object" || Array.isArray(customCode)) {
    return null;
  }
  const record = customCode as Record<string, unknown>;
  const currentTheme = record.currentTheme;
  const themes = record.themes;
  if (
    typeof currentTheme !== "string" ||
    !themes || typeof themes !== "object" || Array.isArray(themes)
  ) {
    return null;
  }
  const selected = (themes as Record<string, unknown>)[currentTheme];
  if (!selected || typeof selected !== "object" || Array.isArray(selected)) {
    return null;
  }
  const selectedFiles = selected as Record<string, unknown>;
  const bundle = {
    ...Object.fromEntries(THEME_FILE_KEYS_V1.map((key) => [
      key,
      typeof selectedFiles[key] === "string"
        ? selectedFiles[key]
        : fallback.bundle[key],
    ])) as Record<ThemeFileKey, string>,
    assets: [],
  };
  const normalizedId = currentTheme.toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^[._-]+|[._-]+$/gu, "") || "custom";
  return {
    assetOwnerThemeId: null,
    bundle,
    checksumSha256: null,
    fallbackReason: null,
    kind: "legacy",
    manifest: themeManifestV1Schema.parse({
      ...fallback.manifest,
      assets: [],
      author: "Site owner",
      files: {
        rssStylesheet: fallback.manifest.files.rssStylesheet,
        webBodyEnd: fallback.manifest.files.webBodyEnd,
        webBodyStart: fallback.manifest.files.webBodyStart,
        webFeed: fallback.manifest.files.webFeed,
        webHeader: fallback.manifest.files.webHeader,
        webItem: fallback.manifest.files.webItem,
      },
      formatVersion: 1,
      microfeed: "*",
      name: `${currentTheme} (legacy)`,
      packageId: `legacy.${normalizedId}`.slice(0, 120),
      previewFixture: undefined,
      version: "0.0.0",
    }),
    previewFixture: null,
    themeId: null,
  };
}

function installedTheme(
  row: Record<string, unknown> | null | undefined,
): {reason: string | null; theme: EffectiveTheme | null} {
  if (!row) return {reason: null, theme: null};
  const requestedId = typeof row.requested_active_theme_id === "string"
    ? row.requested_active_theme_id
    : null;
  if (!row.id) {
    return {
      reason: requestedId
        ? `Active theme ${requestedId} is missing or deleted, so microfeed falls back.`
        : null,
      theme: null,
    };
  }
  try {
    const stored = storedThemeFromRow(row);
    const validated = validateStoredThemePackage(
      stored.manifest,
      stored.bundle,
      MICROFEED_VERSION,
    );
    return {
      reason: null,
      theme: {
        assetOwnerThemeId: stored.assetOwnerThemeId,
        bundle: validated.bundle,
        checksumSha256: stored.checksumSha256,
        fallbackReason: null,
        kind: "installed",
        manifest: validated.manifest,
        previewFixture: stored.previewFixture,
        themeId: stored.id,
      },
    };
  } catch (error) {
    return {
      reason: `Active theme ${requestedId ?? String(row.id)} is invalid or incompatible, so microfeed falls back: ${error instanceof Error ? error.message : String(error)}`,
      theme: null,
    };
  }
}

function parseCustomCodeRow(
  row: Record<string, unknown> | null | undefined,
): unknown {
  if (typeof row?.data !== "string") return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

async function effectiveTheme(target: Target): Promise<EffectiveTheme> {
  const fallback = await bundledFallbackTheme();
  let activeRow: Record<string, unknown> | null = null;
  let customCodeRow: Record<string, unknown> | null = null;
  if (target.local) {
    const local = await localResources(target);
    try {
      const tables = await local.database.prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table'
         AND name IN ('themes', 'theme_state')`,
      ).all<{name: string}>();
      if (new Set(tables.results.map(({name}) => name)).size === 2) {
        activeRow = await local.database.prepare(
          `SELECT themes.*,
             theme_state.active_theme_id AS requested_active_theme_id
           FROM theme_state
           LEFT JOIN themes ON themes.id = theme_state.active_theme_id
             AND themes.deleted_at IS NULL
           WHERE theme_state.id = 'current'
             AND theme_state.active_theme_id IS NOT NULL
           LIMIT 1`,
        ).first<Record<string, unknown>>();
      }
      customCodeRow = await local.database.prepare(
        "SELECT data FROM settings WHERE category = ? LIMIT 1",
      ).bind("customCode").first<Record<string, unknown>>();
    } finally {
      await local.close();
    }
  } else {
    const tables = await target.client.queryD1WithParameters(
      target.config,
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name IN ('themes', 'theme_state')`,
    );
    if (new Set(tables.map((row) => String(row.name))).size === 2) {
      activeRow = (await target.client.queryD1WithParameters(
        target.config,
        `SELECT themes.*,
           theme_state.active_theme_id AS requested_active_theme_id
         FROM theme_state
         LEFT JOIN themes ON themes.id = theme_state.active_theme_id
           AND themes.deleted_at IS NULL
         WHERE theme_state.id = 'current'
           AND theme_state.active_theme_id IS NOT NULL
         LIMIT 1`,
      ))[0] ?? null;
    }
    customCodeRow = (await target.client.queryD1WithParameters(
      target.config,
      "SELECT data FROM settings WHERE category = ? LIMIT 1",
      ["customCode"],
    ))[0] ?? null;
  }

  const resolved = installedTheme(activeRow);
  if (resolved.theme) return resolved.theme;
  const legacy = legacyTheme(parseCustomCodeRow(customCodeRow), fallback);
  if (legacy) return {...legacy, fallbackReason: resolved.reason};
  return {...fallback, fallbackReason: resolved.reason};
}

function normalizedPackageSegment(value: string): string {
  return value.toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "") || "theme";
}

export function initializedThemeManifest(
  source: EffectiveTheme,
  outputDirectory: string,
  overrides: {
    author?: string;
    name?: string;
    packageId?: string;
    version?: string;
  } = {},
): ThemeManifestV1 {
  const directoryName = path.basename(path.resolve(outputDirectory));
  const displayName = directoryName.replace(/[-_]+/gu, " ").trim() || "microfeed";
  const description = `Initialized from ${source.manifest.packageId}@${source.manifest.version} (${source.kind}).`;
  const packageId = overrides.packageId ??
    `${LOCAL_THEME_PACKAGE_ID_PREFIX}${normalizedPackageSegment(directoryName)}`
      .slice(0, 120).replace(/[._-]+$/u, "");
  assertUserThemePackageId(packageId);
  return themeManifestV1Schema.parse({
    $schema: ".microfeed/schemas/manifest.schema.json",
    assets: source.manifest.assets,
    author: overrides.author ?? "Site owner",
    description,
    files: source.manifest.formatVersion === 2
      ? CANONICAL_THEME_FILES_V2
      : CANONICAL_THEME_FILES_V1,
    formatVersion: source.manifest.formatVersion,
    license: source.manifest.license,
    microfeed: source.manifest.microfeed,
    name: overrides.name ?? `${displayName} theme`,
    packageId,
    ...(source.manifest.previewFixture
      ? {previewFixture: source.manifest.previewFixture}
      : {}),
    ...(source.manifest.formatVersion === 2 &&
        source.manifest.searchItemDestination
      ? {searchItemDestination: source.manifest.searchItemDestination}
      : {}),
    version: overrides.version ?? "0.1.0",
  });
}

export async function allowedGithubFetch(url: string): Promise<Response> {
  let current = new URL(url);
  const allowed = new Set(["api.github.com", "raw.githubusercontent.com"]);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    if (
      current.protocol !== "https:" || current.port !== "" ||
      !allowed.has(current.hostname)
    ) {
      throw new Error(`GitHub request redirected to a disallowed host: ${current.hostname}`);
    }
    const response = await fetch(current, {
      headers: {accept: "application/vnd.github+json", "user-agent": "microfeed-theme-manager"},
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("GitHub returned a redirect without a location.");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      const detail = (await response.text()).slice(0, 500);
      throw new Error(
        `GitHub request failed with HTTP ${response.status}` +
        (remaining === "0" ? " (unauthenticated rate limit exhausted)" : "") +
        (detail ? `: ${detail}` : "."),
      );
    }
    return response;
  }
  throw new Error("GitHub redirected the request too many times.");
}

async function limitedResponseBytes(
  response: Response,
  maximumBytes: number,
  displayPath: string,
): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error(
      `${displayPath} exceeds the ${maximumBytes}-byte download limit.`,
    );
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new Error(
          `${displayPath} exceeds the ${maximumBytes}-byte download limit.`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function decodeThemeText(bytes: Uint8Array, displayPath: string): string {
  try {
    return new TextDecoder("utf-8", {fatal: true}).decode(bytes);
  } catch {
    throw new Error(`Theme text file is not valid UTF-8: ${displayPath}`);
  }
}

export function parseGithubSource(
  source: string,
  requestedRef?: string,
  requestedPath?: string,
): {owner: string; path: string; ref: string; repo: string} {
  const url = new URL(source);
  if (
    url.protocol !== "https:" || url.hostname !== "github.com" ||
    url.port !== ""
  ) {
    throw new Error("V1 accepts public https://github.com repository, directory, or manifest URLs.");
  }
  const segments = url.pathname.split("/").filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      throw new Error("GitHub URL contains invalid path encoding.");
    }
  });
  if (segments.length < 2) throw new Error("GitHub URL must include an owner and repository.");
  const owner = segments[0]!;
  const repo = segments[1]!.replace(/\.git$/u, "");
  let ref = requestedRef ?? "HEAD";
  let directory = requestedPath ?? "";
  if (!requestedPath && (segments[2] === "tree" || segments[2] === "blob")) {
    ref = requestedRef ?? segments[3] ?? "HEAD";
    const linkedPath = segments.slice(4).join("/");
    directory = segments[2] === "blob" ? path.posix.dirname(linkedPath) : linkedPath;
    if (directory === ".") directory = "";
  }
  directory = directory.replace(/^\/+|\/+$/gu, "");
  if (
    directory.includes("\\") ||
    directory.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new Error("GitHub theme directory traversal is not allowed.");
  }
  return {owner, path: directory, ref, repo};
}

async function githubThemeSource(
  sourceUrl: string,
  requestedRef?: string,
  requestedPath?: string,
): Promise<ResolvedThemeSource> {
  const github = parseGithubSource(sourceUrl, requestedRef, requestedPath);
  const commitResponse = await allowedGithubFetch(
    `https://api.github.com/repos/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}/commits/${encodeURIComponent(github.ref)}`,
  );
  const commitData = await commitResponse.json() as {sha?: unknown};
  if (typeof commitData.sha !== "string" || !/^[a-f0-9]{40}$/u.test(commitData.sha)) {
    throw new Error("GitHub returned an invalid commit.");
  }
  const commit = commitData.sha;
  const rawUrl = (relativePath: string) =>
    `https://raw.githubusercontent.com/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}/${commit}/` +
    [github.path, relativePath].filter(Boolean).map((part) => part.split("/").map(encodeURIComponent).join("/")).join("/");
  const manifestText = decodeThemeText(
    await limitedResponseBytes(
      await allowedGithubFetch(rawUrl("microfeed-theme.json")),
      THEME_MAX_TEMPLATE_BYTES,
      "microfeed-theme.json",
    ),
    "microfeed-theme.json",
  );
  const manifest = themeManifestV1Schema.parse(JSON.parse(manifestText));
  const treeResponse = await allowedGithubFetch(
    `https://api.github.com/repos/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}/git/trees/${commit}?recursive=1`,
  );
  const treeData = await treeResponse.json() as {
    tree?: Array<{mode?: unknown; path?: unknown; type?: unknown}>;
    truncated?: unknown;
  };
  if (treeData.truncated === true || !Array.isArray(treeData.tree)) {
    throw new Error("GitHub could not return a complete repository tree for symlink validation.");
  }
  const tree = new Map(treeData.tree.flatMap((entry) =>
    typeof entry.path === "string" ? [[entry.path, entry]] : []
  ));
  for (const relativePath of [
    "microfeed-theme.json",
    ...Object.values(manifest.files),
    ...manifest.assets,
  ]) {
    const repositoryPath = [github.path, relativePath].filter(Boolean).join("/");
    const entry = tree.get(repositoryPath);
    if (!entry || entry.type !== "blob") {
      throw new Error(`GitHub theme file is missing or not a regular file: ${relativePath}`);
    }
    if (entry.mode === "120000") {
      throw new Error(`GitHub theme symlinks are not allowed: ${relativePath}`);
    }
  }
  const temporary = await mkdtemp(path.join(tmpdir(), "microfeed-theme-github-"));
  try {
    const files = new Map<string, Uint8Array>();
    files.set("microfeed-theme.json", new TextEncoder().encode(manifestText));
    let totalAssetBytes = 0;
    for (const relativePath of [...Object.values(manifest.files), ...manifest.assets]) {
      const response = await allowedGithubFetch(rawUrl(relativePath));
      const isAsset = manifest.assets.includes(relativePath);
      const bytes = await limitedResponseBytes(
        response,
        isAsset ? THEME_MAX_ASSET_BYTES : THEME_MAX_TEMPLATE_BYTES,
        relativePath,
      );
      if (isAsset) {
        totalAssetBytes += bytes.byteLength;
        if (totalAssetBytes > THEME_MAX_TOTAL_ASSET_BYTES) {
          throw new Error(
            `Theme assets exceed the ${THEME_MAX_TOTAL_ASSET_BYTES}-byte total limit.`,
          );
        }
      } else {
        decodeThemeText(bytes, relativePath);
      }
      files.set(relativePath, bytes);
    }
    for (const [relativePath, bytes] of files) {
      const filename = path.join(temporary, ...relativePath.split("/"));
      await mkdir(path.dirname(filename), {recursive: true});
      await writeFile(filename, bytes);
    }
    return {
      loaded: await loadThemePackage(temporary),
      source: {
        commit,
        kind: "github",
        path: github.path || null,
        ref: github.ref,
        url: sourceUrl,
      },
    };
  } finally {
    await rm(temporary, {force: true, recursive: true});
  }
}

async function resolveThemeSource(
  source: string,
  flags: Flags,
): Promise<ResolvedThemeSource> {
  const bundled = bundledThemeCatalogEntryBySource(source);
  if (bundled) {
    return {
      loaded: await loadThemePackage(
        path.join(repositoryRoot, "themes", bundled.directory),
      ),
      source: {
        commit: null,
        kind: "bundled",
        path: bundled.source,
        ref: null,
        url: null,
      },
    };
  }
  if (source.startsWith("bundled:")) {
    throw new Error(`Unknown Built-in theme source: ${source}`);
  }
  if (/^https?:\/\//iu.test(source)) {
    return githubThemeSource(source, flagString(flags, "ref"), flagString(flags, "path"));
  }
  const directory = path.resolve(source);
  return {
    loaded: await loadThemePackage(directory),
    source: {commit: null, kind: "local-directory", path: directory, ref: null, url: null},
  };
}

export function themeUpdateSource(
  theme: Pick<
    StoredThemeVersion,
    "packageId" | "sourceKind" | "sourcePath" | "sourceUrl"
  >,
): string | null {
  if (theme.sourceKind === "bundled") {
    return canonicalBundledThemeSource(theme.packageId) ?? theme.sourcePath;
  }
  return theme.sourceUrl ?? theme.sourcePath;
}

function bundleForOwner(
  loaded: LoadedThemePackage,
  environment: string,
  ownerId: string,
): ThemeBundleV1 {
  return {
    ...loaded.bundle,
    assets: loaded.bundle.assets.map((asset) => ({
      ...asset,
      key: assetKey(environment, ownerId, asset.path),
    })),
  };
}

async function localResources(target: Target): Promise<{
  bucket: R2Bucket;
  close: () => Promise<void>;
  database: D1Database;
}> {
  const identifier = target.config.d1.id || target.config.d1.name;
  const miniflare = new Miniflare({
    d1Databases: {FEED_DB: identifier},
    defaultPersistRoot: path.join(localPersistencePath(target.config), "v3"),
    modules: true,
    r2Buckets: {MEDIA_BUCKET: target.config.r2.name},
    script: "export default {fetch(){return new Response('ok')}}",
  });
  const database = await miniflare.getD1Database("FEED_DB");
  const bucket = await miniflare.getR2Bucket("MEDIA_BUCKET") as unknown as R2Bucket;
  return {bucket, close: () => miniflare.dispose(), database};
}

const THEME_SUMMARY_SELECT = `SELECT id, package_id, version, name,
  manifest_json, source_kind, source_url, source_ref, source_path,
  source_commit, checksum_sha256, origin_theme_id, asset_owner_theme_id,
  created_at, deleted_at,
  COALESCE(json_array_length(json_extract(manifest_json, '$.assets')), 0)
    AS asset_count
  FROM themes WHERE deleted_at IS NULL
  ORDER BY package_id ASC, created_at DESC`;

async function localThemeSummaries(
  database: D1Database,
): Promise<ThemeVersionSummary[]> {
  const result = await database.prepare(THEME_SUMMARY_SELECT)
    .all<Record<string, unknown>>();
  return result.results.map(storedThemeSummaryFromRow);
}

async function localState(database: D1Database): Promise<ThemeState> {
  return themeStateFromRow(await database.prepare(
    "SELECT * FROM theme_state WHERE id = 'current' LIMIT 1",
  ).first<Record<string, unknown>>());
}

async function themeSummaries(target: Target): Promise<ThemeVersionSummary[]> {
  if (target.local) {
    const local = await localResources(target);
    try {
      return await localThemeSummaries(local.database);
    } finally {
      await local.close();
    }
  }
  const rows = await target.client.queryD1WithParameters(
    target.config,
    THEME_SUMMARY_SELECT,
  );
  return rows.map(storedThemeSummaryFromRow);
}

async function currentThemeState(target: Target): Promise<ThemeState> {
  if (target.local) {
    const local = await localResources(target);
    try {
      return await localState(local.database);
    } finally {
      await local.close();
    }
  }
  return themeStateFromRow((await target.client.queryD1WithParameters(
    target.config,
    "SELECT * FROM theme_state WHERE id = 'current' LIMIT 1",
  ))[0] ?? null);
}

async function themeById(
  target: Target,
  id: string,
  includeDeleted = false,
): Promise<StoredThemeVersion | null> {
  const sql = `SELECT * FROM themes WHERE id = ?
    ${includeDeleted ? "" : "AND deleted_at IS NULL"} LIMIT 1`;
  if (!target.local) {
    const [row] = await target.client.queryD1WithParameters(
      target.config,
      sql,
      [id],
    );
    return row ? storedThemeFromRow(row) : null;
  }
  const local = await localResources(target);
  try {
    const row = await local.database.prepare(sql).bind(id)
      .first<Record<string, unknown>>();
    return row ? storedThemeFromRow(row) : null;
  } finally {
    await local.close();
  }
}

async function installRemote(
  target: Target,
  resolved: ResolvedThemeSource,
): Promise<StoredThemeVersion> {
  const id = randomUUID();
  const bundle = bundleForOwner(
    resolved.loaded,
    environmentPrefix(target.config, false),
    id,
  );
  const validated = validateThemePackage(
    resolved.loaded.manifest,
    bundle,
    MICROFEED_VERSION,
  );
  const checksum = await sha256Hex(canonicalThemePackage(
    validated.manifest,
    validated.bundle,
    resolved.loaded.previewFixture,
  ));
  const [existing] = await target.client.queryD1WithParameters(
    target.config,
    "SELECT * FROM themes WHERE package_id = ? AND version = ? LIMIT 1",
    [validated.manifest.packageId, validated.manifest.version],
  );
  if (existing) {
    const theme = storedThemeFromRow(existing);
    if (theme.checksumSha256 !== checksum) {
      throw new Error(`${theme.packageId}@${theme.version} already exists with different content; increment the package version.`);
    }
    if (
      resolved.source.kind === "bundled" &&
      theme.sourceKind !== "bundled"
    ) {
      throw new Error(
        `${theme.packageId}@${theme.version} already exists without Built-in source metadata.`,
      );
    }
    if (theme.deletedAt) {
      if (
        resolved.source.kind === "bundled" &&
        theme.sourceKind === "bundled" &&
        bundle.assets.length === 0
      ) {
        const restored = await target.client.queryD1WithParameters(
          target.config,
          `UPDATE themes SET deleted_at = NULL, assets_deleted_at = NULL,
           asset_cleanup_error = NULL, source_path = ?
           WHERE id = ? AND deleted_at IS NOT NULL
             AND package_id = ? AND version = ?
             AND source_kind = 'bundled' AND checksum_sha256 = ?
           RETURNING id`,
          [
            resolved.source.path,
            theme.id,
            validated.manifest.packageId,
            validated.manifest.version,
            checksum,
          ],
        );
        if (restored.length === 0) {
          throw new Error(
            "The Built-in theme tombstone changed before it could be restored.",
          );
        }
        return {...theme, deletedAt: null, sourcePath: resolved.source.path};
      }
      throw new Error(`${theme.packageId}@${theme.version} was deleted; increment the package version before reinstalling it.`);
    }
    if (
      resolved.source.kind === "bundled" &&
      theme.sourcePath !== resolved.source.path
    ) {
      await target.client.queryD1WithParameters(
        target.config,
        "UPDATE themes SET source_path = ? WHERE id = ?",
        [resolved.source.path, theme.id],
      );
      return {...theme, sourcePath: resolved.source.path};
    }
    return theme;
  }
  if (bundle.assets.length > 0 && !isR2Ready(target.config)) {
    throw new Error("This theme declares assets, but R2 media storage is not ready for the selected instance.");
  }
  const accountId = cloudflareAccountId(target.config);
  const uploaded: string[] = [];
  try {
    for (const asset of resolved.loaded.assetFiles) {
      const metadata = bundle.assets.find((entry) => entry.path === asset.path)!;
      await target.client.putR2Object(accountId, target.config.r2.name, metadata.key, asset.bytes, asset.contentType);
      uploaded.push(metadata.key);
      const object = await target.client.r2ObjectResponse(
        accountId,
        target.config.r2.name,
        metadata.key,
      );
      const objectBytes = new Uint8Array(await object.arrayBuffer());
      if (objectBytes.byteLength !== asset.bytes.byteLength) {
        throw new Error(`R2 verification failed for ${asset.path}.`);
      }
      const digest = createHash("sha256")
        .update(objectBytes)
        .digest("hex");
      if (digest !== asset.sha256) {
        throw new Error(`R2 checksum verification failed for ${asset.path}.`);
      }
    }
    const inserted = await target.client.queryD1WithParameters(
      target.config,
      `INSERT INTO themes (
        id, package_id, version, name, manifest_json, bundle_json,
        preview_fixture_json, source_kind, source_url, source_ref, source_path, source_commit,
        checksum_sha256, origin_theme_id, asset_owner_theme_id
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE ? = 'bundled' OR (
          SELECT count(*) FROM themes
          WHERE deleted_at IS NULL AND source_kind != 'bundled'
        ) < ?
      RETURNING id`,
      [
        id,
        validated.manifest.packageId,
        validated.manifest.version,
        validated.manifest.name,
        JSON.stringify(validated.manifest),
        JSON.stringify(validated.bundle),
        resolved.loaded.previewFixture
          ? JSON.stringify(resolved.loaded.previewFixture)
          : null,
        resolved.source.kind,
        resolved.source.url,
        resolved.source.ref,
        resolved.source.path,
        resolved.source.commit,
        checksum,
        null,
        bundle.assets.length > 0 ? id : null,
        resolved.source.kind,
        THEME_MAX_CUSTOM_INSTALLED_VERSIONS,
      ],
    );
    if (inserted.length === 0) {
      throw new Error(
        `This environment already has ${THEME_MAX_CUSTOM_INSTALLED_VERSIONS} Custom theme versions. Delete an inactive Custom version before installing another.`,
      );
    }
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) =>
      target.client.deleteR2Object(accountId, target.config.r2.name, key)
    ));
    throw error;
  }
  const [row] = await target.client.queryD1WithParameters(
    target.config,
    "SELECT * FROM themes WHERE id = ? LIMIT 1",
    [id],
  );
  if (!row) throw new Error("The installed theme could not be read back from D1.");
  return storedThemeFromRow(row);
}

async function installLocal(
  target: Target,
  resolved: ResolvedThemeSource,
): Promise<StoredThemeVersion> {
  const local = await localResources(target);
  try {
    const id = randomUUID();
    const bundle = bundleForOwner(
      resolved.loaded,
      environmentPrefix(target.config, true),
      id,
    );
    const validated = validateThemePackage(resolved.loaded.manifest, bundle, MICROFEED_VERSION);
    const checksum = await sha256Hex(canonicalThemePackage(
      validated.manifest,
      validated.bundle,
      resolved.loaded.previewFixture,
    ));
    const existingRow = await local.database.prepare(
      "SELECT * FROM themes WHERE package_id = ? AND version = ? LIMIT 1",
    ).bind(validated.manifest.packageId, validated.manifest.version)
      .first<Record<string, unknown>>();
    if (existingRow) {
      const existing = storedThemeFromRow(existingRow);
      if (existing.checksumSha256 !== checksum) {
        throw new Error(`${existing.packageId}@${existing.version} already exists with different content; increment the package version.`);
      }
      if (
        resolved.source.kind === "bundled" &&
        existing.sourceKind !== "bundled"
      ) {
        throw new Error(
          `${existing.packageId}@${existing.version} already exists without Built-in source metadata.`,
        );
      }
      if (existing.deletedAt) {
        if (
          resolved.source.kind === "bundled" &&
          existing.sourceKind === "bundled" &&
          bundle.assets.length === 0
        ) {
          const restored = await local.database.prepare(
            `UPDATE themes SET deleted_at = NULL, assets_deleted_at = NULL,
             asset_cleanup_error = NULL, source_path = ?
             WHERE id = ? AND deleted_at IS NOT NULL
               AND package_id = ? AND version = ?
               AND source_kind = 'bundled' AND checksum_sha256 = ?
             RETURNING id`,
          ).bind(
            resolved.source.path,
            existing.id,
            validated.manifest.packageId,
            validated.manifest.version,
            checksum,
          ).first<{id: string}>();
          if (!restored) {
            throw new Error(
              "The Built-in theme tombstone changed before it could be restored.",
            );
          }
          return {
            ...existing,
            deletedAt: null,
            sourcePath: resolved.source.path,
          };
        }
        throw new Error(`${existing.packageId}@${existing.version} was deleted; increment the package version before reinstalling it.`);
      }
      if (
        resolved.source.kind === "bundled" &&
        existing.sourcePath !== resolved.source.path
      ) {
        await local.database.prepare(
          "UPDATE themes SET source_path = ? WHERE id = ?",
        ).bind(resolved.source.path, existing.id).run();
        return {...existing, sourcePath: resolved.source.path};
      }
      return existing;
    }
    if (bundle.assets.length > 0 && !isR2Ready(target.config)) {
      throw new Error("This theme declares assets, but R2 media storage is not ready for the selected instance.");
    }
    const uploaded: string[] = [];
    try {
      for (const asset of resolved.loaded.assetFiles) {
        const metadata = bundle.assets.find((entry) => entry.path === asset.path)!;
        await local.bucket.put(metadata.key, asset.bytes, {httpMetadata: {contentType: asset.contentType}});
        uploaded.push(metadata.key);
        const head = await local.bucket.head(metadata.key);
        if (!head || head.size !== asset.bytes.byteLength) throw new Error(`R2 verification failed for ${asset.path}.`);
        const object = await local.bucket.get(metadata.key);
        const digest = object
          ? createHash("sha256").update(
              new Uint8Array(await object.arrayBuffer()),
            ).digest("hex")
          : "";
        if (digest !== asset.sha256) {
          throw new Error(`R2 checksum verification failed for ${asset.path}.`);
        }
      }
      const inserted = await local.database.prepare(
        `INSERT INTO themes (
          id, package_id, version, name, manifest_json, bundle_json,
          preview_fixture_json, source_kind, source_url, source_ref, source_path, source_commit,
          checksum_sha256, origin_theme_id, asset_owner_theme_id
        ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE ? = 'bundled' OR (
            SELECT count(*) FROM themes
            WHERE deleted_at IS NULL AND source_kind != 'bundled'
          ) < ?
        RETURNING id`,
      ).bind(
        id,
        validated.manifest.packageId,
        validated.manifest.version,
        validated.manifest.name,
        JSON.stringify(validated.manifest),
        JSON.stringify(validated.bundle),
        resolved.loaded.previewFixture
          ? JSON.stringify(resolved.loaded.previewFixture)
          : null,
        resolved.source.kind,
        resolved.source.url,
        resolved.source.ref,
        resolved.source.path,
        resolved.source.commit,
        checksum,
        null,
        bundle.assets.length > 0 ? id : null,
        resolved.source.kind,
        THEME_MAX_CUSTOM_INSTALLED_VERSIONS,
      ).first<{id: string}>();
      if (!inserted) {
        throw new Error(
          `This environment already has ${THEME_MAX_CUSTOM_INSTALLED_VERSIONS} Custom theme versions. Delete an inactive Custom version before installing another.`,
        );
      }
      const row = await local.database.prepare(
        "SELECT * FROM themes WHERE id = ? LIMIT 1",
      ).bind(id).first<Record<string, unknown>>();
      if (!row) throw new Error("The installed theme could not be read back from local D1.");
      return storedThemeFromRow(row);
    } catch (error) {
      if (uploaded.length > 0) await local.bucket.delete(uploaded);
      throw error;
    }
  } finally {
    await local.close();
  }
}

async function pruneInstalledBundledThemeVersions(
  target: Target,
  installed: StoredThemeVersion,
): Promise<void> {
  if (target.local) {
    const local = await localResources(target);
    try {
      await pruneSupersededBundledThemeVersions({
        deleteAssets: async (keys) => {
          if (keys.length > 0) await local.bucket.delete(keys);
        },
        query: async (sql, parameters = []) => {
          const result = await local.database.prepare(sql)
            .bind(...parameters)
            .all<Record<string, unknown>>();
          return result.results;
        },
      }, installed.packageId, installed.version);
    } finally {
      await local.close();
    }
    return;
  }

  await pruneSupersededBundledThemeVersions({
    deleteAssets: async (keys) => {
      if (keys.length === 0) return;
      if (!isR2Ready(target.config)) {
        throw new Error(
          "R2 media storage is unavailable for bundled theme asset cleanup.",
        );
      }
      const accountId = cloudflareAccountId(target.config);
      await Promise.all(keys.map((key) => target.client.deleteR2Object(
        accountId,
        target.config.r2.name,
        key,
      )));
    },
    query: (sql, parameters = []) => target.client.queryD1WithParameters(
      target.config,
      sql,
      parameters,
    ),
  }, installed.packageId, installed.version);
}

async function installResolved(target: Target, resolved: ResolvedThemeSource) {
  if (resolved.source.kind === "bundled") {
    const catalog = bundledThemeCatalogEntryBySource(
      resolved.source.path ?? "",
    );
    if (
      !catalog ||
      !isReservedThemePackageId(resolved.loaded.manifest.packageId) ||
      catalog.manifest.packageId !== resolved.loaded.manifest.packageId ||
      catalog.manifest.version !== resolved.loaded.manifest.version
    ) {
      throw new Error(
        "Built-in theme package metadata does not match the catalog registry.",
      );
    }
  } else {
    assertUserThemePackageId(resolved.loaded.manifest.packageId);
  }
  const installed = target.local
    ? await installLocal(target, resolved)
    : await installRemote(target, resolved);
  if (resolved.source.kind === "bundled") {
    await pruneInstalledBundledThemeVersions(target, installed);
  }
  return installed;
}

async function initializationThemeState(target: Target): Promise<ThemeState> {
  if (target.local) {
    const local = await localResources(target);
    try { return await localState(local.database); } finally { await local.close(); }
  }
  const [row] = await target.client.queryD1WithParameters(
    target.config,
    "SELECT * FROM theme_state WHERE id = 'current' LIMIT 1",
  );
  return themeStateFromRow(row ?? null);
}

async function activateInitializationTheme(
  target: Target,
  themeId: string,
): Promise<void> {
  const sql = `UPDATE theme_state SET active_theme_id = ?,
    previous_theme_id = NULL,
    legacy_migrated_at = COALESCE(legacy_migrated_at, CURRENT_TIMESTAMP),
    appearance_preserved_at = COALESCE(appearance_preserved_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = 'current' AND (active_theme_id IS NULL OR active_theme_id = ?)
    RETURNING active_theme_id`;
  if (target.local) {
    const local = await localResources(target);
    try {
      const updated = await local.database.prepare(sql).bind(themeId, themeId)
        .first<{active_theme_id: string}>();
      if (!updated) throw new Error("Another theme became active during initialization.");
    } finally {
      await local.close();
    }
    return;
  }
  const updated = await target.client.queryD1WithParameters(
    target.config,
    sql,
    [themeId, themeId],
  );
  if (updated.length === 0) {
    throw new Error("Another theme became active during initialization.");
  }
}

async function assertPristineThemeInitializationTarget(
  target: Target,
): Promise<void> {
  const allowedBuiltIn = BUNDLED_THEME_CATALOG.map(
    () => "(source_kind = 'bundled' AND package_id = ? AND version = ?)",
  ).join(" OR ");
  const sql = `SELECT
    (SELECT count(*) FROM channels) AS channels,
    (SELECT count(*) FROM settings) AS settings,
    (SELECT count(*) FROM items) AS items,
    (SELECT count(*) FROM theme_drafts) AS drafts,
    (SELECT count(*) FROM themes
      WHERE NOT (${allowedBuiltIn})) AS other_themes`;
  const parameters = BUNDLED_THEME_CATALOG.flatMap(({manifest}) => [
    manifest.packageId,
    manifest.version,
  ]);
  let row: Record<string, unknown> | null;
  if (target.local) {
    const local = await localResources(target);
    try {
      row = await local.database.prepare(sql).bind(...parameters)
        .first<Record<string, unknown>>();
    } finally {
      await local.close();
    }
  } else {
    row = (await target.client.queryD1WithParameters(
      target.config,
      sql,
      parameters,
    ))[0] ?? null;
  }
  const dirty = ["channels", "settings", "items", "drafts", "other_themes"]
    .some((field) => Number(row?.[field] ?? 0) !== 0);
  if (dirty) {
    throw new Error(
      "The database contains application data and is not a pristine or partially completed Built-in-theme installation target.",
    );
  }
}

async function installBundledCatalog(
  target: Target,
): Promise<StoredThemeVersion[]> {
  const installed: StoredThemeVersion[] = [];
  for (const entry of BUNDLED_THEME_CATALOG) {
    installed.push(await installResolved(
      target,
      await resolveThemeSource(entry.source, {}),
    ));
  }
  return installed;
}

export async function synchronizeBundledThemes(
  config: MicrofeedConfig,
  runner: CommandRunner = runCommand,
  local = isLocalOnly(config),
): Promise<StoredThemeVersion[]> {
  return installBundledCatalog({
    client: new CloudflareClient(runner),
    config,
    local,
  });
}

export async function installBundledThemesForInitialization(
  config: MicrofeedConfig,
  runner: CommandRunner = runCommand,
  local = isLocalOnly(config),
): Promise<StoredThemeVersion> {
  const target: Target = {
    client: new CloudflareClient(runner),
    config,
    local,
  };
  const state = await initializationThemeState(target);
  if (state.activeThemeId) {
    const active = await themeById(target, state.activeThemeId);
    if (
      active?.packageId !== BUNDLED_FALLBACK_THEME.manifest.packageId ||
      active.version !== BUNDLED_FALLBACK_THEME.manifest.version
    ) {
      throw new Error(
        "The database already has an active theme and is not a pristine Built-in-theme initialization target.",
      );
    }
  } else {
    await assertPristineThemeInitializationTarget(target);
  }
  const installed = await installBundledCatalog(target);
  const fallback = installed.find(
    ({packageId}) => packageId === BUNDLED_FALLBACK_THEME.manifest.packageId,
  );
  if (!fallback) throw new Error("The Built-in fallback theme was not installed.");
  if (!state.activeThemeId) {
    await activateInitializationTheme(target, fallback.id);
  }
  return fallback;
}

async function managementAction(
  target: Target,
  action: "activate" | "deactivate" | "rollback" | "delete",
  themeId?: string,
): Promise<unknown> {
  if (target.local) {
    const local = await localResources(target);
    try {
      if (action === "activate") {
        const row = await local.database.prepare(
          "SELECT * FROM themes WHERE id = ? AND deleted_at IS NULL LIMIT 1",
        ).bind(themeId ?? "").first<Record<string, unknown>>();
        if (!row) throw new Error("Theme version not found.");
        const theme = storedThemeFromRow(row);
        validateStoredThemePackage(
          theme.manifest,
          theme.bundle,
          MICROFEED_VERSION,
        );
        const updated = await local.database.prepare(
          `UPDATE theme_state SET previous_theme_id = active_theme_id,
           active_theme_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = 'current' AND (active_theme_id IS NULL OR active_theme_id != ?)
             AND EXISTS (
               SELECT 1 FROM themes WHERE id = ? AND deleted_at IS NULL
             )
           RETURNING active_theme_id`,
        ).bind(theme.id, theme.id, theme.id)
          .first<{active_theme_id: string}>();
        if (!updated) {
          const state = await localState(local.database);
          if (state.activeThemeId === theme.id) return state;
          throw new Error("Theme version became unavailable before activation.");
        }
        return await localState(local.database);
      }
      if (action === "deactivate") {
        await local.database.prepare(
          `UPDATE theme_state SET previous_theme_id = active_theme_id,
           active_theme_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 'current'`,
        ).run();
        return await localState(local.database);
      }
      if (action === "rollback") {
        const state = await localState(local.database);
        if (state.previousThemeId) {
          const previous = await local.database.prepare(
            "SELECT * FROM themes WHERE id = ? AND deleted_at IS NULL LIMIT 1",
          ).bind(state.previousThemeId).first();
          if (!previous) throw new Error("The previous theme is unavailable.");
          const theme = storedThemeFromRow(previous as Record<string, unknown>);
          validateStoredThemePackage(
            theme.manifest,
            theme.bundle,
            MICROFEED_VERSION,
          );
        }
        const updated = await local.database.prepare(
          `UPDATE theme_state SET active_theme_id = previous_theme_id,
           previous_theme_id = active_theme_id, updated_at = CURRENT_TIMESTAMP
           WHERE id = 'current' AND (
             previous_theme_id IS NULL OR EXISTS (
               SELECT 1 FROM themes
               WHERE id = theme_state.previous_theme_id AND deleted_at IS NULL
             )
           )
           RETURNING active_theme_id`,
        ).first<{active_theme_id: string | null}>();
        if (!updated) {
          throw new Error("The previous theme became unavailable before rollback.");
        }
        return await localState(local.database);
      }
      await deleteLocalTheme(local.database, local.bucket, themeId ?? "");
      return {};
    } finally { await local.close(); }
  }
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await target.client.queryD1WithParameters(
    target.config,
    "INSERT INTO theme_management_tokens (token_hash, action, theme_id, expires_at_ms) VALUES (?, ?, ?, ?)",
    [tokenHash, action, themeId ?? null, Date.now() + 5 * 60 * 1000],
  );
  const baseUrl = target.config.customDomain
    ? `https://${target.config.customDomain}`
    : target.config.deploymentUrl;
  if (!baseUrl) throw new Error("The selected instance has no deployment URL.");
  try {
    const response = await fetch(new URL("/.well-known/microfeed/theme-management/", baseUrl), {
      headers: {authorization: `Bearer ${token}`},
      method: "POST",
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : `Theme management endpoint failed with HTTP ${response.status}.`);
    return body;
  } finally {
    await target.client.queryD1WithParameters(
      target.config,
      "DELETE FROM theme_management_tokens WHERE token_hash = ?",
      [tokenHash],
    ).catch(() => undefined);
  }
}

async function deleteLocalTheme(
  database: D1Database,
  bucket: R2Bucket,
  id: string,
): Promise<void> {
  const row = await database.prepare(
    "SELECT * FROM themes WHERE id = ? LIMIT 1",
  ).bind(id).first<Record<string, unknown>>();
  if (!row) throw new Error("Theme version not found.");
  const theme = storedThemeFromRow(row);
  if (theme.sourceKind === "bundled") {
    throw new Error(
      "Built-in themes are managed by microfeed deployment and cannot be deleted manually.",
    );
  }
  const state = await localState(database);
  if (state.activeThemeId === id) {
    throw new Error("Deactivate or replace the active theme before deleting it.");
  }
  if (!theme.deletedAt) {
    const deleted = await database.prepare(
      `UPDATE themes SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = ? AND deleted_at IS NULL AND NOT EXISTS (
         SELECT 1 FROM theme_state
         WHERE id = 'current' AND active_theme_id = ?
       )
       RETURNING id`,
    ).bind(id, id).first<{id: string}>();
    if (!deleted) {
      throw new Error(
        "The theme became active before it could be deleted. Deactivate or replace it first.",
      );
    }
  }
  await database.prepare(
    `UPDATE theme_state SET previous_theme_id = NULL,
     updated_at = CURRENT_TIMESTAMP WHERE id = 'current' AND previous_theme_id = ?`,
  ).bind(id).run();
  const ownerId = theme.assetOwnerThemeId;
  if (!ownerId) return;
  const references = await database.prepare(
    `SELECT (
      SELECT count(*) FROM themes WHERE deleted_at IS NULL AND asset_owner_theme_id = ?
    ) + (
      SELECT count(*) FROM theme_drafts WHERE asset_owner_theme_id = ?
    ) AS count`,
  ).bind(ownerId, ownerId).first<{count: number}>();
  if ((references?.count ?? 0) > 0) return;
  const ownerRow = await database.prepare(
    "SELECT * FROM themes WHERE id = ? LIMIT 1",
  ).bind(ownerId).first<Record<string, unknown>>();
  if (!ownerRow) return;
  const owner = storedThemeFromRow(ownerRow);
  if (owner.bundle.assets.length === 0) return;
  try {
    await bucket.delete(owner.bundle.assets.map((asset) => asset.key));
    await database.prepare(
      `UPDATE themes SET assets_deleted_at = CURRENT_TIMESTAMP,
       asset_cleanup_error = NULL WHERE id = ?`,
    ).bind(ownerId).run();
  } catch (error) {
    await database.prepare(
      "UPDATE themes SET asset_cleanup_error = ? WHERE id = ?",
    ).bind(error instanceof Error ? error.message : String(error), ownerId).run();
    throw error;
  }
}

function withFinalNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

async function initializeGitRepository(
  output: string,
  runner: CommandRunner,
): Promise<void> {
  await runner("git", ["init", "--initial-branch", "main"], {cwd: output});
}

async function writeThemePackage(
  target: Target,
  theme: ThemePackageFiles,
  outputDirectory: string,
  options: WriteThemePackageOptions = {},
): Promise<string> {
  const output = path.resolve(outputDirectory);
  const outputExists = await readdir(output).then(
    (entries) => {
      if (entries.length > 0) {
        throw new Error(`Refusing to export into non-empty directory ${output}.`);
      }
      return true;
    },
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return false;
      throw error;
    },
  );
  const parent = path.dirname(output);
  await mkdir(parent, {recursive: true});
  const staging = await mkdtemp(path.join(parent, `.${path.basename(output)}.tmp-`));
  const writtenPaths = new Set<string>();
  const writeRelative = async (relativePath: string, value: string | Uint8Array) => {
    const filename = path.resolve(staging, relativePath);
    const resolvedRelative = path.relative(staging, filename);
    if (
      !resolvedRelative || resolvedRelative.startsWith("..") ||
      path.isAbsolute(resolvedRelative)
    ) {
      throw new Error(`Unsafe export path ${relativePath}.`);
    }
    if (writtenPaths.has(resolvedRelative)) {
      throw new Error(`Theme package paths conflict at ${relativePath}.`);
    }
    writtenPaths.add(resolvedRelative);
    await mkdir(path.dirname(filename), {recursive: true});
    await writeFile(filename, value);
  };
  try {
    await writeRelative("microfeed-theme.json", `${JSON.stringify(theme.manifest, null, 2)}\n`);
    for (const [key, relativePath] of Object.entries(theme.manifest.files)) {
      await writeRelative(
        relativePath,
        withFinalNewline(theme.bundle[key as keyof typeof theme.manifest.files]),
      );
    }
    if (theme.manifest.previewFixture) {
      if (!theme.previewFixture) {
        throw new Error(
          `The declared preview fixture is missing: ${theme.manifest.previewFixture}`,
        );
      }
      await writeRelative(
        theme.manifest.previewFixture,
        `${JSON.stringify(theme.previewFixture, null, 2)}\n`,
      );
    } else if (theme.previewFixture) {
      throw new Error(
        "The stored preview fixture has no manifest.previewFixture path.",
      );
    }
    if (theme.bundle.assets.length > 0) {
      if (target.local) {
        const local = await localResources(target);
        try {
          for (const asset of theme.bundle.assets) {
            const object = await local.bucket.get(asset.key);
            if (!object) throw new Error(`Theme asset is missing: ${asset.path}`);
            await writeRelative(asset.path, new Uint8Array(await object.arrayBuffer()));
          }
        } finally { await local.close(); }
      } else {
        const accountId = cloudflareAccountId(target.config);
        for (const asset of theme.bundle.assets) {
          const response = await target.client.r2ObjectResponse(accountId, target.config.r2.name, asset.key);
          await writeRelative(asset.path, new Uint8Array(await response.arrayBuffer()));
        }
      }
    }
    await writeRelative("THEME.md", options.readme ?? generatedThemeReadme());
    await writeRelative(".microfeed/schemas/manifest.schema.json", `${JSON.stringify(z.toJSONSchema(themeManifestV1Schema), null, 2)}\n`);
    await writeRelative(".microfeed/schemas/theme-context.schema.json", `${JSON.stringify(z.toJSONSchema(themeContextSchema), null, 2)}\n`);
    if (options.repositoryScaffold) {
      await writeRelative("README.md", options.repositoryScaffold.readme);
      await writeRelative(".gitignore", ".yarn/\nnode_modules/\n");
      await writeRelative(".yarnrc.yml", `nodeLinker: node-modules\nnpmPreapprovedPackages:\n  - "@microfeed/theme-kit"\n`);
      await writeRelative("yarn.lock", "");
      await writeRelative("package.json", `${JSON.stringify({
        devDependencies: {
          "@microfeed/theme-kit": themeKitCompatibilityRange(MICROFEED_VERSION),
        },
        name: theme.manifest.packageId,
        packageManager: MICROFEED_PACKAGE_MANAGER,
        private: true,
        scripts: {
          preview: "theme-kit preview .",
          test: "theme-kit test . --json",
          validate: "theme-kit validate . --json",
        },
      }, null, 2)}\n`);
      if (theme.manifest.assets.length === 0) {
        await writeRelative("assets/.gitkeep", "");
      }
      if (!writtenPaths.has("fixtures/custom.json")) {
        await writeRelative(
          "fixtures/custom.json",
          await readFile(path.join(
            repositoryRoot,
            "packages/theme-kit/assets/starter/fixtures/custom.json",
          )),
        );
      }
      for (const relativePath of [
        "CLAUDE.md",
        ".agents/skills/develop-microfeed-theme/SKILL.md",
        ".agents/skills/develop-microfeed-theme/agents/openai.yaml",
        ".agents/skills/develop-microfeed-theme/references/public-site.md",
      ]) {
        await writeRelative(
          relativePath,
          await readFile(path.join(
            repositoryRoot,
            "packages/theme-kit/assets/starter",
            relativePath,
          )),
        );
      }
    }
    if (outputExists) await rmdir(output);
    await rename(staging, output);
  } catch (error) {
    await rm(staging, {force: true, recursive: true});
    throw error;
  }
  return output;
}

async function initializeThemeRepository(
  target: Target,
  flags: Flags,
  runner: CommandRunner,
): Promise<{
  gitInitialized: boolean;
  manifest: ThemeManifestV1;
  output: string;
  source: {
    checksumSha256: string | null;
    fallbackReason: string | null;
    kind: EffectiveTheme["kind"];
    packageId: string;
    themeId: string | null;
    version: string;
  };
}> {
  const outputDirectory = flagString(flags, "output");
  if (!outputDirectory) {
    throw new Error("theme init requires an output directory.");
  }
  const source = await effectiveTheme(target);
  const manifest = initializedThemeManifest(source, outputDirectory, {
    author: flagString(flags, "author"),
    name: flagString(flags, "name"),
    packageId: flagString(flags, "package-id"),
    version: flagString(flags, "version"),
  });
  const validated = validateThemePackage(
    manifest,
    source.bundle,
    MICROFEED_VERSION,
  );
  const output = await writeThemePackage(
    target,
    {
      assetOwnerThemeId: source.assetOwnerThemeId,
      bundle: validated.bundle,
      manifest: validated.manifest,
      previewFixture: source.previewFixture,
    },
    outputDirectory,
    {repositoryScaffold: {
      readme: generatedInitializedThemeRepositoryReadme(manifest, {
        kind: source.kind,
        packageId: source.manifest.packageId,
        version: source.manifest.version,
      }),
    }},
  );
  const gitInitialized = !flagBoolean(flags, "no-git");
  if (gitInitialized) {
    await initializeGitRepository(output, runner);
  }
  return {
    gitInitialized,
    manifest: validated.manifest,
    output,
    source: {
      checksumSha256: source.checksumSha256,
      fallbackReason: source.fallbackReason,
      kind: source.kind,
      packageId: source.manifest.packageId,
      themeId: source.themeId,
      version: source.manifest.version,
    },
  };
}

export async function themeCommand(
  flags: Flags,
  runner: CommandRunner = runCommand,
): Promise<void> {
  const action = flagString(flags, "action");
  if (!action || !["init", "install", "list", "update", "activate", "deactivate", "rollback", "export", "delete"].includes(action)) {
    throw new Error("Theme action must be init, install, list, update, activate, deactivate, rollback, export, or delete.");
  }
  if (flagBoolean(flags, "git") && action !== "export") {
    throw new Error("--git is supported only by theme export.");
  }
  if (flagBoolean(flags, "active") && action !== "export") {
    throw new Error("--active is supported only by theme export.");
  }
  const requestedThemeId = flagString(flags, "theme-id");
  const requestedActiveTheme = flagBoolean(flags, "active");
  if (
    action === "export" &&
    Boolean(requestedThemeId) === requestedActiveTheme
  ) {
    throw new Error(
      "theme export requires exactly one of <theme-id> or --active.",
    );
  }
  const target = await resolveTarget(flags, runner);
  if (action === "init") {
    const result = await initializeThemeRepository(target, flags, runner);
    writeOutput(
      flags,
      result,
      `Created ${result.manifest.packageId}@${result.manifest.version} in ${result.output} from ${result.source.packageId}@${result.source.version} (${result.source.kind})${result.gitInitialized ? " and initialized Git." : "."}`,
    );
    return;
  }
  if (action === "install") {
    const source = flagString(flags, "source");
    if (!source) {
      throw new Error(
        "theme install requires bundled:<key>, default, a GitHub URL, or a directory.",
      );
    }
    const theme = await installResolved(target, await resolveThemeSource(source, flags));
    writeOutput(flags, {theme}, `Installed ${theme.packageId}@${theme.version} as inactive (${theme.id}).`);
    return;
  }
  if (action === "list") {
    const themes = await themeSummaries(target);
    const state = await currentThemeState(target);
    writeOutput(flags, {state, themes}, themes.length
      ? themes.map((theme) => `${theme.id}  ${theme.packageId}@${theme.version}${state.activeThemeId === theme.id ? "  active" : state.previousThemeId === theme.id ? "  previous" : ""}`).join("\n")
      : "No installed theme versions.");
    return;
  }
  let themeId = requestedThemeId;
  if (action === "export" && requestedActiveTheme) {
    const state = await currentThemeState(target);
    if (!state.activeThemeId) {
      throw new Error(
        "No installed theme version is active. Use theme init to derive a " +
          "repository from the effective fallback theme.",
      );
    }
    themeId = state.activeThemeId;
  }
  const theme = themeId
    ? await themeById(target, themeId, action === "delete")
    : null;
  if (["update", "activate", "export", "delete"].includes(action) && !theme) {
    const guidance = action === "export" && requestedActiveTheme
      ? " Use theme init to derive a repository from the effective fallback theme."
      : "";
    throw new Error(`Theme ${themeId ?? "<missing>"} was not found.${guidance}`);
  }
  if (action === "update") {
    const source = themeUpdateSource(theme!);
    if (!source) throw new Error("This theme version has no update source.");
    const updateFlags = {...flags};
    if (!updateFlags.ref && theme!.sourceRef) updateFlags.ref = theme!.sourceRef;
    if (!updateFlags.path && theme!.sourcePath && theme!.sourceUrl) updateFlags.path = theme!.sourcePath;
    const resolved = await resolveThemeSource(source, updateFlags);
    if (resolved.source.commit && resolved.source.commit === theme!.sourceCommit) {
      writeOutput(flags, {changed: false, theme}, `${theme!.packageId}@${theme!.version} is already at commit ${theme!.sourceCommit}.`);
      return;
    }
    const installed = await installResolved(target, resolved);
    writeOutput(flags, {changed: installed.id !== theme!.id, theme: installed}, `Installed update ${installed.packageId}@${installed.version} as inactive (${installed.id}).`);
    return;
  }
  if (action === "export") {
    const output = flagString(flags, "output") ?? path.join(
      ".microfeed",
      "themes",
      `${theme!.packageId}-${theme!.version}`,
    );
    const resolvedOutput = await writeThemePackage(target, theme!, output, {
      repositoryScaffold: {
        readme: generatedExportedThemeRepositoryReadme(theme!.manifest),
      },
    });
    const gitInitialized = flagBoolean(flags, "git");
    if (gitInitialized) {
      await initializeGitRepository(resolvedOutput, runner);
    }
    writeOutput(
      flags,
      {
        gitInitialized,
        output: resolvedOutput,
        packageId: theme!.packageId,
        selection: requestedActiveTheme ? "active" : "theme-id",
        themeId: theme!.id,
        version: theme!.version,
      },
      `Exported ${theme!.packageId}@${theme!.version} to ${resolvedOutput}${gitInitialized ? " and initialized Git." : "."}`,
    );
    return;
  }
  if (action === "delete") {
    if (theme!.sourceKind === "bundled") {
      throw new Error(
        "Built-in themes are managed by microfeed deployment and cannot be deleted manually.",
      );
    }
    if (flagString(flags, "confirm") !== theme!.id) {
      throw new Error(`Delete requires --confirm ${theme!.id}.`);
    }
    await managementAction(target, "delete", theme!.id);
    writeOutput(flags, {deleted: theme!.id}, `Deleted ${theme!.packageId}@${theme!.version}.`);
    return;
  }
  const result = await managementAction(target, action as "activate" | "deactivate" | "rollback", theme?.id);
  writeOutput(flags, result, action === "activate" ? `Activated ${theme!.packageId}@${theme!.version}.` : `${action[0]!.toUpperCase()}${action.slice(1)} complete.`);
}
