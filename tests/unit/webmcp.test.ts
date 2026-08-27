import {readFile} from "node:fs/promises";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {dashboardTools, clearAdminWebMcpTools, reconcileAdminWebMcpTools} from
  "@/client/webmcp/admin-tools";
import {itemDraftTool, pageDraftTool} from "@/client/webmcp/editor-tools";
import {nativeWebMcpAvailable} from "@/client/webmcp/feature-detection";
import {registerWebMcpTools} from "@/client/webmcp/model-context";

function fakeDocument(options: {
  adminPath?: string;
  enabled?: boolean;
  modelContext?: unknown;
} = {}): Document {
  return {
    ...(options.modelContext ? {modelContext: options.modelContext} : {}),
    querySelector: vi.fn((selector: string) => {
      if (selector.includes("microfeed-webmcp-enabled")) {
        return {content: options.enabled ? "true" : "false"};
      }
      if (selector.includes("microfeed-admin-path")) {
        return {content: options.adminPath ?? "admin"};
      }
      return null;
    }),
  } as unknown as Document;
}

beforeEach(() => {
  vi.stubGlobal("window", {
    location: {
      assign: vi.fn(),
      origin: "https://feed.example.com",
    },
  });
});

afterEach(() => {
  clearAdminWebMcpTools();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WebMCP feature detection and registration", () => {
  it("requires both protected-dashboard markup and the native Document API", () => {
    const registerTool = vi.fn();
    expect(nativeWebMcpAvailable(fakeDocument({
      enabled: true,
      modelContext: {registerTool},
    }))).toBe(true);
    expect(nativeWebMcpAvailable(fakeDocument({
      enabled: false,
      modelContext: {registerTool},
    }))).toBe(false);
    expect(nativeWebMcpAvailable(fakeDocument({enabled: true}))).toBe(false);
  });

  it("does nothing in unsupported browsers", async () => {
    const registerTool = vi.fn();
    vi.stubGlobal("document", fakeDocument({
      enabled: false,
      modelContext: {registerTool},
    }));
    await registerWebMcpTools([dashboardTools()[0]!], new AbortController().signal);
    expect(registerTool).not.toHaveBeenCalled();
  });

  it("reconciles dashboard tools and aborts the previous registration", async () => {
    const registerTool = vi.fn(async (
      _tool: unknown,
      _options: {signal: AbortSignal},
    ) => undefined);
    vi.stubGlobal("document", fakeDocument({
      enabled: true,
      modelContext: {registerTool},
    }));

    await reconcileAdminWebMcpTools();
    const firstSignal = registerTool.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(registerTool).toHaveBeenCalledTimes(5);
    expect(firstSignal.aborted).toBe(false);

    await reconcileAdminWebMcpTools();
    expect(registerTool).toHaveBeenCalledTimes(10);
    expect(firstSignal.aborted).toBe(true);
  });

  it("keeps the implementation behind a native feature-gated import", async () => {
    const source = await readFile(
      new URL("../../src/layouts/AdminShell.astro", import.meta.url),
      "utf8",
    );
    expect(source).toContain("nativeWebMcpAvailable()");
    expect(source).toContain('import("@/client/webmcp/admin-tools")');
    expect(source).not.toContain(
      'from "@/client/webmcp/admin-tools"',
    );
    expect(source).not.toContain('from "@/client/webmcp/schemas"');
    expect(source).not.toContain("navigator.modelContext");
    expect(source).not.toContain("exposedTo");
  });
});

describe("WebMCP tool contracts", () => {
  it("defines the seven concise, non-overlapping tools and annotations", () => {
    const readTools = dashboardTools();
    const saveTools = [
      itemDraftTool(async () => ({})),
      pageDraftTool(async () => ({})),
    ];
    expect([...readTools, ...saveTools].map(({name}) => name)).toEqual([
      "microfeed_list_items",
      "microfeed_get_item",
      "microfeed_list_pages",
      "microfeed_get_page",
      "microfeed_start_draft",
      "microfeed_save_item_draft",
      "microfeed_save_page_draft",
    ]);
    for (const tool of readTools.slice(0, 4)) {
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        untrustedContentHint: true,
      });
    }
    for (const tool of saveTools) {
      expect(tool.annotations).toEqual({
        readOnlyHint: false,
        untrustedContentHint: true,
      });
    }
  });

  it("validates arguments in application code and never accepts status", async () => {
    const signal = new AbortController().signal;
    const itemSave = vi.fn(async () => ({}));
    const pageSave = vi.fn(async () => ({}));
    expect(() => itemDraftTool(itemSave).execute(
      {status: "published", title: "No"},
      {signal},
    )).toThrow(/Unrecognized key/u);
    expect(() => pageDraftTool(pageSave).execute({}, {signal}))
      .toThrow(/at least one Page field/u);
    expect(itemSave).not.toHaveBeenCalled();
    expect(pageSave).not.toHaveBeenCalled();
  });

  it("normalizes missing execution signals from preview clients", async () => {
    const itemSave = vi.fn(async (
      _input: unknown,
      _signal: AbortSignal,
    ) => ({}));
    const pageSave = vi.fn(async (
      _input: unknown,
      _signal: AbortSignal,
    ) => ({}));

    await itemDraftTool(itemSave).execute({title: "Draft"});
    await pageDraftTool(pageSave).execute({title: "Page"}, {});

    const itemSignal = itemSave.mock.calls[0]?.[1];
    const pageSignal = pageSave.mock.calls[0]?.[1];
    expect(itemSignal).toBeInstanceOf(AbortSignal);
    expect(itemSignal?.aborted).toBe(false);
    expect(pageSignal).toBeInstanceOf(AbortSignal);
    expect(pageSignal?.aborted).toBe(false);
  });

  it("uses authenticated same-origin fetches for read tools", async () => {
    vi.stubGlobal("document", fakeDocument({adminPath: "admin"}));
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      items: [{id: "draft-1", status: 2, title: "Draft", updatedAtMs: 1}],
      nextCursor: "next",
    }), {headers: {"content-type": "application/json"}}));
    vi.stubGlobal("fetch", fetch);
    const result = await dashboardTools()[0]!.execute(
      {limit: 1, status: "unpublished"},
    ) as Record<string, any>;

    expect(fetch).toHaveBeenCalledWith(
      "https://feed.example.com/admin/ajax/items/?status=unpublished&limit=1",
      expect.objectContaining({credentials: "same-origin"}),
    );
    expect(result.items[0]).toMatchObject({
      editor_url: "https://feed.example.com/admin/items/draft-1/",
      status: "unpublished",
    });
  });
});
