import {randomShortUUID} from "@/shared/StringUtils";

const IDEMPOTENCY_RETENTION_MS = 24 * 60 * 60 * 1000;

interface ItemCreateIdempotencyRow {
  completed_at_ms: number | null;
  item_id: string;
  key_hash: string;
  request_hash: string;
}

export interface ItemCreateIdempotencyClaim {
  completed: boolean;
  itemId: string;
  keyHash: string;
  replay: boolean;
}

export class ItemCreateIdempotencyConflictError extends Error {}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const fields = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, field]) => `${JSON.stringify(key)}:${canonicalJson(field)}`);
    return `{${fields.join(",")}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("Idempotency input must be JSON-serializable.");
  }
  return serialized;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function claimItemCreateIdempotency(
  database: D1Database,
  key: string,
  input: unknown,
  now = Date.now(),
): Promise<ItemCreateIdempotencyClaim> {
  const [keyHash, requestHash] = await Promise.all([
    sha256(key),
    sha256(canonicalJson(input)),
  ]);
  const proposedItemId = randomShortUUID();
  const results = await database.batch<ItemCreateIdempotencyRow>([
    database.prepare(
      "DELETE FROM item_create_idempotency WHERE created_at_ms < ?",
    ).bind(now - IDEMPOTENCY_RETENTION_MS),
    database.prepare(
      "INSERT OR IGNORE INTO item_create_idempotency " +
        "(key_hash, request_hash, item_id, created_at_ms) VALUES (?, ?, ?, ?)",
    ).bind(keyHash, requestHash, proposedItemId, now),
    database.prepare(
      "SELECT key_hash, request_hash, item_id, completed_at_ms " +
        "FROM item_create_idempotency WHERE key_hash = ? LIMIT 1",
    ).bind(keyHash),
  ]);
  const row = results[2]?.results[0];
  if (!row) throw new Error("Unable to reserve the idempotent item creation.");
  if (row.request_hash !== requestHash) {
    throw new ItemCreateIdempotencyConflictError(
      "This Idempotency-Key was already used with a different item payload.",
    );
  }
  return {
    completed: row.completed_at_ms !== null,
    itemId: row.item_id,
    keyHash,
    replay: Number(results[1]?.meta.changes ?? 0) === 0,
  };
}

export async function completeItemCreateIdempotency(
  database: D1Database,
  keyHash: string,
  now = Date.now(),
): Promise<void> {
  await database.prepare(
    "UPDATE item_create_idempotency SET completed_at_ms = ? " +
      "WHERE key_hash = ? AND completed_at_ms IS NULL",
  ).bind(now, keyHash).run();
}
