import {env} from "cloudflare:workers";
import type {APIContext} from "astro";
import {beforeEach, describe, expect, it} from "vitest";

import {createApiItem, validateApiItem} from "@/server/api/handlers";
import FeedCrudManager from "@/server/feed/FeedCrudManager";
import FeedDb from "@/server/feed/FeedDb";
import {claimItemCreateIdempotency} from "@/server/items/idempotency";

const ORIGIN = "https://feed.example.com";

async function createRequest(
  input: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<Response> {
  const request = new Request(`${ORIGIN}/api/v1/items/`, {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json",
      ...(idempotencyKey ? {"Idempotency-Key": idempotencyKey} : {}),
    },
    method: "POST",
  });
  const database = new FeedDb(env, request);
  const content = await database.getContent();
  const crud = new FeedCrudManager(content, database, request);
  return await createApiItem({
    locals: {feedCrud: crud, feedDb: database},
    request,
  } as APIContext);
}

async function responseId(response: Response): Promise<string> {
  return (await response.json() as {id: string}).id;
}

beforeEach(async () => {
  await env.FEED_DB.batch([
    env.FEED_DB.prepare(
      "DELETE FROM items WHERE id IN " +
        "(SELECT item_id FROM item_create_idempotency)",
    ),
    env.FEED_DB.prepare("DELETE FROM item_create_idempotency"),
  ]);
});

describe("idempotent API item creation", () => {
  it("replays the same canonical payload without creating a duplicate", async () => {
    const key = "12af9687-0f4e-479f-9a97-d67d52f5f02b";
    const first = await createRequest({
      custom: {a: 1, b: 2},
      status: "unpublished",
      title: "Safe create",
    }, key);
    const firstId = await responseId(first);
    const replay = await createRequest({
      title: "Safe create",
      status: "unpublished",
      custom: {b: 2, a: 1},
    }, key);

    expect(replay.status).toBe(201);
    expect(replay.headers.get("idempotency-replayed")).toBe("true");
    expect(await responseId(replay)).toBe(firstId);
    expect(await env.FEED_DB.prepare(
      "SELECT count(*) AS count FROM items WHERE id = ?",
    ).bind(firstId).first()).toEqual({count: 1});
    const stored = await env.FEED_DB.prepare(
      "SELECT key_hash, request_hash FROM item_create_idempotency",
    ).first<{key_hash: string; request_hash: string}>();
    expect(stored?.key_hash).not.toContain(key);
    expect(stored?.request_hash).not.toContain("Safe create");
  });

  it("rejects a reused key with a different payload", async () => {
    const key = "payload-conflict";
    await createRequest({title: "First"}, key);
    const conflict = await createRequest({title: "Second"}, key);

    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      error: "This Idempotency-Key was already used with a different item payload.",
    });
  });

  it("rejects malformed keys before reserving an item", async () => {
    const response = await createRequest({title: "Not created"}, "x".repeat(129));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({error: "Invalid Idempotency-Key."});
    expect(await env.FEED_DB.prepare(
      "SELECT count(*) AS count FROM item_create_idempotency",
    ).first()).toEqual({count: 0});
  });

  it("converges concurrent and interrupted requests on one item ID", async () => {
    const concurrent = await Promise.all([
      createRequest({title: "Concurrent"}, "concurrent-key"),
      createRequest({title: "Concurrent"}, "concurrent-key"),
    ]);
    const ids = await Promise.all(concurrent.map(responseId));
    expect(new Set(ids).size).toBe(1);
    expect(await env.FEED_DB.prepare(
      "SELECT count(*) AS count FROM items WHERE id = ?",
    ).bind(ids[0]).first()).toEqual({count: 1});

    const pending = await claimItemCreateIdempotency(
      env.FEED_DB,
      "pending-key",
      {title: "Recovered"},
    );
    const recovered = await createRequest({title: "Recovered"}, "pending-key");
    expect(await responseId(recovered)).toBe(pending.itemId);
    expect(recovered.headers.get("idempotency-replayed")).toBe("true");
  });

  it("expires claims after 24 hours but does not recreate a deleted completed item", async () => {
    const completed = await createRequest({title: "Delete later"}, "delete-key");
    const completedId = await responseId(completed);
    await env.FEED_DB.prepare("DELETE FROM items WHERE id = ?")
      .bind(completedId).run();
    const deletedReplay = await createRequest({title: "Delete later"}, "delete-key");
    expect(await responseId(deletedReplay)).toBe(completedId);
    expect(await env.FEED_DB.prepare(
      "SELECT count(*) AS count FROM items WHERE id = ?",
    ).bind(completedId).first()).toEqual({count: 0});

    const expiring = await createRequest({title: "Expires"}, "expiry-key");
    const oldId = await responseId(expiring);
    await env.FEED_DB.prepare(
      "UPDATE item_create_idempotency SET created_at_ms = 0 " +
        "WHERE item_id = ?",
    ).bind(oldId).run();
    const afterExpiry = await createRequest({title: "Expires"}, "expiry-key");
    expect(await responseId(afterExpiry)).not.toBe(oldId);
    expect(afterExpiry.headers.get("idempotency-replayed")).toBeNull();
  });
});

describe("item validation API", () => {
  it("uses the create schema without item, media, or runtime side effects", async () => {
    const before = await env.FEED_DB.prepare(
      "SELECT count(*) AS count FROM items",
    ).first<{count: number}>();
    const mediaBefore = (await env.MEDIA_BUCKET.list()).objects
      .map(({key}) => key).sort();
    const untouchedLocals = new Proxy({}, {
      get() {
        throw new Error("Validation accessed mutating runtime state.");
      },
    });
    const valid = await validateApiItem({
      locals: untouchedLocals,
      request: new Request(`${ORIGIN}/api/v1/items/validate/`, {
        body: JSON.stringify({status: "unpublished", title: "Valid"}),
        headers: {"content-type": "application/json"},
        method: "POST",
      }),
    } as APIContext);
    const invalid = await validateApiItem({
      request: new Request(`${ORIGIN}/api/v1/items/validate/`, {
        body: JSON.stringify({image: "not a URL"}),
        headers: {"content-type": "application/json"},
        method: "POST",
      }),
    } as APIContext);

    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual({valid: true});
    expect(invalid.status).toBe(400);
    expect(await env.FEED_DB.prepare(
      "SELECT count(*) AS count FROM items",
    ).first()).toEqual(before);
    expect((await env.MEDIA_BUCKET.list()).objects.map(({key}) => key).sort())
      .toEqual(mediaBefore);
  });
});
