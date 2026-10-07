import {afterEach, describe, expect, it, vi} from "vitest";

import {tagRequest} from "@/client/tags";

afterEach(() => vi.unstubAllGlobals());

describe("Admin tag requests", () => {
  it.each([
    [500, "Feed context unavailable"],
    [403, "Forbidden"],
    [200, "<html>Unexpected response</html>"],
  ])("reports a non-JSON HTTP %s response without exposing the parser error", async (status, body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, {status})));
    await expect(tagRequest("/admin/ajax/tags/")).rejects.toThrow(
      `The server returned an invalid tag response (HTTP ${status}). Please refresh and try again.`,
    );
  });

  it("asks the administrator to sign in after their session expires", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unauthorized", {status: 401})));
    await expect(tagRequest("/admin/ajax/tags/")).rejects.toThrow("Sign in again to manage tags.");
  });

  it("preserves the server's tag validation message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      error: "Tag name must be 50 characters or fewer.", field: "name",
    }, {status: 400})));
    await expect(tagRequest("/admin/ajax/tags/", {method: "POST"})).rejects.toThrow("Tag name must be 50 characters or fewer.");
  });

  it("returns successful JSON responses", async () => {
    const result = {items: [{id: "stable-id", name: "Topic", slug: "topic"}]};
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(result)));
    expect(await tagRequest("/admin/ajax/tags/")).toEqual(result);
  });
});
