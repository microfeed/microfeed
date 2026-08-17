import {createHmac} from "node:crypto";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

import {
  decryptWebhookSecret,
  encryptWebhookSecret,
  generateWebhookSecret,
  standardWebhookSignature,
} from "@/server/webhooks/crypto";
import {
  changedWebhookFields,
  contentMutationWebhookInputs,
} from "@/server/webhooks/emission";
import {
  prepareWebhookEvent,
  truncateWebhookPayload,
} from "@/server/webhooks/events";
import {
  validateWebhookEndpointUrl,
  validateWebhookEvents,
  WebhookRequestError,
} from "@/server/webhooks/validation";
import {WEBHOOK_EVENT_TYPES, WEBHOOK_LIMITS} from "@/shared/Webhooks";
import {
  WEBHOOK_EVENT_EXAMPLES,
  webhookGeneratedEventInput,
} from "@/shared/WebhookExamples";
import {
  apiWebhookContextHeadersSchema,
  apiWebhookEventSchema,
} from "@/shared/ApiSchemas";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("webhook contract", () => {
  it("contains the complete stable event inventory", () => {
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(22);
    expect(WEBHOOK_EVENT_TYPES).toEqual(expect.arrayContaining([
      "channel.updated",
      "item.created",
      "item.published",
      "page.navigation_updated",
      "site_file.reset",
      "theme.activated",
      "webhook.test",
    ]));
  });

  it("emits creation, material edits, visibility transitions, and snapshots", () => {
    expect(contentMutationWebhookInputs({
      after: {id: "one", status: "published", title: "Hello"},
      id: "one",
      kind: "item",
      mutation: "created",
    }).map(({type}) => type)).toEqual(["item.created", "item.published"]);

    expect(contentMutationWebhookInputs({
      after: {id: "draft", status: "unpublished", title: "Draft"},
      id: "draft",
      kind: "page",
      mutation: "created",
    }).map(({type}) => type)).toEqual(["page.created", "page.unpublished"]);

    expect(contentMutationWebhookInputs({
      after: {id: "one", status: "unlisted", title: "Hello"},
      before: {id: "one", status: "published", title: "Hello"},
      id: "one",
      kind: "item",
      mutation: "updated",
    }).map(({type}) => type)).toEqual(["item.updated", "item.unlisted"]);

    expect(contentMutationWebhookInputs({
      after: {id: "one", status: "published", updated_at: "later"},
      before: {id: "one", status: "published", updated_at: "before"},
      id: "one",
      kind: "item",
      mutation: "updated",
    })).toEqual([]);

    const deleted = contentMutationWebhookInputs({
      before: {id: "one", status: "published", title: "Last snapshot"},
      id: "one",
      kind: "page",
      mutation: "deleted",
    });
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatchObject({
      object: {id: "one", status: "published", title: "Last snapshot"},
      type: "page.deleted",
    });
  });

  it("reports only material changed fields", () => {
    expect(changedWebhookFields(
      {title: "Before", updatedAt: "old"},
      {title: "After", updatedAt: "new"},
    )).toEqual(["title"]);
  });

  it("truncates large content and records each removed field", () => {
    const object = {content_html: "x".repeat(WEBHOOK_LIMITS.payloadBytes), id: "one"};
    const envelope = {
      context: {},
      data: {changed_fields: ["content_html"], object: {...object}, previous_status: null, truncated_fields: []},
      id: "evt_one",
    };
    const payload = truncateWebhookPayload(envelope, object);
    expect(Buffer.byteLength(payload)).toBeLessThanOrEqual(WEBHOOK_LIMITS.payloadBytes);
    expect(JSON.parse(payload).data).toMatchObject({
      object: {id: "one"},
      truncated_fields: ["data.object.content_html"],
    });

    const prepared = JSON.parse(prepareWebhookEvent(
      {MICROFEED_INSTANCE_ID: "site"} as Env,
      new Request("https://feed.example.com/admin/"),
      {
        changedFields: ["content_html"],
        object: {
          content_html: "x".repeat(WEBHOOK_LIMITS.payloadBytes),
          content_text: "Large item",
          id: "one",
          status: "published",
        },
        previousStatus: "published",
        subjectId: "one",
        type: "item.updated",
      },
      {origin: "dashboard"},
    ).payload);
    expect(prepared.data.object).toEqual({id: "one"});
    expect(apiWebhookEventSchema.safeParse(prepared).success).toBe(true);
  });

  it("discriminates subjects and validates automation context headers", () => {
    const event = {
      api_version: "1",
      context: {
        causation_id: null,
        correlation_id: "evt_parent",
        origin: "api",
        request_id: "request",
      },
      data: {
        changed_fields: ["title"],
        object: {
          content_text: "Hello",
          id: "one",
          status: "unpublished",
          title: "Hello",
        },
        previous_status: null,
        truncated_fields: [],
      },
      id: "evt_one",
      site: {id: "site", url: "https://feed.example.com"},
      subject: {api_path: "/api/v1/items/one/", id: "one", type: "item"},
      timestamp: "2026-08-14T12:00:00.000Z",
      test: false,
      type: "item.created",
    };
    expect(apiWebhookEventSchema.safeParse(event).success).toBe(true);
    expect(apiWebhookEventSchema.safeParse({
      ...event,
      subject: {...event.subject, type: "page"},
    }).success).toBe(false);
    for (const type of WEBHOOK_EVENT_TYPES) {
      expect(
        apiWebhookEventSchema.safeParse(WEBHOOK_EVENT_EXAMPLES[type]).success,
        type,
      ).toBe(true);
      const runtimePayload = JSON.parse(prepareWebhookEvent(
        {MICROFEED_INSTANCE_ID: "site"} as Env,
        new Request("https://feed.example.com/admin/"),
        webhookGeneratedEventInput(type),
        {origin: "system"},
      ).payload);
      expect(runtimePayload.test, type).toBe(false);
      expect(apiWebhookEventSchema.safeParse(runtimePayload).success, type)
        .toBe(true);
    }
    expect(apiWebhookContextHeadersSchema.safeParse({
      "Microfeed-Causation-Id": "evt_one",
      "Microfeed-Correlation-Id": "workflow-123",
    }).success).toBe(true);
    expect(apiWebhookContextHeadersSchema.safeParse({
      "Microfeed-Correlation-Id": "x".repeat(129),
    }).success).toBe(false);
    expect(apiWebhookContextHeadersSchema.safeParse({
      "Microfeed-Correlation-Id": "bad\nvalue",
    }).success).toBe(false);
  });
});

describe("webhook endpoint validation and secrets", () => {
  it("allows only the documented local endpoint exception", () => {
    expect(validateWebhookEndpointUrl("http://127.0.0.1:8978/webhook", {
      local: true,
      siteOrigin: "http://127.0.0.1:4321",
    })).toBe("http://127.0.0.1:8978/webhook");
    for (const value of [
      "http://localhost:8978/webhook",
      "http://127.0.0.1/webhook",
      "https://127.0.0.1:8978/webhook",
      "http://127.0.0.1:8978/another-path",
      "http://127.0.0.1:8978/webhook?secret=value",
    ]) {
      expect(() => validateWebhookEndpointUrl(value, {
        local: true,
        siteOrigin: "http://127.0.0.1:4321",
      })).toThrow(WebhookRequestError);
    }
  });

  it("rejects credentials, fragments, self, loopback, and private targets", () => {
    for (const value of [
      "https://user:pass@example.com/webhook",
      "https://example.com/webhook#secret",
      "https://feed.example.com/webhook",
      "https://127.0.0.1/webhook",
      "https://10.0.0.1/webhook",
      "https://[::1]/webhook",
      "https://[::ffff:127.0.0.1]/webhook",
      "https://[fd00::1]/webhook",
    ]) {
      expect(() => validateWebhookEndpointUrl(value, {
        local: false,
        siteOrigin: "https://feed.example.com",
      }), value).toThrow(WebhookRequestError);
    }
  });

  it("rejects webhook.test as a subscription", () => {
    expect(() => validateWebhookEvents(["webhook.test"]))
      .toThrow(WebhookRequestError);
    expect(validateWebhookEvents(["item.created", "item.created"]))
      .toEqual(["item.created"]);
  });

  it("encrypts secrets and produces a Standard Webhooks signature", async () => {
    const secret = generateWebhookSecret();
    const encrypted = await encryptWebhookSecret(secret, "storage-key");
    expect(encrypted).not.toContain(secret);
    expect(await decryptWebhookSecret(encrypted, "storage-key")).toBe(secret);

    const signature = await standardWebhookSignature(
      secret,
      "whd_one",
      1_700_000_000,
      '{"ok":true}',
    );
    const expected = createHmac(
      "sha256",
      Buffer.from(secret.slice("whsec_".length), "base64"),
    ).update('whd_one.1700000000.{"ok":true}').digest("base64");
    expect(signature).toBe(`v1,${expected}`);
  });
});

describe("webhook limits migration", () => {
  async function database(): Promise<DatabaseSync> {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(await readFile(path.join(repositoryRoot, "migrations/0017_webhooks.sql"), "utf8"));
    db.exec(await readFile(path.join(repositoryRoot, "migrations/0019_webhook_delivery_budget.sql"), "utf8"));
    return db;
  }

  it("preserves existing daily usage while replacing the fixed limit", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(await readFile(path.join(repositoryRoot, "migrations/0017_webhooks.sql"), "utf8"));
    db.prepare(
      "INSERT INTO webhook_daily_usage (usage_day, deliveries) VALUES ('2026-08-13', 875)",
    ).run();

    db.exec(await readFile(
      path.join(repositoryRoot, "migrations/0019_webhook_delivery_budget.sql"),
      "utf8",
    ));

    expect(db.prepare(
      "SELECT usage_day, deliveries FROM webhook_daily_usage",
    ).get()).toEqual({deliveries: 875, usage_day: "2026-08-13"});
    expect(db.prepare(
      "SELECT daily_delivery_limit FROM webhook_settings WHERE id = 1",
    ).get()).toEqual({daily_delivery_limit: 1_000});
  });

  it("preserves deliveries and attempts while adding infrastructure cancellation", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(await readFile(
      path.join(repositoryRoot, "migrations/0017_webhooks.sql"),
      "utf8",
    ));
    db.exec(`
      INSERT INTO webhook_endpoints
        (id, name, url, secret_ciphertext)
      VALUES ('endpoint', 'Endpoint', 'https://example.com/webhook', 'cipher');
      INSERT INTO webhook_events
        (id, event_type, subject_type, subject_id, payload_json, origin,
          request_id, correlation_id, budget_day)
      VALUES ('event', 'webhook.test', 'webhook', 'test', '{}', 'system',
        'request', 'correlation', '2026-08-17');
      INSERT INTO webhook_deliveries
        (id, event_id, endpoint_id, endpoint_url)
      VALUES ('delivery', 'event', 'endpoint', 'https://example.com/webhook');
      INSERT INTO webhook_delivery_attempts
        (delivery_id, attempt_number, outcome, duration_ms)
      VALUES ('delivery', 1, 'retry', 10);
    `);

    db.exec(await readFile(
      path.join(
        repositoryRoot,
        "migrations/0020_webhook_infrastructure_disable.sql",
      ),
      "utf8",
    ));
    db.prepare(`
      UPDATE webhook_deliveries
      SET status = 'canceled_webhooks_disabled'
      WHERE id = 'delivery'
    `).run();

    expect(db.prepare(
      "SELECT status FROM webhook_deliveries WHERE id = 'delivery'",
    ).get()).toEqual({status: "canceled_webhooks_disabled"});
    expect(db.prepare(
      "SELECT delivery_id, attempt_number FROM webhook_delivery_attempts",
    ).all()).toEqual([{attempt_number: 1, delivery_id: "delivery"}]);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("atomically enforces endpoint slots and deletion semantics", async () => {
    const db = await database();
    const insert = db.prepare("INSERT INTO webhook_endpoints (id, name, url, secret_ciphertext, status) VALUES (?, ?, ?, 'cipher', ?)");
    for (let index = 0; index < 20; index += 1) {
      insert.run(`endpoint-${index}`, `Endpoint ${index}`, `https://example.com/${index}`, index === 0 ? "disabled" : "active");
    }
    expect(() => insert.run("endpoint-20", "Too many", "https://example.com/20", "active"))
      .toThrow(/webhook_endpoint_limit/u);
    db.prepare("UPDATE webhook_endpoints SET deleted_at = CURRENT_TIMESTAMP WHERE id = 'endpoint-1'").run();
    expect(() => insert.run("endpoint-20", "Replacement", "https://example.com/20", "active"))
      .not.toThrow();
  });

  it("reserves complete fanout against one UTC daily budget", async () => {
    const db = await database();
    db.prepare("INSERT INTO webhook_daily_usage (usage_day, deliveries) VALUES ('2026-08-14', 990)").run();
    const insert = db.prepare("INSERT INTO webhook_events (id, event_type, subject_type, subject_id, payload_json, origin, request_id, correlation_id, delivery_count, budget_day) VALUES (?, 'item.created', 'item', 'one', '{}', 'api', 'request', 'correlation', ?, ?)");
    expect(() => insert.run("evt_too_many", 20, "2026-08-14"))
      .toThrow(/webhook_daily_budget/u);
    expect(db.prepare("SELECT deliveries FROM webhook_daily_usage WHERE usage_day = '2026-08-14'").get())
      .toEqual({deliveries: 990});
    expect(db.prepare("SELECT COUNT(*) AS count FROM webhook_events").get())
      .toEqual({count: 0});
    insert.run("evt_fits", 10, "2026-08-14");
    insert.run("evt_next_day", 20, "2026-08-15");
    expect(db.prepare("SELECT usage_day, deliveries FROM webhook_daily_usage ORDER BY usage_day").all())
      .toEqual([
        {deliveries: 1_000, usage_day: "2026-08-14"},
        {deliveries: 20, usage_day: "2026-08-15"},
      ]);
  });

  it("enforces a configurable fail-closed budget from zero to one million", async () => {
    const db = await database();
    const insert = db.prepare("INSERT INTO webhook_events (id, event_type, subject_type, subject_id, payload_json, origin, request_id, correlation_id, delivery_count, budget_day) VALUES (?, 'item.created', 'item', 'one', '{}', 'api', 'request', 'correlation', ?, '2026-08-14')");

    db.prepare("UPDATE webhook_settings SET daily_delivery_limit = 0 WHERE id = 1").run();
    expect(() => insert.run("evt_zero", 1)).toThrow(/webhook_daily_budget/u);

    db.prepare("UPDATE webhook_settings SET daily_delivery_limit = 1000000 WHERE id = 1").run();
    insert.run("evt_million", 1_000_000);
    expect(db.prepare("SELECT deliveries FROM webhook_daily_usage WHERE usage_day = '2026-08-14'").get())
      .toEqual({deliveries: 1_000_000});
    expect(() => insert.run("evt_over", 1)).toThrow(/webhook_daily_budget/u);
    expect(() => db.prepare("UPDATE webhook_settings SET daily_delivery_limit = 1000001 WHERE id = 1").run())
      .toThrow();

    db.prepare("DELETE FROM webhook_settings WHERE id = 1").run();
    db.prepare("DELETE FROM webhook_daily_usage").run();
    insert.run("evt_fallback", 1_000);
    expect(() => insert.run("evt_fallback_over", 1)).toThrow(/webhook_daily_budget/u);
  });
});
