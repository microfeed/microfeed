import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {itemCommand} from "../../../packages/cli/src/commands";

let directory: string;
let previousExitCode: typeof process.exitCode;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "microfeed-cli-search-test-"));
  process.env.MICROFEED_CONFIG_DIR = directory;
  process.env.MICROFEED_API_KEY = "test-api-key";
  process.env.MICROFEED_URL = "https://feed.example.com";
  previousExitCode = process.exitCode;
  process.exitCode = undefined;
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.exitCode = previousExitCode;
  delete process.env.MICROFEED_CONFIG_DIR;
  delete process.env.MICROFEED_API_KEY;
  delete process.env.MICROFEED_URL;
  await rm(directory, {force: true, recursive: true});
});

describe("microfeed item search", () => {
  it("maps the query and every search filter to the native API request", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);

      expect(request.method).toBe("GET");
      expect(request.headers.get("authorization")).toBe("Bearer test-api-key");
      expect(url.pathname).toBe("/api/v1/search/");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        date_published_ms_gt: "1767225600000",
        date_published_ms_lt: "1798761600000",
        fields: "title",
        limit: "5",
        next_cursor: "opaque-cursor",
        q: "hello",
        status: "published,unlisted",
      });

      return Response.json({
        items: [{highlights: {content_text: [], title: []}, id: "item-1", title: "Hello"}],
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const write = vi.spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await itemCommand([
      "search",
      "hello",
      "--fields",
      "title",
      "--status",
      "published,unlisted",
      "--date-published-ms-gt",
      "1767225600000",
      "--date-published-ms-lt",
      "1798761600000",
      "--limit",
      "5",
      "--next-cursor",
      "opaque-cursor",
    ], {json: true});

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(write.mock.calls[0]?.[0]))).toMatchObject({
      body: {items: [{id: "item-1", title: "Hello"}]},
      ok: true,
      status: 200,
    });
  });

  it("preserves exact-phrase syntax in the positional query", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      expect(url.searchParams.get("q")).toBe('launch "season finale"');
      return Response.json({items: []});
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await itemCommand([
      "search",
      '  launch "season finale"  ',
      "--fields",
      "title,content",
    ], {json: false});

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("requires exactly one non-empty query of at most 200 characters", async () => {
    await expect(itemCommand(["search"], {json: false}))
      .rejects.toThrow("item search <query>");
    await expect(itemCommand(["search", "hello", "world"], {json: false}))
      .rejects.toThrow("item search <query>");
    await expect(itemCommand(["search", "   "], {json: false}))
      .rejects.toThrow("1–200 characters");
    await expect(itemCommand(["search", "x".repeat(201)], {json: false}))
      .rejects.toThrow("1–200 characters");
  });
});
