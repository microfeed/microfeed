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
  migrationIndexDefinitions,
  repositoryMigrations,
  type SnapshotManifest,
  SNAPSHOT_FORMAT,
  SNAPSHOT_TABLES,
  SNAPSHOT_VERSION,
  sha256File,
  validateAppliedMigrationPrefix,
  validateSnapshotMigrations,
  writeSnapshotManifest,
} from "../../../manage-cli/lib/snapshot";
import {repositoryRoot} from "../../../manage-cli/lib/process";
import {ITEM_SEARCH_VIRTUAL_TABLE_PREFIXES} from "../../../src/shared/ItemSearchSql";
import {
  canRepairRemoteRestoreBaseline,
  formatSnapshotBytes,
  localSnapshotNextSteps,
  maintenanceWorkerSource,
  remoteRestoreBaselineRepairNotice,
  remoteRestoreTargetReadinessError,
  remoteSnapshotNextSteps,
  reverifyRemoteRestoreTargetIfFingerprintChanged,
  restoreLocalMedia,
  restoredRemoteMediaMismatch,
  snapshotCreatedMessage,
  snapshotMaintenanceRouting,
  snapshotMediaProgressMessage,
  type SnapshotRestoreJournal,
  snapshotWorkerErrorDetail,
  validateRemoteRestoreBaselineRepair,
  validateRestoreJournal,
  verifyRestoredRemoteMediaWithRetries,
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
      "d1_kv",
      "d1_migrations",
      "site_search_exact",
      "site_search_exact_data",
      "site_search_title_trigram_idx",
      "sqlite_sequence",
    ])).toEqual(["channels"]);
    expect(SNAPSHOT_TABLES.internal).toContain("d1_kv");
    expect(SNAPSHOT_TABLES.ephemeral).toContain("item_create_idempotency");
    expect(SNAPSHOT_TABLES.ephemeral).toContain("item_search_metadata");
    expect(SNAPSHOT_TABLES.ephemeral).toContain("site_search_documents");
    expect(SNAPSHOT_TABLES.durable).toContain("pages");
    expect(SNAPSHOT_TABLES.durable).toContain("site_files");
  });

  it("extracts explicit index definitions without matching comments or data", () => {
    expect(migrationIndexDefinitions(`
      -- CREATE INDEX ignored_comment ON channels(status);
      CREATE TABLE channels (id TEXT, status INTEGER, note TEXT);
      INSERT INTO channels VALUES ('id', 1, 'CREATE INDEX ignored_data;');
      CREATE UNIQUE INDEX IF NOT EXISTS "channel status"
        ON channels(status);
      /* CREATE INDEX ignored_block ON channels(note); */
      CREATE INDEX [channel_note] ON channels(note);
    `)).toEqual([
      {
        name: "channel status",
        sql: "CREATE UNIQUE INDEX IF NOT EXISTS \"channel status\"\n" +
          "        ON channels(status);",
      },
      {
        name: "channel_note",
        sql: "CREATE INDEX [channel_note] ON channels(note);",
      },
    ]);
  });
});

describe("snapshot command progress", () => {
  it("formats live media progress and the successful archive path", () => {
    expect(formatSnapshotBytes(0)).toBe("0 B");
    expect(formatSnapshotBytes(1536)).toBe("1.5 KiB");
    expect(snapshotMediaProgressMessage({
      downloadedBytes: 1536,
      objectCount: 4,
      objectNumber: 2,
      totalBytes: 4 * 1024,
    })).toBe("Downloading R2 media: object 2 of 4; 1.5 KiB of 4.0 KiB");
    expect(snapshotMediaProgressMessage({
      downloadedBytes: 0,
      objectCount: 0,
      objectNumber: 0,
      totalBytes: 0,
    })).toBe("R2 media bucket is empty; no objects to download");
    expect(snapshotCreatedMessage("/tmp/microfeed-org.tar.gz")).toBe(
      "✅ Snapshot created at /tmp/microfeed-org.tar.gz. It contains " +
        "sensitive data, is unencrypted, and is readable only by your user account.",
    );
  });

  it("prints the exact local login setup command only when it is needed", () => {
    expect(localSnapshotNextSteps("microfeed-org-local", true)).toBe(
      "Set up the local dashboard login:\n\n" +
        "yarn manage auth setup \\\n" +
        "  --instance microfeed-org-local\n\n" +
        "Then run `yarn dev --instance microfeed-org-local` to start it.",
    );
    expect(localSnapshotNextSteps("microfeed-org-local", false)).toBe(
      "Run `yarn dev --instance microfeed-org-local` to start it.",
    );
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
  if (position < 6) {
    database.exec(`
      INSERT INTO settings (category, data)
      VALUES (
        'apiSettings',
        '{"enabled":true,"apps":[{"id":"snapshot-api-key","name":"Snapshot integration","token":"snapshot-secret","createdAtMs":1725000000000}]}'
      );
    `);
  } else {
    database.exec(`
      INSERT INTO api_keys
        (id, name, api_key, created_at_ms, updated_at_ms)
      VALUES
        ('snapshot-api-key', 'Snapshot integration', 'snapshot-secret',
         1725000000000, 1725000000000);
    `);
  }
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

function snapshotSql(
  database: DatabaseSync,
  includeIndexes = true,
): {data: string; schema: string} {
  const allTables = database.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND " +
      "name NOT LIKE 'sqlite_%' ORDER BY name",
  ).all() as Array<{name: string}>;
  const exportedTables = new Set([
    ...applicationTablesFromSqlite(allTables.map(({name}) => name)),
    "d1_migrations",
  ]);
  const schemaRows = (database.prepare(
    "SELECT name, sql, tbl_name, type FROM sqlite_schema " +
      "WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' " +
      `${includeIndexes ? "" : "AND type <> 'index' "}` +
      "ORDER BY type DESC, name",
  ).all() as Array<{
    name: string;
    sql: string;
    tbl_name: string;
    type: string;
  }>).filter(({name, tbl_name, type}) =>
    exportedTables.has(type === "table" ? name : tbl_name) &&
    !name.startsWith("item_search_") &&
    !name.startsWith("items_search_") &&
    !name.startsWith("items_site_search_") &&
    !name.startsWith("pages_site_search_") &&
    !name.startsWith("site_search_documents_after_") &&
    !ITEM_SEARCH_VIRTUAL_TABLE_PREFIXES.some((prefix) =>
      name === prefix || name.startsWith(`${prefix}_`)
    )
  );
  const data: string[] = [];
  for (const name of exportedTables) {
    if (new Set<string>([
      ...SNAPSHOT_TABLES.ephemeral,
      ...SNAPSHOT_TABLES.targetSpecific,
    ]).has(name)) {
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
      const exported = snapshotSql(source, false);
      const restored = new DatabaseSync(":memory:");
      restored.exec(exported.schema);
      restored.exec(
        `PRAGMA defer_foreign_keys=ON; BEGIN TRANSACTION;\n${exported.data}\nCOMMIT;`,
      );
      const repairedIndexes: string[] = [];
      for (const migration of migrations.slice(0, position)) {
        repairedIndexes.push(...migrationIndexDefinitions(await readFile(
          path.join(repositoryRoot, "migrations", migration.filename),
          "utf8",
        )).map(({sql}) => sql));
      }
      restored.exec(repairedIndexes.join("\n"));
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
        expect(database.prepare(
          "SELECT id, name, api_key FROM api_keys WHERE id = 'snapshot-api-key'",
        ).get()).toEqual({
          api_key: "snapshot-secret",
          id: "snapshot-api-key",
          name: "Snapshot integration",
        });
        const indexes = database.prepare(
          "SELECT name FROM sqlite_schema WHERE type = 'index' AND " +
            "sql IS NOT NULL ORDER BY name",
        ).all() as Array<{name: string}>;
        expect(indexes.map(({name}) => name)).toEqual(
          (await Promise.all(migrations.map(async (migration) =>
            migrationIndexDefinitions(await readFile(
              path.join(repositoryRoot, "migrations", migration.filename),
              "utf8",
            ))
          ))).flat().map(({name}) => name).sort(),
        );
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
    r2: {name: "target-media", reuse: false, setupMode: "automatic"},
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

  it("temporarily enables a private workers.dev control endpoint", () => {
    expect(snapshotMaintenanceRouting(config)).toEqual({
      preview_urls: false,
      routes: [],
      workers_dev: true,
    });
    expect(snapshotMaintenanceRouting({
      ...config,
      customDomain: "copy.example.com",
    })).toEqual({
      preview_urls: false,
      routes: [{
        custom_domain: true,
        pattern: "copy.example.com",
      }],
      workers_dev: true,
    });
  });

  it("summarizes an HTML endpoint error instead of printing the whole page", () => {
    expect(snapshotWorkerErrorDetail(
      "<!doctype html><title>Page not found</title><body>large page</body>",
      "text/html; charset=UTF-8",
    )).toBe(
      "Cloudflare returned an HTML page titled `Page not found` instead of " +
        "the maintenance API.",
    );
    expect(snapshotWorkerErrorDetail("", "text/plain")).toBe(
      "No error detail was returned.",
    );
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

  it("reports exact restored R2 inventory differences", () => {
    const object = {
      archivePath: "media/00000001",
      customMetadata: {},
      etag: null,
      httpMetadata: {
        cacheControl: "no-cache",
        contentType: "image/png",
      },
      key: "production/cover.png",
      sha256: "0".repeat(64),
      size: 12,
      storageClass: "Standard",
      uploaded: null,
    };
    expect(restoredRemoteMediaMismatch([object], [{
      customMetadata: {},
      httpMetadata: {contentType: "image/png"},
      key: object.key,
      size: 11,
      storageClass: "Standard",
    }, {
      key: "unexpected.txt",
      size: 1,
    }])).toBe(
      "Restored R2 verification found 3 differences (snapshot: 1 objects; " +
        "restored: 2 objects):\n" +
        "- \"production/cover.png\" has 11 bytes; expected 12\n" +
        "- \"production/cover.png\" metadata is " +
        '{"customMetadata":{},"httpMetadata":{"contentType":"image/png"},' +
        '"storageClass":"Standard"}; expected ' +
        '{"customMetadata":{},"httpMetadata":{"cacheControl":"no-cache",' +
        '"contentType":"image/png"},"storageClass":"Standard"}\n' +
        '- unexpected object "unexpected.txt"',
    );
    expect(restoredRemoteMediaMismatch([object], [{
      customMetadata: {},
      httpMetadata: object.httpMetadata,
      key: object.key,
      size: object.size,
      storageClass: object.storageClass,
    }])).toBeNull();
  });

  it("retries a transient restored R2 inventory mismatch", async () => {
    const object = {
      archivePath: "media/00000001",
      customMetadata: {},
      etag: null,
      httpMetadata: {contentType: "image/png"},
      key: "production/cover.png",
      sha256: "0".repeat(64),
      size: 12,
      storageClass: "Standard",
      uploaded: null,
    };
    const list = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([object]);
    const pause = vi.fn(async () => undefined);
    const onRetry = vi.fn();

    await verifyRestoredRemoteMediaWithRetries({
      expected: [object],
      list,
      onRetry,
      pause,
      retryDelays: [25],
    });

    expect(list).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledWith(25);
    expect(onRetry).toHaveBeenCalledWith(
      25,
      expect.stringContaining('missing object "production/cover.png"'),
    );
  });

  it("reports a restored R2 mismatch after every retry", async () => {
    await expect(verifyRestoredRemoteMediaWithRetries({
      expected: [],
      list: async () => [{key: "unexpected.txt", size: 1}],
      pause: async () => undefined,
      retryDelays: [0, 0],
    })).rejects.toThrow('unexpected object "unexpected.txt"');
  });
});

describe("remote restore target readiness", () => {
  const config: MicrofeedConfig = {
    accountId: "account-id",
    adminPath: "admin",
    completedSteps: ["d1-ready", "r2-ready"],
    customDomain: null,
    d1: {id: "database-id", name: "restored-podcast-db", reuse: false},
    deploymentUrl: null,
    hosting: "cloudflare",
    instanceId: "instance-id",
    instanceName: "restored-podcast",
    projectName: "restored-podcast",
    r2: {
      name: "restored-podcast-media",
      reuse: false,
      setupMode: "automatic",
    },
  };

  it("explains that a valid archive still needs a completed target", () => {
    expect(remoteRestoreTargetReadinessError(config)).toBe(
      "Snapshot archive validation passed, but instance `restored-podcast` " +
        "is not ready for remote restore. Initialization did not finish " +
        "successfully, so the CLI never recorded the fresh-target safety " +
        "fingerprint for its D1 database and R2 bucket. Initialization must " +
        "complete successfully before you retry remote restore. Remote " +
        "restore did not start; no target data was changed.",
    );
  });

  it("identifies reused resources and accepts a recorded fresh target", () => {
    const resumedConfig: MicrofeedConfig = {
      ...config,
      completedSteps: [
        "d1-ready",
        "r2-ready",
        "worker-deployed",
        "deployment-verified",
      ],
      d1: {...config.d1, reuse: true},
      r2: {...config.r2, reuse: true},
    };
    const resumedError = remoteRestoreTargetReadinessError(resumedConfig);
    expect(resumedError).toContain(
      "The CLI has no fresh-target safety fingerprint, so it cannot prove",
    );
    expect(resumedError).toContain(
      "D1 database `restored-podcast-db` is marked as reused. " +
        "R2 bucket `restored-podcast-media` is marked as reused.",
    );
    expect(resumedError).toContain(
      "Run the restore with `--dry-run`. The CLI will automatically repair",
    );
    expect(canRepairRemoteRestoreBaseline(resumedConfig)).toBe(true);
    expect(canRepairRemoteRestoreBaseline(config)).toBe(false);
    expect(remoteRestoreTargetReadinessError({
      ...resumedConfig,
      restoreBaseline: {
        createdAt: "2026-08-02T00:00:00.000Z",
        fingerprint: "fingerprint",
      },
    })).toBeNull();
  });

  it("explains automatic local fingerprint repair without asking a question", () => {
    const notice = remoteRestoreBaselineRepairNotice(config);
    expect(notice.title).toBe("Fresh snapshot restore target verified");
    expect(notice.message).toContain(
      "Snapshot restore: not started\nCloudflare changes: none",
    );
    expect(notice.message).toContain(
      "Local safety record: saving automatically so the later restore will " +
        "refuse to start if this target changes",
    );
  });

  it("fully reverifies a target when its saved fingerprint changed", async () => {
    const reverify = vi.fn(async () => undefined);
    await expect(reverifyRemoteRestoreTargetIfFingerprintChanged({
      currentFingerprint: "after-first-page-bootstrap",
      expectedFingerprint: "after-initialization",
      reverify,
    })).resolves.toBe(true);
    expect(reverify).toHaveBeenCalledOnce();
  });

  it("uses a matching fingerprint without running the expensive recheck", async () => {
    const reverify = vi.fn(async () => undefined);
    await expect(reverifyRemoteRestoreTargetIfFingerprintChanged({
      currentFingerprint: "unchanged",
      expectedFingerprint: "unchanged",
      reverify,
    })).resolves.toBe(false);
    expect(reverify).not.toHaveBeenCalled();
  });

  it("rejects fingerprint drift when the full freshness proof fails", async () => {
    await expect(reverifyRemoteRestoreTargetIfFingerprintChanged({
      currentFingerprint: "changed",
      expectedFingerprint: "saved",
      reverify: async () => {
        throw new Error("D1 contains user-created content");
      },
    })).rejects.toThrow("D1 contains user-created content");
  });
});

describe("remote snapshot next steps", () => {
  it("prints the exact login setup command when the snapshot has no owner", () => {
    expect(remoteSnapshotNextSteps("microfeed-copy1", true)).toBe(
      "Remote restore complete for microfeed-copy1.\n\n" +
        "The snapshot did not contain an administrator login. Set it up now:\n\n" +
        "yarn manage auth setup \\\n" +
        "  --instance microfeed-copy1",
    );
  });

  it("does not request setup when the restored owner was preserved", () => {
    expect(remoteSnapshotNextSteps("microfeed-copy1", false)).toBe(
      "Remote restore complete for microfeed-copy1.",
    );
  });
});

describe("remote restore baseline repair", () => {
  const applicationTables = [
    ...SNAPSHOT_TABLES.durable,
    ...SNAPSHOT_TABLES.ephemeral,
    ...SNAPSHOT_TABLES.targetSpecific,
  ];
  const valid = {
    allowInitialPasswordSetup: true,
    applicationRowCounts: Object.fromEntries(
      [...SNAPSHOT_TABLES.durable, ...SNAPSHOT_TABLES.ephemeral]
        .map((table) => [table, 0]),
    ),
    applicationTables,
    appliedMigrations: ["0001.sql", "0002.sql"],
    bootstrapChannelRows: [],
    bootstrapSettingRows: [],
    bootstrapWorkerName: "restored-podcast",
    currentIndexes: ["channels_status"],
    currentMigrations: ["0001.sql", "0002.sql"],
    expectedInstanceId: "target-instance-id",
    expectedIndexes: ["channels_status"],
    expectedPublicOrigins: ["https://copy.example.com"],
    initialPasswordSetupRows: [],
    installationInstanceIds: ["target-instance-id"],
    r2ObjectCount: 0,
  };

  it("accepts a current target with no application rows", () => {
    expect(() => validateRemoteRestoreBaselineRepair(valid)).not.toThrow();
  });

  const bootstrapChannelRows = [{
    data: JSON.stringify({
      categories: [],
      copyright: "©{{current_year}}",
      image: "/assets/default/channel-image.png",
      "itunes:block": false,
      "itunes:complete": false,
      "itunes:explicit": false,
      "itunes:type": "episodic",
      language: "en-us",
      link: "https://copy.example.com",
    }),
    id: "Abc_123-Xyz",
    is_primary: 1,
    status: 1,
  }];
  const bootstrapSettingRows = [
    {category: "access", data: JSON.stringify({currentPolicy: "public"})},
    {category: "analytics", data: JSON.stringify({})},
    {category: "customCode", data: JSON.stringify({})},
    {
      category: "subscribeMethods",
      data: JSON.stringify({methods: [
        {
          editable: false,
          enabled: true,
          id: "Rss_123-Abc",
          image: "/assets/brands/subscribe/rss.png",
          name: "RSS",
          type: "rss",
          url: "",
        },
        {
          editable: false,
          enabled: true,
          id: "Json123-Abc",
          image: "/assets/brands/subscribe/json.png",
          name: "JSON",
          type: "json",
          url: "",
        },
      ]}),
    },
    {
      category: "webGlobalSettings",
      data: JSON.stringify({
        favicon: {
          contentType: "image/png",
          url: "/assets/default/favicon.png",
        },
        itemsPerPage: 20,
        itemsSortOrder: "newest_first",
        publicBucketUrl: "/media/",
      }),
    },
  ];

  it("accepts the automatic channel and settings bootstrap rows", () => {
    expect(() => validateRemoteRestoreBaselineRepair({
      ...valid,
      applicationRowCounts: {
        ...valid.applicationRowCounts,
        channels: 1,
        settings: 5,
      },
      bootstrapChannelRows,
      bootstrapSettingRows,
    })).not.toThrow();
  });

  it("accepts the canonical automatic settings bootstrap rows", () => {
    const canonicalBootstrapRows = bootstrapSettingRows.map((row) =>
      row.category === "webGlobalSettings"
        ? {
            ...row,
            data: JSON.stringify({
              favicon: {
                contentType: "image/png",
                url: "/assets/default/favicon.png",
              },
              itemsOrder: "desc",
              itemsPerPage: 20,
              itemsSort: "published_at",
              publicBucketUrl: "/media/",
            }),
          }
        : row
    );

    expect(() => validateRemoteRestoreBaselineRepair({
      ...valid,
      applicationRowCounts: {
        ...valid.applicationRowCounts,
        channels: 1,
        settings: 5,
      },
      bootstrapChannelRows,
      bootstrapSettingRows: canonicalBootstrapRows,
    })).not.toThrow();
  });

  const initialPasswordSetup = {
    createdAt: "2026-08-02T20:00:00.000Z",
    email: "owner@example.com",
    expiresAt: "2026-08-02T20:30:00.000Z",
    id: "owner",
    purpose: "initial",
    tokenHash: "a".repeat(64),
    userId: null,
  };

  it("accepts the pending initial password link created during initialization", () => {
    expect(() => validateRemoteRestoreBaselineRepair({
      ...valid,
      applicationRowCounts: {
        ...valid.applicationRowCounts,
        auth_password_setup: 1,
      },
      initialPasswordSetupRows: [initialPasswordSetup],
    })).not.toThrow();
  });

  it.each([
    {
      change: {purpose: "reset"},
      name: "a password reset link",
    },
    {
      change: {tokenHash: "not-a-token-hash"},
      name: "an invalid token hash",
    },
    {
      change: {userId: "existing-owner"},
      name: "an existing owner reference",
    },
  ])("rejects $name as fresh password setup state", ({change}) => {
    expect(() => validateRemoteRestoreBaselineRepair({
      ...valid,
      applicationRowCounts: {
        ...valid.applicationRowCounts,
        auth_password_setup: 1,
      },
      initialPasswordSetupRows: [{...initialPasswordSetup, ...change}],
    })).toThrow("not the one-time initial login record");
  });

  it("rejects initial password setup when built-in login is disabled", () => {
    expect(() => validateRemoteRestoreBaselineRepair({
      ...valid,
      allowInitialPasswordSetup: false,
      applicationRowCounts: {
        ...valid.applicationRowCounts,
        auth_password_setup: 1,
      },
      initialPasswordSetupRows: [initialPasswordSetup],
    })).toThrow("not the one-time initial login record");
  });

  it("rejects a modified bootstrap setting", () => {
    expect(() => validateRemoteRestoreBaselineRepair({
      ...valid,
      applicationRowCounts: {
        ...valid.applicationRowCounts,
        channels: 1,
        settings: 5,
      },
      bootstrapChannelRows,
      bootstrapSettingRows: bootstrapSettingRows.map((row) =>
        row.category === "access"
          ? {category: "access", data: JSON.stringify({currentPolicy: "offline"})}
          : row
      ),
    })).toThrow("not the automatic bootstrap settings");
  });

  it.each([
    {
      change: {applicationTables: applicationTables.slice(1)},
      message: "Missing tables",
      name: "a missing application table",
    },
    {
      change: {appliedMigrations: ["0001.sql"]},
      message: "migration ledger is not at",
      name: "a migration ledger behind the checkout",
    },
    {
      change: {currentIndexes: []},
      message: "indexes do not match",
      name: "a missing index",
    },
    {
      change: {
        applicationRowCounts: {
          ...valid.applicationRowCounts,
          items: 1,
        },
      },
      message: "contains application data in: items",
      name: "application data",
    },
    {
      change: {installationInstanceIds: ["another-instance"]},
      message: "installation identity does not match",
      name: "a different installation identity",
    },
    {
      change: {r2ObjectCount: 1},
      message: "R2 bucket is not empty",
      name: "an R2 object",
    },
  ])("rejects $name", ({change, message}) => {
    expect(() => validateRemoteRestoreBaselineRepair({...valid, ...change}))
      .toThrow(message);
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

  it("builds D1-managed imports that restore source state and rewrite target identity", () => {
    const sql = buildRestoreSql({
      currentApplicationTables: ["new_table"],
      dataSql: "BEGIN TRANSACTION;\nINSERT INTO settings VALUES ('webGlobalSettings', '{}', NULL, NULL);\nCOMMIT;",
      schemaSql: "BEGIN TRANSACTION;\nCREATE TABLE settings(category TEXT PRIMARY KEY, data TEXT, created_at TEXT, updated_at TEXT);\nCREATE TABLE microfeed_installation(id TEXT PRIMARY KEY, instanceId TEXT);\nCOMMIT;",
      snapshotApplicationTables: ["settings", "microfeed_installation"],
    });
    expect(sql).toContain("PRAGMA defer_foreign_keys=TRUE;");
    expect(sql).not.toContain("BEGIN TRANSACTION;");
    expect(sql).not.toContain("COMMIT;");
    expect(sql).toContain('DROP TABLE IF EXISTS "new_table"');
    expect(sql).not.toContain("target-instance");
    const finalization = buildRestoreFinalizationSql("target-instance");
    expect(finalization).not.toContain("BEGIN TRANSACTION;");
    expect(finalization).not.toContain("COMMIT;");
    expect(finalization).toContain("target-instance");
    expect(finalization).toContain("'$.publicBucketUrl', '/media/'");
    expect(finalization).toContain('DELETE FROM "auth_session"');
    expect(finalization).toContain('DELETE FROM "item_create_idempotency"');
    expect(finalization).toContain('DELETE FROM "oauth_access_token"');
    expect(finalization).toContain('INSERT INTO "oauth_client"');
  });

  it("finalizes target identity and clears every ephemeral table", async () => {
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
      INSERT INTO item_create_idempotency
        (key_hash, request_hash, item_id, created_at_ms, completed_at_ms)
      VALUES
        ('key-hash', 'request-hash', 'reserved-id', 1, 2);
      INSERT INTO microfeed_installation (id, instanceId)
      VALUES ('installation', 'source-instance');
    `);

    database.exec(buildRestoreFinalizationSql("target-instance"));

    for (const table of [
      "auth_session",
      "auth_verification",
      "auth_rate_limit",
      "auth_password_setup",
      "item_create_idempotency",
    ]) {
      expect(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get())
        .toEqual({count: 0});
    }
    expect(database.prepare(
      "SELECT clientId, redirectUris, requirePKCE FROM oauth_client",
    ).all()).toEqual([{
      clientId: "microfeed-cli",
      redirectUris: '["http://127.0.0.1:8977/callback"]',
      requirePKCE: 1,
    }]);
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
      r2: {name: "local-media", reuse: false, setupMode: "automatic"},
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
