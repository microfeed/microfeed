import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {DatabaseSync} from "node:sqlite";

import {describe, expect, it} from "vitest";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("item create idempotency migration", () => {
  it("stores only hashes, a reserved item ID, completion, and indexed time", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec(await readFile(path.join(
      repositoryRoot,
      "migrations/0012_item_create_idempotency.sql",
    ), "utf8"));

    const columns = database.prepare(
      "PRAGMA table_info(item_create_idempotency)",
    ).all() as Array<{name: string; notnull: number; pk: number}>;
    expect(columns.map(({name}) => name)).toEqual([
      "key_hash",
      "request_hash",
      "item_id",
      "created_at_ms",
      "completed_at_ms",
    ]);
    expect(columns.find(({name}) => name === "key_hash")?.pk).toBe(1);
    expect(columns.find(({name}) => name === "completed_at_ms")?.notnull)
      .toBe(0);

    expect(database.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'index' " +
        "AND name = 'item_create_idempotency_created_at'",
    ).get()).toEqual({name: "item_create_idempotency_created_at"});
  });
});
