import {env} from "cloudflare:workers";
import type {APIContext} from "astro";
import {beforeEach, describe, expect, it, vi} from "vitest";

import {encryptWebhookSecret, generateWebhookSecret} from "@/server/webhooks/crypto";
import {processWebhookMessage, type WebhookQueueMessage} from "@/server/webhooks/delivery";
import {
  commitMutationWithWebhookEvents,
  createWebhookTestDelivery,
  emitWebhookEvent,
  enqueueUnqueuedWebhookDeliveries,
  pruneWebhookHistory,
  redeliverWebhookDelivery,
} from "@/server/webhooks/events";
import {
  createWebhookEndpoint,
  resumeWebhookEndpoint,
  rotateWebhookEndpointSecret,
} from "@/server/webhooks/store";
import {WEBHOOK_RETRY_DELAYS_SECONDS} from "@/shared/Webhooks";
import FeedDb from "@/server/feed/FeedDb";
import FeedCrudManager from "@/server/feed/FeedCrudManager";
import {
  createApiItem,
  updateApiItem,
} from "@/server/api/handlers";

const ENCRYPTION_KEY = "worker-test-webhook-encryption-key-32-bytes";

function runtime(queueIds: string[] = []): Env {
  return {
    FEED_DB: env.FEED_DB,
    MICROFEED_CLOUDFLARE_ACCOUNT_ID: "account",
    MICROFEED_INSTANCE_ID: "test-instance",
    WEBHOOK_QUEUE: {
      send: async (body: WebhookQueueMessage) => queueIds.push(body.deliveryId),
      sendBatch: async (messages: Array<{body: WebhookQueueMessage}>) => {
        queueIds.push(...messages.map(({body}) => body.deliveryId));
      },
    },
    WEBHOOK_SECRET_KEY: ENCRYPTION_KEY,
  } as unknown as Env;
}

function message(deliveryId: string) {
  return {
    ack: vi.fn(),
    body: {deliveryId},
    retry: vi.fn(),
  } as unknown as Message<WebhookQueueMessage>;
}

async function insertEndpoint(
  id: string,
  options: {failures?: number; previous?: boolean; status?: string} = {},
): Promise<{previousSecret?: string; secret: string}> {
  const secret = generateWebhookSecret();
  const previousSecret = options.previous ? generateWebhookSecret() : undefined;
  await env.FEED_DB.prepare(`
    INSERT INTO webhook_endpoints (
      id, name, url, status, secret_ciphertext,
      previous_secret_ciphertext, previous_secret_expires_at,
      consecutive_terminal_failures
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    id,
    `https://example.com/${id}`,
    options.status ?? "active",
    await encryptWebhookSecret(secret, ENCRYPTION_KEY),
    previousSecret
      ? await encryptWebhookSecret(previousSecret, ENCRYPTION_KEY)
      : null,
    previousSecret ? new Date(Date.now() + 60_000).toISOString() : null,
    options.failures ?? 0,
  ).run();
  return {...(previousSecret ? {previousSecret} : {}), secret};
}

async function insertDelivery(
  endpointId: string,
  suffix: string,
  options: {isTest?: boolean; status?: string} = {},
): Promise<string> {
  const eventId = `evt_${suffix}`;
  const deliveryId = `whd_${suffix}`;
  await env.FEED_DB.batch([
    env.FEED_DB.prepare(`
      INSERT INTO webhook_events (
        id, event_type, subject_type, subject_id, payload_json, origin,
        request_id, correlation_id, delivery_count, budget_day
      ) VALUES (?, 'item.published', 'item', 'item', ?, 'system', 'request', ?, 0, date('now'))
    `).bind(eventId, JSON.stringify({id: eventId, type: "item.published"}), eventId),
    env.FEED_DB.prepare(`
      INSERT INTO webhook_deliveries (
        id, event_id, endpoint_id, endpoint_url, status, is_test
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      deliveryId,
      eventId,
      endpointId,
      `https://example.com/${endpointId}`,
      options.status ?? "pending",
      options.isTest ? 1 : 0,
    ),
  ]);
  return deliveryId;
}

beforeEach(async () => {
  vi.unstubAllGlobals();
  await env.FEED_DB.batch([
    env.FEED_DB.prepare("DELETE FROM webhook_delivery_attempts"),
    env.FEED_DB.prepare("DELETE FROM webhook_deliveries"),
    env.FEED_DB.prepare("DELETE FROM webhook_events"),
    env.FEED_DB.prepare("DELETE FROM webhook_budget_reservations"),
    env.FEED_DB.prepare("DELETE FROM webhook_daily_usage"),
    env.FEED_DB.prepare("DELETE FROM webhook_subscriptions"),
    env.FEED_DB.prepare("DELETE FROM webhook_alerts"),
    env.FEED_DB.prepare("DELETE FROM webhook_endpoints"),
    env.FEED_DB.prepare(
      "DELETE FROM settings WHERE category LIKE 'webhook-atomic-%'",
    ),
  ]);
});

describe("webhook fanout and accounting", () => {
  it("records API content, context headers, and its outbox in the mutation path", async () => {
    await insertEndpoint("api-route");
    await env.FEED_DB.batch([
      env.FEED_DB.prepare(
        "INSERT INTO webhook_subscriptions (endpoint_id, event_type) VALUES ('api-route', 'item.created')",
      ),
      env.FEED_DB.prepare(
        "INSERT INTO webhook_subscriptions (endpoint_id, event_type) VALUES ('api-route', 'item.updated')",
      ),
    ]);
    const createRequest = new Request("https://feed.example.com/api/v1/items/", {
      body: JSON.stringify({
        content_html: "<p>Atomic route body</p>",
        status: "unpublished",
        title: "Atomic route",
      }),
      headers: {
        "content-type": "application/json",
        "Microfeed-Causation-Id": "evt_parent",
        "Microfeed-Correlation-Id": "workflow_one",
      },
      method: "POST",
    });
    const database = new FeedDb(env, createRequest);
    const content = await database.getContent();
    const createResponse = await createApiItem({
      locals: {
        feedCrud: new FeedCrudManager(content, database, createRequest),
        feedDb: database,
      },
      request: createRequest,
    } as unknown as APIContext);
    expect(createResponse.status).toBe(201);
    const {id} = await createResponse.json() as {id: string};
    const event = await env.FEED_DB.prepare(
      "SELECT payload_json FROM webhook_events WHERE subject_id = ? AND event_type = 'item.created'",
    ).bind(id).first<{payload_json: string}>();
    const payload = JSON.parse(event!.payload_json) as {
      context: {causation_id: string; correlation_id: string};
    };
    expect(payload.context).toMatchObject({
      causation_id: "evt_parent",
      correlation_id: "workflow_one",
    });

    const updateRequest = new Request(
      `https://feed.example.com/api/v1/items/${id}/`,
      {
        body: JSON.stringify({title: "Atomic route"}),
        headers: {"content-type": "application/json"},
        method: "PUT",
      },
    );
    const updateDatabase = new FeedDb(env, updateRequest);
    const updateContent = await updateDatabase.getContent();
    const updateResponse = await updateApiItem({
      locals: {
        feedCrud: new FeedCrudManager(
          updateContent,
          updateDatabase,
          updateRequest,
        ),
        feedDb: updateDatabase,
      },
      params: {itemId: id},
      request: updateRequest,
    } as unknown as APIContext);
    expect(updateResponse.status).toBe(200);
    expect(await env.FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM webhook_events WHERE subject_id = ? AND event_type = 'item.updated'",
    ).bind(id).first()).toEqual({count: 0});
  });

  it("commits content and its outbox atomically, including budget suppression", async () => {
    await insertEndpoint("atomic");
    await env.FEED_DB.prepare(
      "INSERT INTO webhook_subscriptions (endpoint_id, event_type) VALUES ('atomic', 'channel.updated')",
    ).run();
    const queueIds: string[] = [];
    await commitMutationWithWebhookEvents(
      runtime(queueIds),
      new Request("https://feed.example.com/api/v1/channels/primary/"),
      [env.FEED_DB.prepare(
        "INSERT INTO settings (category, data) VALUES ('webhook-atomic-success', '{}')",
      )],
      [{
        object: {title: "Atomic"},
        subjectId: "primary",
        subjectType: "channel",
        type: "channel.updated",
      }],
      {origin: "api"},
    );
    expect(queueIds).toHaveLength(1);
    expect(await env.FEED_DB.prepare(
      "SELECT data FROM settings WHERE category = 'webhook-atomic-success'",
    ).first()).toEqual({data: "{}"});
    expect(await env.FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM webhook_deliveries WHERE status = 'pending'",
    ).first()).toEqual({count: 1});

    await expect(commitMutationWithWebhookEvents(
      runtime(),
      new Request("https://feed.example.com/api/v1/channels/primary/"),
      [
        env.FEED_DB.prepare(
          "INSERT INTO settings (category, data) VALUES ('webhook-atomic-rollback', '{}')",
        ),
        env.FEED_DB.prepare(
          "INSERT INTO settings (category, data) VALUES ('webhook-atomic-rollback', '{}')",
        ),
      ],
      [{
        object: {title: "Rollback"},
        subjectId: "primary",
        subjectType: "channel",
        type: "channel.updated",
      }],
      {origin: "api"},
    )).rejects.toThrow();
    expect(await env.FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM settings WHERE category = 'webhook-atomic-rollback'",
    ).first()).toEqual({count: 0});

    await env.FEED_DB.prepare(
      "INSERT INTO webhook_daily_usage (usage_day, deliveries) VALUES (date('now'), 1000) " +
      "ON CONFLICT (usage_day) DO UPDATE SET deliveries = 1000",
    ).run();
    await commitMutationWithWebhookEvents(
      runtime(queueIds),
      new Request("https://feed.example.com/api/v1/channels/primary/"),
      [env.FEED_DB.prepare(
        "INSERT INTO settings (category, data) VALUES ('webhook-atomic-budget', '{}')",
      )],
      [{
        object: {title: "Budget"},
        subjectId: "primary",
        subjectType: "channel",
        type: "channel.updated",
      }],
      {origin: "api"},
    );
    expect(await env.FEED_DB.prepare(
      "SELECT data FROM settings WHERE category = 'webhook-atomic-budget'",
    ).first()).toEqual({data: "{}"});
    expect(await env.FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM webhook_deliveries WHERE status = 'suppressed_budget'",
    ).first()).toEqual({count: 1});
  });

  it("reserves an entire fanout, queues only delivery IDs, and never sends a partial fanout", async () => {
    const queueIds: string[] = [];
    for (let index = 0; index < 10; index += 1) {
      const id = `endpoint-${index}`;
      await insertEndpoint(id);
      await env.FEED_DB.prepare(
        "INSERT INTO webhook_subscriptions (endpoint_id, event_type) VALUES (?, 'item.created')",
      ).bind(id).run();
    }
    await env.FEED_DB.prepare(
      "INSERT INTO webhook_daily_usage (usage_day, deliveries) VALUES (date('now'), 990)",
    ).run();
    const emitted = await emitWebhookEvent(
      runtime(queueIds),
      new Request("https://feed.example.com/api/v1/items/"),
      {object: {id: "item"}, subjectId: "item", type: "item.created"},
      {origin: "api"},
    );
    expect(emitted.deliveryIds).toHaveLength(10);
    expect(queueIds).toEqual(emitted.deliveryIds);
    expect(await env.FEED_DB.prepare(
      "SELECT deliveries FROM webhook_daily_usage WHERE usage_day = date('now')",
    ).first()).toEqual({deliveries: 1_000});

    const suppressed = await emitWebhookEvent(
      runtime(queueIds),
      new Request("https://feed.example.com/api/v1/items/"),
      {object: {id: "second"}, subjectId: "second", type: "item.created"},
      {origin: "api"},
    );
    expect(suppressed).toMatchObject({deliveryIds: [], suppressed: "daily_budget"});
    expect(await env.FEED_DB.prepare(`
      SELECT COUNT(*) AS count FROM webhook_deliveries
      WHERE event_id = ? AND status = 'suppressed_budget'
    `).bind(suppressed.eventId).first()).toEqual({count: 10});
    expect(queueIds).toHaveLength(10);
  });

  it("fails corrupted over-limit fanout closed and records an Admin alert", async () => {
    await env.FEED_DB.prepare("DROP TRIGGER webhook_endpoint_limit_insert").run();
    try {
      for (let index = 0; index < 21; index += 1) {
        const id = `damaged-${index}`;
        await insertEndpoint(id);
        await env.FEED_DB.prepare(
          "INSERT INTO webhook_subscriptions (endpoint_id, event_type) VALUES (?, 'channel.updated')",
        ).bind(id).run();
      }
      const queueIds: string[] = [];
      const emitted = await emitWebhookEvent(
        runtime(queueIds),
        new Request("https://feed.example.com/admin/"),
        {object: {id: "primary"}, subjectId: "primary", type: "channel.updated"},
        {origin: "dashboard"},
      );
      expect(emitted).toMatchObject({deliveryIds: [], suppressed: "fanout_limit"});
      expect(queueIds).toEqual([]);
      expect(await env.FEED_DB.prepare(
        "SELECT kind FROM webhook_alerts ORDER BY id DESC LIMIT 1",
      ).first()).toEqual({kind: "fanout_limit"});
    } finally {
      await env.FEED_DB.prepare(`
        CREATE TRIGGER webhook_endpoint_limit_insert
        BEFORE INSERT ON webhook_endpoints
        WHEN NEW.deleted_at IS NULL AND (
          SELECT COUNT(*) FROM webhook_endpoints WHERE deleted_at IS NULL
        ) >= 20
        BEGIN SELECT RAISE(ABORT, 'webhook_endpoint_limit'); END
      `).run();
    }
  });
});

describe("webhook endpoint lifecycle", () => {
  it("enforces the twentieth slot under concurrent dashboard creation", async () => {
    for (let index = 0; index < 19; index += 1) {
      await insertEndpoint(`existing-${index}`, {
        status: index === 0 ? "disabled" : "active",
      });
    }
    const created = await Promise.allSettled([
      createWebhookEndpoint(runtime(), {
        events: ["item.created"],
        name: "Concurrent one",
        url: "https://one.example.com/webhook",
      }, "https://feed.example.com"),
      createWebhookEndpoint(runtime(), {
        events: ["item.created"],
        name: "Concurrent two",
        url: "https://two.example.com/webhook",
      }, "https://feed.example.com"),
    ]);
    expect(created.filter(({status}) => status === "fulfilled")).toHaveLength(1);
    expect(created.filter(({status}) => status === "rejected")).toHaveLength(1);
    expect(await env.FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM webhook_endpoints WHERE deleted_at IS NULL",
    ).first()).toEqual({count: 20});
    const successful = created.find(({status}) => status === "fulfilled");
    if (successful?.status !== "fulfilled") throw new Error("Endpoint creation did not succeed.");
    expect(successful.value.secret).toMatch(/^whsec_/u);
    const stored = await env.FEED_DB.prepare(
      "SELECT secret_ciphertext FROM webhook_endpoints WHERE id = ?",
    ).bind(successful.value.endpoint.id).first<{secret_ciphertext: string}>();
    expect(stored?.secret_ciphertext).not.toContain(successful.value.secret);
  });

  it("requires a successful paused test before explicit resume", async () => {
    await insertEndpoint("paused", {failures: 10, status: "auto_paused"});
    await expect(resumeWebhookEndpoint(env.FEED_DB, "paused"))
      .rejects.toThrow(/successful test/u);
    const queueIds: string[] = [];
    const test = await createWebhookTestDelivery(
      runtime(queueIds),
      new Request("https://feed.example.com/admin/webhooks/endpoints/"),
      "paused",
    );
    expect(queueIds).toEqual([test.deliveryId]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, {status: 204})));
    await processWebhookMessage(runtime(), message(test.deliveryId));
    expect(await env.FEED_DB.prepare(`
      SELECT status, resume_tested_at FROM webhook_endpoints WHERE id = 'paused'
    `).first()).toMatchObject({status: "auto_paused"});
    expect((await env.FEED_DB.prepare(`
      SELECT resume_tested_at FROM webhook_endpoints WHERE id = 'paused'
    `).first<{resume_tested_at: string | null}>())?.resume_tested_at).toBeTruthy();
    expect(await resumeWebhookEndpoint(env.FEED_DB, "paused"))
      .toMatchObject({consecutiveTerminalFailures: 0, status: "active"});
  });

  it("rotates with a 24-hour overlap and redelivers the same event under a new delivery ID", async () => {
    await insertEndpoint("rotation-redelivery");
    const sourceId = await insertDelivery("rotation-redelivery", "source", {
      status: "succeeded",
    });
    const rotated = await rotateWebhookEndpointSecret(runtime(), "rotation-redelivery");
    expect(rotated?.secret).toMatch(/^whsec_/u);
    const secretState = await env.FEED_DB.prepare(`
      SELECT previous_secret_ciphertext, previous_secret_expires_at
      FROM webhook_endpoints WHERE id = 'rotation-redelivery'
    `).first<Record<string, unknown>>();
    expect(secretState?.previous_secret_ciphertext).toBeTruthy();
    expect(Date.parse(String(secretState?.previous_secret_expires_at)))
      .toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1_000);

    const queueIds: string[] = [];
    const redelivery = await redeliverWebhookDelivery(
      runtime(queueIds),
      new Request("https://feed.example.com/admin/webhooks/deliveries/"),
      sourceId,
    );
    expect(redelivery.deliveryId).not.toBe(sourceId);
    expect(redelivery.eventId).toBe("evt_source");
    expect(queueIds).toEqual([redelivery.deliveryId]);
    expect(await env.FEED_DB.prepare(`
      SELECT event_id, is_manual FROM webhook_deliveries WHERE id = ?
    `).bind(redelivery.deliveryId).first()).toEqual({
      event_id: "evt_source",
      is_manual: 1,
    });
  });
});

describe("webhook delivery policy", () => {
  it("signs exact bytes with both rotation secrets and resets a failure streak on success", async () => {
    await insertEndpoint("rotating", {failures: 4, previous: true});
    const deliveryId = await insertDelivery("rotating", "rotation");
    const requests: Request[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return new Response(null, {status: 204});
    }));
    const queued = message(deliveryId);
    await processWebhookMessage(runtime(), queued);
    expect(queued.ack).toHaveBeenCalledOnce();
    const request = requests[0]!;
    expect(request.redirect).toBe("manual");
    expect(request.headers.get("webhook-signature")?.split(" ")).toHaveLength(2);
    expect(await request.text()).toBe(JSON.stringify({id: "evt_rotation", type: "item.published"}));
    expect(await env.FEED_DB.prepare(`
      SELECT status, attempt_count FROM webhook_deliveries WHERE id = ?
    `).bind(deliveryId).first()).toEqual({attempt_count: 1, status: "succeeded"});
    expect(await env.FEED_DB.prepare(`
      SELECT consecutive_terminal_failures FROM webhook_endpoints WHERE id = 'rotating'
    `).first()).toEqual({consecutive_terminal_failures: 0});
  });

  it("retries only the documented statuses with the six-attempt schedule", async () => {
    await insertEndpoint("retry");
    const deliveryId = await insertDelivery("retry", "retry");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("later", {status: 503})));
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const queued = message(deliveryId);
      await processWebhookMessage(runtime(), queued);
      if (attempt < 6) {
        expect(queued.retry).toHaveBeenCalledWith({
          delaySeconds: WEBHOOK_RETRY_DELAYS_SECONDS[attempt - 1],
        });
        await env.FEED_DB.prepare(
          "UPDATE webhook_deliveries SET next_attempt_at = datetime('now', '-1 second') WHERE id = ?",
        ).bind(deliveryId).run();
      } else {
        expect(queued.ack).toHaveBeenCalledOnce();
      }
    }
    expect(await env.FEED_DB.prepare(`
      SELECT status, attempt_count, response_body FROM webhook_deliveries WHERE id = ?
    `).bind(deliveryId).first()).toEqual({
      attempt_count: 6,
      response_body: "later",
      status: "failed",
    });
    expect(await env.FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM webhook_delivery_attempts WHERE delivery_id = ?",
    ).bind(deliveryId).first()).toEqual({count: 6});
  });

  it("auto-pauses exactly at 10 terminal failures and cancels pending work", async () => {
    await insertEndpoint("breaker", {failures: 9});
    const deliveryId = await insertDelivery("breaker", "breaker");
    const pendingId = await insertDelivery("breaker", "pending");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", {status: 400})));
    const queued = message(deliveryId);
    await processWebhookMessage(runtime(), queued);
    expect(queued.ack).toHaveBeenCalledOnce();
    expect(await env.FEED_DB.prepare(`
      SELECT status, consecutive_terminal_failures
      FROM webhook_endpoints WHERE id = 'breaker'
    `).first()).toEqual({
      consecutive_terminal_failures: 10,
      status: "auto_paused",
    });
    expect(await env.FEED_DB.prepare(
      "SELECT status FROM webhook_deliveries WHERE id = ?",
    ).bind(pendingId).first()).toEqual({status: "canceled_endpoint_paused"});
  });
});

describe("webhook reconciliation and retention", () => {
  it("requeues unleased saved work and prunes 30-day diagnostics", async () => {
    await insertEndpoint("reconcile");
    const deliveryId = await insertDelivery("reconcile", "reconcile");
    const queueIds: string[] = [];
    expect(await enqueueUnqueuedWebhookDeliveries(runtime(queueIds))).toBe(1);
    expect(queueIds).toEqual([deliveryId]);
    await env.FEED_DB.prepare(`
      UPDATE webhook_deliveries
      SET status = 'failed', created_at = datetime('now', '-31 days'), completed_at = datetime('now', '-31 days')
      WHERE id = ?
    `).bind(deliveryId).run();
    await pruneWebhookHistory(env.FEED_DB);
    expect(await env.FEED_DB.prepare(
      "SELECT COUNT(*) AS count FROM webhook_deliveries WHERE id = ?",
    ).bind(deliveryId).first()).toEqual({count: 0});
  });
});
