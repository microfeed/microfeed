import FeedDb from "@/server/feed/FeedDb";
import {getPageById, listPages} from "@/server/pages/service";
import {getSiteFileById, listSiteFiles} from "@/server/site-files/service";
import ThemeStore from "@/server/themes/ThemeStore";
import {OPENAPI_DOCUMENT} from "@/shared/OpenApiDocument";
import {ITEM_STATUSES_DICT, STATUSES} from "@/shared/Constants";
import {isLocalDevelopmentHostname} from "@/shared/StringUtils";
import {
  WEBHOOK_EVENT_DEFINITIONS,
  WEBHOOK_EVENT_EXAMPLES,
  webhookChannelSnapshot,
  webhookEventInputForSnapshot,
  webhookGeneratedEventInput,
  webhookItemSnapshot,
  webhookPageSnapshot,
  webhookSiteFileSnapshot,
  webhookThemeSnapshot,
} from "@/shared/WebhookExamples";
import {
  WEBHOOK_EVENT_TYPE_SET,
  type WebhookEventInput,
  type WebhookEventType,
  type WebhookExplorerPreview,
  type WebhookExplorerSourceMode,
  type WebhookExplorerSubject,
} from "@/shared/Webhooks";
import {
  createWebhookExplorerDelivery,
  prepareWebhookEvent,
} from "./events";
import {getWebhookDelivery} from "./store";
import {WebhookRequestError} from "./validation";

export interface WebhookExplorerSelection {
  eventType: WebhookEventType;
  sourceMode: WebhookExplorerSourceMode;
  subjectId?: string;
}

function eventType(value: unknown): WebhookEventType {
  if (typeof value !== "string" || !WEBHOOK_EVENT_TYPE_SET.has(value)) {
    throw new WebhookRequestError("Choose a supported webhook event.");
  }
  return value as WebhookEventType;
}

export function parseWebhookExplorerSelection(
  input: Record<string, unknown>,
): WebhookExplorerSelection {
  const sourceMode = input.source_mode;
  if (sourceMode !== "generated" && sourceMode !== "current") {
    throw new WebhookRequestError("Choose generated example or current content.");
  }
  const subjectId = typeof input.subject_id === "string"
    ? input.subject_id.trim()
    : "";
  return {
    eventType: eventType(input.event_type),
    sourceMode,
    ...(subjectId ? {subjectId} : {}),
  };
}

function includesSearch(values: unknown[], query: string): boolean {
  if (!query) return true;
  return values.some((value) =>
    String(value ?? "").toLocaleLowerCase().includes(query)
  );
}

function statusLabel(value: unknown): string {
  return ITEM_STATUSES_DICT[Number(value)]?.name ?? "unknown";
}

export async function listWebhookExplorerSubjects(
  runtimeEnv: Env,
  request: Request,
  typeValue: unknown,
  searchValue: unknown,
): Promise<WebhookExplorerSubject[]> {
  const type = eventType(typeValue);
  const definition = WEBHOOK_EVENT_DEFINITIONS.find((entry) => entry.type === type)!;
  const query = typeof searchValue === "string"
    ? searchValue.trim().toLocaleLowerCase()
    : "";
  if (definition.sourceKind === "webhook") return [];
  if (definition.sourceKind === "channel") {
    return [{id: "primary", label: "Primary channel"}];
  }
  if (definition.sourceKind === "page_navigation") {
    return [{id: "navigation", label: "Current Page navigation"}];
  }
  if (definition.sourceKind === "item") {
    const result = await runtimeEnv.FEED_DB.prepare(`
      SELECT id, status, COALESCE(json_extract(data, '$.title'), '') AS title
      FROM items
      WHERE status != ?
        AND (? = '' OR lower(id) LIKE ? OR lower(COALESCE(json_extract(data, '$.title'), '')) LIKE ?)
      ORDER BY updated_at DESC, id DESC
      LIMIT 50
    `).bind(STATUSES.DELETED, query, `%${query}%`, `%${query}%`)
      .all<Record<string, unknown>>();
    return result.results.map((row) => ({
      description: statusLabel(row.status),
      id: String(row.id),
      label: String(row.title || "Untitled item"),
    }));
  }
  if (definition.sourceKind === "page") {
    const pages = await listPages(
      new FeedDb(runtimeEnv, request),
      request,
      {limit: 100},
    );
    return pages.items.filter((page) =>
      includesSearch([page.id, page.title, page.slug], query)
    ).slice(0, 50).map((page) => ({
      description: `${page.status} · /${page.slug}`,
      id: page.id,
      label: page.title || "Untitled Page",
    }));
  }
  if (definition.sourceKind === "site_file") {
    const files = await listSiteFiles(runtimeEnv.FEED_DB, request);
    return files.filter((file) =>
      (type !== "site_file.reset" || Boolean(file.generator)) &&
      includesSearch([file.id, file.filename], query)
    ).slice(0, 50).map((file) => ({
      description: file.generator ? `built-in · ${file.mode}` : file.mode,
      id: file.id,
      label: file.filename,
    }));
  }
  const themes = await new ThemeStore(runtimeEnv.FEED_DB).listVersions(false);
  return themes.filter((theme) =>
    includesSearch(
      [theme.id, theme.name, theme.packageId, theme.version],
      query,
    )
  ).slice(0, 50).map((theme) => ({
    description: `${theme.packageId} · ${theme.version}`,
    id: theme.id,
    label: theme.name,
  }));
}

async function currentSnapshot(
  runtimeEnv: Env,
  request: Request,
  selection: WebhookExplorerSelection,
): Promise<Record<string, unknown>> {
  const definition = WEBHOOK_EVENT_DEFINITIONS.find((entry) =>
    entry.type === selection.eventType
  )!;
  const subjectId = selection.subjectId;
  if (definition.sourceKind === "webhook") {
    throw new WebhookRequestError(
      "webhook.test uses its generated connection-test snapshot.",
    );
  }
  if (definition.sourceKind === "channel") {
    const row = await runtimeEnv.FEED_DB.prepare(`
      SELECT id, data FROM channels
      WHERE status = ? AND is_primary = 1
      LIMIT 1
    `).bind(STATUSES.PUBLISHED).first<{data: string; id: string}>();
    if (!row) {
      throw new WebhookRequestError("The primary channel was not found.");
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      throw new WebhookRequestError("The primary channel snapshot is invalid.");
    }
    return webhookChannelSnapshot({id: row.id, ...data});
  }
  if (definition.sourceKind === "page_navigation") {
    const pages = await runtimeEnv.FEED_DB.prepare(`
      SELECT id FROM pages
      WHERE status = ? AND show_in_navigation = 1
      ORDER BY navigation_order ASC, title COLLATE NOCASE ASC, id ASC
    `).bind(STATUSES.PUBLISHED).all<{id: string}>();
    return {
      id: "navigation",
      page_ids: pages.results.map(({id}) => String(id)),
    };
  }
  if (!subjectId) {
    throw new WebhookRequestError("Choose current content for this event.");
  }
  if (definition.sourceKind === "item") {
    const item = await new FeedDb(runtimeEnv, request).getItemById(subjectId);
    if (!item || Number(item.status) === STATUSES.DELETED) {
      throw new WebhookRequestError("The selected item was not found.");
    }
    return webhookItemSnapshot(item as Record<string, unknown>);
  }
  if (definition.sourceKind === "page") {
    const page = await getPageById(runtimeEnv.FEED_DB, request, subjectId);
    if (!page) throw new WebhookRequestError("The selected Page was not found.");
    return webhookPageSnapshot(page as unknown as Record<string, unknown>);
  }
  if (definition.sourceKind === "site_file") {
    const file = await getSiteFileById(runtimeEnv.FEED_DB, request, subjectId);
    if (!file) {
      throw new WebhookRequestError("The selected Site File was not found.");
    }
    if (selection.eventType === "site_file.reset" && !file.generator) {
      throw new WebhookRequestError("Only a built-in Site File can be reset.");
    }
    return webhookSiteFileSnapshot(file as unknown as Record<string, unknown>);
  }
  const theme = await new ThemeStore(runtimeEnv.FEED_DB).getVersion(subjectId);
  if (!theme) throw new WebhookRequestError("The selected theme was not found.");
  return webhookThemeSnapshot(theme as unknown as Record<string, unknown>);
}

export async function webhookExplorerEventInput(
  runtimeEnv: Env,
  request: Request,
  selection: WebhookExplorerSelection,
): Promise<WebhookEventInput> {
  if (selection.sourceMode === "generated") {
    return webhookGeneratedEventInput(selection.eventType);
  }
  return webhookEventInputForSnapshot(
    selection.eventType,
    await currentSnapshot(runtimeEnv, request, selection),
  );
}

function replaceGeneratedValues(
  value: unknown,
  oldId: string,
  newId: string,
  timestamp: string,
  field = "",
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      replaceGeneratedValues(entry, oldId, newId, timestamp, field)
    );
  }
  if (!value || typeof value !== "object") {
    if (typeof value !== "string") return value;
    if ((field.startsWith("date_") || field.endsWith("_at")) &&
        Number.isFinite(Date.parse(value))) return timestamp;
    return value.replaceAll(oldId, newId);
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    replaceGeneratedValues(entry, oldId, newId, timestamp, key),
  ]));
}

function materializeGeneratedInput(
  input: WebhookEventInput,
  endpointId: string,
): WebhookEventInput {
  const stableSubject = input.type === "channel.updated" ||
    input.type === "page.navigation_updated";
  const newId = stableSubject
    ? input.subjectId
    : input.type === "webhook.test"
    ? endpointId
    : `test_${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  return {
    ...input,
    object: replaceGeneratedValues(
      input.object,
      input.subjectId,
      newId,
      timestamp,
    ) as Record<string, unknown>,
    subjectId: newId,
  };
}

function dereferenceSchema(
  value: unknown,
  schemas: Record<string, Record<string, unknown>>,
  trail: ReadonlySet<string> = new Set(),
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => dereferenceSchema(entry, schemas, trail));
  }
  if (!value || typeof value !== "object") return value;
  const object = value as Record<string, unknown>;
  const reference = typeof object.$ref === "string" ? object.$ref : "";
  const prefix = "#/components/schemas/";
  if (reference.startsWith(prefix)) {
    const name = reference.slice(prefix.length);
    const target = schemas[name];
    if (!target || trail.has(name)) return object;
    return dereferenceSchema(
      target,
      schemas,
      new Set([...trail, name]),
    );
  }
  return Object.fromEntries(Object.entries(object).map(([key, entry]) => [
    key,
    dereferenceSchema(entry, schemas, trail),
  ]));
}

function eventSchema(type: WebhookEventType): Record<string, unknown> {
  const schemas = OPENAPI_DOCUMENT.components?.schemas as
    | Record<string, Record<string, unknown>>
    | undefined;
  const envelope = schemas?.MicrofeedWebhookEvent as
    | {oneOf?: Array<Record<string, any>>}
    | undefined;
  const variant = envelope?.oneOf?.find((entry) =>
    entry.properties?.type?.const === type
  );
  return (dereferenceSchema(variant ?? {}, schemas ?? {}) ?? {}) as
    Record<string, unknown>;
}

function previewHeaders(type: WebhookEventType): Record<string, string> {
  return {
    "content-type": "application/json",
    "webhook-id": "whd_generated_when_sent",
    "webhook-signature": "v1,generated_when_sent",
    "webhook-timestamp": "generated_when_sent",
    "x-microfeed-attempt": "1",
    "x-microfeed-event": type,
    "x-microfeed-test": "true",
  };
}

export async function previewWebhookExplorerEvent(
  runtimeEnv: Env,
  request: Request,
  selection: WebhookExplorerSelection,
): Promise<WebhookExplorerPreview> {
  let payload: Record<string, unknown>;
  if (selection.sourceMode === "generated") {
    payload = structuredClone(WEBHOOK_EVENT_EXAMPLES[selection.eventType]);
  } else {
    const input = await webhookExplorerEventInput(runtimeEnv, request, selection);
    const eventId = `evt_preview_${selection.eventType.replaceAll(".", "_")}`;
    payload = JSON.parse(prepareWebhookEvent(
      runtimeEnv,
      request,
      input,
      {origin: "dashboard"},
      {
        correlationId: eventId,
        eventId,
        requestId: "req_preview",
        test: true,
        timestamp: "2026-01-01T00:00:00.000Z",
      },
    ).payload) as Record<string, unknown>;
  }
  return {
    headers: previewHeaders(selection.eventType),
    payload,
    rawBody: JSON.stringify(payload),
    schema: eventSchema(selection.eventType),
  };
}

export async function printWebhookExplorerEvent(
  runtimeEnv: Env,
  request: Request,
  selection: WebhookExplorerSelection,
): Promise<WebhookExplorerPreview> {
  if (!isLocalDevelopmentHostname(new URL(request.url).hostname)) {
    throw new WebhookRequestError(
      "Printing webhook previews is available only from a loopback-hosted Admin session.",
    );
  }
  const preview = await previewWebhookExplorerEvent(runtimeEnv, request, selection);
  console.info(
    `=== microfeed Event Explorer preview: ${selection.eventType} (not delivered) ===`,
  );
  console.info(preview.rawBody);
  return preview;
}

export async function sendWebhookExplorerEvent(
  runtimeEnv: Env,
  request: Request,
  selection: WebhookExplorerSelection,
  endpointId: string,
) {
  if (!endpointId) throw new WebhookRequestError("Choose a webhook endpoint.");
  const eventInput = await webhookExplorerEventInput(
    runtimeEnv,
    request,
    selection,
  );
  const result = await createWebhookExplorerDelivery(
    runtimeEnv,
    request,
    endpointId,
    selection.sourceMode === "generated"
      ? materializeGeneratedInput(eventInput, endpointId)
      : eventInput,
  );
  return {
    ...result,
    delivery: await getWebhookDelivery(runtimeEnv.FEED_DB, result.deliveryId),
  };
}
