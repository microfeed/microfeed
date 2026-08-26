import {lt, valid} from "semver";

import {themeBundleV1Schema} from "@/shared/themes/ThemeContract";

type QueryParameter = string | number | null;

export interface BundledThemePruningStore {
  deleteAssets: (keys: string[]) => Promise<void>;
  query: (
    sql: string,
    parameters?: QueryParameter[],
  ) => Promise<Array<Record<string, unknown>>>;
}

interface BundledThemeCandidate {
  assetOwnerThemeId: string | null;
  id: string;
  version: string;
}

function candidateFromRow(
  row: Record<string, unknown>,
): BundledThemeCandidate | null {
  if (typeof row.id !== "string" || typeof row.version !== "string") {
    return null;
  }
  return {
    assetOwnerThemeId: typeof row.asset_owner_theme_id === "string"
      ? row.asset_owner_theme_id
      : null,
    id: row.id,
    version: row.version,
  };
}

const MARK_SUPERSEDED_BUNDLED_THEME_DELETED = `UPDATE themes
  SET deleted_at = CURRENT_TIMESTAMP
  WHERE id = ?
    AND package_id = ?
    AND version = ?
    AND source_kind = 'bundled'
    AND deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM theme_state
      WHERE id = 'current'
        AND (active_theme_id = ? OR previous_theme_id = ?)
    )
    AND NOT EXISTS (
      SELECT 1 FROM theme_drafts
      WHERE origin_theme_id = ? OR asset_owner_theme_id = ?
    )
    AND NOT EXISTS (
      SELECT 1 FROM themes AS dependent
      WHERE dependent.deleted_at IS NULL
        AND dependent.id != ?
        AND (
          dependent.origin_theme_id = ? OR
          dependent.asset_owner_theme_id = ?
        )
    )
  RETURNING id`;

async function cleanupAssetOwner(
  store: BundledThemePruningStore,
  ownerId: string,
): Promise<void> {
  const [references] = await store.query(
    `SELECT (
      SELECT count(*) FROM themes
      WHERE deleted_at IS NULL AND asset_owner_theme_id = ?
    ) + (
      SELECT count(*) FROM theme_drafts WHERE asset_owner_theme_id = ?
    ) AS count`,
    [ownerId, ownerId],
  );
  if (Number(references?.count ?? 0) > 0) return;

  const [owner] = await store.query(
    "SELECT bundle_json FROM themes WHERE id = ? LIMIT 1",
    [ownerId],
  );
  if (typeof owner?.bundle_json !== "string") return;
  const bundle = themeBundleV1Schema.parse(JSON.parse(owner.bundle_json));
  if (bundle.assets.length === 0) return;

  try {
    await store.deleteAssets(bundle.assets.map((asset) => asset.key));
    await store.query(
      `UPDATE themes SET assets_deleted_at = CURRENT_TIMESTAMP,
       asset_cleanup_error = NULL WHERE id = ?`,
      [ownerId],
    );
  } catch (error) {
    await store.query(
      "UPDATE themes SET asset_cleanup_error = ? WHERE id = ?",
      [error instanceof Error ? error.message : String(error), ownerId],
    );
    throw error;
  }
}

/**
 * Soft-deletes superseded bundled versions that are not active, the rollback
 * target, or the origin/asset owner of another installed version or draft.
 * Invalid and newer version strings fail closed and remain installed.
 */
export async function pruneSupersededBundledThemeVersions(
  store: BundledThemePruningStore,
  packageId: string,
  currentVersion: string,
): Promise<string[]> {
  if (valid(currentVersion) !== currentVersion) {
    throw new Error(
      `The current bundled theme version ${currentVersion} is not exact SemVer.`,
    );
  }
  const rows = await store.query(
    `SELECT id, version, asset_owner_theme_id FROM themes
     WHERE package_id = ? AND source_kind = 'bundled' AND deleted_at IS NULL`,
    [packageId],
  );
  const candidates = rows
    .map(candidateFromRow)
    .filter((candidate): candidate is BundledThemeCandidate =>
      candidate !== null && valid(candidate.version) === candidate.version &&
      lt(candidate.version, currentVersion)
    );
  const pruned: string[] = [];
  for (const candidate of candidates) {
    const deleted = await store.query(
      MARK_SUPERSEDED_BUNDLED_THEME_DELETED,
      [
        candidate.id,
        packageId,
        candidate.version,
        candidate.id,
        candidate.id,
        candidate.id,
        candidate.id,
        candidate.id,
        candidate.id,
        candidate.id,
      ],
    );
    if (deleted.length === 0) continue;
    pruned.push(candidate.id);
    if (candidate.assetOwnerThemeId) {
      await cleanupAssetOwner(store, candidate.assetOwnerThemeId);
    }
  }
  return pruned;
}
