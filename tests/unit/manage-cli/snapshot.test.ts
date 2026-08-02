import {createHash} from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  truncate,
  writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";

import {afterEach, describe, expect, it, vi} from "vitest";

import {
  applicationTablesFromSqlite,
  assertClassifiedTables,
  assertSafeArchivePath,
  buildRestoreFinalizationSql,
  buildRestoreSql,
  createSnapshotArchive,
  extractSnapshotArchive,
  repositoryMigrations,
  type SnapshotManifest,
  SNAPSHOT_FORMAT,
  SNAPSHOT_VERSION,
  sha256File,
  validateAppliedMigrationPrefix,
  validateSnapshotMigrations,
  writeSnapshotManifest,
} from "../../../manage-cli/lib/snapshot";
import {repositoryRoot} from "../../../manage-cli/lib/process";
import {
  maintenanceWorkerSource,
  restoreLocalMedia,
  type SnapshotRestoreJournal,
  validateRestoreJournal,
  uploadRemoteObject,
} from "../../../manage-cli/commands";
import type {MicrofeedConfig} from "../../../manage-cli/types";
import {Miniflare} from "miniflare";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})
  ));
});

describe("snapshot migration history", () => {
  it("accepts only an ordered database-ledger prefix", async () => {
    const migrations = await repositoryMigrations();

    expect(validateAppliedMigrationPrefix(
      migrations.slice(0, 2).map(({filename}) => filename),
      migrations,
    )).toEqual(migrations.slice(0, 2));
    expect(() => validateAppliedMigrationPrefix(
      [migrations[1]!.filename],
      migrations,
    )).toThrow("diverges at position 1");
    expect(() => validateAppliedMigrationPrefix(
      [...migrations.map(({filename}) => filename), "9999_future.sql"],
      migrations,
    )).toThrow("newer than this checkout");
  });

  it("rejects newer, missing, reordered, and edited historical migrations", async () => {
    const migrations = await repositoryMigrations();
    expect(validateSnapshotMigrations(migrations.slice(0, 2), migrations))
      .toEqual({pending: migrations.slice(2)});
    expect(() => validateSnapshotMigrations(
      [...migrations, {filename: "9999_future.sql", sha256: "a".repeat(64)}],
      migrations,
    )).toThrow("newer");
    expect(() => validateSnapshotMigrations(
      [migrations[1]!],
      migrations,
    )).toThrow("diverges");
    expect(() => validateSnapshotMigrations(
      [{...migrations[0]!, sha256: "0".repeat(64)}],
      migrations,
    )).toThrow("was edited");
  });

  it("requires every application table to be classified", () => {
    expect(() => assertClassifiedTables([
      "channels",
      "items",
      "settings",
      "future_queue",
    ])).toThrow("future_queue");
    expect(applicationTablesFromSqlite([
      "_cf_KV",
      "channels",
      "d1_migrations",
      "sqlite_sequence",
    ])).toEqual(["channels"]);
  });
});

function createMigrationLedger(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function applyMigrationRange(
  database: DatabaseSync,
  migrations: Awaited<ReturnType<typeof repositoryMigrations>>,
  start: number,
  end: number,
): Promise<void> {
  for (const migration of migrations.slice(start, end)) {
    database.exec(await readFile(
      path.join(repositoryRoot, "migrations", migration.filename),
      "utf8",
    ));
    database.prepare("INSERT INTO d1_migrations (name) VALUES (?)")
      .run(migration.filename);
  }
}

function insertRepresentativeData(database: DatabaseSync, position: number): void {
  database.exec(`
    INSERT INTO channels (id, status, is_primary, data)
      VALUES ('channel0001', 1, 1, '{"title":"Saved channel"}');
    INSERT INTO items (id, status, data)
      VALUES ('item0000001', 1, '{"title":"Saved item"}');
    INSERT INTO settings (category, data)
      VALUES ('webGlobalSettings', '{"publicBucketUrl":"https://old.example/media/"}');
  `);
  if (position >= 2) {
    database.exec(`
      INSERT INTO auth_user
        (id, name, email, emailVerified, createdAt, updatedAt, role)
      VALUES
        ('owner', 'Owner', 'owner@example.com', 1,
         '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'admin');
      INSERT INTO auth_account
        (id, accountId, providerId, userId, password, createdAt, updatedAt)
      VALUES
        ('credential', 'owner', 'credential', 'owner', 'password-hash',
         '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    `);
  }
}

function quoteSql(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

function snapshotSql(database: DatabaseSync): {data: string; schema: string} {
  const schemaRows = database.prepare(
    "SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND " +
      "name NOT LIKE 'sqlite_%' ORDER BY type DESC, name",
  ).all() as Array<{sql: string}>;
  const tables = database.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND " +
      "name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all() as Array<{name: string}>;
  const data: string[] = [];
  for (const {name} of tables) {
    if ([
      "auth_password_setup",
      "auth_rate_limit",
      "auth_session",
      "auth_verification",
      "microfeed_installation",
    ].includes(name)) {
      continue;
    }
    const rows = database.prepare(`SELECT * FROM "${name}" ORDER BY rowid`)
      .all() as Array<Record<string, unknown>>;
    for (const row of rows) {
      const columns = Object.keys(row).map((column) => `"${column}"`).join(", ");
      data.push(
        `INSERT INTO "${name}" (${columns}) VALUES (` +
          `${Object.values(row).map(quoteSql).join(", ")});`,
      );
    }
  }
  return {
    data: data.join("\n"),
    schema: schemaRows.map(({sql}) => `${sql};`).join("\n"),
  };
}

describe("migration upgrades from historical snapshot positions", () => {
  it("upgrades both a normal database and a schema/data snapshot from every released head", async () => {
    const migrations = await repositoryMigrations();
    for (let position = 1; position <= migrations.length; position += 1) {
      const normal = new DatabaseSync(":memory:");
      createMigrationLedger(normal);
      await applyMigrationRange(normal, migrations, 0, position);
      insertRepresentativeData(normal, position);
      await applyMigrationRange(normal, migrations, position, migrations.length);

      const source = new DatabaseSync(":memory:");
      createMigrationLedger(source);
      await applyMigrationRange(source, migrations, 0, position);
      insertRepresentativeData(source, position);
      const exported = snapshotSql(source);
      const restored = new DatabaseSync(":memory:");
      restored.exec(exported.schema);
      restored.exec(
        `PRAGMA defer_foreign_keys=ON; BEGIN TRANSACTION;\n${exported.data}\nCOMMIT;`,
      );
      await applyMigrationRange(restored, migrations, position, migrations.length);

      for (const database of [normal, restored]) {
        const ledger = database.prepare(
          "SELECT name FROM d1_migrations ORDER BY id",
        ).all() as Array<{name: string}>;
        expect(ledger.map(({name}) => name)).toEqual(
          migrations.map(({filename}) => filename),
        );
        expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
        expect(database.prepare(
          "SELECT json_extract(data, '$.title') AS title FROM channels",
        ).get()).toEqual({title: "Saved channel"});
        const tables = database.prepare(
          "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name",
        ).all() as Array<{name: string}>;
        expect(() => assertClassifiedTables(
          applicationTablesFromSqlite(tables.map(({name}) => name)),
        )).not.toThrow();
        if (position >= 2) {
          expect(database.prepare(
            "SELECT email FROM auth_user WHERE id = 'owner'",
          ).get()).toEqual({email: "owner@example.com"});
          expect(database.prepare(
            "SELECT password FROM auth_account WHERE id = 'credential'",
          ).get()).toEqual({password: "password-hash"});
        }
      }
      normal.close();
      source.close();
      restored.close();
    }
  });

  it("covers column, data, index, and authentication transformations in fixture history", async () => {
    const fixtureDirectory = path.join(
      repositoryRoot,
      "tests",
      "fixtures",
      "snapshot-migrations",
    );
    const fixtures = (await import("node:fs/promises")).readdir(fixtureDirectory);
    const filenames = (await fixtures).sort();
    const database = new DatabaseSync(":memory:");
    for (const filename of filenames) {
      database.exec(await readFile(path.join(fixtureDirectory, filename), "utf8"));
    }
    expect(database.prepare(
      "SELECT slug FROM fixture_channels WHERE id = 'fixture'",
    ).get()).toEqual({slug: "migrated-title"});
    expect(database.prepare(
      "SELECT role FROM fixture_auth_user WHERE id = 'owner'",
    ).get()).toEqual({role: "administrator"});
    expect(database.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'index' AND " +
        "name = 'fixture_channels_slug_idx'",
    ).get()).toEqual({name: "fixture_channels_slug_idx"});
    database.close();
  });

  it("surfaces a failed forward migration without advancing its ledger", async () => {
    const database = new DatabaseSync(":memory:");
    createMigrationLedger(database);
    database.exec("CREATE TABLE stable_data (id TEXT PRIMARY KEY);");
    database.prepare("INSERT INTO stable_data (id) VALUES (?)").run("preserved");
    const failedMigration = await readFile(path.join(
      repositoryRoot,
      "tests",
      "fixtures",
      "snapshot-migrations-failed",
      "0006_failure.sql",
    ), "utf8");

    expect(() => database.exec(failedMigration)).toThrow();
    expect(database.prepare("SELECT id FROM stable_data").get()).toEqual({
      id: "preserved",
    });
    expect(database.prepare("SELECT name FROM d1_migrations").all()).toEqual([]);
    database.close();
  });
});

describe("remote restore resume journal", () => {
  const config: MicrofeedConfig = {
    accountId: "account-id",
    adminPath: "admin",
    completedSteps: [],
    customDomain: null,
    d1: {id: "database-id", name: "target-db", reuse: false},
    deploymentUrl: "https://target.example.workers.dev",
    hosting: "cloudflare",
    instanceId: "instance-id",
    instanceName: "target",
    projectName: "target",
    r2: {name: "target-media", reuse: false},
  };
  const journal: SnapshotRestoreJournal = {
    accountId: "account-id",
    archiveSha256: "a".repeat(64),
    databaseId: "database-id",
    instanceId: "instance-id",
    r2BucketName: "target-media",
    stage: "migrations-applied",
    startedAt: "2026-08-01T00:00:00.000Z",
  };

  it("resumes only the identical archive against the identical target", () => {
    expect(() => validateRestoreJournal(
      journal,
      config,
      "a".repeat(64),
    )).not.toThrow();
    expect(() => validateRestoreJournal(
      journal,
      config,
      "b".repeat(64),
    )).toThrow("different snapshot restore");
    expect(() => validateRestoreJournal(
      journal,
      {...config, d1: {...config.d1, id: "replacement-db"}},
      "a".repeat(64),
    )).toThrow("different snapshot restore");
  });

  it("generates a syntactically valid maintenance Worker with streamed multipart cleanup", () => {
    const source = maintenanceWorkerSource();
    expect(() => new Function(
      source.replace("export default", "return"),
    )).not.toThrow();
    expect(source).toContain("uploadPart(partNumber, request.body)");
    expect(source).toContain(".abort()");
    expect(source).toContain("status: 503");
  });

  it("aborts an incomplete remote multipart upload after a streamed part failure", async () => {
    const directory = await temporaryDirectory("microfeed-multipart-");
    await mkdir(path.join(directory, "media"));
    const filename = path.join(directory, "media", "00000001");
    await writeFile(filename, "");
    await truncate(filename, 9 * 1024 * 1024);
    const actions: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (
      input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      const action = url.searchParams.get("action") ?? "";
      actions.push(action);
      if (action === "create") {
        return Response.json({uploadId: "upload-id"});
      }
      if (action === "part") {
        const stream = init?.body as unknown as AsyncIterable<Uint8Array>;
        for await (const _chunk of stream) {
          // Consume the file stream so its descriptor is closed in the test.
        }
        return Response.json({error: "injected failure"}, {status: 500});
      }
      if (action === "abort") {
        return Response.json({aborted: true});
      }
      throw new Error(`Unexpected action: ${action}`);
    }));

    await expect(uploadRemoteObject(
      "https://restore.example.test/__microfeed_snapshot_restore/v1",
      "token",
      directory,
      {
        archivePath: "media/00000001",
        customMetadata: {},
        etag: null,
        httpMetadata: {contentType: "application/octet-stream"},
        key: "production/large.bin",
        sha256: "0".repeat(64),
        size: 9 * 1024 * 1024,
        storageClass: "Standard",
        uploaded: null,
      },
    )).rejects.toThrow("injected failure");
    expect(actions).toEqual(["create", "part", "abort"]);
  });
});

describe("snapshot archive validation", () => {
  it("round-trips a checksummed archive and rejects corrupted payloads", async () => {
    const source = await temporaryDirectory("microfeed-snapshot-test-");
    await mkdir(path.join(source, "database"));
    await mkdir(path.join(source, "media"));
    await writeFile(path.join(source, "database", "schema.sql"), "CREATE TABLE channels(id TEXT);\n");
    await writeFile(path.join(source, "database", "data.sql"), "\n");
    await writeFile(path.join(source, "media", "00000001"), "media-body");
    const migrations = await repositoryMigrations();
    const manifest: SnapshotManifest = {
      createdAt: "2026-08-01T00:00:00.000Z",
      database: {
        data: {
          path: "database/data.sql",
          sha256: await sha256File(path.join(source, "database", "data.sql")),
        },
        migrations: migrations.slice(0, 1),
        rowCounts: {channels: 0},
        schema: {
          path: "database/schema.sql",
          sha256: await sha256File(path.join(source, "database", "schema.sql")),
        },
        tables: {
          durable: ["channels"],
          ephemeral: [],
          internal: [],
          targetSpecific: [],
        },
      },
      format: SNAPSHOT_FORMAT,
      media: {
        objectCount: 1,
        objects: [{
          archivePath: "media/00000001",
          customMetadata: {source: "fixture"},
          etag: "etag",
          httpMetadata: {contentType: "text/plain"},
          key: "production/example.txt",
          sha256: createHash("sha256").update("media-body").digest("hex"),
          size: 10,
          storageClass: "Standard",
          uploaded: "2026-08-01T00:00:00.000Z",
        }],
        totalBytes: 10,
      },
      source: {
        databaseName: "source-db",
        deploymentEnvironment: "production",
        instanceName: "source",
        projectName: "source",
        r2BucketName: "source-media",
      },
      version: SNAPSHOT_VERSION,
    };
    await writeSnapshotManifest(source, manifest);
    const archive = path.join(await temporaryDirectory("microfeed-archive-"), "backup.tar.gz");
    await createSnapshotArchive(source, archive);
    const extracted = await temporaryDirectory("microfeed-extracted-");
    await expect(extractSnapshotArchive(archive, extracted)).resolves.toMatchObject({
      manifest: {format: SNAPSHOT_FORMAT, version: SNAPSHOT_VERSION},
    });

    await writeFile(path.join(source, "media", "00000001"), "corrupt");
    const corruptArchive = path.join(
      await temporaryDirectory("microfeed-corrupt-archive-"),
      "backup.tar.gz",
    );
    await createSnapshotArchive(source, corruptArchive);
    await expect(extractSnapshotArchive(
      corruptArchive,
      await temporaryDirectory("microfeed-corrupt-extracted-"),
    )).rejects.toThrow("checksum failed");
  });

  it("rejects traversal, absolute, and undeclared archive paths", () => {
    expect(() => assertSafeArchivePath("../secret")).toThrow("Unsafe path");
    expect(() => assertSafeArchivePath("/absolute")).toThrow("Unsafe path");
    expect(() => assertSafeArchivePath("media/not-an-object-name")).toThrow(
      "Unexpected path",
    );
  });

  it("builds one transaction that restores source state and rewrites target identity", () => {
    const sql = buildRestoreSql({
      currentApplicationTables: ["new_table"],
      dataSql: "BEGIN TRANSACTION;\nINSERT INTO settings VALUES ('webGlobalSettings', '{}', NULL, NULL);\nCOMMIT;",
      schemaSql: "BEGIN TRANSACTION;\nCREATE TABLE settings(category TEXT PRIMARY KEY, data TEXT, created_at TEXT, updated_at TEXT);\nCREATE TABLE microfeed_installation(id TEXT PRIMARY KEY, instanceId TEXT);\nCOMMIT;",
      snapshotApplicationTables: ["settings", "microfeed_installation"],
    });
    expect(sql.match(/BEGIN TRANSACTION;/gu)).toHaveLength(1);
    expect(sql.match(/COMMIT;/gu)).toHaveLength(1);
    expect(sql).toContain('DROP TABLE IF EXISTS "new_table"');
    expect(sql).not.toContain("target-instance");
    const finalization = buildRestoreFinalizationSql("target-instance");
    expect(finalization).toContain("target-instance");
    expect(finalization).toContain("'$.publicBucketUrl', '/media/'");
    expect(finalization).toContain('DELETE FROM "auth_session"');
  });

  it("finalizes target identity and clears every ephemeral authentication table", async () => {
    const database = new DatabaseSync(":memory:");
    const migrations = await repositoryMigrations();
    createMigrationLedger(database);
    await applyMigrationRange(database, migrations, 0, migrations.length);
    insertRepresentativeData(database, migrations.length);
    database.exec(`
      INSERT INTO auth_session
        (id, expiresAt, token, createdAt, updatedAt, userId)
      VALUES
        ('session', '2027-01-01', 'token', '2026-01-01', '2026-01-01', 'owner');
      INSERT INTO auth_verification
        (id, identifier, value, expiresAt, createdAt, updatedAt)
      VALUES
        ('verification', 'owner', 'secret', '2027-01-01', '2026-01-01', '2026-01-01');
      INSERT INTO auth_rate_limit (id, key, count, lastRequest)
      VALUES ('rate', 'owner', 1, 1);
      INSERT INTO auth_password_setup
        (id, purpose, email, userId, tokenHash, createdAt, expiresAt)
      VALUES
        ('owner', 'reset', 'owner@example.com', 'owner', 'hash',
         '2026-01-01', '2027-01-01');
      INSERT INTO microfeed_installation (id, instanceId)
      VALUES ('installation', 'source-instance');
    `);

    database.exec(buildRestoreFinalizationSql("target-instance"));

    for (const table of [
      "auth_session",
      "auth_verification",
      "auth_rate_limit",
      "auth_password_setup",
    ]) {
      expect(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get())
        .toEqual({count: 0});
    }
    expect(database.prepare(
      "SELECT instanceId FROM microfeed_installation",
    ).get()).toEqual({instanceId: "target-instance"});
    expect(database.prepare(
      "SELECT json_extract(data, '$.publicBucketUrl') AS url FROM settings",
    ).get()).toEqual({url: "/media/"});
    expect(database.prepare(
      "SELECT password FROM auth_account WHERE id = 'credential'",
    ).get()).toEqual({password: "password-hash"});
    database.close();
  });

  it("restores local R2 bodies and metadata into Wrangler's persistence layout", async () => {
    const directory = await temporaryDirectory("microfeed-local-r2-");
    const persistence = path.join(directory, "local-state");
    await mkdir(path.join(directory, "media"), {recursive: true});
    await writeFile(path.join(directory, "media", "00000001"), "local media");
    const config: MicrofeedConfig = {
      accountId: null,
      adminPath: "admin",
      completedSteps: [],
      customDomain: null,
      d1: {id: "local", name: "local-db", reuse: false},
      deploymentUrl: "http://localhost:4321",
      hosting: "local",
      instanceId: "local-instance",
      instanceName: "local-restore",
      projectName: "local-restore",
      r2: {name: "local-media", reuse: false},
    };
    await restoreLocalMedia(config, directory, persistence, [{
      archivePath: "media/00000001",
      customMetadata: {owner: "快照"},
      etag: null,
      httpMetadata: {
        cacheExpiry: "2026-09-01T00:00:00.000Z",
        contentType: "text/plain",
      },
      key: "production/你好.txt",
      sha256: createHash("sha256").update("local media").digest("hex"),
      size: 11,
      storageClass: "Standard",
      uploaded: null,
    }]);

    const miniflare = new Miniflare({
      defaultPersistRoot: path.join(persistence, "v3"),
      modules: true,
      r2Buckets: {MEDIA_BUCKET: config.r2.name},
      script: "export default {fetch() { return new Response(null, {status: 404}); }};",
    });
    try {
      const bucket = await miniflare.getR2Bucket("MEDIA_BUCKET") as unknown as {
        get: (key: string) => Promise<{
          customMetadata: Record<string, string>;
          httpMetadata: {cacheExpiry?: Date; contentType?: string};
          text: () => Promise<string>;
        } | null>;
      };
      const object = await bucket.get("production/你好.txt");
      expect(await object?.text()).toBe("local media");
      expect(object?.httpMetadata.contentType).toBe("text/plain");
      expect(object?.httpMetadata.cacheExpiry?.toISOString()).toBe(
        "2026-09-01T00:00:00.000Z",
      );
      expect(object?.customMetadata).toEqual({owner: "快照"});
    } finally {
      await miniflare.dispose();
    }
  });
});
