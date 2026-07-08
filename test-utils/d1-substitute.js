const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function isQuerySql(sql) {
  return /^\s*(select|with|pragma|explain)\b/i.test(sql);
}

function shapeRunResult(result) {
  return {
    success: true,
    meta: {
      changes: result?.changes ?? 0,
      last_row_id: result?.lastInsertRowid ?? 0,
      duration: 0,
    },
  };
}

function shapeAllResult(results) {
  return {
    results,
    success: true,
    meta: {
      duration: 0,
    },
  };
}

class BoundStatement {
  constructor(statement, sql, params = []) {
    this.statement = statement;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new BoundStatement(this.statement, this.sql, params);
  }

  async run() {
    return shapeRunResult(this.statement.run(...this.params));
  }

  async all() {
    return shapeAllResult(this.statement.all(...this.params));
  }

  async first(columnName) {
    const row = this.statement.get(...this.params);
    if (!row) {
      return null;
    }
    if (columnName) {
      return row[columnName];
    }
    return row;
  }
}

class D1SubstituteDatabase {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new BoundStatement(this.database.prepare(sql), sql);
  }

  async batch(statements) {
    // Cloudflare D1 batch() is async and transactional. Mirror both so tests
    // catch missing-await and partial-write regressions.
    this.database.exec("BEGIN");
    const results = [];
    try {
      for (const statement of statements) {
        if (isQuerySql(statement.sql)) {
          results.push(await statement.all());
        } else {
          results.push(await statement.run());
        }
      }
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.database.close();
  }
}

function createD1SubstituteDatabase() {
  return new D1SubstituteDatabase(new Database(":memory:"));
}

function createMigratedInMemoryDatabase(schemaPath = path.resolve(__dirname, "../ops/db/init.sql")) {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  database.exec(fs.readFileSync(schemaPath, "utf8"));
  return new D1SubstituteDatabase(database);
}

module.exports = {
  createD1SubstituteDatabase,
  createMigratedInMemoryDatabase,
};
