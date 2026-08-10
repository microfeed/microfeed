import type {
  StoredThemeVersion,
  ThemeDraft,
  ThemeState,
} from "@/shared/themes/ThemeContract";
import {
  storedThemeVersionSchema,
  themeDraftSchema,
} from "@/shared/themes/ThemeContract";

type DatabaseRow = Record<string, unknown>;

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Theme row is missing ${field}.`);
  }
  return value;
}

function parseJson(value: unknown, field: string): unknown {
  try {
    return JSON.parse(requiredString(value, field));
  } catch (error) {
    throw new Error(`Theme row has invalid ${field}.`, {cause: error});
  }
}

export function storedThemeFromRow(row: DatabaseRow): StoredThemeVersion {
  return storedThemeVersionSchema.parse({
    assetOwnerThemeId: nullableString(row.asset_owner_theme_id),
    bundle: parseJson(row.bundle_json, "bundle_json"),
    checksumSha256: requiredString(row.checksum_sha256, "checksum_sha256"),
    createdAt: requiredString(row.created_at, "created_at"),
    deletedAt: nullableString(row.deleted_at),
    id: requiredString(row.id, "id"),
    manifest: parseJson(row.manifest_json, "manifest_json"),
    name: requiredString(row.name, "name"),
    originThemeId: nullableString(row.origin_theme_id),
    packageId: requiredString(row.package_id, "package_id"),
    sourceCommit: nullableString(row.source_commit),
    sourceKind: requiredString(row.source_kind, "source_kind"),
    sourcePath: nullableString(row.source_path),
    sourceRef: nullableString(row.source_ref),
    sourceUrl: nullableString(row.source_url),
    version: requiredString(row.version, "version"),
  });
}

export function themeDraftFromRow(row: DatabaseRow): ThemeDraft {
  return themeDraftSchema.parse({
    assetOwnerThemeId: nullableString(row.asset_owner_theme_id),
    bundle: parseJson(row.bundle_json, "bundle_json"),
    createdAt: requiredString(row.created_at, "created_at"),
    id: requiredString(row.id, "id"),
    manifest: parseJson(row.manifest_json, "manifest_json"),
    name: requiredString(row.name, "name"),
    originKind: requiredString(row.origin_kind, "origin_kind"),
    originThemeId: nullableString(row.origin_theme_id),
    packageId: requiredString(row.package_id, "package_id"),
    updatedAt: requiredString(row.updated_at, "updated_at"),
    version: requiredString(row.version, "version"),
  });
}

export function themeStateFromRow(row: DatabaseRow | null): ThemeState {
  return {
    activeThemeId: nullableString(row?.active_theme_id),
    previousThemeId: nullableString(row?.previous_theme_id),
    updatedAt: nullableString(row?.updated_at) ?? new Date(0).toISOString(),
  };
}
