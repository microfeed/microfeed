import {legacyItemPath} from "@/shared/ItemUrls";
import type {MicrofeedConfig} from "../types";
import type {CloudflareClient} from "./cloudflare";

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Run both before and after swapping the Worker, including snapshot restores. */
export async function prepareItemUrls(
  cloudflare: CloudflareClient,
  config: MicrofeedConfig,
  options: {local?: boolean; persistTo?: string} = {},
) {
  for (let pass = 0; pass < 10000; pass++) {
    const rows = await cloudflare.queryD1(config,
      "SELECT id, substr(json_extract(data, '$.title'), 1, 50) AS title, url_revision FROM items WHERE public_path IS NULL ORDER BY id LIMIT 50", options);
    if (!rows.length) return;
    for (const row of rows) {
      if (typeof row.id !== "string" || !Number.isSafeInteger(row.url_revision) || Number(row.url_revision) < 0) {
        throw new Error("Cannot preserve an item URL with an invalid ID or revision. Repair the database row before retrying.");
      }
      const title = typeof row.title === "string" ? row.title : undefined;
      const path = legacyItemPath({id: String(row.id), title});
      await cloudflare.queryD1(config,
        `UPDATE items SET public_path = ${literal(path)}, url_revision = url_revision + 1 ` +
        `WHERE id = ${literal(String(row.id))} AND public_path IS NULL ` +
        `AND url_revision = ${Number(row.url_revision)}`, options);
    }
  }
  throw new Error("Item URL preparation is still receiving old-writer changes. Retry deployment to finish preserving legacy URLs.");
}
