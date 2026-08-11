import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {itemCommand} from "../../../packages/cli/src/commands";

function feed(items: unknown[], extra: Record<string, unknown> = {}) {
  return Response.json({
    _microfeed: {prev_url: "https://feed.example/api/v1/feed/?prev_cursor=before"},
    items,
    next_url: "https://feed.example/api/v1/feed/?next_cursor=after",
    title: "Large channel metadata",
    version: "https://jsonfeed.org/version/1.1",
    ...extra,
  });
}

beforeEach(() => {
  process.env.MICROFEED_API_KEY = "environment-secret";
  process.env.MICROFEED_URL = "https://feed.example";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.MICROFEED_API_KEY;
  delete process.env.MICROFEED_URL;
});

describe("agent-oriented item output", () => {
  it("summarizes list output, normalizes status, and preserves pagination", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => feed([{
      _microfeed: {status: "unpublished"},
      content_html: "<p>Long body</p>",
      date_modified: "2026-08-11T12:00:00.000Z",
      date_published: "2026-08-11T11:00:00.000Z",
      id: "item-1",
      title: "Draft",
      url: "https://feed.example/i/item-1/",
    }])));
    const stdout = vi.spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await itemCommand(["list", "--summary"], {json: true});

    const output = JSON.parse(String(stdout.mock.calls[0]?.[0]));
    expect(output.body).toEqual({
      items: [{
        date_modified: "2026-08-11T12:00:00.000Z",
        date_published: "2026-08-11T11:00:00.000Z",
        id: "item-1",
        status: "unpublished",
        title: "Draft",
        url: "https://feed.example/i/item-1/",
      }],
      next_url: "https://feed.example/api/v1/feed/?next_cursor=after",
      prev_url: "https://feed.example/api/v1/feed/?prev_cursor=before",
    });
    expect(JSON.stringify(output)).not.toContain("Long body");
    expect(output).toMatchObject({ok: true, status: 200});
  });

  it("projects requested summary fields and rejects fields without compact mode", async () => {
    const fetchMock = vi.fn(async () => feed([{
      _microfeed: {status: "published"},
      id: "item-1",
      title: "Only these",
    }]));
    vi.stubGlobal("fetch", fetchMock);
    const stdout = vi.spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await itemCommand([
      "list",
      "--summary",
      "--fields",
      "id,title,status",
    ], {json: true});
    expect(JSON.parse(String(stdout.mock.calls[0]?.[0])).body.items)
      .toEqual([{id: "item-1", status: "published", title: "Only these"}]);

    await expect(itemCommand([
      "list",
      "--fields",
      "id,title",
    ], {json: true})).rejects.toThrow("--fields requires --summary");
    await expect(itemCommand([
      "list",
      "--summary",
      "--fields",
      "id,unknown",
    ], {json: true})).rejects.toThrow("--fields accepts");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("unwraps one item while leaving default get output unchanged", async () => {
    const fetchMock = vi.fn(async () => feed([{
      _microfeed: {status: "unlisted"},
      content_html: "<p>Body</p>",
      id: "item-1",
      title: "One item",
    }]));
    vi.stubGlobal("fetch", fetchMock);
    const stdout = vi.spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await itemCommand([
      "get",
      "item-1",
      "--unwrap",
      "--fields",
      "id,title,status",
    ], {json: true});
    expect(JSON.parse(String(stdout.mock.calls[0]?.[0])).body).toEqual({
      id: "item-1",
      status: "unlisted",
      title: "One item",
    });

    stdout.mockClear();
    await itemCommand(["get", "item-1"], {json: true});
    expect(JSON.parse(String(stdout.mock.calls[0]?.[0])).body)
      .toHaveProperty("version", "https://jsonfeed.org/version/1.1");
  });
});

describe("agent-safe item creation", () => {
  it("validates without creating and rejects mutating validation combinations", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("https://feed.example/api/v1/items/validate/");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        status: "unpublished",
        title: "Validate me",
      });
      return Response.json({valid: true});
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await itemCommand([
      "create",
      "--title",
      "Validate me",
      "--status",
      "unpublished",
      "--validate-only",
    ], {json: true});
    expect(fetchMock).toHaveBeenCalledOnce();

    await expect(itemCommand([
      "create",
      "--title",
      "No upload",
      "--image-file",
      "cover.png",
      "--validate-only",
    ], {json: true})).rejects.toThrow("--validate-only cannot be combined");
  });

  it("sends an explicit reusable idempotency key", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("idempotency-key"))
        .toBe("8ca861ab-0383-4f10-bbc2-8c80d8ef29dc");
      return Response.json({id: "created-id"}, {
        headers: {"Idempotency-Replayed": "true"},
        status: 201,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const stdout = vi.spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await itemCommand([
      "create",
      "--title",
      "Safe retry",
      "--idempotency-key",
      "8ca861ab-0383-4f10-bbc2-8c80d8ef29dc",
    ], {json: true});

    expect(JSON.parse(String(stdout.mock.calls[0]?.[0])).headers)
      .toMatchObject({"idempotency-replayed": "true"});

    await expect(itemCommand([
      "create",
      "--title",
      "Unsafe key",
      "--idempotency-key",
      " surrounding-space ",
    ], {json: true})).rejects.toThrow(
      "1–128 printable ASCII characters without surrounding whitespace",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reads back a verified create and reports the ID if verification fails", async () => {
    let failVerification = false;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/v1/items/")) {
        return Response.json({id: "created-id"}, {status: 201});
      }
      if (failVerification) return Response.json({error: "missing"}, {status: 404});
      return feed([{
        _microfeed: {status: "unpublished"},
        id: "created-id",
        title: "Verified",
      }]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const stdout = vi.spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await itemCommand([
      "create",
      "--title",
      "Verified",
      "--status",
      "unpublished",
      "--verify",
    ], {json: true});
    expect(JSON.parse(String(stdout.mock.calls[0]?.[0])).body).toMatchObject({
      id: "created-id",
      title: "Verified",
    });

    failVerification = true;
    await expect(itemCommand([
      "create",
      "--title",
      "Verification failure",
      "--verify",
    ], {json: true})).rejects.toThrow(
      "Item created-id was created, but read-back verification failed (404)",
    );
  });
});
