import semver from "semver";

import {
  PUBLIC_CACHE_TAGS,
  purgePublicCache,
  type PublicCachePurger,
} from "@/server/cache/public-cache";
import {MICROFEED_VERSION} from "@/shared/Version";
import type {
  StoredThemeVersion,
  ThemeBundleV1,
  ThemeDraft,
  ThemeListOptions,
  ThemeListResponse,
  ThemeListSort,
  ThemeManifestV1,
  ThemeSourceKind,
  ThemeState,
} from "@/shared/themes/ThemeContract";
import {
  THEME_LIST_PAGE_SIZE,
  THEME_MAX_DRAFTS,
  THEME_MAX_INSTALLED_VERSIONS,
} from "@/shared/themes/ThemeContract";
import {
  canonicalThemePackage,
  sha256Hex,
} from "@/shared/themes/ThemeRenderer";
import {validateThemePackage} from "@/shared/themes/ThemeValidation";
import {
  commitDatabaseMutation,
  type DatabaseMutationCommit,
} from "@/server/mutation";
import {
  storedThemeFromRow,
  storedThemeSummaryFromRow,
  themeDraftFromRow,
  themeDraftSummaryFromRow,
  themeStateFromRow,
} from "@/shared/themes/ThemeRows";
import {
  BUNDLED_DEFAULT_THEME_BUNDLE,
  BUNDLED_DEFAULT_THEME_ID,
  BUNDLED_DEFAULT_THEME_MANIFEST,
  legacyThemeMigrationSource,
  MIGRATED_LEGACY_THEME_ID,
} from "./BundledThemes";

interface ThemeSource {
  commit?: string | null;
  kind: ThemeSourceKind;
  path?: string | null;
  ref?: string | null;
  url?: string | null;
}

export interface InstallThemeInput {
  assetOwnerThemeId?: string | null;
  bundle: ThemeBundleV1;
  id?: string;
  manifest: ThemeManifestV1;
  originThemeId?: string | null;
  source: ThemeSource;
}

export interface CreateDraftInput {
  assetOwnerThemeId?: string | null;
  bundle: ThemeBundleV1;
  manifest: ThemeManifestV1;
  originKind: "built-in" | "theme";
  originThemeId?: string | null;
}

export interface SaveDraftInput {
  bundle: ThemeBundleV1;
  manifest: ThemeManifestV1;
}

function results<T extends Record<string, unknown>>(
  result: D1Result<unknown>,
): T[] {
  return (result.results ?? []) as T[];
}

function localPackageId(packageId: string): string {
  if (packageId.startsWith("local.")) return packageId;
  return `local.${packageId}`.slice(0, 120).replace(/[._-]+$/u, "");
}

function nextPatchVersion(versions: string[], sourceVersion: string): string {
  const valid = versions.filter((version) => semver.valid(version));
  const baseline = semver.valid(sourceVersion) ? sourceVersion : "0.0.0";
  const latest = valid.sort(semver.rcompare)[0] ?? baseline;
  return semver.inc(latest, "patch") ?? "0.0.1";
}

function escapedLike(value: string): string {
  return `%${value.toLocaleLowerCase().replace(/[\\%_]/gu, "\\$&")}%`;
}

const THEME_SUMMARY_COLUMNS = `
  themes.id, themes.package_id, themes.version, themes.name,
  themes.manifest_json, themes.source_kind, themes.source_url,
  themes.source_ref, themes.source_path, themes.source_commit,
  themes.checksum_sha256, themes.origin_theme_id,
  origin_themes.name AS origin_theme_name,
  origin_themes.version AS origin_theme_version,
  themes.asset_owner_theme_id, themes.created_at, themes.deleted_at,
  COALESCE(json_array_length(json_extract(themes.manifest_json, '$.assets')), 0)
    AS asset_count`;

const DRAFT_SUMMARY_COLUMNS = `
  id, package_id, version, name, manifest_json, origin_kind,
  origin_theme_id, asset_owner_theme_id, created_at, updated_at,
  COALESCE(json_array_length(json_extract(manifest_json, '$.assets')), 0)
    AS asset_count`;

export default class ThemeStore {
  constructor(
    private readonly database: D1Database,
    private readonly publicCachePurger?: PublicCachePurger,
  ) {}

  private async purgeActiveTheme(): Promise<void> {
    if (this.publicCachePurger) {
      await purgePublicCache(
        [PUBLIC_CACHE_TAGS.THEME_CURRENT],
        this.publicCachePurger,
      );
    }
  }

  async listVersions(includeDeleted = true): Promise<StoredThemeVersion[]> {
    const result = await this.database.prepare(
      `SELECT * FROM themes
       ${includeDeleted ? "" : "WHERE deleted_at IS NULL"}
       ORDER BY package_id ASC, created_at DESC`,
    ).all();
    return results(result).map(storedThemeFromRow);
  }

  async listDrafts(): Promise<ThemeDraft[]> {
    const result = await this.database.prepare(
      "SELECT * FROM theme_drafts ORDER BY updated_at DESC",
    ).all();
    return results(result).map(themeDraftFromRow);
  }

  async listSummaries(options: ThemeListOptions): Promise<ThemeListResponse> {
    const page = Math.max(1, Math.trunc(options.page));
    const search = options.q ? escapedLike(options.q) : null;
    const where = search
      ? `WHERE themes.deleted_at IS NULL AND (
          lower(themes.name) LIKE ? ESCAPE '\\' OR
          lower(themes.package_id) LIKE ? ESCAPE '\\' OR
          lower(themes.version) LIKE ? ESCAPE '\\' OR
          lower(COALESCE(json_extract(themes.manifest_json, '$.author'), '')) LIKE ? ESCAPE '\\' OR
          lower(COALESCE(themes.source_url, '')) LIKE ? ESCAPE '\\'
        )`
      : "WHERE themes.deleted_at IS NULL";
    const sortSql = {
      "installed-asc": "themes.created_at ASC, themes.id ASC",
      "installed-desc": "themes.created_at DESC, themes.id ASC",
      "name-asc": "lower(themes.name) ASC, themes.version ASC, themes.id ASC",
      "name-desc": "lower(themes.name) DESC, themes.version DESC, themes.id ASC",
      status: `CASE
        WHEN themes.id = theme_state.active_theme_id THEN 0
        WHEN themes.id = theme_state.previous_theme_id THEN 1
        ELSE 2 END ASC, themes.created_at DESC, themes.id ASC`,
    } satisfies Record<ThemeListSort, string>;
    const parameters = search ? [search, search, search, search, search] : [];
    const [themeRows, countRow, draftRows, state] = await Promise.all([
      this.database.prepare(
        `SELECT ${THEME_SUMMARY_COLUMNS}
         FROM themes
         LEFT JOIN themes AS origin_themes
           ON origin_themes.id = themes.origin_theme_id
         CROSS JOIN theme_state
         ${where} AND theme_state.id = 'current'
         ORDER BY ${sortSql[options.sort]}
         LIMIT ? OFFSET ?`,
      ).bind(
        ...parameters,
        THEME_LIST_PAGE_SIZE,
        (page - 1) * THEME_LIST_PAGE_SIZE,
      ).all(),
      this.database.prepare(
        `SELECT count(*) AS total FROM themes ${where.replaceAll("themes.", "themes.")}`,
      ).bind(...parameters).first<{total: number}>(),
      this.database.prepare(
        `SELECT ${DRAFT_SUMMARY_COLUMNS}
         FROM theme_drafts ORDER BY updated_at DESC`,
      ).all(),
      this.getState(),
    ]);
    const total = Number(countRow?.total ?? 0);
    return {
      drafts: results(draftRows).map(themeDraftSummaryFromRow),
      limits: {
        drafts: THEME_MAX_DRAFTS,
        installed: THEME_MAX_INSTALLED_VERSIONS,
      },
      pagination: {
        page,
        pageSize: THEME_LIST_PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / THEME_LIST_PAGE_SIZE),
      },
      state,
      themes: results(themeRows).map(storedThemeSummaryFromRow),
    };
  }

  async getVersion(id: string, includeDeleted = false): Promise<StoredThemeVersion | null> {
    const row = await this.database.prepare(
      `SELECT * FROM themes WHERE id = ?
       ${includeDeleted ? "" : "AND deleted_at IS NULL"} LIMIT 1`,
    ).bind(id).first<Record<string, unknown>>();
    return row ? storedThemeFromRow(row) : null;
  }

  async getDraft(id: string): Promise<ThemeDraft | null> {
    const row = await this.database.prepare(
      "SELECT * FROM theme_drafts WHERE id = ? LIMIT 1",
    ).bind(id).first<Record<string, unknown>>();
    return row ? themeDraftFromRow(row) : null;
  }

  async getState(): Promise<ThemeState> {
    const row = await this.database.prepare(
      "SELECT * FROM theme_state WHERE id = 'current' LIMIT 1",
    ).first<Record<string, unknown>>();
    return themeStateFromRow(row);
  }

  /**
   * Converts the selected pre-versioning custom theme exactly once. The
   * original settings.customCode value is deliberately never changed so an
   * older microfeed release can still use it after an application rollback.
   */
  async ensureLegacyThemeMigrated(
    settings: Record<string, any> | null | undefined,
  ): Promise<StoredThemeVersion | null> {
    const state = await this.database.prepare(
      `SELECT active_theme_id, legacy_migrated_at
       FROM theme_state WHERE id = 'current' LIMIT 1`,
    ).first<{active_theme_id: string | null; legacy_migrated_at: string | null}>();
    if (!state) throw new Error("Theme state is unavailable.");
    if (state.legacy_migrated_at) {
      return state.active_theme_id
        ? await this.getVersion(state.active_theme_id)
        : null;
    }

    const source = legacyThemeMigrationSource(settings);
    if (!source) {
      await this.database.prepare(
        `UPDATE theme_state SET legacy_migrated_at = CURRENT_TIMESTAMP,
         legacy_migration_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = 'current' AND legacy_migrated_at IS NULL`,
      ).run();
      return state.active_theme_id
        ? await this.getVersion(state.active_theme_id)
        : null;
    }

    let validated: {bundle: ThemeBundleV1; manifest: ThemeManifestV1};
    let checksum: string;
    try {
      validated = validateThemePackage(
        source.manifest,
        source.bundle,
        MICROFEED_VERSION,
      );
      checksum = await sha256Hex(canonicalThemePackage(
        validated.manifest,
        validated.bundle,
      ));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.database.prepare(
        `UPDATE theme_state SET legacy_migrated_at = CURRENT_TIMESTAMP,
         legacy_migration_error = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = 'current' AND legacy_migrated_at IS NULL`,
      ).bind(message).run();
      console.error(JSON.stringify({
        error: message,
        message: "Existing theme migration failed; using the bundled default or active D1 theme",
      }));
      return state.active_theme_id
        ? await this.getVersion(state.active_theme_id)
        : null;
    }

    await this.database.batch([
      this.database.prepare(
        `INSERT OR IGNORE INTO themes (
          id, package_id, version, name, manifest_json, bundle_json,
          source_kind, checksum_sha256, origin_theme_id, asset_owner_theme_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'migration', ?, NULL, NULL)`,
      ).bind(
        MIGRATED_LEGACY_THEME_ID,
        validated.manifest.packageId,
        validated.manifest.version,
        validated.manifest.name,
        JSON.stringify(validated.manifest),
        JSON.stringify(validated.bundle),
        checksum,
      ),
      this.database.prepare(
        `UPDATE theme_state SET legacy_theme_id = ?,
         active_theme_id = COALESCE(active_theme_id, ?),
         legacy_migrated_at = CURRENT_TIMESTAMP,
         legacy_migration_error = NULL,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = 'current' AND legacy_migrated_at IS NULL`,
      ).bind(MIGRATED_LEGACY_THEME_ID, MIGRATED_LEGACY_THEME_ID),
    ]);
    const migratedState = await this.getState();
    if (!state.active_theme_id && migratedState.activeThemeId === MIGRATED_LEGACY_THEME_ID) {
      await this.purgeActiveTheme();
    }
    return migratedState.activeThemeId
      ? await this.getVersion(migratedState.activeThemeId)
      : null;
  }

  /**
   * Gives an upgraded site with no selected version the same bundled default
   * used for pristine initialization. Existing active D1 themes are unchanged.
   */
  async ensureAppearancePreserved(): Promise<StoredThemeVersion | null> {
    const state = await this.database.prepare(
      `SELECT active_theme_id, appearance_preserved_at
       FROM theme_state WHERE id = 'current' LIMIT 1`,
    ).first<{
      active_theme_id: string | null;
      appearance_preserved_at: string | null;
    }>();
    if (!state) throw new Error("Theme state is unavailable.");
    if (state.appearance_preserved_at || state.active_theme_id) {
      if (!state.appearance_preserved_at) {
        await this.database.prepare(
          `UPDATE theme_state SET appearance_preserved_at = CURRENT_TIMESTAMP,
           appearance_preservation_error = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = 'current' AND appearance_preserved_at IS NULL`,
        ).run();
      }
      return state.active_theme_id
        ? await this.getVersion(state.active_theme_id)
        : null;
    }

    const validated = validateThemePackage(
      BUNDLED_DEFAULT_THEME_MANIFEST,
      BUNDLED_DEFAULT_THEME_BUNDLE,
      MICROFEED_VERSION,
    );
    const checksum = await sha256Hex(canonicalThemePackage(
      validated.manifest,
      validated.bundle,
    ));
    const existingRow = await this.database.prepare(
      "SELECT * FROM themes WHERE package_id = ? AND version = ? LIMIT 1",
    ).bind(validated.manifest.packageId, validated.manifest.version)
      .first<Record<string, unknown>>();
    const existing = existingRow ? storedThemeFromRow(existingRow) : null;
    if (existing && (existing.deletedAt || existing.checksumSha256 !== checksum)) {
      throw new Error(
        `${validated.manifest.packageId}@${validated.manifest.version} is reserved by different bundled-default content.`,
      );
    }
    const defaultThemeId = existing?.id ?? BUNDLED_DEFAULT_THEME_ID;
    await this.database.batch([
      this.database.prepare(
        `INSERT OR IGNORE INTO themes (
          id, package_id, version, name, manifest_json, bundle_json,
          source_kind, checksum_sha256, origin_theme_id, asset_owner_theme_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'bundled', ?, NULL, NULL)`,
      ).bind(
        defaultThemeId,
        validated.manifest.packageId,
        validated.manifest.version,
        validated.manifest.name,
        JSON.stringify(validated.manifest),
        JSON.stringify(validated.bundle),
        checksum,
      ),
      this.database.prepare(
        `UPDATE theme_state SET active_theme_id = COALESCE(active_theme_id, ?),
         appearance_preserved_at = CURRENT_TIMESTAMP,
         appearance_preservation_error = NULL,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = 'current' AND appearance_preserved_at IS NULL`,
      ).bind(defaultThemeId),
    ]);
    const preserved = await this.getState();
    if (preserved.activeThemeId === defaultThemeId) {
      await this.purgeActiveTheme();
      return this.getVersion(defaultThemeId);
    }
    return preserved.activeThemeId
      ? await this.getVersion(preserved.activeThemeId)
      : null;
  }

  async ensureThemeMigration(
    settings: Record<string, any> | null | undefined,
  ): Promise<StoredThemeVersion | null> {
    await this.ensureLegacyThemeMigrated(settings);
    return this.ensureAppearancePreserved();
  }

  async installVersion(input: InstallThemeInput): Promise<StoredThemeVersion> {
    const {bundle, manifest} = validateThemePackage(
      input.manifest,
      input.bundle,
      MICROFEED_VERSION,
    );
    const checksum = await sha256Hex(canonicalThemePackage(manifest, bundle));
    const existing = await this.database.prepare(
      "SELECT * FROM themes WHERE package_id = ? AND version = ? LIMIT 1",
    ).bind(manifest.packageId, manifest.version)
      .first<Record<string, unknown>>();
    if (existing) {
      const theme = storedThemeFromRow(existing);
      if (theme.checksumSha256 !== checksum) {
        throw new Error(
          `${manifest.packageId}@${manifest.version} is already installed with different content.`,
        );
      }
      if (theme.deletedAt) {
        throw new Error(
          `${manifest.packageId}@${manifest.version} was deleted. Publish a new semantic version instead of reusing it.`,
        );
      }
      return theme;
    }

    const id = input.id ?? crypto.randomUUID();
    const assetOwnerThemeId = bundle.assets.length > 0
      ? input.assetOwnerThemeId ?? id
      : input.assetOwnerThemeId ?? null;
    const inserted = await this.database.prepare(
      `INSERT INTO themes (
        id, package_id, version, name, manifest_json, bundle_json,
        source_kind, source_url, source_ref, source_path, source_commit,
        checksum_sha256, origin_theme_id, asset_owner_theme_id
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE (SELECT count(*) FROM themes WHERE deleted_at IS NULL) < ?
      RETURNING id`,
    ).bind(
      id,
      manifest.packageId,
      manifest.version,
      manifest.name,
      JSON.stringify(manifest),
      JSON.stringify(bundle),
      input.source.kind,
      input.source.url ?? null,
      input.source.ref ?? null,
      input.source.path ?? null,
      input.source.commit ?? null,
      checksum,
      input.originThemeId ?? null,
      assetOwnerThemeId,
      THEME_MAX_INSTALLED_VERSIONS,
    ).first<{id: string}>();
    if (!inserted) {
      throw new Error(
        `This environment already has ${THEME_MAX_INSTALLED_VERSIONS} installed theme versions. Delete an inactive version before installing another.`,
      );
    }
    const installed = await this.getVersion(id);
    if (!installed) throw new Error("The installed theme could not be loaded.");
    return installed;
  }

  async createDraft(input: CreateDraftInput): Promise<ThemeDraft> {
    const source = validateThemePackage(input.manifest, input.bundle);
    const packageId = localPackageId(source.manifest.packageId);
    const versionRows = await this.database.prepare(
      `SELECT version FROM themes WHERE package_id = ?
       UNION ALL SELECT version FROM theme_drafts WHERE package_id = ?`,
    ).bind(packageId, packageId).all();
    const version = nextPatchVersion(
      results<{version: string}>(versionRows).map((row) => row.version),
      source.manifest.version,
    );
    const manifest = {
      ...source.manifest,
      name: source.manifest.name.endsWith(" (custom)")
        ? source.manifest.name
        : `${source.manifest.name} (custom)`,
      packageId,
      repository: undefined,
      version,
    } satisfies ThemeManifestV1;
    const id = crypto.randomUUID();
    const inserted = await this.database.prepare(
      `INSERT INTO theme_drafts (
        id, package_id, version, name, manifest_json, bundle_json,
        origin_kind, origin_theme_id, asset_owner_theme_id
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE (SELECT count(*) FROM theme_drafts) < ?
      RETURNING id`,
    ).bind(
      id,
      manifest.packageId,
      manifest.version,
      manifest.name,
      JSON.stringify(manifest),
      JSON.stringify(source.bundle),
      input.originKind,
      input.originThemeId ?? null,
      input.assetOwnerThemeId ?? null,
      THEME_MAX_DRAFTS,
    ).first<{id: string}>();
    if (!inserted) {
      throw new Error(
        `This environment already has ${THEME_MAX_DRAFTS} theme drafts. Discard a draft before creating another.`,
      );
    }
    const draft = await this.getDraft(id);
    if (!draft) throw new Error("The theme draft could not be loaded.");
    return draft;
  }

  async saveDraft(id: string, input: SaveDraftInput): Promise<ThemeDraft> {
    const existing = await this.getDraft(id);
    if (!existing) throw new Error("Theme draft not found.");
    const validated = validateThemePackage(
      input.manifest,
      input.bundle,
      MICROFEED_VERSION,
    );
    if (validated.manifest.packageId !== existing.packageId) {
      throw new Error("A draft's package ID cannot be changed.");
    }
    if (
      JSON.stringify(validated.manifest.files) !==
        JSON.stringify(existing.manifest.files) ||
      JSON.stringify(validated.manifest.assets) !==
        JSON.stringify(existing.manifest.assets) ||
      JSON.stringify(validated.bundle.assets) !==
        JSON.stringify(existing.bundle.assets)
    ) {
      throw new Error(
        "Admin drafts may edit only theme metadata and the six text slots; packaged files and assets are inherited unchanged.",
      );
    }
    await this.database.prepare(
      `UPDATE theme_drafts SET version = ?, name = ?, manifest_json = ?,
       bundle_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(
      validated.manifest.version,
      validated.manifest.name,
      JSON.stringify(validated.manifest),
      JSON.stringify(validated.bundle),
      id,
    ).run();
    const draft = await this.getDraft(id);
    if (!draft) throw new Error("The saved draft could not be loaded.");
    return draft;
  }

  async discardDraft(id: string, bucket?: R2Bucket | null): Promise<void> {
    const draft = await this.getDraft(id);
    await this.database.prepare("DELETE FROM theme_drafts WHERE id = ?")
      .bind(id).run();
    if (draft?.assetOwnerThemeId) {
      await this.cleanupAssetOwner(draft.assetOwnerThemeId, bucket);
    }
  }

  async publishDraft(id: string): Promise<StoredThemeVersion> {
    const draft = await this.getDraft(id);
    if (!draft) throw new Error("Theme draft not found.");
    const validated = validateThemePackage(
      draft.manifest,
      draft.bundle,
      MICROFEED_VERSION,
    );
    const checksum = await sha256Hex(
      canonicalThemePackage(validated.manifest, validated.bundle),
    );
    const existing = await this.database.prepare(
      "SELECT * FROM themes WHERE package_id = ? AND version = ? LIMIT 1",
    ).bind(draft.packageId, draft.version).first<Record<string, unknown>>();
    if (existing) {
      throw new Error(
        `${draft.packageId}@${draft.version} already exists. Choose a new version before publishing.`,
      );
    }

    const themeId = crypto.randomUUID();
    const inserted = await this.database.prepare(
        `INSERT INTO themes (
          id, package_id, version, name, manifest_json, bundle_json,
          source_kind, checksum_sha256, origin_theme_id, asset_owner_theme_id
        ) SELECT ?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?
          WHERE (SELECT count(*) FROM themes WHERE deleted_at IS NULL) < ?
        RETURNING id`,
      ).bind(
        themeId,
        draft.packageId,
        draft.version,
        draft.name,
        JSON.stringify(validated.manifest),
        JSON.stringify(validated.bundle),
        checksum,
        draft.originThemeId,
        draft.assetOwnerThemeId,
        THEME_MAX_INSTALLED_VERSIONS,
      ).first<{id: string}>();
    if (!inserted) {
      throw new Error(
        `This environment already has ${THEME_MAX_INSTALLED_VERSIONS} installed theme versions. Delete an inactive version, then install this draft again. The draft has been retained.`,
      );
    }
    await this.database.prepare("DELETE FROM theme_drafts WHERE id = ?")
      .bind(id).run();
    const published = await this.getVersion(themeId);
    if (!published) throw new Error("The published theme could not be loaded.");
    return published;
  }

  async activate(
    id: string,
    commit?: DatabaseMutationCommit<ThemeState>,
  ): Promise<ThemeState> {
    const theme = await this.getVersion(id);
    if (!theme) throw new Error("Theme version not found.");
    validateThemePackage(theme.manifest, theme.bundle, MICROFEED_VERSION);
    const before = await this.getState();
    if (before.activeThemeId === id) return before;
    const now = new Date().toISOString();
    const state: ThemeState = {
      activeThemeId: id,
      previousThemeId: before.activeThemeId,
      updatedAt: now,
    };
    const statement = this.database.prepare(
      `UPDATE theme_state SET previous_theme_id = active_theme_id,
       active_theme_id = ?, updated_at = ?
       WHERE id = 'current'
         AND EXISTS (
           SELECT 1 FROM themes WHERE id = ? AND deleted_at IS NULL
         )`,
    ).bind(id, now, id);
    await commitDatabaseMutation(this.database, [statement], state, commit);
    await this.purgeActiveTheme();
    return state;
  }

  async deactivate(
    commit?: DatabaseMutationCommit<ThemeState>,
  ): Promise<ThemeState> {
    const before = await this.getState();
    if (!before.activeThemeId) return before;
    const now = new Date().toISOString();
    const state: ThemeState = {
      activeThemeId: null,
      previousThemeId: before.activeThemeId,
      updatedAt: now,
    };
    const statement = this.database.prepare(
      `UPDATE theme_state SET previous_theme_id = active_theme_id,
       active_theme_id = NULL, updated_at = ? WHERE id = 'current'`,
    ).bind(now);
    await commitDatabaseMutation(this.database, [statement], state, commit);
    await this.purgeActiveTheme();
    return state;
  }

  async rollback(
    commit?: DatabaseMutationCommit<ThemeState>,
  ): Promise<ThemeState> {
    const before = await this.getState();
    if (before.previousThemeId) {
      const previous = await this.getVersion(before.previousThemeId);
      if (!previous) throw new Error("The previous theme is unavailable.");
      validateThemePackage(previous.manifest, previous.bundle, MICROFEED_VERSION);
    }
    const now = new Date().toISOString();
    const state: ThemeState = {
      activeThemeId: before.previousThemeId,
      previousThemeId: before.activeThemeId,
      updatedAt: now,
    };
    const statement = this.database.prepare(
      `UPDATE theme_state SET active_theme_id = previous_theme_id,
       previous_theme_id = active_theme_id, updated_at = ?
       WHERE id = 'current' AND (
         previous_theme_id IS NULL OR EXISTS (
           SELECT 1 FROM themes
           WHERE id = theme_state.previous_theme_id AND deleted_at IS NULL
         )
       )`,
    ).bind(now);
    await commitDatabaseMutation(this.database, [statement], state, commit);
    await this.purgeActiveTheme();
    return state;
  }

  async deleteVersion(id: string, bucket?: R2Bucket | null): Promise<void> {
    const theme = await this.getVersion(id, true);
    if (!theme) throw new Error("Theme version not found.");
    const state = await this.getState();
    if (state.activeThemeId === id) {
      throw new Error("Deactivate or replace the active theme before deleting it.");
    }
    if (!theme.deletedAt) {
      const deleted = await this.database.prepare(
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
    await this.database.prepare(
      `UPDATE theme_state SET previous_theme_id = NULL,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = 'current' AND previous_theme_id = ?`,
    ).bind(id).run();

    const ownerId = theme.assetOwnerThemeId;
    if (!ownerId) return;
    await this.cleanupAssetOwner(ownerId, bucket);
  }

  private async cleanupAssetOwner(
    ownerId: string,
    bucket?: R2Bucket | null,
  ): Promise<void> {
    const references = await this.database.prepare(
      `SELECT (
        SELECT count(*) FROM themes
        WHERE deleted_at IS NULL AND asset_owner_theme_id = ?
      ) + (
        SELECT count(*) FROM theme_drafts WHERE asset_owner_theme_id = ?
      ) AS count`,
    ).bind(ownerId, ownerId).first<{count: number}>();
    if ((references?.count ?? 0) > 0) return;

    const owner = await this.getVersion(ownerId, true);
    if (!owner || owner.bundle.assets.length === 0) return;

    try {
      if (!bucket) throw new Error("R2 media storage is unavailable.");
      await bucket.delete(owner.bundle.assets.map((asset) => asset.key));
      await this.database.prepare(
        `UPDATE themes SET assets_deleted_at = CURRENT_TIMESTAMP,
         asset_cleanup_error = NULL WHERE id = ?`,
      ).bind(ownerId).run();
    } catch (error) {
      await this.database.prepare(
        "UPDATE themes SET asset_cleanup_error = ? WHERE id = ?",
      ).bind(
        error instanceof Error ? error.message : String(error),
        ownerId,
      ).run();
      throw error;
    }
  }
}
