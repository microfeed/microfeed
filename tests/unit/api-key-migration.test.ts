import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";

import {describe, expect, it} from "vitest";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

async function migration(): Promise<string> {
  return readFile(
    path.join(repositoryRoot, "migrations", "0006_api_keys.sql"),
    "utf8",
  );
}

function createDatabase(data?: string): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL UNIQUE,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  if (data !== undefined) {
    database.prepare(
      "INSERT INTO settings (category, data) VALUES ('apiSettings', ?)",
    ).run(data);
  }
  return database;
}

describe("API-key migration", () => {
  it("copies valid legacy API keys and leaves the rollback JSON unchanged", async () => {
    const legacy = JSON.stringify({
      apps: [
        {
          createdAtMs: 1_725_000_000_000,
          id: "existing-key",
          name: "Production",
          token: "legacy-secret",
        },
        {id: "missing-time", name: "Automation", token: "second-secret"},
        {id: "not-a-key", name: "Broken"},
      ],
      enabled: true,
    });
    const database = createDatabase(legacy);
    const sql = await migration();

    database.exec(sql);
    database.exec(sql);

    const rows = database.prepare(
      "SELECT id, name, api_key, created_at_ms, updated_at_ms " +
        "FROM api_keys ORDER BY id",
    ).all();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      api_key: "legacy-secret",
      created_at_ms: 1_725_000_000_000,
      id: "existing-key",
      name: "Production",
      updated_at_ms: 1_725_000_000_000,
    });
    expect(rows[1]).toMatchObject({
      api_key: "second-secret",
      id: "missing-time",
      name: "Automation",
    });
    expect(Number(rows[1]!.created_at_ms)).toBeGreaterThan(0);
    expect(rows[1]!.updated_at_ms).toBe(rows[1]!.created_at_ms);
    expect(database.prepare(
      "SELECT data FROM settings WHERE category = 'apiSettings'",
    ).get()).toEqual({data: legacy});
    database.close();
  });

  it("handles missing settings and malformed JSON", async () => {
    const sql = await migration();
    for (const data of [undefined, "not-json", JSON.stringify({apps: null})]) {
      const database = createDatabase(data);
      expect(() => database.exec(sql)).not.toThrow();
      expect(database.prepare("SELECT count(*) AS count FROM api_keys").get())
        .toEqual({count: 0});
      database.close();
    }
  });

  it("uses deterministic fallbacks and resolves legacy conflicts", async () => {
    const database = createDatabase(JSON.stringify({
      apps: [
        {name: "Duplicate", token: "same-secret"},
        {id: "second", name: "duplicate", token: "same-secret"},
        {id: "third", name: "Duplicate", token: "third-secret"},
        {id: "third", name: "Fourth", token: "fourth-secret"},
      ],
    }));

    database.exec(await migration());

    const rows = database.prepare(
      "SELECT id, name, api_key FROM api_keys ORDER BY api_key",
    ).all();
    expect(rows).toEqual([
      {
        api_key: "same-secret",
        id: "legacy-api-key-0000",
        name: "Duplicate (legacy-api-key-0000)",
      },
      {api_key: "third-secret", id: "third", name: "Duplicate (third)"},
    ]);
    database.close();
  });

  it("preserves existing keys with read and write access when scopes are added", async () => {
    const database = createDatabase();
    database.exec(await migration());
    database.prepare(
      "INSERT INTO api_keys (id, name, api_key, created_at_ms, updated_at_ms) VALUES ('one', 'One', 'mf_one', 1, 1)",
    ).run();
    database.exec(await readFile(
      path.join(repositoryRoot, "migrations", "0018_api_key_scopes.sql"),
      "utf8",
    ));
    expect(database.prepare("SELECT scopes FROM api_keys WHERE id = 'one'").get())
      .toEqual({scopes: "content:read content:write"});
    database.close();
  });
});
