import {mkdtemp, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {itemCommand} from "../../../packages/cli/src/commands";
import {
  uploadAttachmentFile,
  uploadImageFile,
} from "../../../packages/cli/src/media";

let directory: string;
let imagePath: string;

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "microfeed-image-test-"));
  imagePath = path.join(directory, "cover.png");
  await writeFile(imagePath, new Uint8Array([137, 80, 78, 71]));
  process.env.MICROFEED_API_KEY = "environment-secret";
  process.env.MICROFEED_URL = "https://feed.example";
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.MICROFEED_API_KEY;
  delete process.env.MICROFEED_URL;
  await rm(directory, {force: true, recursive: true});
});

function preparedResponse(presignedUrl =
  "https://feed.example/media-upload/production/media/image.png?signature=secret") {
  return new Response(JSON.stringify({
    media_url: "https://feed.example/media/production/media/image.png",
    presigned_url: presignedUrl,
  }), {
    headers: {"content-type": "application/json"},
    status: 201,
  });
}

describe("CLI item image uploads", () => {
  it("prepares, uploads, and attaches a local image without forwarding credentials", async () => {
    const fetchMock = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = String(input);
      if (url.endsWith("/api/v1/media_files/presigned_urls/")) {
        expect(new Headers(init?.headers).get("authorization"))
          .toBe("Bearer environment-secret");
        expect(JSON.parse(String(init?.body))).toMatchObject({
          category: "image",
          full_local_file_path: "cover.png",
          item_id: "item-id",
          size: 4,
          type: "image/png",
        });
        return preparedResponse();
      }
      if (url.startsWith("https://feed.example/media-upload/")) {
        const headers = new Headers(init?.headers);
        expect(headers.get("authorization")).toBeNull();
        expect(headers.get("content-length")).toBe("4");
        expect(headers.get("content-type")).toBe("image/png");
        expect(init?.redirect).toBe("manual");
        const chunks: Buffer[] = [];
        for await (const chunk of init?.body as unknown as NodeJS.ReadableStream) {
          chunks.push(Buffer.from(chunk));
        }
        expect(Buffer.concat(chunks).byteLength).toBe(4);
        return Response.json({etag: "etag"});
      }
      expect(url).toBe("https://feed.example/api/v1/items/item-id/");
      expect(JSON.parse(String(init?.body))).toEqual({
        image: "https://feed.example/media/production/media/image.png",
      });
      return Response.json({id: "item-id"});
    });
    vi.stubGlobal("fetch", fetchMock);
    const write = vi.spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await itemCommand([
      "update",
      "item-id",
      "--image-file",
      imagePath,
    ], {json: true});

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('"status":200'));
    expect(write.mock.calls.flat().join(""))
      .not.toContain("signature=secret");
  });

  it("rejects cross-site upload URLs before reading or sending image bytes", async () => {
    const fetchMock = vi.fn(async () =>
      preparedResponse(
        "https://uploads.attacker.example/media-upload/image.png?signature=secret",
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadImageFile(imagePath, "item-id", {json: true}))
      .rejects.toThrow("different site; no file bytes were sent");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refuses an upload redirect without forwarding image bytes", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes("/api/v1/")) return preparedResponse();
      return new Response(null, {
        headers: {location: "https://uploads.attacker.example/image.png"},
        status: 302,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadImageFile(imagePath, "item-id", {json: true}))
      .rejects.toThrow("upload returned a redirect");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.some(([input]) =>
      String(input).startsWith("https://uploads.attacker.example")
    )).toBe(false);
  });

  it("rejects ambiguous item input before uploading a file", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(itemCommand([
      "update",
      "item-id",
      "--image",
      "https://images.example/cover.png",
      "--image-file",
      imagePath,
    ], {json: true})).rejects.toThrow(
      "Use either --image-file or --image, not both.",
    );
    await expect(itemCommand([
      "create",
      "--input",
      "item.json",
      "--image-file",
      imagePath,
    ], {json: true})).rejects.toThrow(
      "Use either --input or item flags, not both.",
    );
    await expect(itemCommand([
      "update",
      "item-id",
      "--input",
      "item.json",
      "--attachment-file",
      imagePath,
    ], {json: true})).rejects.toThrow(
      "Use either --input or item flags, not both.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("CLI media attachment uploads", () => {
  it("uploads a local file as attachments[0] rather than the item image", async () => {
    const fetchMock = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = String(input);
      if (url.endsWith("/api/v1/media_files/presigned_urls/")) {
        expect(new Headers(init?.headers).get("authorization"))
          .toBe("Bearer environment-secret");
        expect(JSON.parse(String(init?.body))).toEqual({
          category: "image",
          full_local_file_path: "cover.png",
          item_id: "item-id",
          size: 4,
          type: "image/png",
        });
        return preparedResponse();
      }
      if (url.startsWith("https://feed.example/media-upload/")) {
        expect(new Headers(init?.headers).get("authorization")).toBeNull();
        expect(init?.redirect).toBe("manual");
        return Response.json({etag: "etag"});
      }
      expect(url).toBe("https://feed.example/api/v1/items/item-id/");
      expect(JSON.parse(String(init?.body))).toEqual({
        attachments: [{
          category: "image",
          mime_type: "image/png",
          size_in_bytes: 4,
          url: "https://feed.example/media/production/media/image.png",
        }],
      });
      return Response.json({
        attachments: [{category: "image"}],
        id: "item-id",
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const write = vi.spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    await itemCommand([
      "update",
      "item-id",
      "--attachment-file",
      imagePath,
    ], {json: true});

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(write.mock.calls.flat().join(""))
      .not.toContain("signature=secret");
  });

  it("creates an item before preparing and saving its attachment", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = String(input);
      urls.push(url);
      if (url === "https://feed.example/api/v1/items/" && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({title: "New photo"});
        return Response.json({id: "created-id"}, {status: 201});
      }
      if (url.endsWith("/api/v1/media_files/presigned_urls/")) {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          category: "image",
          item_id: "created-id",
        });
        return preparedResponse();
      }
      if (url.startsWith("https://feed.example/media-upload/")) {
        return Response.json({etag: "etag"});
      }
      expect(url).toBe("https://feed.example/api/v1/items/created-id/");
      expect(JSON.parse(String(init?.body))).toHaveProperty(
        "attachments.0.url",
        "https://feed.example/media/production/media/image.png",
      );
      return Response.json({id: "created-id"});
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await itemCommand([
      "create",
      "--title",
      "New photo",
      "--attachment-file",
      imagePath,
    ], {json: true});

    expect(urls).toEqual([
      "https://feed.example/api/v1/items/",
      "https://feed.example/api/v1/media_files/presigned_urls/",
      expect.stringContaining("https://feed.example/media-upload/"),
      "https://feed.example/api/v1/items/created-id/",
    ]);
  });

  it("reports a newly created item ID when its attachment upload fails", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input) === "https://feed.example/api/v1/items/") {
        return Response.json({id: "recoverable-id"}, {status: 201});
      }
      return preparedResponse(
        "https://uploads.attacker.example/media-upload/image.png?signature=secret",
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(itemCommand([
      "create",
      "--title",
      "Recoverable item",
      "--attachment-file",
      imagePath,
    ], {json: true})).rejects.toThrow(
      "Item recoverable-id was created, but its media attachment was not added.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("infers attachment category, MIME type, and size from the local file", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes("/api/v1/")) return preparedResponse();
      return Response.json({etag: "etag"});
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadAttachmentFile(imagePath, "item-id", {json: true}))
      .resolves.toEqual({
        category: "image",
        mime_type: "image/png",
        size_in_bytes: 4,
        url: "https://feed.example/media/production/media/image.png",
      });
  });
});
