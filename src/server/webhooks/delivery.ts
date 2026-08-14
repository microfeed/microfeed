import {
  WEBHOOK_LIMITS,
  WEBHOOK_RETRY_DELAYS_SECONDS,
} from "@/shared/Webhooks";
import {
  decryptWebhookSecret,
  standardWebhookSignature,
} from "./crypto";

export interface WebhookQueueMessage {
  deliveryId: string;
}

interface DeliveryRecord extends Record<string, unknown> {
  attempt_count: number;
  endpoint_id: string;
  endpoint_status: "active" | "disabled" | "auto_paused";
  endpoint_url: string;
  event_type: string;
  id: string;
  is_test: number;
  payload_json: string;
  previous_secret_ciphertext: string | null;
  previous_secret_expires_at: string | null;
  secret_ciphertext: string;
  status: string;
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function responseDiagnostic(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (length < WEBHOOK_LIMITS.responseDiagnosticBytes) {
      const {done, value} = await reader.read();
      if (done) break;
      const remaining = WEBHOOK_LIMITS.responseDiagnosticBytes - length;
      const chunk = value.byteLength > remaining
        ? value.slice(0, remaining)
        : value;
      chunks.push(chunk);
      length += chunk.byteLength;
      if (chunk.byteLength < value.byteLength) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function acquireDelivery(
  database: D1Database,
  deliveryId: string,
): Promise<DeliveryRecord | null> {
  const lease = new Date(Date.now() + 30_000).toISOString();
  const result = await database.prepare(`
    UPDATE webhook_deliveries SET lease_until = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status IN ('pending', 'retrying')
      AND (next_attempt_at IS NULL OR next_attempt_at <= CURRENT_TIMESTAMP)
      AND (lease_until IS NULL OR lease_until < CURRENT_TIMESTAMP)
  `).bind(lease, deliveryId).run();
  if (!result.meta.changes) return null;
  return database.prepare(`
    SELECT webhook_deliveries.id, webhook_deliveries.status,
      webhook_deliveries.endpoint_id, webhook_deliveries.endpoint_url,
      webhook_deliveries.attempt_count, webhook_deliveries.is_test,
      webhook_events.event_type, webhook_events.payload_json,
      webhook_endpoints.status AS endpoint_status,
      webhook_endpoints.secret_ciphertext,
      webhook_endpoints.previous_secret_ciphertext,
      webhook_endpoints.previous_secret_expires_at
    FROM webhook_deliveries
    JOIN webhook_events ON webhook_events.id = webhook_deliveries.event_id
    JOIN webhook_endpoints ON webhook_endpoints.id = webhook_deliveries.endpoint_id
    WHERE webhook_deliveries.id = ? LIMIT 1
  `).bind(deliveryId).first<DeliveryRecord>();
}

async function markCanceledForEndpointState(
  database: D1Database,
  record: DeliveryRecord,
): Promise<void> {
  const status = record.endpoint_status === "auto_paused"
    ? "canceled_endpoint_paused"
    : "canceled_endpoint_disabled";
  await database.prepare(`
    UPDATE webhook_deliveries SET status = ?, lease_until = NULL,
      completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, record.id).run();
}

async function markSuccessful(
  database: D1Database,
  record: DeliveryRecord,
  attempt: number,
  response: Response,
  body: string,
  durationMs: number,
): Promise<void> {
  await database.batch([
    database.prepare(`
      INSERT INTO webhook_delivery_attempts (
        delivery_id, attempt_number, outcome, response_status, response_body,
        duration_ms, created_at
      ) VALUES (?, ?, 'succeeded', ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(record.id, attempt, response.status, body, durationMs),
    database.prepare(`
      UPDATE webhook_deliveries
      SET status = 'succeeded', attempt_count = ?, response_status = ?,
        response_body = ?, error = NULL, lease_until = NULL,
        completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(attempt, response.status, body, record.id),
    database.prepare(`
      UPDATE webhook_endpoints
      SET consecutive_terminal_failures = 0,
        resume_tested_at = CASE
          WHEN status = 'auto_paused' AND ? = 1 THEN CURRENT_TIMESTAMP
          ELSE resume_tested_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL
    `).bind(record.is_test, record.endpoint_id),
  ]);
}

async function markTerminalFailure(
  database: D1Database,
  record: DeliveryRecord,
  input: {
    attempt: number;
    durationMs: number;
    error?: string;
    outcome: string;
    responseBody?: string;
    responseStatus?: number;
  },
): Promise<void> {
  await database.batch([
    database.prepare(`
      INSERT INTO webhook_delivery_attempts (
        delivery_id, attempt_number, outcome, response_status, response_body,
        error, duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      record.id,
      input.attempt,
      input.outcome,
      input.responseStatus ?? null,
      input.responseBody ?? null,
      input.error ?? null,
      input.durationMs,
    ),
    database.prepare(`
      UPDATE webhook_deliveries
      SET status = 'failed', attempt_count = ?, response_status = ?,
        response_body = ?, error = ?, lease_until = NULL,
        completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      input.attempt,
      input.responseStatus ?? null,
      input.responseBody ?? null,
      input.error ?? null,
      record.id,
    ),
    database.prepare(`
      UPDATE webhook_endpoints
      SET consecutive_terminal_failures = consecutive_terminal_failures + 1,
        status = CASE
          WHEN consecutive_terminal_failures + 1 >= ? THEN 'auto_paused'
          ELSE status END,
        resume_tested_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND deleted_at IS NULL
    `).bind(
      WEBHOOK_LIMITS.autoPauseTerminalFailures,
      record.endpoint_id,
    ),
    database.prepare(`
      UPDATE webhook_deliveries
      SET status = 'canceled_endpoint_paused',
        completed_at = CURRENT_TIMESTAMP, lease_until = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE endpoint_id = ? AND id != ?
        AND status IN ('pending', 'retrying')
        AND EXISTS (
          SELECT 1 FROM webhook_endpoints
          WHERE id = ? AND status = 'auto_paused'
        )
    `).bind(record.endpoint_id, record.id, record.endpoint_id),
  ]);
}

async function markForRetry(
  database: D1Database,
  record: DeliveryRecord,
  input: {
    attempt: number;
    delaySeconds: number;
    durationMs: number;
    error?: string;
    outcome: string;
    responseBody?: string;
    responseStatus?: number;
  },
): Promise<void> {
  const nextAttemptAt = new Date(Date.now() + input.delaySeconds * 1_000)
    .toISOString();
  await database.batch([
    database.prepare(`
      INSERT INTO webhook_delivery_attempts (
        delivery_id, attempt_number, outcome, response_status, response_body,
        error, duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      record.id,
      input.attempt,
      input.outcome,
      input.responseStatus ?? null,
      input.responseBody ?? null,
      input.error ?? null,
      input.durationMs,
    ),
    database.prepare(`
      UPDATE webhook_deliveries
      SET status = 'retrying', attempt_count = ?, response_status = ?,
        response_body = ?, error = ?, next_attempt_at = ?,
        lease_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      input.attempt,
      input.responseStatus ?? null,
      input.responseBody ?? null,
      input.error ?? null,
      nextAttemptAt,
      record.id,
    ),
  ]);
}

export async function processWebhookMessage(
  runtimeEnv: Env,
  message: Message<WebhookQueueMessage>,
): Promise<void> {
  const deliveryId = message.body?.deliveryId;
  if (typeof deliveryId !== "string" || !deliveryId.startsWith("whd_")) {
    message.ack();
    return;
  }
  const record = await acquireDelivery(runtimeEnv.FEED_DB, deliveryId);
  if (!record) {
    message.ack();
    return;
  }
  if (
    record.endpoint_status !== "active" &&
    !(record.endpoint_status === "auto_paused" && Boolean(record.is_test))
  ) {
    await markCanceledForEndpointState(runtimeEnv.FEED_DB, record);
    message.ack();
    return;
  }
  const attempt = Number(record.attempt_count) + 1;
  const startedAt = Date.now();
  let response: Response | undefined;
  let body = "";
  let requestError: string | undefined;
  try {
    const timestamp = Math.floor(Date.now() / 1_000);
    const secret = await decryptWebhookSecret(
      String(record.secret_ciphertext),
      runtimeEnv.WEBHOOK_SECRET_KEY,
    );
    const signatures = [await standardWebhookSignature(
      secret,
      record.id,
      timestamp,
      String(record.payload_json),
    )];
    if (
      record.previous_secret_ciphertext &&
      record.previous_secret_expires_at &&
      Date.parse(record.previous_secret_expires_at) > Date.now()
    ) {
      const previousSecret = await decryptWebhookSecret(
        record.previous_secret_ciphertext,
        runtimeEnv.WEBHOOK_SECRET_KEY,
      );
      signatures.push(await standardWebhookSignature(
        previousSecret,
        record.id,
        timestamp,
        String(record.payload_json),
      ));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_LIMITS.timeoutMs);
    try {
      response = await fetch(record.endpoint_url, {
        body: String(record.payload_json),
        headers: {
          "content-type": "application/json",
          "user-agent": "microfeed-webhooks/1",
          "webhook-id": record.id,
          "webhook-signature": signatures.join(" "),
          "webhook-timestamp": String(timestamp),
          "x-microfeed-attempt": String(attempt),
          "x-microfeed-event": record.event_type,
        },
        method: "POST",
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    body = await responseDiagnostic(response);
  } catch (error) {
    requestError = error instanceof Error ? error.message : String(error);
  }
  const durationMs = Date.now() - startedAt;
  if (response?.ok) {
    await markSuccessful(
      runtimeEnv.FEED_DB,
      record,
      attempt,
      response,
      body,
      durationMs,
    );
    message.ack();
    return;
  }
  const retryable = !response || retryableStatus(response.status);
  if (retryable && attempt < 6) {
    const configuredDelay = WEBHOOK_RETRY_DELAYS_SECONDS[attempt - 1] ??
      WEBHOOK_RETRY_DELAYS_SECONDS.at(-1)!;
    const delaySeconds = configuredDelay;
    await markForRetry(runtimeEnv.FEED_DB, record, {
      attempt,
      delaySeconds,
      durationMs,
      ...(requestError ? {error: requestError} : {}),
      outcome: requestError ? "network_error" : "retryable_response",
      ...(body ? {responseBody: body} : {}),
      ...(response ? {responseStatus: response.status} : {}),
    });
    message.retry({delaySeconds});
    return;
  }
  await markTerminalFailure(runtimeEnv.FEED_DB, record, {
    attempt,
    durationMs,
    ...(requestError ? {error: requestError} : {}),
    outcome: retryable ? "retry_exhausted" : "terminal_response",
    ...(body ? {responseBody: body} : {}),
    ...(response ? {responseStatus: response.status} : {}),
  });
  message.ack();
}
