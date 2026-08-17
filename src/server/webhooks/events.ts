import {
  WEBHOOK_LIMITS,
  type WebhookEventInput,
  type WebhookEventType,
  webhookSubjectType,
} from "@/shared/Webhooks";
import {WebhookRequestError, WebhookUnavailableError} from "./validation";

export type WebhookOrigin = "api" | "dashboard" | "system";

export interface WebhookEventContext {
  causationId?: string;
  correlationId?: string;
  origin: WebhookOrigin;
  requestId?: string;
}

interface EligibleEndpoint extends Record<string, unknown> {
  id: string;
  status: "active" | "auto_paused";
  url: string;
}

export interface PreparedWebhookEvent {
  budgetDay: string;
  causationId?: string;
  correlationId: string;
  eventId: string;
  payload: string;
  requestId: string;
  timestamp: string;
}

interface MutationEventPlan {
  fallbackStatements: D1PreparedStatement[];
  pendingDeliveryIds: string[];
  primaryStatements: D1PreparedStatement[];
}

function webhooksAvailable(runtimeEnv: Env): boolean {
  return Boolean(
    runtimeEnv.WEBHOOK_QUEUE && runtimeEnv.WEBHOOK_SECRET_KEY?.trim(),
  );
}

function apiPath(
  subjectType: string,
  subjectId: string,
  eventType: WebhookEventType,
): string | undefined {
  if (subjectType === "item") {
    return `/api/v1/items/${encodeURIComponent(subjectId)}/`;
  }
  if (subjectType === "page" && eventType !== "page.navigation_updated") {
    return `/api/v1/pages/${encodeURIComponent(subjectId)}/`;
  }
  if (subjectType === "site_file") {
    return `/api/v1/site-files/${encodeURIComponent(subjectId)}/`;
  }
  if (subjectType === "channel") return "/api/v1/channels/primary/";
  return undefined;
}

export function truncateWebhookPayload(
  envelope: Record<string, unknown>,
  object: Record<string, unknown>,
): string {
  const data = envelope.data as {
    object: Record<string, unknown>;
    truncated_fields: string[];
  };
  let serialized = JSON.stringify(envelope);
  if (new TextEncoder().encode(serialized).byteLength <= WEBHOOK_LIMITS.payloadBytes) {
    return serialized;
  }
  if (!Object.hasOwn(object, "id")) {
    throw new Error("Webhook snapshots require a stable id before truncation.");
  }
  data.object = {id: object.id};
  data.truncated_fields = Object.keys(object)
    .filter((field) => field !== "id")
    .sort()
    .map((field) => `data.object.${field}`);
  serialized = JSON.stringify(envelope);
  if (new TextEncoder().encode(serialized).byteLength > WEBHOOK_LIMITS.payloadBytes) {
    throw new Error("Webhook event metadata exceeds the payload limit.");
  }
  return serialized;
}

export function prepareWebhookEvent(
  runtimeEnv: Env,
  request: Request,
  input: WebhookEventInput,
  context: WebhookEventContext,
  options: {
    correlationId?: string;
    eventId?: string;
    requestId?: string;
    test?: boolean;
    timestamp?: string;
  } = {},
): PreparedWebhookEvent {
  const eventId = options.eventId ?? `evt_${crypto.randomUUID()}`;
  const timestamp = options.timestamp ?? new Date().toISOString();
  const causationId = context.causationId ??
    request.headers.get("Microfeed-Causation-Id") ?? undefined;
  const correlationId = options.correlationId ?? context.correlationId ??
    request.headers.get("Microfeed-Correlation-Id") ?? causationId ?? eventId;
  const requestId = options.requestId ?? context.requestId ??
    request.headers.get("cf-ray") ?? `req_${crypto.randomUUID()}`;
  const subjectType = input.subjectType ?? webhookSubjectType(input.type);
  const object = structuredClone(input.object);
  const envelope: Record<string, unknown> = {
    api_version: "1",
    context: {
      causation_id: causationId ?? null,
      correlation_id: correlationId,
      origin: context.origin,
      request_id: requestId,
    },
    data: {
      changed_fields: input.changedFields ?? [],
      object,
      previous_status: input.previousStatus ?? null,
      truncated_fields: [],
    },
    id: eventId,
    site: {
      id: runtimeEnv.MICROFEED_INSTANCE_ID ?? "local",
      url: new URL(request.url).origin,
    },
    subject: {
      ...(apiPath(subjectType, input.subjectId, input.type)
        ? {api_path: apiPath(subjectType, input.subjectId, input.type)}
        : {}),
      id: input.subjectId,
      type: subjectType,
    },
    timestamp,
    test: Boolean(options.test),
    type: input.type,
  };
  return {
    budgetDay: timestamp.slice(0, 10),
    ...(causationId ? {causationId} : {}),
    correlationId,
    eventId,
    payload: truncateWebhookPayload(envelope, object),
    requestId,
    timestamp,
  };
}

function eventStatement(
  database: D1Database,
  prepared: PreparedWebhookEvent,
  input: WebhookEventInput,
  context: WebhookEventContext,
  deliveryCount: number,
  suppressionReason?: string,
): D1PreparedStatement {
  return database.prepare(`
    INSERT INTO webhook_events (
      id, event_type, api_version, subject_type, subject_id, payload_json,
      origin, request_id, correlation_id, causation_id, delivery_count,
      budget_day, suppression_reason, created_at
    ) VALUES (?, ?, '1', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    prepared.eventId,
    input.type,
    input.subjectType ?? webhookSubjectType(input.type),
    input.subjectId,
    prepared.payload,
    context.origin,
    prepared.requestId,
    prepared.correlationId,
    prepared.causationId ?? null,
    deliveryCount,
    prepared.budgetDay,
    suppressionReason ?? null,
    prepared.timestamp,
  );
}

function deliveryStatement(
  database: D1Database,
  prepared: PreparedWebhookEvent,
  endpoint: EligibleEndpoint,
  status: "pending" | "suppressed_budget" | "suppressed_endpoint_paused",
  options: {isManual?: boolean; isTest?: boolean} = {},
): {id: string; statement: D1PreparedStatement} {
  const id = `whd_${crypto.randomUUID()}`;
  const terminal = status !== "pending";
  return {
    id,
    statement: database.prepare(`
      INSERT INTO webhook_deliveries (
        id, event_id, endpoint_id, endpoint_url, status, is_test, is_manual,
        completed_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      prepared.eventId,
      endpoint.id,
      endpoint.url,
      status,
      options.isTest ? 1 : 0,
      options.isManual ? 1 : 0,
      terminal ? prepared.timestamp : null,
      prepared.timestamp,
      prepared.timestamp,
    ),
  };
}

async function queueDeliveries(
  runtimeEnv: Env,
  deliveryIds: string[],
): Promise<void> {
  if (deliveryIds.length === 0) return;
  await runtimeEnv.WEBHOOK_QUEUE.sendBatch(deliveryIds.map((deliveryId) => ({
    body: {deliveryId},
    contentType: "json" as const,
  })));
  const now = new Date().toISOString();
  await runtimeEnv.FEED_DB.batch(deliveryIds.map((deliveryId) =>
    runtimeEnv.FEED_DB.prepare(`
      UPDATE webhook_deliveries SET queued_at = ?, updated_at = ?
      WHERE id = ? AND status IN ('pending', 'retrying')
    `).bind(now, now, deliveryId)
  ));
}

async function eligibleEndpoints(
  database: D1Database,
  eventType: WebhookEventType,
): Promise<EligibleEndpoint[]> {
  const result = await database.prepare(`
    SELECT webhook_endpoints.id, webhook_endpoints.url,
      webhook_endpoints.status
    FROM webhook_endpoints
    JOIN webhook_subscriptions
      ON webhook_subscriptions.endpoint_id = webhook_endpoints.id
    WHERE webhook_endpoints.deleted_at IS NULL
      AND webhook_endpoints.status IN ('active', 'auto_paused')
      AND webhook_subscriptions.event_type = ?
    ORDER BY webhook_endpoints.created_at ASC, webhook_endpoints.id ASC
  `).bind(eventType).all<EligibleEndpoint>();
  return result.results;
}

async function mutationEventPlan(
  runtimeEnv: Env,
  request: Request,
  input: WebhookEventInput,
  context: WebhookEventContext,
): Promise<MutationEventPlan | null> {
  const endpoints = await eligibleEndpoints(runtimeEnv.FEED_DB, input.type);
  if (endpoints.length === 0) return null;
  const prepared = prepareWebhookEvent(runtimeEnv, request, input, context);
  if (endpoints.length > WEBHOOK_LIMITS.endpointCount) {
    const statements = [
      eventStatement(
        runtimeEnv.FEED_DB,
        prepared,
        input,
        context,
        0,
        "fanout_limit",
      ),
      runtimeEnv.FEED_DB.prepare(`
        INSERT INTO webhook_alerts (kind, message)
        VALUES ('fanout_limit', ?)
      `).bind(
        `Event ${prepared.eventId} matched ${endpoints.length} eligible endpoints; fanout was suppressed.`,
      ),
    ];
    return {
      fallbackStatements: statements,
      pendingDeliveryIds: [],
      primaryStatements: statements,
    };
  }
  const active = endpoints.filter(({status}) => status === "active");
  const paused = endpoints.filter(({status}) => status === "auto_paused");
  const pending = active.map((endpoint) =>
    deliveryStatement(runtimeEnv.FEED_DB, prepared, endpoint, "pending")
  );
  const pausedDeliveries = paused.map((endpoint) =>
    deliveryStatement(
      runtimeEnv.FEED_DB,
      prepared,
      endpoint,
      "suppressed_endpoint_paused",
    )
  );
  const budgetSuppressed = active.map((endpoint) =>
    deliveryStatement(
      runtimeEnv.FEED_DB,
      prepared,
      endpoint,
      "suppressed_budget",
    )
  );
  const fallbackStatements = active.length > 0
    ? [
        eventStatement(
          runtimeEnv.FEED_DB,
          prepared,
          input,
          context,
          0,
          "daily_budget",
        ),
        ...budgetSuppressed.map(({statement}) => statement),
        ...pausedDeliveries.map(({statement}) => statement),
      ]
    : [
        eventStatement(
          runtimeEnv.FEED_DB,
          prepared,
          input,
          context,
          0,
        ),
        ...pausedDeliveries.map(({statement}) => statement),
      ];
  return {
    fallbackStatements,
    pendingDeliveryIds: pending.map(({id}) => id),
    primaryStatements: [
      eventStatement(
        runtimeEnv.FEED_DB,
        prepared,
        input,
        context,
        pending.length,
      ),
      ...pending.map(({statement}) => statement),
      ...pausedDeliveries.map(({statement}) => statement),
    ],
  };
}

/**
 * Commits content SQL and every matching webhook outbox row in one D1 batch.
 * If the complete fanout cannot reserve daily budget, the same content SQL is
 * retried atomically with suppressed delivery rows instead. Queue writes occur
 * only after that transaction succeeds and reconciliation covers a failed
 * sendBatch call.
 */
export async function commitMutationWithWebhookEvents(
  runtimeEnv: Env,
  request: Request,
  contentStatements: D1PreparedStatement[],
  inputs: WebhookEventInput[],
  context: WebhookEventContext,
): Promise<void> {
  if (!webhooksAvailable(runtimeEnv) || inputs.length === 0) {
    await runtimeEnv.FEED_DB.batch(contentStatements);
    return;
  }
  const plans = (await Promise.all(inputs.map((input) =>
    mutationEventPlan(runtimeEnv, request, input, context)
  ))).filter((plan): plan is MutationEventPlan => plan !== null);
  if (plans.length === 0) {
    await runtimeEnv.FEED_DB.batch(contentStatements);
    return;
  }
  let deliveryIds = plans.flatMap(({pendingDeliveryIds}) => pendingDeliveryIds);
  try {
    await runtimeEnv.FEED_DB.batch([
      ...contentStatements,
      ...plans.flatMap(({primaryStatements}) => primaryStatements),
    ]);
  } catch (error) {
    if (!String(error).includes("webhook_daily_budget")) throw error;
    await runtimeEnv.FEED_DB.batch([
      ...contentStatements,
      ...plans.flatMap(({fallbackStatements}) => fallbackStatements),
    ]);
    deliveryIds = [];
  }
  try {
    await queueDeliveries(runtimeEnv, deliveryIds);
  } catch (error) {
    console.error(JSON.stringify({
      deliveryIds,
      error: error instanceof Error ? error.message : String(error),
      message: "Webhook deliveries were saved but not queued; reconciliation will retry",
    }));
  }
}

export async function emitWebhookEvent(
  runtimeEnv: Env,
  request: Request,
  input: WebhookEventInput,
  context: WebhookEventContext,
): Promise<{deliveryIds: string[]; eventId?: string; suppressed?: string}> {
  if (!webhooksAvailable(runtimeEnv)) return {deliveryIds: []};
  const endpoints = await eligibleEndpoints(runtimeEnv.FEED_DB, input.type);
  if (endpoints.length === 0) return {deliveryIds: []};
  const active = endpoints.filter(({status}) => status === "active");
  const paused = endpoints.filter(({status}) => status === "auto_paused");
  const prepared = prepareWebhookEvent(runtimeEnv, request, input, context);
  if (endpoints.length > WEBHOOK_LIMITS.endpointCount) {
    await runtimeEnv.FEED_DB.batch([
      eventStatement(
        runtimeEnv.FEED_DB,
        prepared,
        input,
        context,
        0,
        "fanout_limit",
      ),
      runtimeEnv.FEED_DB.prepare(`
        INSERT INTO webhook_alerts (kind, message)
        VALUES ('fanout_limit', ?)
      `).bind(
        `Event ${prepared.eventId} matched ${endpoints.length} eligible endpoints; fanout was suppressed.`,
      ),
    ]);
    return {
      deliveryIds: [],
      eventId: prepared.eventId,
      suppressed: "fanout_limit",
    };
  }
  const pending = active.map((endpoint) =>
    deliveryStatement(runtimeEnv.FEED_DB, prepared, endpoint, "pending")
  );
  const pausedDeliveries = paused.map((endpoint) =>
    deliveryStatement(
      runtimeEnv.FEED_DB,
      prepared,
      endpoint,
      "suppressed_endpoint_paused",
    )
  );
  try {
    await runtimeEnv.FEED_DB.batch([
      eventStatement(
        runtimeEnv.FEED_DB,
        prepared,
        input,
        context,
        pending.length,
      ),
      ...pending.map(({statement}) => statement),
      ...pausedDeliveries.map(({statement}) => statement),
    ]);
  } catch (error) {
    if (!String(error).includes("webhook_daily_budget")) throw error;
    const suppressed = active.map((endpoint) =>
      deliveryStatement(
        runtimeEnv.FEED_DB,
        prepared,
        endpoint,
        "suppressed_budget",
      )
    );
    await runtimeEnv.FEED_DB.batch([
      eventStatement(
        runtimeEnv.FEED_DB,
        prepared,
        input,
        context,
        0,
        "daily_budget",
      ),
      ...suppressed.map(({statement}) => statement),
      ...pausedDeliveries.map(({statement}) => statement),
    ]);
    return {
      deliveryIds: [],
      eventId: prepared.eventId,
      suppressed: "daily_budget",
    };
  }
  const deliveryIds = pending.map(({id}) => id);
  try {
    await queueDeliveries(runtimeEnv, deliveryIds);
  } catch (error) {
    console.error(JSON.stringify({
      deliveryIds,
      error: error instanceof Error ? error.message : String(error),
      message: "Webhook deliveries were saved but not queued; reconciliation will retry",
    }));
  }
  return {deliveryIds, eventId: prepared.eventId};
}

async function endpointForDirectDelivery(
  database: D1Database,
  endpointId: string,
  allowPaused: boolean,
): Promise<EligibleEndpoint | null> {
  return database.prepare(`
    SELECT id, url, status FROM webhook_endpoints
    WHERE id = ? AND deleted_at IS NULL
      AND status ${allowPaused ? "IN ('active', 'auto_paused')" : "= 'active'"}
    LIMIT 1
  `).bind(endpointId).first<EligibleEndpoint>();
}

async function createDirectDelivery(
  runtimeEnv: Env,
  request: Request,
  input: WebhookEventInput,
  context: WebhookEventContext,
  endpoint: EligibleEndpoint,
  options: {isManual?: boolean; isTest?: boolean},
): Promise<{deliveryId: string; eventId: string; suppressed?: string}> {
  const prepared = prepareWebhookEvent(runtimeEnv, request, input, context, {
    test: options.isTest,
  });
  const delivery = deliveryStatement(
    runtimeEnv.FEED_DB,
    prepared,
    endpoint,
    "pending",
    options,
  );
  try {
    await runtimeEnv.FEED_DB.batch([
      eventStatement(runtimeEnv.FEED_DB, prepared, input, context, 1),
      delivery.statement,
    ]);
  } catch (error) {
    if (!String(error).includes("webhook_daily_budget")) throw error;
    const suppressed = deliveryStatement(
      runtimeEnv.FEED_DB,
      prepared,
      endpoint,
      "suppressed_budget",
      options,
    );
    await runtimeEnv.FEED_DB.batch([
      eventStatement(
        runtimeEnv.FEED_DB,
        prepared,
        input,
        context,
        0,
        "daily_budget",
      ),
      suppressed.statement,
    ]);
    return {
      deliveryId: suppressed.id,
      eventId: prepared.eventId,
      suppressed: "daily_budget",
    };
  }
  await queueDeliveries(runtimeEnv, [delivery.id]).catch((error) => {
    console.error(JSON.stringify({
      deliveryId: delivery.id,
      error: error instanceof Error ? error.message : String(error),
      message: "Webhook delivery will be queued by reconciliation",
    }));
  });
  return {deliveryId: delivery.id, eventId: prepared.eventId};
}

export async function createWebhookTestDelivery(
  runtimeEnv: Env,
  request: Request,
  endpointId: string,
): Promise<{deliveryId: string; eventId: string; suppressed?: string}> {
  if (!webhooksAvailable(runtimeEnv)) {
    throw new WebhookUnavailableError(
      "Enable webhooks with yarn manage deploy --enable-webhooks first.",
    );
  }
  const endpoint = await endpointForDirectDelivery(
    runtimeEnv.FEED_DB,
    endpointId,
    true,
  );
  if (!endpoint) {
    throw new WebhookRequestError(
      "The endpoint does not exist or is disabled.",
    );
  }
  return createDirectDelivery(
    runtimeEnv,
    request,
    {
      object: {
        id: endpointId,
        message: "This is a microfeed webhook test.",
      },
      subjectId: endpointId,
      subjectType: "webhook",
      type: "webhook.test",
    },
    {origin: "dashboard"},
    endpoint,
    {isTest: true},
  );
}

export async function createWebhookExplorerDelivery(
  runtimeEnv: Env,
  request: Request,
  endpointId: string,
  input: WebhookEventInput,
): Promise<{deliveryId: string; eventId: string; suppressed?: string}> {
  if (!webhooksAvailable(runtimeEnv)) {
    throw new WebhookUnavailableError(
      "Enable webhooks with yarn manage deploy --enable-webhooks first.",
    );
  }
  const endpoint = await endpointForDirectDelivery(
    runtimeEnv.FEED_DB,
    endpointId,
    true,
  );
  if (!endpoint) {
    throw new WebhookRequestError(
      "The endpoint does not exist or is disabled.",
    );
  }
  return createDirectDelivery(
    runtimeEnv,
    request,
    input,
    {origin: "dashboard"},
    endpoint,
    {isTest: true},
  );
}

export async function redeliverWebhookDelivery(
  runtimeEnv: Env,
  _request: Request,
  deliveryId: string,
): Promise<{deliveryId: string; eventId: string; suppressed?: string}> {
  if (!webhooksAvailable(runtimeEnv)) {
    throw new WebhookUnavailableError("Webhooks are not enabled.");
  }
  const source = await runtimeEnv.FEED_DB.prepare(`
    SELECT webhook_deliveries.endpoint_id, webhook_deliveries.is_test,
      webhook_events.id AS event_id
    FROM webhook_deliveries
    JOIN webhook_events ON webhook_events.id = webhook_deliveries.event_id
    WHERE webhook_deliveries.id = ? LIMIT 1
  `).bind(deliveryId).first<Record<string, unknown>>();
  if (!source) throw new WebhookRequestError("Delivery not found.");
  const endpoint = await endpointForDirectDelivery(
    runtimeEnv.FEED_DB,
    String(source.endpoint_id),
    false,
  );
  if (!endpoint) {
    throw new WebhookRequestError(
      "The endpoint must be active before redelivery.",
    );
  }
  const newDeliveryId = `whd_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  try {
    await runtimeEnv.FEED_DB.batch([
      runtimeEnv.FEED_DB.prepare(`
        INSERT INTO webhook_budget_reservations (
          id, delivery_count, budget_day, created_at
        ) VALUES (?, 1, ?, ?)
      `).bind(
        `whr_${crypto.randomUUID()}`,
        now.slice(0, 10),
        now,
      ),
      runtimeEnv.FEED_DB.prepare(`
        INSERT INTO webhook_deliveries (
          id, event_id, endpoint_id, endpoint_url, status, is_test, is_manual,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending', ?, 1, ?, ?)
      `).bind(
        newDeliveryId,
        String(source.event_id),
        endpoint.id,
        endpoint.url,
        Number(source.is_test) ? 1 : 0,
        now,
        now,
      ),
    ]);
  } catch (error) {
    if (String(error).includes("webhook_daily_budget")) {
      await runtimeEnv.FEED_DB.prepare(`
        INSERT INTO webhook_deliveries (
          id, event_id, endpoint_id, endpoint_url, status, is_test, is_manual,
          completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'suppressed_budget', ?, 1, ?, ?, ?)
      `).bind(
        newDeliveryId,
        String(source.event_id),
        endpoint.id,
        endpoint.url,
        Number(source.is_test) ? 1 : 0,
        now,
        now,
        now,
      ).run();
      return {
        deliveryId: newDeliveryId,
        eventId: String(source.event_id),
        suppressed: "daily_budget",
      };
    }
    throw error;
  }
  await queueDeliveries(runtimeEnv, [newDeliveryId]);
  return {deliveryId: newDeliveryId, eventId: String(source.event_id)};
}

export async function enqueueUnqueuedWebhookDeliveries(
  runtimeEnv: Env,
): Promise<number> {
  if (!webhooksAvailable(runtimeEnv)) return 0;
  const result = await runtimeEnv.FEED_DB.prepare(`
    SELECT id FROM webhook_deliveries
    WHERE status IN ('pending', 'retrying')
      AND (queued_at IS NULL OR queued_at < datetime('now', '-15 minutes'))
      AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP)
      AND (lease_until IS NULL OR lease_until < CURRENT_TIMESTAMP)
    ORDER BY created_at ASC LIMIT 100
  `).all<{id: string}>();
  const ids = result.results.map(({id}) => id);
  for (let index = 0; index < ids.length; index += 20) {
    await queueDeliveries(runtimeEnv, ids.slice(index, index + 20));
  }
  return ids.length;
}

export async function hasConfiguredWebhookEndpoints(
  database: D1Database,
): Promise<boolean> {
  const endpoint = await database.prepare(`
    SELECT 1 AS configured
    FROM webhook_endpoints
    WHERE deleted_at IS NULL
    LIMIT 1
  `).first<{configured: number}>();
  return Boolean(endpoint?.configured);
}

export function isDailyWebhookCleanupDue(scheduledTime: number): boolean {
  return new Date(scheduledTime).getUTCHours() === 0;
}

export async function runWebhookScheduledMaintenance(
  runtimeEnv: Env,
  scheduledTime: number,
): Promise<{cleaned: boolean; reconciled: number; skipped: boolean}> {
  if (!webhooksAvailable(runtimeEnv) ||
    !await hasConfiguredWebhookEndpoints(runtimeEnv.FEED_DB)) {
    return {cleaned: false, reconciled: 0, skipped: true};
  }
  const reconciled = await enqueueUnqueuedWebhookDeliveries(runtimeEnv);
  const cleaned = isDailyWebhookCleanupDue(scheduledTime);
  if (cleaned) await pruneWebhookHistory(runtimeEnv.FEED_DB);
  return {cleaned, reconciled, skipped: false};
}

export async function pruneWebhookHistory(database: D1Database): Promise<void> {
  await database.batch([
    database.prepare(`
      UPDATE webhook_endpoints
      SET previous_secret_ciphertext = NULL,
        previous_secret_expires_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE previous_secret_expires_at IS NOT NULL
        AND previous_secret_expires_at <= CURRENT_TIMESTAMP
    `),
    database.prepare(`
      DELETE FROM webhook_delivery_attempts WHERE delivery_id IN (
        SELECT id FROM webhook_deliveries
        WHERE created_at < datetime('now', '-${WEBHOOK_LIMITS.retentionDays} days')
      )
    `),
    database.prepare(`
      DELETE FROM webhook_deliveries
      WHERE created_at < datetime('now', '-${WEBHOOK_LIMITS.retentionDays} days')
    `),
    database.prepare(`
      DELETE FROM webhook_events
      WHERE created_at < datetime('now', '-${WEBHOOK_LIMITS.retentionDays} days')
        AND id NOT IN (SELECT event_id FROM webhook_deliveries)
    `),
    database.prepare(`
      DELETE FROM webhook_daily_usage WHERE usage_day < date('now', '-35 days')
    `),
    database.prepare(`
      DELETE FROM webhook_budget_reservations
      WHERE created_at < datetime('now', '-35 days')
    `),
    database.prepare(`
      DELETE FROM webhook_alerts
      WHERE resolved_at IS NOT NULL
        AND resolved_at < datetime('now', '-${WEBHOOK_LIMITS.retentionDays} days')
    `),
    database.prepare(`
      DELETE FROM webhook_endpoints
      WHERE deleted_at < datetime('now', '-${WEBHOOK_LIMITS.retentionDays} days')
        AND id NOT IN (SELECT endpoint_id FROM webhook_deliveries)
    `),
  ]);
}
