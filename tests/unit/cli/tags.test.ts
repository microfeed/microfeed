import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {itemCommand, tagCommand} from "../../../packages/cli/src/commands";

beforeEach(() => {
  process.env.MICROFEED_API_KEY = "test-api-key";
  process.env.MICROFEED_URL = "https://feed.example.com";
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals(); delete process.env.MICROFEED_API_KEY; delete process.env.MICROFEED_URL;});

describe("tag CLI", () => {
  it("defaults to encoded slug lookup and supports stable ID lookup", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      expect(request.headers.get("authorization")).toBe("Bearer test-api-key");
      return Response.json({id: "stable-tag"});
    });
    vi.stubGlobal("fetch", fetchMock);
    await tagCommand(["get", "世界"], {json: true});
    await tagCommand(["get", "--id", "stable-tag"], {json: true});
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/tags/%E4%B8%96%E7%95%8C/");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/api/v1/tags/by-id/stable-tag/");
    await expect(tagCommand(["get", "slug", "--id", "id"], {json: true})).rejects.toThrow("not both");
  });

  it("replaces item tags through repeatable flags without implicit creation", async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(String(init?.body))).toMatchObject({tag_slugs: ["one", "two"]});
      return Response.json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    await itemCommand(["update", "item", "--tag", "one", "--tag", "two"], {json: true});
    expect(fetchMock).toHaveBeenCalledOnce();
    await expect(itemCommand(["update", "item", "--tag", "one", "--tag-id", "two"], {json: true})).rejects.toThrow("not both");
  });

  it("reads a slug target before deletion and requires its exact immutable ID", async () => {
    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      if (init?.method === "DELETE") expect(String(input)).toContain("/by-id/stable-tag/");
      return Response.json({id: "stable-tag"});
    }));
    await expect(tagCommand(["delete", "slug", "--confirm", "slug"], {json: true})).rejects.toThrow("exactly match stable-tag");
    expect(methods).toEqual(["GET"]);
    await tagCommand(["delete", "slug", "--confirm", "stable-tag"], {json: true});
    expect(methods).toEqual(["GET", "GET", "DELETE"]);
  });
});
