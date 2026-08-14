import {
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_EVENT_TYPE_SET,
  WEBHOOK_LIMITS,
  type WebhookAttemptSummary,
  type WebhookDeliverySummary,
  type WebhookDeliveryStatus,
  type WebhookEndpointSummary,
  type WebhookEndpointStatus,
  type WebhookEventType,
  type WebhookOverview,
} from "@/shared/Webhooks";
import {
  encryptWebhookSecret,
  generateWebhookSecret,
} from "./crypto";
import {
  validateWebhookEndpointUrl,
  validateWebhookEvents,
  WebhookEndpointLimitError,
  WebhookRequestError,
  WebhookUnavailableError,
} from "./validation";

interface EndpointRow extends Record<string, unknown> {
  consecutive_terminal_failures: number;
  created_at: string;
  deleted_at: string | null;
  events: string | null;
  id: string;
  name: string;
  resume_tested_at: string | null;
  status: WebhookEndpointStatus;
  updated_at: string;
  url: string;
}

function webhookEncryptionSecret(runtimeEnv: Env): string {
  const value = runtimeEnv.WEBHOOK_SECRET_KEY?.trim();
  if (!value) {
    throw new WebhookUnavailableError(
      "Webhooks are not enabled for this microfeed deployment.",
    );
  }
  return value;
}

function endpointFromRow(row: EndpointRow): WebhookEndpointSummary {
  return {
    consecutiveTerminalFailures: Number(
      row.consecutive_terminal_failures ?? 0,
    ),
    createdAt: String(row.created_at),
    ...(row.deleted_at ? {deletedAt: String(row.deleted_at)} : {}),
    events: (String(row.events ?? "").split(",").filter(Boolean)) as
      WebhookEventType[],
    id: String(row.id),
    name: String(row.name),
    ...(row.resume_tested_at
      ? {resumeTestedAt: String(row.resume_tested_at)}
      : {}),
    status: row.status,
    updatedAt: String(row.updated_at),
    url: String(row.url),
  };
}

const ENDPOINT_SELECT = `
  SELECT webhook_endpoints.*,
    GROUP_CONCAT(webhook_subscriptions.event_type) AS events
  FROM webhook_endpoints
  LEFT JOIN webhook_subscriptions
    ON webhook_subscriptions.endpoint_id = webhook_endpoints.id
`;

export async function listWebhookEndpoints(
  database: D1Database,
  includeDeleted = false,
): Promise<WebhookEndpointSummary[]> {
  const result = await database.prepare(`${ENDPOINT_SELECT}
    ${includeDeleted ? "" : "WHERE webhook_endpoints.deleted_at IS NULL"}
    GROUP BY webhook_endpoints.id
    ORDER BY webhook_endpoints.created_at DESC, webhook_endpoints.id DESC
  `).all<EndpointRow>();
  return result.results.map(endpointFromRow);
}

export async function getWebhookEndpoint(
  database: D1Database,
  id: string,
): Promise<WebhookEndpointSummary | null> {
  const row = await database.prepare(`${ENDPOINT_SELECT}
    WHERE webhook_endpoints.id = ? AND webhook_endpoints.deleted_at IS NULL
    GROUP BY webhook_endpoints.id
    LIMIT 1
  `).bind(id).first<EndpointRow>();
  return row ? endpointFromRow(row) : null;
}

export async function createWebhookEndpoint(
  runtimeEnv: Env,
  input: {events: unknown; name: unknown; url: unknown},
  siteOrigin: string,
): Promise<{endpoint: WebhookEndpointSummary; secret: string}> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 80) {
    throw new WebhookRequestError(
      "Endpoint names must contain 1–80 characters.",
    );
  }
  if (typeof input.url !== "string") {
    throw new WebhookRequestError("Enter a webhook URL.");
  }
  const url = validateWebhookEndpointUrl(input.url, {
    local: !runtimeEnv.MICROFEED_CLOUDFLARE_ACCOUNT_ID?.trim(),
    siteOrigin,
  });
  const events = validateWebhookEvents(input.events);
  const id = `whe_${crypto.randomUUID()}`;
  const secret = generateWebhookSecret();
  const encrypted = await encryptWebhookSecret(
    secret,
    webhookEncryptionSecret(runtimeEnv),
  );
  const statements = [
    runtimeEnv.FEED_DB.prepare(`
      INSERT INTO webhook_endpoints (
        id, name, url, status, secret_ciphertext, created_at, updated_at
      ) VALUES (?, ?, ?, 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(id, name, url, encrypted),
    ...events.map((event) =>
      runtimeEnv.FEED_DB.prepare(`
        INSERT INTO webhook_subscriptions (endpoint_id, event_type)
        VALUES (?, ?)
      `).bind(id, event)
    ),
  ];
  try {
    await runtimeEnv.FEED_DB.batch(statements);
  } catch (error) {
    if (String(error).includes("webhook_endpoint_limit")) {
      throw new WebhookEndpointLimitError(
        `A microfeed instance supports at most ${WEBHOOK_LIMITS.endpointCount} non-deleted webhook endpoints.`,
      );
    }
    throw error;
  }
  return {endpoint: (await getWebhookEndpoint(runtimeEnv.FEED_DB, id))!, secret};
}

export async function updateWebhookEndpoint(
  runtimeEnv: Env,
  id: string,
  input: {events?: unknown; name?: unknown; status?: unknown; url?: unknown},
  siteOrigin: string,
): Promise<WebhookEndpointSummary | null> {
  const existing = await getWebhookEndpoint(runtimeEnv.FEED_DB, id);
  if (!existing) return null;
  const name = input.name === undefined
    ? existing.name
    : typeof input.name === "string"
    ? input.name.trim()
    : "";
  if (!name || name.length > 80) {
    throw new WebhookRequestError(
      "Endpoint names must contain 1–80 characters.",
    );
  }
  const url = input.url === undefined
    ? existing.url
    : typeof input.url === "string"
    ? validateWebhookEndpointUrl(input.url, {
        local: !runtimeEnv.MICROFEED_CLOUDFLARE_ACCOUNT_ID?.trim(),
        siteOrigin,
      })
    : (() => {
        throw new WebhookRequestError("Enter a webhook URL.");
      })();
  const events = input.events === undefined
    ? existing.events
    : validateWebhookEvents(input.events);
  const status = input.status === undefined ? existing.status : input.status;
  if (
    input.status !== undefined &&
    status !== "active" && status !== "disabled"
  ) {
    throw new WebhookRequestError("Choose active or disabled.");
  }
  if (existing.status === "auto_paused" && status === "active") {
    throw new WebhookRequestError(
      "Send a successful test and use the explicit resume action.",
    );
  }
  const activating = existing.status === "disabled" && status === "active";
  const canceledStatus = status === "disabled"
    ? "canceled_endpoint_disabled"
    : null;
  await runtimeEnv.FEED_DB.batch([
    runtimeEnv.FEED_DB.prepare(`
      UPDATE webhook_endpoints
      SET name = ?, url = ?, status = ?,
        consecutive_terminal_failures = CASE WHEN ? = 1
          THEN 0 ELSE consecutive_terminal_failures END,
        resume_tested_at = CASE WHEN ? = 1 THEN NULL ELSE resume_tested_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL
    `).bind(name, url, status, activating ? 1 : 0, activating ? 1 : 0, id),
    runtimeEnv.FEED_DB.prepare(
      "DELETE FROM webhook_subscriptions WHERE endpoint_id = ?",
    ).bind(id),
    ...events.map((event) =>
      runtimeEnv.FEED_DB.prepare(`
        INSERT INTO webhook_subscriptions (endpoint_id, event_type)
        VALUES (?, ?)
      `).bind(id, event)
    ),
    ...(canceledStatus
      ? [runtimeEnv.FEED_DB.prepare(`
          UPDATE webhook_deliveries
          SET status = ?, completed_at = CURRENT_TIMESTAMP,
            lease_until = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE endpoint_id = ? AND status IN ('pending', 'retrying')
        `).bind(canceledStatus, id)]
      : []),
  ]);
  return getWebhookEndpoint(runtimeEnv.FEED_DB, id);
}

export async function rotateWebhookEndpointSecret(
  runtimeEnv: Env,
  id: string,
): Promise<{endpoint: WebhookEndpointSummary; secret: string} | null> {
  const existing = await getWebhookEndpoint(runtimeEnv.FEED_DB, id);
  if (!existing) return null;
  const secret = generateWebhookSecret();
  const encrypted = await encryptWebhookSecret(
    secret,
    webhookEncryptionSecret(runtimeEnv),
  );
  await runtimeEnv.FEED_DB.prepare(`
    UPDATE webhook_endpoints
    SET previous_secret_ciphertext = secret_ciphertext,
      previous_secret_expires_at = datetime('now', '+24 hours'),
      secret_ciphertext = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL
  `).bind(encrypted, id).run();
  return {endpoint: (await getWebhookEndpoint(runtimeEnv.FEED_DB, id))!, secret};
}

export async function resumeWebhookEndpoint(
  database: D1Database,
  id: string,
): Promise<WebhookEndpointSummary | null> {
  const result = await database.prepare(`
    UPDATE webhook_endpoints
    SET status = 'active', consecutive_terminal_failures = 0,
      resume_tested_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND deleted_at IS NULL AND status = 'auto_paused'
      AND resume_tested_at IS NOT NULL
  `).bind(id).run();
  if (!result.meta.changes) {
    const endpoint = await getWebhookEndpoint(database, id);
    if (!endpoint) return null;
    throw new WebhookRequestError(
      "Send a successful test delivery before resuming this endpoint.",
    );
  }
  return getWebhookEndpoint(database, id);
}

export async function deleteWebhookEndpoint(
  database: D1Database,
  id: string,
): Promise<boolean> {
  const results = await database.batch([
    database.prepare(`
      UPDATE webhook_endpoints SET deleted_at = CURRENT_TIMESTAMP,
        status = 'disabled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL
    `).bind(id),
    database.prepare(`
      UPDATE webhook_deliveries
      SET status = 'canceled_endpoint_disabled',
        completed_at = CURRENT_TIMESTAMP, lease_until = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE endpoint_id = ? AND status IN ('pending', 'retrying')
    `).bind(id),
  ]);
  return Boolean(results[0]?.meta.changes);
}

interface DeliveryRow extends Record<string, unknown> {
  attempt_count: number;
  completed_at: string | null;
  created_at: string;
  endpoint_id: string;
  endpoint_name: string | null;
  endpoint_url: string;
  error: string | null;
  event_id: string;
  event_type: WebhookEventType;
  id: string;
  is_manual: number;
  is_test: number;
  response_body: string | null;
  response_status: number | null;
  status: WebhookDeliveryStatus;
}

function deliveryFromRow(row: DeliveryRow): WebhookDeliverySummary {
  return {
    attemptCount: Number(row.attempt_count),
    ...(row.completed_at ? {completedAt: String(row.completed_at)} : {}),
    createdAt: String(row.created_at),
    endpointId: String(row.endpoint_id),
    ...(row.endpoint_name ? {endpointName: String(row.endpoint_name)} : {}),
    endpointUrl: String(row.endpoint_url),
    ...(row.error ? {error: String(row.error)} : {}),
    eventId: String(row.event_id),
    eventType: row.event_type,
    id: String(row.id),
    isManual: Boolean(row.is_manual),
    isTest: Boolean(row.is_test),
    ...(row.response_body ? {responseBody: String(row.response_body)} : {}),
    ...(row.response_status !== null
      ? {responseStatus: Number(row.response_status)}
      : {}),
    status: row.status,
  };
}

const DELIVERY_SELECT = `
  SELECT webhook_deliveries.*,
    webhook_events.event_type AS event_type,
    webhook_endpoints.name AS endpoint_name
  FROM webhook_deliveries
  JOIN webhook_events ON webhook_events.id = webhook_deliveries.event_id
  LEFT JOIN webhook_endpoints ON webhook_endpoints.id = webhook_deliveries.endpoint_id
`;

export async function listWebhookDeliveries(
  database: D1Database,
  filters: {endpointId?: string; eventType?: string; status?: string} = {},
): Promise<WebhookDeliverySummary[]> {
  const clauses: string[] = [];
  const bindings: string[] = [];
  if (filters.endpointId) {
    clauses.push("webhook_deliveries.endpoint_id = ?");
    bindings.push(filters.endpointId);
  }
  if (filters.eventType && WEBHOOK_EVENT_TYPE_SET.has(filters.eventType)) {
    clauses.push("webhook_events.event_type = ?");
    bindings.push(filters.eventType);
  }
  if (filters.status) {
    clauses.push("webhook_deliveries.status = ?");
    bindings.push(filters.status);
  }
  const result = await database.prepare(`${DELIVERY_SELECT}
    ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
    ORDER BY webhook_deliveries.created_at DESC, webhook_deliveries.id DESC
    LIMIT 200
  `).bind(...bindings).all<DeliveryRow>();
  return result.results.map(deliveryFromRow);
}

export async function getWebhookDelivery(
  database: D1Database,
  id: string,
): Promise<(
  WebhookDeliverySummary & {attempts: WebhookAttemptSummary[]; payload: unknown}
) | null> {
  const row = await database.prepare(`${DELIVERY_SELECT}
    WHERE webhook_deliveries.id = ? LIMIT 1
  `).bind(id).first<DeliveryRow>();
  if (!row) return null;
  const [event, attempts] = await Promise.all([
    database.prepare(
      "SELECT payload_json FROM webhook_events WHERE id = ? LIMIT 1",
    ).bind(row.event_id).first<{payload_json: string}>(),
    database.prepare(`
      SELECT attempt_number, outcome, response_status, response_body,
        error, duration_ms, created_at
      FROM webhook_delivery_attempts WHERE delivery_id = ?
      ORDER BY attempt_number ASC
    `).bind(id).all<Record<string, unknown>>(),
  ]);
  return {
    ...deliveryFromRow(row),
    attempts: attempts.results.map((attempt) => ({
      attemptNumber: Number(attempt.attempt_number),
      createdAt: String(attempt.created_at),
      durationMs: Number(attempt.duration_ms),
      ...(attempt.error ? {error: String(attempt.error)} : {}),
      outcome: String(attempt.outcome),
      ...(attempt.response_body
        ? {responseBody: String(attempt.response_body)}
        : {}),
      ...(attempt.response_status !== null &&
          attempt.response_status !== undefined
        ? {responseStatus: Number(attempt.response_status)}
        : {}),
    })),
    payload: JSON.parse(event?.payload_json ?? "null") as unknown,
  };
}

export async function webhookOverview(
  runtimeEnv: Env,
): Promise<WebhookOverview> {
  const today = new Date().toISOString().slice(0, 10);
  const [counts, usage, failures, alerts] = await Promise.all([
    runtimeEnv.FEED_DB.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
      FROM webhook_endpoints WHERE deleted_at IS NULL
    `).first<{active: number; total: number}>(),
    runtimeEnv.FEED_DB.prepare(`
      SELECT deliveries FROM webhook_daily_usage WHERE usage_day = ?
    `).bind(today).first<{deliveries: number}>(),
    runtimeEnv.FEED_DB.prepare(`
      SELECT COUNT(*) AS total FROM webhook_deliveries
      WHERE status = 'failed' AND created_at >= datetime('now', '-24 hours')
    `).first<{total: number}>(),
    runtimeEnv.FEED_DB.prepare(`
      SELECT id, kind, message, created_at FROM webhook_alerts
      WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 10
    `).all<Record<string, unknown>>(),
  ]);
  const deliveriesToday = Number(usage?.deliveries ?? 0);
  return {
    activeEndpoints: Number(counts?.active ?? 0),
    alerts: alerts.results.map((alert) => ({
      createdAt: String(alert.created_at),
      id: Number(alert.id),
      kind: String(alert.kind),
      message: String(alert.message),
    })),
    dailyLimit: WEBHOOK_LIMITS.dailyDeliveries,
    deliveriesToday,
    enabled: Boolean(
      runtimeEnv.WEBHOOK_QUEUE && runtimeEnv.WEBHOOK_SECRET_KEY?.trim(),
    ),
    endpointLimit: WEBHOOK_LIMITS.endpointCount,
    endpoints: Number(counts?.total ?? 0),
    estimatedQueueOperationsToday: deliveriesToday * 3,
    recentFailures: Number(failures?.total ?? 0),
  };
}

export {WEBHOOK_EVENT_TYPES};
