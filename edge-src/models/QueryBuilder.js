const FILTER_OPERATORS = {
  eq: "=",
  "==": "=",
  ne: "!=",
  "!=": "!=",
  gt: ">",
  ">": ">",
  gte: ">=",
  ">=": ">=",
  lt: "<",
  "<": "<",
  lte: "<=",
  "<=": "<=",
  in: "IN",
};

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function ensureAllowedIdentifier(kind, value, allowedValues) {
  if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
    throw new Error(`QueryBuilder requires an allow-list for ${kind}s`);
  }

  if (!allowedValues.includes(value)) {
    throw new Error(`QueryBuilder rejected ${kind} ${value}`);
  }
}

function normalizeFilterKey(filterKey) {
  const splitAt = filterKey.lastIndexOf("__");
  if (splitAt === -1) {
    return {column: filterKey, operator: "eq"};
  }

  return {
    column: filterKey.slice(0, splitAt),
    operator: filterKey.slice(splitAt + 2),
  };
}

function normalizeOrderEntry(orderEntry) {
  if (typeof orderEntry === "string") {
    const trimmed = orderEntry.trim();
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s+(asc|desc))?$/i);
    if (!match) {
      throw new Error(`QueryBuilder rejected order clause ${orderEntry}`);
    }

    return {
      column: match[1],
      direction: (match[2] || "asc").toUpperCase(),
    };
  }

  if (orderEntry && typeof orderEntry === "object") {
    const {column, direction = "asc"} = orderEntry;
    if (typeof column !== "string" || !column) {
      throw new Error("QueryBuilder order entry requires a column");
    }
    const normalizedDirection = String(direction).toLowerCase();
    if (!["asc", "desc"].includes(normalizedDirection)) {
      throw new Error(`QueryBuilder rejected order direction ${direction}`);
    }

    return {
      column,
      direction: normalizedDirection.toUpperCase(),
    };
  }

  throw new Error("QueryBuilder rejected order entry");
}

function getAllowedColumns(allowedColumns, table) {
  if (Array.isArray(allowedColumns)) {
    return allowedColumns;
  }

  if (allowedColumns && typeof allowedColumns === "object") {
    return allowedColumns[table];
  }

  return undefined;
}

function buildFilterClause(filterKey, filterValue, allowedColumns) {
  const {column, operator} = normalizeFilterKey(filterKey);
  ensureAllowedIdentifier("column", column, allowedColumns);

  const sqlOperator = FILTER_OPERATORS[operator];
  if (!sqlOperator) {
    throw new Error(`QueryBuilder rejected operator ${operator}`);
  }

  const quotedColumn = quoteIdentifier(column);
  if (filterValue === null) {
    if (operator === "eq" || operator === "==") {
      return {sql: `${quotedColumn} IS NULL`, binds: []};
    }
    if (operator === "ne" || operator === "!=") {
      return {sql: `${quotedColumn} IS NOT NULL`, binds: []};
    }
    throw new Error(`QueryBuilder rejected null value for operator ${operator}`);
  }

  if (operator === "in") {
    if (!Array.isArray(filterValue)) {
      throw new Error(`QueryBuilder requires an array for ${filterKey}`);
    }
    if (filterValue.length === 0) {
      return {sql: "1 = 0", binds: []};
    }
    return {
      sql: `${quotedColumn} IN (${filterValue.map(() => "?").join(", ")})`,
      binds: filterValue,
    };
  }

  if (Array.isArray(filterValue)) {
    throw new Error(`QueryBuilder rejected array value for ${filterKey}`);
  }

  return {
    sql: `${quotedColumn} ${sqlOperator} ?`,
    binds: [filterValue],
  };
}

export function buildQuery({
  table,
  queryKwargs = {},
  orderBy = [],
  limit,
  allowedTables,
  allowedColumns,
}) {
  ensureAllowedIdentifier("table", table, allowedTables);
  const columnsForTable = getAllowedColumns(allowedColumns, table);
  if (!columnsForTable || columnsForTable.length === 0) {
    throw new Error(`QueryBuilder requires an allow-list for columns on ${table}`);
  }

  const whereSql = [];
  const binds = [];

  Object.entries(queryKwargs).forEach(([filterKey, filterValue]) => {
    const clause = buildFilterClause(filterKey, filterValue, columnsForTable);
    whereSql.push(clause.sql);
    binds.push(...clause.binds);
  });

  const orderSql = orderBy.length > 0
    ? orderBy.map((entry) => {
      const {column, direction} = normalizeOrderEntry(entry);
      ensureAllowedIdentifier("column", column, columnsForTable);
      return `${quoteIdentifier(column)} ${direction}`;
    }).join(", ")
    : "";

  const sqlParts = [`SELECT * FROM ${quoteIdentifier(table)}`];
  if (whereSql.length > 0) {
    sqlParts.push(`WHERE ${whereSql.join(" AND ")}`);
  }
  if (orderSql) {
    sqlParts.push(`ORDER BY ${orderSql}`);
  }
  if (limit !== undefined && limit !== null) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error(`QueryBuilder rejected limit ${limit}`);
    }
    sqlParts.push("LIMIT ?");
    binds.push(limit);
  }

  return {
    sql: sqlParts.join(" "),
    binds,
  };
}

export {buildQuery as buildSelectQuery};

export default buildQuery;
