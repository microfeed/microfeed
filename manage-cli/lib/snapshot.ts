import {createHash} from "node:crypto";
import {createReadStream} from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import * as tar from "tar";

import {
  MICROFEED_OAUTH_CALLBACK_URL,
  MICROFEED_OAUTH_CLIENT_ID,
  OAUTH_SCOPES,
} from "../../src/shared/OAuth";
import {ITEM_SEARCH_VIRTUAL_TABLE_PREFIXES} from "../../src/shared/ItemSearchSql";
import {repositoryRoot} from "./process";

export const SNAPSHOT_FORMAT = "microfeed-portable-snapshot";
export const SNAPSHOT_VERSION = 1;

export const SNAPSHOT_TABLES = {
  durable: [
    "channels",
    "items",
    "settings",
    "api_keys",
    "auth_user",
    "auth_account",
    "passkey",
  ],
  ephemeral: [
    "item_search_metadata",
    "oauth_access_token",
    "oauth_refresh_token",
    "oauth_consent",
    "oauth_client",
    "oauth_connection",
    "auth_session",
    "auth_verification",
    "auth_rate_limit",
    "auth_password_setup",
  ],
  internal: ["_cf_KV", "d1_kv"],
  targetSpecific: ["microfeed_installation"],
} as const;

export type SnapshotTableCategory = keyof typeof SNAPSHOT_TABLES;

export interface SnapshotMigration {
  filename: string;
  sha256: string;
}

export interface SnapshotIndexDefinition {
  name: string;
  sql: string;
}

export interface SnapshotR2HttpMetadata {
  cacheControl?: string;
  cacheExpiry?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  contentType?: string;
}

export interface SnapshotR2Object {
  archivePath: string;
  customMetadata: Record<string, string>;
  etag: string | null;
  httpMetadata: SnapshotR2HttpMetadata;
  key: string;
  sha256: string;
  size: number;
  storageClass: string | null;
  uploaded: string | null;
}

export interface SnapshotManifest {
  createdAt: string;
  database: {
    data: {path: "database/data.sql"; sha256: string};
    migrations: SnapshotMigration[];
    rowCounts: Record<string, number>;
    schema: {path: "database/schema.sql"; sha256: string};
    tables: Record<SnapshotTableCategory, string[]>;
  };
  format: typeof SNAPSHOT_FORMAT;
  media: {
    objectCount: number;
    objects: SnapshotR2Object[];
    totalBytes: number;
  };
  source: {
    databaseName: string;
    deploymentEnvironment: "production";
    instanceName: string;
    projectName: string;
    r2BucketName: string;
  };
  version: typeof SNAPSHOT_VERSION;
}

export interface ExtractedSnapshot {
  directory: string;
  manifest: SnapshotManifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(
  value: unknown,
  description: string,
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid snapshot manifest: ${description} is missing.`);
  }
  return value;
}

function requiredSha256(value: unknown, description: string): string {
  const hash = requiredString(value, description);
  if (!/^[a-f0-9]{64}$/u.test(hash)) {
    throw new Error(
      `Invalid snapshot manifest: ${description} is not a SHA-256 hash.`,
    );
  }
  return hash;
}

function requiredNonNegativeInteger(
  value: unknown,
  description: string,
): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(
      `Invalid snapshot manifest: ${description} must be a non-negative integer.`,
    );
  }
  return Number(value);
}

function optionalString(value: unknown, description: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return requiredString(value, description);
}

function requiredIsoDate(value: unknown, description: string): string {
  const date = requiredString(value, description);
  if (Number.isNaN(Date.parse(date))) {
    throw new Error(`Invalid snapshot manifest: ${description} is not a date.`);
  }
  return date;
}

function optionalIsoDate(value: unknown, description: string): string | null {
  return value === null || value === undefined
    ? null
    : requiredIsoDate(value, description);
}

function stringRecord(
  value: unknown,
  description: string,
): Record<string, string> {
  if (!isRecord(value)) {
    throw new Error(`Invalid snapshot manifest: ${description} is invalid.`);
  }
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new Error(
        `Invalid snapshot manifest: ${description}.${key} is not a string.`,
      );
    }
    result[key] = entry;
  }
  return result;
}

function stringArray(value: unknown, description: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Invalid snapshot manifest: ${description} is invalid.`);
  }
  return [...value];
}

function parseHttpMetadata(value: unknown): SnapshotR2HttpMetadata {
  if (!isRecord(value)) {
    throw new Error("Invalid snapshot manifest: R2 HTTP metadata is invalid.");
  }
  const result: SnapshotR2HttpMetadata = {};
  for (const key of [
    "cacheControl",
    "cacheExpiry",
    "contentDisposition",
    "contentEncoding",
    "contentLanguage",
    "contentType",
  ] as const) {
    if (value[key] !== undefined) {
      result[key] = requiredString(value[key], `R2 HTTP metadata ${key}`);
    }
  }
  if (result.cacheExpiry !== undefined) {
    requiredIsoDate(result.cacheExpiry, "R2 HTTP metadata cacheExpiry");
  }
  return result;
}

function parseMigration(value: unknown, index: number): SnapshotMigration {
  if (!isRecord(value)) {
    throw new Error(`Invalid snapshot manifest: migration ${index} is invalid.`);
  }
  return {
    filename: requiredString(value.filename, `migration ${index} filename`),
    sha256: requiredSha256(value.sha256, `migration ${index} hash`),
  };
}

function parseObject(value: unknown, index: number): SnapshotR2Object {
  if (!isRecord(value)) {
    throw new Error(`Invalid snapshot manifest: R2 object ${index} is invalid.`);
  }
  const archivePath = requiredString(
    value.archivePath,
    `R2 object ${index} archive path`,
  );
  assertSafeArchivePath(archivePath);
  if (!/^media\/\d{8}$/u.test(archivePath)) {
    throw new Error(
      `Invalid snapshot manifest: unexpected R2 object path ${archivePath}.`,
    );
  }
  const storageClass = optionalString(
    value.storageClass,
    `R2 object ${index} storage class`,
  );
  if (storageClass !== null &&
      storageClass !== "Standard" && storageClass !== "InfrequentAccess") {
    throw new Error(
      `Invalid snapshot manifest: R2 object ${index} has an unsupported storage class.`,
    );
  }
  return {
    archivePath,
    customMetadata: stringRecord(
      value.customMetadata,
      `R2 object ${index} custom metadata`,
    ),
    etag: optionalString(value.etag, `R2 object ${index} ETag`),
    httpMetadata: parseHttpMetadata(value.httpMetadata),
    key: requiredString(value.key, `R2 object ${index} key`),
    sha256: requiredSha256(value.sha256, `R2 object ${index} hash`),
    size: requiredNonNegativeInteger(value.size, `R2 object ${index} size`),
    storageClass,
    uploaded: optionalIsoDate(value.uploaded, `R2 object ${index} upload time`),
  };
}

export function parseSnapshotManifest(value: unknown): SnapshotManifest {
  if (!isRecord(value)) {
    throw new Error("Invalid snapshot manifest.");
  }
  if (value.format !== SNAPSHOT_FORMAT || value.version !== SNAPSHOT_VERSION) {
    throw new Error(
      "Unsupported snapshot format or version. Upgrade this checkout if the archive was created by a newer microfeed release.",
    );
  }
  if (!isRecord(value.source) || !isRecord(value.database) ||
      !isRecord(value.media)) {
    throw new Error("Invalid snapshot manifest: required sections are missing.");
  }
  const database = value.database;
  if (!isRecord(database.schema) || !isRecord(database.data) ||
      !isRecord(database.tables) || !isRecord(database.rowCounts)) {
    throw new Error("Invalid snapshot manifest: database metadata is invalid.");
  }
  const databaseTables = database.tables;
  if (database.schema.path !== "database/schema.sql" ||
      database.data.path !== "database/data.sql") {
    throw new Error("Invalid snapshot manifest: database paths are invalid.");
  }
  const tables = Object.fromEntries(
    (Object.keys(SNAPSHOT_TABLES) as SnapshotTableCategory[]).map((category) => [
      category,
      stringArray(databaseTables[category], `${category} table list`),
    ]),
  ) as Record<SnapshotTableCategory, string[]>;
  assertClassifiedTables(Object.values(tables).flat(), tables);
  const rowCounts: Record<string, number> = {};
  for (const [table, count] of Object.entries(database.rowCounts)) {
    rowCounts[table] = requiredNonNegativeInteger(count, `${table} row count`);
  }
  const expectedRowCountTables = [...tables.durable].sort();
  const actualRowCountTables = Object.keys(rowCounts).sort();
  if (JSON.stringify(actualRowCountTables) !== JSON.stringify(expectedRowCountTables)) {
    throw new Error(
      "Invalid snapshot manifest: durable row counts do not match the durable table list.",
    );
  }
  if (!Array.isArray(database.migrations) || !Array.isArray(value.media.objects)) {
    throw new Error("Invalid snapshot manifest: database migrations or media objects are invalid.");
  }
  const objects = value.media.objects.map(parseObject);
  const objectCount = requiredNonNegativeInteger(
    value.media.objectCount,
    "R2 object count",
  );
  const totalBytes = requiredNonNegativeInteger(
    value.media.totalBytes,
    "R2 total bytes",
  );
  if (objectCount !== objects.length ||
      totalBytes !== objects.reduce((sum, object) => sum + object.size, 0)) {
    throw new Error("Invalid snapshot manifest: R2 totals do not match its objects.");
  }
  const archivePaths = new Set(objects.map(({archivePath}) => archivePath));
  if (archivePaths.size !== objects.length) {
    throw new Error("Invalid snapshot manifest: duplicate R2 archive paths.");
  }
  const objectKeys = new Set(objects.map(({key}) => key));
  if (objectKeys.size !== objects.length) {
    throw new Error("Invalid snapshot manifest: duplicate R2 object keys.");
  }
  return {
    createdAt: requiredIsoDate(value.createdAt, "creation time"),
    database: {
      data: {
        path: "database/data.sql",
        sha256: requiredSha256(database.data.sha256, "data SQL hash"),
      },
      migrations: database.migrations.map(parseMigration),
      rowCounts,
      schema: {
        path: "database/schema.sql",
        sha256: requiredSha256(database.schema.sha256, "schema SQL hash"),
      },
      tables,
    },
    format: SNAPSHOT_FORMAT,
    media: {objectCount, objects, totalBytes},
    source: {
      databaseName: requiredString(value.source.databaseName, "source database"),
      deploymentEnvironment: value.source.deploymentEnvironment === "production"
        ? "production"
        : (() => {
            throw new Error("Snapshots can only contain production data.");
          })(),
      instanceName: requiredString(value.source.instanceName, "source instance"),
      projectName: requiredString(value.source.projectName, "source project"),
      r2BucketName: requiredString(value.source.r2BucketName, "source R2 bucket"),
    },
    version: SNAPSHOT_VERSION,
  };
}

export async function sha256File(filename: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export async function repositoryMigrations(
  migrationsDirectory = path.join(repositoryRoot, "migrations"),
): Promise<SnapshotMigration[]> {
  const filenames = (await readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));
  if (filenames.length === 0) {
    throw new Error("No D1 migration files were found in this checkout.");
  }
  return Promise.all(filenames.map(async (filename) => ({
    filename,
    sha256: await sha256File(path.join(migrationsDirectory, filename)),
  })));
}

export function validateAppliedMigrationPrefix(
  appliedFilenames: readonly string[],
  migrations: readonly SnapshotMigration[],
): SnapshotMigration[] {
  if (appliedFilenames.length > migrations.length) {
    throw new Error(
      "The database contains migrations newer than this checkout. Use a newer checkout before creating or restoring a snapshot.",
    );
  }
  for (const [index, filename] of appliedFilenames.entries()) {
    if (migrations[index]?.filename !== filename) {
      throw new Error(
        `The D1 migration ledger diverges at position ${index + 1}: ` +
          `expected ${migrations[index]?.filename ?? "no migration"}, found ${filename}.`,
      );
    }
  }
  return migrations.slice(0, appliedFilenames.length);
}

export function validateSnapshotMigrations(
  snapshot: readonly SnapshotMigration[],
  current: readonly SnapshotMigration[],
): {pending: SnapshotMigration[]} {
  if (snapshot.length > current.length) {
    throw new Error(
      "This snapshot is newer than the current checkout. Use a newer checkout before restoring it.",
    );
  }
  for (const [index, migration] of snapshot.entries()) {
    const expected = current[index];
    if (!expected) {
      throw new Error("This snapshot is newer than the current checkout.");
    }
    if (migration.filename !== expected.filename) {
      throw new Error(
        `Snapshot migration history diverges at position ${index + 1}: ` +
          `expected ${expected.filename}, found ${migration.filename}.`,
      );
    }
    if (migration.sha256 !== expected.sha256) {
      throw new Error(
        `Released migration ${migration.filename} was edited. Restore requires an exact historical SHA-256 match.`,
      );
    }
  }
  return {pending: current.slice(snapshot.length)};
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | '"' | "`" | "]" | null = null;
  let blockComment = false;
  let lineComment = false;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]!;
    const next = sql[index + 1];
    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
        current += character;
      }
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) {
        if (next === quote && quote !== "]") {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (character === "-" && next === "-") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "[") {
      quote = "]";
      current += character;
      continue;
    }
    if (character === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function indexName(statement: string): string | null {
  const prefix = statement.match(
    /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?/iu,
  );
  if (!prefix) return null;
  const remaining = statement.slice(prefix[0].length);
  const marker = remaining[0];
  if (marker === '"' || marker === "`" || marker === "[") {
    const closing = marker === "[" ? "]" : marker;
    let name = "";
    for (let index = 1; index < remaining.length; index += 1) {
      const character = remaining[index]!;
      if (character === closing) {
        if (remaining[index + 1] === closing && marker !== "[") {
          name += closing;
          index += 1;
          continue;
        }
        return name;
      }
      name += character;
    }
    return null;
  }
  return remaining.match(/^[^\s(]+/u)?.[0] ?? null;
}

export function migrationIndexDefinitions(sql: string): SnapshotIndexDefinition[] {
  return splitSqlStatements(sql).flatMap((statement) => {
    const name = indexName(statement);
    return name ? [{name, sql: `${statement};`}] : [];
  });
}

export function assertClassifiedTables(
  tables: readonly string[],
  classification: Record<SnapshotTableCategory, readonly string[]> =
    SNAPSHOT_TABLES,
): void {
  const assigned = new Map<string, SnapshotTableCategory>();
  for (const category of Object.keys(classification) as SnapshotTableCategory[]) {
    for (const table of classification[category]) {
      if (assigned.has(table)) {
        throw new Error(`Snapshot table ${table} has more than one classification.`);
      }
      assigned.set(table, category);
    }
  }
  const unknown = tables.filter((table) => !assigned.has(table)).sort();
  if (unknown.length > 0) {
    throw new Error(
      "Snapshot creation refused unclassified application tables: " +
        `${unknown.join(", ")}. Add every table to SNAPSHOT_TABLES.`,
    );
  }
}

export function applicationTablesFromSqlite(tables: readonly string[]): string[] {
  const internalTables = new Set<string>(SNAPSHOT_TABLES.internal);
  return tables.filter((table) =>
    table !== "d1_migrations" &&
    !table.startsWith("sqlite_") &&
    !table.startsWith("_cf_") &&
    !internalTables.has(table) &&
    !ITEM_SEARCH_VIRTUAL_TABLE_PREFIXES.some((prefix) =>
      table === prefix || table.startsWith(`${prefix}_`)
    )
  ).sort((left, right) => left.localeCompare(right));
}

export function assertSafeArchivePath(entryPath: string): void {
  const normalized = path.posix.normalize(entryPath.replaceAll("\\", "/"));
  if (
    !entryPath ||
    normalized !== entryPath ||
    normalized.startsWith("../") ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/u.test(normalized)
  ) {
    throw new Error(`Unsafe path in snapshot archive: ${entryPath || "<empty>"}.`);
  }
  if (
    normalized !== "manifest.json" &&
    normalized !== "database" &&
    normalized !== "database/schema.sql" &&
    normalized !== "database/data.sql" &&
    normalized !== "media" &&
    !/^media\/\d{8}$/u.test(normalized)
  ) {
    throw new Error(`Unexpected path in snapshot archive: ${entryPath}.`);
  }
}

export async function createSnapshotArchive(
  directory: string,
  output: string,
): Promise<void> {
  await mkdir(path.dirname(path.resolve(output)), {recursive: true});
  await tar.create({
    cwd: directory,
    file: output,
    gzip: true,
    portable: true,
    prefix: "",
  }, ["manifest.json", "database", "media"]);
  await chmod(output, 0o600);
}

export async function extractSnapshotArchive(
  archive: string,
  directory: string,
): Promise<ExtractedSnapshot> {
  await mkdir(directory, {recursive: true});
  const extractedPaths = new Set<string>();
  await tar.extract({
    cwd: directory,
    file: archive,
    preservePaths: false,
    strict: true,
    filter: (entryPath, entry) => {
      const normalizedEntryPath = entryPath.replace(/\/$/u, "");
      assertSafeArchivePath(normalizedEntryPath);
      if (extractedPaths.has(normalizedEntryPath)) {
        throw new Error(`Duplicate path in snapshot archive: ${normalizedEntryPath}.`);
      }
      extractedPaths.add(normalizedEntryPath);
      const isRegularEntry = "type" in entry
        ? entry.type === "File" || entry.type === "Directory"
        : entry.isFile() || entry.isDirectory();
      if (!isRegularEntry) {
        throw new Error("Unsupported non-file entry in snapshot archive.");
      }
      return true;
    },
  });
  const manifestPath = path.join(directory, "manifest.json");
  const manifestStat = await lstat(manifestPath);
  if (!manifestStat.isFile()) {
    throw new Error("Snapshot manifest is not a regular file.");
  }
  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Snapshot manifest is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const manifest = parseSnapshotManifest(rawManifest);
  await verifySnapshotPayload(directory, manifest);
  return {directory, manifest};
}

export async function verifySnapshotPayload(
  directory: string,
  manifest: SnapshotManifest,
): Promise<void> {
  const files = [
    {path: manifest.database.schema.path, sha256: manifest.database.schema.sha256},
    {path: manifest.database.data.path, sha256: manifest.database.data.sha256},
    ...manifest.media.objects.map((object) => ({
      path: object.archivePath,
      sha256: object.sha256,
    })),
  ];
  for (const file of files) {
    const filename = path.join(directory, ...file.path.split("/"));
    const stat = await lstat(filename).catch(() => null);
    if (!stat?.isFile()) {
      throw new Error(`Snapshot payload is missing ${file.path}.`);
    }
    const actual = await sha256File(filename);
    if (actual !== file.sha256) {
      throw new Error(`Snapshot checksum failed for ${file.path}.`);
    }
  }
  for (const object of manifest.media.objects) {
    const stat = await lstat(
      path.join(directory, ...object.archivePath.split("/")),
    );
    if (stat.size !== object.size) {
      throw new Error(`Snapshot size check failed for ${object.archivePath}.`);
    }
  }
}

export async function writeSnapshotManifest(
  directory: string,
  manifest: SnapshotManifest,
): Promise<void> {
  await writeFile(
    path.join(directory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    {encoding: "utf8", mode: 0o600},
  );
}

function sqlIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function unwrapD1Export(sql: string): string {
  return sql.split(/\r?\n/u).filter((line) => {
    const normalized = line.trim();
    return !/^(?:BEGIN\s+TRANSACTION|COMMIT);?$/iu.test(normalized) &&
      !/^PRAGMA\s+foreign_keys\s*=\s*(?:ON|OFF);?$/iu.test(normalized);
  }).join("\n").trim();
}

export function buildRestoreSql(input: {
  currentApplicationTables: readonly string[];
  dataSql: string;
  schemaSql: string;
  snapshotApplicationTables: readonly string[];
}): string {
  const tablesToDrop = [...new Set([
    ...input.currentApplicationTables,
    ...input.snapshotApplicationTables,
    "d1_migrations",
  ])].sort((left, right) => right.localeCompare(left));
  return [
    // D1 and Wrangler wrap SQL-file imports in a managed transaction. Explicit
    // transaction statements are rejected by remote D1 imports.
    "PRAGMA defer_foreign_keys=TRUE;",
    ...tablesToDrop.map((table) => `DROP TABLE IF EXISTS ${sqlIdentifier(table)};`),
    unwrapD1Export(input.schemaSql),
    unwrapD1Export(input.dataSql),
    "",
  ].join("\n");
}

export function buildRestoreFinalizationSql(instanceId: string): string {
  const officialScopes = JSON.stringify(Object.values(OAUTH_SCOPES));
  return [
    ...SNAPSHOT_TABLES.ephemeral.map((table) =>
      `DELETE FROM ${sqlIdentifier(table)};`
    ),
    `INSERT INTO ${sqlIdentifier("oauth_client")} (` +
      `${sqlIdentifier("id")}, ${sqlIdentifier("clientId")}, ` +
      `${sqlIdentifier("disabled")}, ${sqlIdentifier("skipConsent")}, ` +
      `${sqlIdentifier("scopes")}, ${sqlIdentifier("createdAt")}, ` +
      `${sqlIdentifier("updatedAt")}, ${sqlIdentifier("name")}, ` +
      `${sqlIdentifier("redirectUris")}, ` +
      `${sqlIdentifier("tokenEndpointAuthMethod")}, ` +
      `${sqlIdentifier("grantTypes")}, ${sqlIdentifier("responseTypes")}, ` +
      `${sqlIdentifier("public")}, ${sqlIdentifier("type")}, ` +
      `${sqlIdentifier("requirePKCE")}) VALUES (` +
      `${sqlString(MICROFEED_OAUTH_CLIENT_ID)}, ` +
      `${sqlString(MICROFEED_OAUTH_CLIENT_ID)}, 0, 0, ` +
      `${sqlString(officialScopes)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ` +
      `${sqlString("microfeed CLI")}, ` +
      `${sqlString(JSON.stringify([MICROFEED_OAUTH_CALLBACK_URL]))}, ` +
      `${sqlString("none")}, ` +
      `${sqlString(JSON.stringify(["authorization_code", "refresh_token"]))}, ` +
      `${sqlString(JSON.stringify(["code"]))}, 1, ${sqlString("native")}, 1);`,
    `DELETE FROM ${sqlIdentifier("microfeed_installation")};`,
    `INSERT INTO ${sqlIdentifier("microfeed_installation")} ` +
      `(${sqlIdentifier("id")}, ${sqlIdentifier("instanceId")}) VALUES ` +
      `('installation', ${sqlString(instanceId)});`,
    `UPDATE ${sqlIdentifier("settings")} SET ${sqlIdentifier("data")} = ` +
      `json_set(COALESCE(${sqlIdentifier("data")}, '{}'), ` +
      "'$.publicBucketUrl', '/media/') " +
      `WHERE ${sqlIdentifier("category")} = 'webGlobalSettings';`,
    "",
  ].join("\n");
}
