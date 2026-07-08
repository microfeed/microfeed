import {buildQuery} from "./QueryBuilder";

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function normalizeWhere(where, primaryKey) {
  if (where === undefined || where === null) {
    throw new Error("BaseRepo requires a WHERE clause");
  }
  if (typeof where === "object" && !Array.isArray(where)) {
    return where;
  }
  return {[primaryKey]: where};
}

function definedEntries(row) {
  return Object.entries(row).filter(([, value]) => value !== undefined);
}

export default class BaseRepo {
  constructor(db, {table, primaryKey, allowedColumns}) {
    this.db = db;
    this.table = table;
    this.primaryKey = primaryKey;
    this.allowedColumns = allowedColumns;
  }

  buildSelectStatement({
    queryKwargs = {},
    orderBy = [],
    limit,
  } = {}) {
    const {sql, binds} = buildQuery({
      table: this.table,
      queryKwargs,
      orderBy,
      limit,
      allowedTables: [this.table],
      allowedColumns: this.allowedColumns,
    });
    return this.db.prepare(sql).bind(...binds);
  }

  async list(options = {}) {
    return this.buildSelectStatement(options).all();
  }

  async getFirst(options = {}) {
    const response = await this.list({
      ...options,
      limit: 1,
    });
    return response.results[0] || null;
  }

  async getById(id) {
    return this.getFirst({
      queryKwargs: {
        [this.primaryKey]: id,
      },
    });
  }

  buildInsertStatement(row) {
    const entries = definedEntries(row);
    if (entries.length === 0) {
      throw new Error(`BaseRepo cannot insert an empty row into ${this.table}`);
    }

    const columns = entries.map(([column]) => quoteIdentifier(column)).join(", ");
    const placeholders = entries.map(() => "?").join(", ");
    return this.db.prepare(
      `INSERT INTO ${quoteIdentifier(this.table)} (${columns}) VALUES (${placeholders})`,
    ).bind(...entries.map(([, value]) => value));
  }

  async insert(row) {
    return this.buildInsertStatement(row).run();
  }

  buildUpdateStatement(where, patch) {
    const whereClause = normalizeWhere(where, this.primaryKey);
    const patchEntries = definedEntries(patch).filter(([column]) => column !== this.primaryKey);
    if (patchEntries.length === 0) {
      throw new Error(`BaseRepo cannot update ${this.table} without fields`);
    }

    const now = new Date().toISOString();
    const setClause = [`${quoteIdentifier("updated_at")} = ?`];
    const bindValues = [now];
    patchEntries.forEach(([column, value]) => {
      setClause.push(`${quoteIdentifier(column)} = ?`);
      bindValues.push(value);
    });

    const whereKeys = Object.keys(whereClause);
    const whereSql = whereKeys.map((column) => `${quoteIdentifier(column)} = ?`).join(" AND ");
    const whereValues = whereKeys.map((column) => whereClause[column]);

    return this.db.prepare(
      `UPDATE ${quoteIdentifier(this.table)} SET ${setClause.join(", ")} WHERE ${whereSql}`,
    ).bind(...bindValues, ...whereValues);
  }

  async update(where, patch) {
    return this.buildUpdateStatement(where, patch).run();
  }

  buildUpsertStatement(row) {
    const entries = definedEntries(row);
    if (entries.length === 0) {
      throw new Error(`BaseRepo cannot upsert an empty row into ${this.table}`);
    }

    const insertColumns = entries.map(([column]) => quoteIdentifier(column)).join(", ");
    const insertPlaceholders = entries.map(() => "?").join(", ");
    const insertValues = entries.map(([, value]) => value);

    const updateEntries = entries.filter(([column]) => column !== this.primaryKey);
    const setClause = [`${quoteIdentifier("updated_at")} = ?`];
    const updateValues = [new Date().toISOString()];
    updateEntries.forEach(([column, value]) => {
      setClause.push(`${quoteIdentifier(column)} = ?`);
      updateValues.push(value);
    });

    return this.db.prepare(
      `INSERT INTO ${quoteIdentifier(this.table)} (${insertColumns}) VALUES (${insertPlaceholders}) ON CONFLICT(${quoteIdentifier(this.primaryKey)}) DO UPDATE SET ${setClause.join(", ")}`,
    ).bind(...insertValues, ...updateValues);
  }

  async upsert(row) {
    return this.buildUpsertStatement(row).run();
  }

  buildDeleteStatement(where) {
    const whereClause = normalizeWhere(where, this.primaryKey);

    const whereKeys = Object.keys(whereClause);
    const whereSql = whereKeys.map((column) => `${quoteIdentifier(column)} = ?`).join(" AND ");
    const whereValues = whereKeys.map((column) => whereClause[column]);

    return this.db.prepare(
      `DELETE FROM ${quoteIdentifier(this.table)} WHERE ${whereSql}`,
    ).bind(...whereValues);
  }

  async delete(where) {
    return this.buildDeleteStatement(where).run();
  }
}
