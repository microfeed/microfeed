import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {
  CREATE_ITEM_SEARCH_INDEX_SQL,
  DROP_ITEM_SEARCH_INDEX_SQL,
} from "@/shared/ItemSearchSql";
import {ITEM_CONTENT_TEXT_REVISION} from "@/shared/ItemSearch";
import {htmlToPlainText} from "@/shared/StringUtils";
import type {MicrofeedConfig} from "../types";
import type {CloudflareClient} from "./cloudflare";

const NORMALIZATION_BATCH_SIZE = 50;
const MAX_NORMALIZATION_BATCHES = 10_000;

interface ItemSearchOptions {
  local?: boolean;
  persistTo?: string;
}

interface ItemSearchSourceRow extends Record<string, unknown> {
  data: string;
  id: string;
  updated_at: string;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function executeTemporarySql(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  sql: string,
  options: ItemSearchOptions,
): Promise<void> {
  const directory = await mkdtemp(path.join(tmpdir(), "microfeed-item-search-"));
  try {
    const filename = path.join(directory, "item-search.sql");
    await writeFile(filename, `${sql.trim()}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await cloudflare.executeSqlFile(config, filename, options);
  } finally {
    await rm(directory, {force: true, recursive: true});
  }
}

function sourceRows(
  rows: Array<Record<string, unknown>>,
): ItemSearchSourceRow[] {
  return rows.map((row) => {
    if (
      typeof row.id !== "string" ||
      typeof row.data !== "string" ||
      typeof row.updated_at !== "string"
    ) {
      throw new Error("D1 returned an invalid item search normalization row.");
    }
    return row as ItemSearchSourceRow;
  });
}

function normalizedUpdateSql(rows: readonly ItemSearchSourceRow[]): string {
  return rows.map((row) => {
    let data: unknown;
    try {
      data = JSON.parse(row.data);
    } catch {
      throw new Error(
        `Item ${row.id} contains invalid saved JSON; search normalization ` +
          "stopped without marking the index ready.",
      );
    }
    const description = data && typeof data === "object" &&
        typeof (data as {description?: unknown}).description === "string"
      ? (data as {description: string}).description
      : "";
    const contentText = htmlToPlainText(description);
    return "UPDATE items SET " +
      `content_text = ${sqlString(contentText)}, ` +
      `content_text_revision = ${ITEM_CONTENT_TEXT_REVISION}, ` +
      `content_text_updated_at = ${sqlString(row.updated_at)} ` +
      `WHERE id = ${sqlString(row.id)} AND ` +
      `updated_at = ${sqlString(row.updated_at)};`;
  }).join("\n");
}

export async function rebuildItemSearchIndexes(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
): Promise<void> {
  await executeTemporarySql(
    cloudflare,
    config,
    `${DROP_ITEM_SEARCH_INDEX_SQL}\n${CREATE_ITEM_SEARCH_INDEX_SQL}`,
    options,
  );
}

export async function itemSearchIndexesExist(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
): Promise<boolean> {
  const rows = await cloudflare.queryD1(
    config,
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN " +
      "('site_search_exact', 'site_search_title_trigram') ORDER BY name",
    options,
  );
  return rows.length === 2;
}

export async function ensureItemSearchIndexes(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
): Promise<void> {
  if (!await itemSearchIndexesExist(cloudflare, config, options)) {
    await rebuildItemSearchIndexes(cloudflare, config, options);
  }
}

export async function dropItemSearchIndexes(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
): Promise<void> {
  await executeTemporarySql(
    cloudflare,
    config,
    DROP_ITEM_SEARCH_INDEX_SQL,
    options,
  );
}

export async function normalizeItemSearchContent(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
  markReady = true,
): Promise<number> {
  await cloudflare.queryD1(
    config,
    "UPDATE site_search_metadata SET ready = 0, normalized_at = NULL " +
      "WHERE id = 1",
    options,
  );

  let normalized = 0;
  for (let batch = 0; batch < MAX_NORMALIZATION_BATCHES; batch += 1) {
    const rows = sourceRows(await cloudflare.queryD1(
      config,
      "SELECT id, data, updated_at FROM items " +
        "WHERE status != 3 AND (content_text_updated_at != updated_at OR " +
        `content_text_revision != ${ITEM_CONTENT_TEXT_REVISION}) ` +
        `ORDER BY rowid LIMIT ${NORMALIZATION_BATCH_SIZE}`,
      options,
    ));
    if (rows.length === 0) break;
    await executeTemporarySql(
      cloudflare,
      config,
      normalizedUpdateSql(rows),
      options,
    );
    normalized += rows.length;
  }

  const [remaining] = await cloudflare.queryD1(
    config,
    "SELECT COUNT(*) AS count FROM items " +
      "WHERE status != 3 AND (content_text_updated_at != updated_at OR " +
      `content_text_revision != ${ITEM_CONTENT_TEXT_REVISION})`,
    options,
  );
  if (!remaining || Number(remaining.count) !== 0) {
    throw new Error(
      "Item search normalization did not finish. Retry the same deployment " +
        "after item writes have settled.",
    );
  }
  if (markReady) {
    const normalizedAt = new Date().toISOString();
    await cloudflare.queryD1(
      config,
      "INSERT INTO site_search_metadata (id, ready, normalized_at) VALUES " +
        `(1, 1, ${sqlString(normalizedAt)}) ON CONFLICT(id) DO UPDATE SET ` +
        "ready = 1, normalized_at = excluded.normalized_at",
      options,
    );
  }
  return normalized;
}

export async function setItemSearchReady(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  ready: boolean,
  options: ItemSearchOptions = {},
): Promise<void> {
  await cloudflare.queryD1(
    config,
    "UPDATE site_search_metadata SET " +
      `ready = ${ready ? 1 : 0}, ` +
      `${ready ? "normalized_at = CURRENT_TIMESTAMP" : "normalized_at = NULL"} ` +
      "WHERE id = 1",
    options,
  );
}

export async function prepareItemSearch(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: ItemSearchOptions = {},
  markReady = true,
): Promise<number> {
  await ensureItemSearchIndexes(cloudflare, config, options);
  return normalizeItemSearchContent(cloudflare, config, options, markReady);
}

export async function withItemSearchIndexesSuspended<T>(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  operation: () => Promise<T>,
  options: ItemSearchOptions = {},
): Promise<T> {
  if (!await itemSearchIndexesExist(cloudflare, config, options)) {
    return operation();
  }
  await dropItemSearchIndexes(cloudflare, config, options);
  try {
    return await operation();
  } finally {
    await rebuildItemSearchIndexes(cloudflare, config, options);
    await normalizeItemSearchContent(cloudflare, config, options);
  }
}
