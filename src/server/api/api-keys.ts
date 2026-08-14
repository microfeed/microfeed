import {SETTINGS_CATEGORIES} from "@/shared/Constants";
import {
  API_KEY_SCOPES,
  resolveApiAccessSettings,
  type ApiAccessSettings,
  type ApiKeyRecord,
  type ApiKeyScope,
  updateApiAccessEnabled,
} from "@/shared/Api";

interface ApiKeyRow {
  api_key: string;
  created_at_ms: number;
  id: string;
  name: string;
  scopes: string;
  updated_at_ms: number;
}

interface ApiSettingsRow {
  data: string;
}

export class ApiKeyNameConflictError extends Error {
  constructor() {
    super("An API key with this name already exists.");
    this.name = "ApiKeyNameConflictError";
  }
}

function apiKeyFromRow(row: ApiKeyRow): ApiKeyRecord {
  return {
    apiKey: row.api_key,
    createdAtMs: Number(row.created_at_ms),
    id: row.id,
    name: row.name,
    scopes: normalizeApiKeyScopes(row.scopes),
    updatedAtMs: Number(row.updated_at_ms),
  };
}

function normalizeApiKeyScopes(scopes: unknown): ApiKeyScope[] {
  const values = Array.isArray(scopes)
    ? scopes
    : typeof scopes === "string"
    ? scopes.split(/\s+/u)
    : [];
  const normalized = [...new Set(values)].filter((scope): scope is ApiKeyScope =>
    typeof scope === "string" &&
    (API_KEY_SCOPES as readonly string[]).includes(scope)
  );
  return normalized.length ? normalized : [...API_KEY_SCOPES];
}

function normalizeApiKeyName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new TypeError("Enter a name for this API key.");
  }
  if (normalized.length > 80) {
    throw new TypeError("API key names must be 80 characters or fewer.");
  }
  return normalized;
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `mf_${secret}`;
}

function boolJson(value: boolean): string {
  return value ? "true" : "false";
}

function upsertApiSettingsStatement(
  database: D1Database,
  settings: ApiAccessSettings,
): D1PreparedStatement {
  const timestamp = new Date().toISOString();
  return database.prepare(
    "INSERT INTO settings (category, data, created_at, updated_at) " +
      "VALUES (?, json_object(" +
      "'enabled', json(?), 'publicDocsEnabled', json(?)), ?, ?) " +
      "ON CONFLICT(category) DO UPDATE SET " +
      "data = json_set(" +
      "CASE WHEN json_valid(settings.data) THEN settings.data ELSE '{}' END, " +
      "'$.enabled', json(?), '$.publicDocsEnabled', json(?)), " +
      "updated_at = ?",
  ).bind(
    SETTINGS_CATEGORIES.API_SETTINGS,
    boolJson(settings.enabled),
    boolJson(settings.publicDocsEnabled),
    timestamp,
    timestamp,
    boolJson(settings.enabled),
    boolJson(settings.publicDocsEnabled),
    timestamp,
  );
}

function removeLegacyApiKeyStatement(
  database: D1Database,
  id: string,
  apiKey: string,
): D1PreparedStatement {
  return database.prepare(
    "UPDATE settings SET data = CASE " +
      "WHEN json_valid(data) AND json_type(data, '$.apps') = 'array' THEN " +
      "json_set(data, '$.apps', json(COALESCE((" +
      "SELECT json_group_array(json(value)) FROM json_each(data, '$.apps') " +
      "WHERE COALESCE(json_extract(value, '$.id'), '') != ? " +
      "AND COALESCE(json_extract(value, '$.token'), '') != ?" +
      "), '[]'))) ELSE data END, updated_at = ? " +
      "WHERE category = ?",
  ).bind(
    id,
    apiKey,
    new Date().toISOString(),
    SETTINGS_CATEGORIES.API_SETTINGS,
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && /unique constraint/iu.test(error.message);
}

export async function readApiAccessSettings(
  database: D1Database,
): Promise<ApiAccessSettings> {
  const row = await database.prepare(
    "SELECT data FROM settings WHERE category = ? LIMIT 1",
  ).bind(SETTINGS_CATEGORIES.API_SETTINGS).first<ApiSettingsRow>();
  if (!row) {
    return resolveApiAccessSettings(undefined);
  }
  try {
    return resolveApiAccessSettings(JSON.parse(row.data));
  } catch {
    return resolveApiAccessSettings(undefined);
  }
}

export async function updateApiAccessSettings(
  database: D1Database,
  settings: ApiAccessSettings,
): Promise<ApiAccessSettings> {
  const normalized = updateApiAccessEnabled(settings, settings.enabled);
  await upsertApiSettingsStatement(database, normalized).run();
  return normalized;
}

export async function listApiKeys(
  database: D1Database,
): Promise<ApiKeyRecord[]> {
  const result = await database.prepare(
    "SELECT id, name, api_key, scopes, created_at_ms, updated_at_ms " +
      "FROM api_keys ORDER BY created_at_ms DESC, id DESC",
  ).all<ApiKeyRow>();
  return result.results.map(apiKeyFromRow);
}

export async function findApiKey(
  database: D1Database,
  id: string,
): Promise<ApiKeyRecord | null> {
  const row = await database.prepare(
    "SELECT id, name, api_key, scopes, created_at_ms, updated_at_ms " +
      "FROM api_keys WHERE id = ? LIMIT 1",
  ).bind(id).first<ApiKeyRow>();
  return row ? apiKeyFromRow(row) : null;
}

export async function apiKeyExists(
  database: D1Database,
  providedApiKey: string,
): Promise<boolean> {
  if (!providedApiKey) {
    return false;
  }
  const row = await database.prepare(
    "SELECT 1 AS found FROM api_keys WHERE api_key = ? LIMIT 1",
  ).bind(providedApiKey).first<{found: number}>();
  return row?.found === 1;
}

export async function apiKeyScopes(
  database: D1Database,
  providedApiKey: string,
): Promise<Set<ApiKeyScope> | null> {
  if (!providedApiKey) return null;
  const row = await database.prepare(
    "SELECT scopes FROM api_keys WHERE api_key = ? LIMIT 1",
  ).bind(providedApiKey).first<{scopes: string}>();
  return row ? new Set(normalizeApiKeyScopes(row.scopes)) : null;
}

export async function createApiKey(
  database: D1Database,
  input: {
    name: string;
    scopes?: ApiKeyScope[];
    settings?: ApiAccessSettings;
  },
): Promise<ApiKeyRecord> {
  const now = Date.now();
  const apiKey: ApiKeyRecord = {
    apiKey: generateApiKey(),
    createdAtMs: now,
    id: crypto.randomUUID(),
    name: normalizeApiKeyName(input.name),
    scopes: normalizeApiKeyScopes(input.scopes),
    updatedAtMs: now,
  };
  const statements = [
    ...(input.settings
      ? [upsertApiSettingsStatement(
        database,
        updateApiAccessEnabled(input.settings, input.settings.enabled),
      )]
      : []),
    database.prepare(
      "INSERT INTO api_keys " +
        "(id, name, api_key, scopes, created_at_ms, updated_at_ms) " +
        "VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(
      apiKey.id,
      apiKey.name,
      apiKey.apiKey,
      apiKey.scopes.join(" "),
      apiKey.createdAtMs,
      apiKey.updatedAtMs,
    ),
  ];
  try {
    await database.batch(statements);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApiKeyNameConflictError();
    }
    throw error;
  }
  return apiKey;
}

export async function renameApiKey(
  database: D1Database,
  id: string,
  name: string,
): Promise<ApiKeyRecord | null> {
  const normalizedName = normalizeApiKeyName(name);
  try {
    await database.prepare(
      "UPDATE api_keys SET name = ?, updated_at_ms = ? WHERE id = ?",
    ).bind(normalizedName, Date.now(), id).run();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApiKeyNameConflictError();
    }
    throw error;
  }
  return findApiKey(database, id);
}

export async function rotateApiKey(
  database: D1Database,
  id: string,
): Promise<ApiKeyRecord | null> {
  const existing = await findApiKey(database, id);
  if (!existing) {
    return null;
  }
  const now = Date.now();
  await database.batch([
    database.prepare(
      "UPDATE api_keys SET api_key = ?, updated_at_ms = ? WHERE id = ?",
    ).bind(generateApiKey(), now, id),
    removeLegacyApiKeyStatement(database, id, existing.apiKey),
  ]);
  return findApiKey(database, id);
}

export async function revokeApiKey(
  database: D1Database,
  id: string,
): Promise<boolean> {
  const existing = await findApiKey(database, id);
  if (!existing) {
    return false;
  }
  await database.batch([
    database.prepare("DELETE FROM api_keys WHERE id = ?").bind(id),
    removeLegacyApiKeyStatement(database, id, existing.apiKey),
  ]);
  return true;
}
