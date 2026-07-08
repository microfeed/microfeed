import {buildQuery} from "./QueryBuilder";

describe("QueryBuilder", () => {
  test("builds bound filters for the supported operators", () => {
    const result = buildQuery({
      table: "items",
      queryKwargs: {
        id: "item_1",
        "status__!=": 3,
        "score__>": 10,
        "score__>=": 11,
        "score__<": 20,
        "score__<=": 21,
        slug__in: ["one", "two"],
      },
      orderBy: ["score desc", "id"],
      limit: 5,
      allowedTables: ["items"],
      allowedColumns: ["id", "status", "score", "slug"],
    });

    expect(result).toEqual({
      sql: 'SELECT * FROM "items" WHERE "id" = ? AND "status" != ? AND "score" > ? AND "score" >= ? AND "score" < ? AND "score" <= ? AND "slug" IN (?, ?) ORDER BY "score" DESC, "id" ASC LIMIT ?',
      binds: ["item_1", 3, 10, 11, 20, 21, "one", "two", 5],
    });
  });

  test("binds dangerous values instead of interpolating them", () => {
    const result = buildQuery({
      table: "items",
      queryKwargs: {
        title: `x'; DROP TABLE items; --`,
        slug__in: [`a"`, `b; SELECT * FROM tags;`],
      },
      allowedTables: ["items"],
      allowedColumns: ["title", "slug"],
    });

    expect(result.sql).toBe('SELECT * FROM "items" WHERE "title" = ? AND "slug" IN (?, ?)');
    expect(result.binds).toEqual([`x'; DROP TABLE items; --`, `a"`, `b; SELECT * FROM tags;`]);
    expect(result.sql).not.toContain("DROP TABLE");
    expect(result.sql).not.toContain("SELECT * FROM tags");
  });

  test("rejects tables, columns, and order clauses outside the allow-list", () => {
    expect(() => buildQuery({
      table: "items; DROP TABLE items;",
      allowedTables: ["items"],
      allowedColumns: ["id"],
    })).toThrow(/table/i);

    expect(() => buildQuery({
      table: "items",
      queryKwargs: {
        "not_allowed": "x",
      },
      allowedTables: ["items"],
      allowedColumns: ["id"],
    })).toThrow(/column/i);

    expect(() => buildQuery({
      table: "items",
      orderBy: ["id; DROP TABLE tags;"],
      allowedTables: ["items"],
      allowedColumns: ["id"],
    })).toThrow(/order/i);
  });

  test("supports empty in-lists as a false predicate", () => {
    const result = buildQuery({
      table: "items",
      queryKwargs: {
        slug__in: [],
      },
      allowedTables: ["items"],
      allowedColumns: ["slug"],
    });

    expect(result).toEqual({
      sql: 'SELECT * FROM "items" WHERE 1 = 0',
      binds: [],
    });
  });
});
