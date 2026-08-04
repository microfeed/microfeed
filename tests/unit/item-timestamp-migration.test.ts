import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";

import {describe, expect, it} from "vitest";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

async function migration(filename: string): Promise<string> {
  return readFile(path.join(repositoryRoot, "migrations", filename), "utf8");
}

describe("item timestamp normalization migration", () => {
  it("normalizes SQLite and mixed timestamp formats to indexed RFC 3339 text", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec(await migration("0001_initial.sql"));
    const insert = database.prepare(
      "INSERT INTO items " +
        "(id, status, data, pub_date, created_at, updated_at) " +
        "VALUES (?, 1, '{}', ?, ?, ?)",
    );
    insert.run(
      "legacy-item",
      "2026-08-04T12:00:00.000Z",
      "2026-08-04 10:00:00",
      "2026-08-04 13:00:00",
    );
    insert.run(
      "mixed-item",
      "2026-08-04T11:00:00.000Z",
      "2026-08-04 11:00:00",
      "2026-08-04T12:00:00.123Z",
    );

    const normalization = await migration(
      "0005_normalize_item_timestamps.sql",
    );
    database.exec(normalization);
    database.exec(normalization);

    expect(database.prepare(
      "SELECT id, created_at, updated_at FROM items ORDER BY id",
    ).all()).toEqual([
      {
        created_at: "2026-08-04T10:00:00.000Z",
        id: "legacy-item",
        updated_at: "2026-08-04T13:00:00.000Z",
      },
      {
        created_at: "2026-08-04T11:00:00.000Z",
        id: "mixed-item",
        updated_at: "2026-08-04T12:00:00.123Z",
      },
    ]);

    const queryPlan = database.prepare(
      "EXPLAIN QUERY PLAN " +
        "SELECT id FROM items WHERE created_at < ? " +
        "ORDER BY created_at DESC, id DESC LIMIT 3",
    ).all("2026-08-05T00:00:00.000Z");
    expect(queryPlan.some((row) =>
      String(row.detail).includes("items_created_at")
    )).toBe(true);
    database.close();
  });
});
