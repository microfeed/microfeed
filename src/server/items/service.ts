import {ITEM_STATUSES_STRINGS_DICT, STATUSES} from "@/shared/Constants";
import type FeedCrudManager from "@/server/feed/FeedCrudManager";
import type FeedDb from "@/server/feed/FeedDb";

type ItemInput = Record<string, any>;

function statusValue(value: unknown, fallback: number): number {
  if (typeof value === "number" && Object.values(STATUSES).includes(value)) {
    return value;
  }
  return (ITEM_STATUSES_STRINGS_DICT as Readonly<Record<string, number>>)[
    String(value ?? "")
  ] ?? fallback;
}

function normalizedInput(
  input: ItemInput,
  fallbackStatus: number,
  defaultPublishedAt?: number,
): ItemInput {
  const normalized = {...input};
  normalized.status = statusValue(input.status, fallbackStatus);
  if (input.date_published_ms !== undefined) {
    normalized.date_published_ms = input.date_published_ms;
  } else if (typeof input.date_published === "string") {
    const timestamp = Date.parse(input.date_published);
    if (!Number.isNaN(timestamp)) normalized.date_published_ms = timestamp;
  } else if (defaultPublishedAt !== undefined) {
    normalized.date_published_ms = defaultPublishedAt;
  }
  return normalized;
}

export async function createItem(
  feedCrud: FeedCrudManager,
  input: ItemInput,
  reservedId?: string,
): Promise<string> {
  const {id: _ignored, ...fields} = input;
  return feedCrud.upsertItem(normalizedInput(
    {...fields, ...(reservedId ? {id: reservedId} : {})},
    STATUSES.PUBLISHED,
    Date.now(),
  ));
}

export async function updateItem(
  database: FeedDb,
  feedCrud: FeedCrudManager,
  id: string,
  input: ItemInput,
): Promise<ItemInput | null> {
  const existing = await database.getItemById(id);
  if (!existing) return null;
  const normalized = normalizedInput(input, existing.status);
  const patch = feedCrud._publicToInternalSchemaForItem(normalized);
  const finalizesDraftPublicationDate =
    input.date_published !== undefined ||
    input.date_published_ms !== undefined ||
    (
      Object.hasOwn(input, "status") &&
      normalized.status === STATUSES.PUBLISHED
    );
  const item = {
    ...existing,
    ...patch,
    ...(finalizesDraftPublicationDate
      ? {pubDateIsDraftDefault: false}
      : {}),
    guid: input.guid ?? existing.guid ?? id,
    id,
    pubDateMs: patch.pubDateMs ?? existing.pubDateMs,
    status: patch.status ?? existing.status,
  };
  await feedCrud.saveInternalItem(item);
  return item;
}

export async function deleteItem(
  database: FeedDb,
  feedCrud: FeedCrudManager,
  id: string,
): Promise<boolean> {
  const existing = await database.getItemById(id);
  if (!existing) return false;
  await feedCrud.saveInternalItem({...existing, id, status: STATUSES.DELETED});
  return true;
}
