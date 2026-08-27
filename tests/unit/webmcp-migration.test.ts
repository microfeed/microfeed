import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";

import {describe, expect, it} from "vitest";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

async function migration(name: string): Promise<string> {
  return readFile(path.join(repositoryRoot, "migrations", name), "utf8");
}

describe("WebMCP webhook-origin migration", () => {
  it("preserves event history and dependent deliveries", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec(await migration("0017_webhooks.sql"));
    database.exec(await migration("0019_webhook_delivery_budget.sql"));
    database.exec(await migration("0020_webhook_infrastructure_disable.sql"));
    database.exec("PRAGMA foreign_keys = ON");
    database.exec(`
      INSERT INTO webhook_endpoints (
        id, name, url, secret_ciphertext
      ) VALUES ('endpoint', 'Endpoint', 'https://example.com/hook', 'secret');
      INSERT INTO webhook_events (
        id, event_type, subject_type, subject_id, payload_json, origin,
        request_id, correlation_id, delivery_count, budget_day
      ) VALUES (
        'event', 'item.updated', 'item', 'item', '{}', 'dashboard',
        'request', 'correlation', 0, '2026-08-26'
      );
      INSERT INTO webhook_deliveries (
        id, event_id, endpoint_id, endpoint_url
      ) VALUES (
        'delivery', 'event', 'endpoint', 'https://example.com/hook'
      );
      INSERT INTO webhook_delivery_attempts (
        delivery_id, attempt_number, outcome, duration_ms
      ) VALUES ('delivery', 1, 'retry', 10);
    `);

    database.exec(
      `BEGIN IMMEDIATE;\n${await migration("0022_webmcp_webhook_origin.sql")}\nCOMMIT;`,
    );
    expect(database.prepare(
      "SELECT id, origin FROM webhook_events",
    ).get()).toEqual({id: "event", origin: "dashboard"});
    expect(database.prepare(
      "SELECT id, event_id FROM webhook_deliveries",
    ).get()).toEqual({event_id: "event", id: "delivery"});
    expect(database.prepare(
      "SELECT delivery_id, attempt_number FROM webhook_delivery_attempts",
    ).get()).toEqual({attempt_number: 1, delivery_id: "delivery"});
    expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);

    expect(() => database.prepare(`
      INSERT INTO webhook_events (
        id, event_type, subject_type, subject_id, payload_json, origin,
        request_id, correlation_id, delivery_count, budget_day
      ) VALUES (?, 'item.created', 'item', 'draft', '{}', ?, 'request', ?, 0, ?)
    `).run("webmcp-event", "webmcp", "webmcp-event", "2026-08-26"))
      .not.toThrow();
    database.close();
  });
});
