import {createHmac, randomBytes} from "node:crypto";
import {Readable} from "node:stream";

import {afterEach, describe, expect, it, vi} from "vitest";

import {
  handleWebhook,
  readWebhookSample,
  validatedForwardUrl,
  verifyWebhookSignature,
  type ListenOptions,
} from "../../../packages/cli/src/webhooks";

function signedRequest(body: Buffer, secret: string, deliveryId = "whd_test") {
  const timestamp = String(Math.floor(Date.now() / 1_000));
  const signature = `v1,${createHmac(
    "sha256",
    Buffer.from(secret.slice("whsec_".length), "base64"),
  ).update(Buffer.concat([
    Buffer.from(`${deliveryId}.${timestamp}.`),
    body,
  ])).digest("base64")}`;
  const request = Readable.from([body]) as Readable & {
    headers: Record<string, string>;
    method: string;
    url: string;
  };
  request.method = "POST";
  request.url = "/webhook";
  request.headers = {
    "content-length": String(body.length),
    "content-type": "application/json",
    "webhook-id": deliveryId,
    "webhook-signature": signature,
    "webhook-timestamp": timestamp,
    "x-microfeed-event": "webhook.test",
  };
  return request;
}

function responseCapture() {
  const result: {body?: Buffer; headers?: Record<string, string>; status?: number} = {};
  const response = {
    end(value?: string | Buffer) {
      result.body = Buffer.isBuffer(value) ? value : Buffer.from(value ?? "");
      return response;
    },
    get headersSent() {
      return result.status !== undefined;
    },
    writeHead(status: number, headers?: Record<string, string>) {
      result.status = status;
      result.headers = headers;
      return response;
    },
  };
  return {response, result};
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("microfeed webhook listener signatures", () => {
  it("verifies exact bytes and rejects stale, changed, or wrong signatures", () => {
    const key = randomBytes(32);
    const secret = `whsec_${key.toString("base64")}`;
    const body = Buffer.from('{"type":"webhook.test"}', "utf8");
    const deliveryId = "whd_test";
    const nowSeconds = 1_700_000_000;
    const timestamp = String(nowSeconds);
    const signature = `v1,${createHmac("sha256", key)
      .update(Buffer.concat([Buffer.from(`${deliveryId}.${timestamp}.`), body]))
      .digest("base64")}`;
    expect(verifyWebhookSignature({body, deliveryId, nowSeconds, secret, signature, timestamp})).toBe(true);
    expect(verifyWebhookSignature({body: Buffer.from(`${body} `), deliveryId, nowSeconds, secret, signature, timestamp})).toBe(false);
    expect(verifyWebhookSignature({body, deliveryId, nowSeconds: nowSeconds + 301, secret, signature, timestamp})).toBe(false);
  });

  it("rejects malformed secrets instead of accepting lossy base64 decoding", () => {
    expect(() => verifyWebhookSignature({
      body: Buffer.from("{}"),
      deliveryId: "whd_test",
      nowSeconds: 1_700_000_000,
      secret: "whsec_not-base64!!!!",
      signature: "v1,invalid",
      timestamp: "1700000000",
    })).toThrow(/valid base64/u);
  });
});

describe("microfeed webhook listener behavior", () => {
  const secret = `whsec_${Buffer.alloc(32, 7).toString("base64")}`;

  it("allows only explicit HTTP loopback forwarding targets", () => {
    expect(validatedForwardUrl("http://127.0.0.1:3000/hook"))
      .toBe("http://127.0.0.1:3000/hook");
    expect(validatedForwardUrl("http://[::1]:3000/hook"))
      .toBe("http://[::1]:3000/hook");
    for (const value of [
      "https://127.0.0.1:3000/hook",
      "http://example.com:3000/hook",
      "http://user:pass@localhost:3000/hook",
      "http://localhost/hook",
    ]) expect(() => validatedForwardUrl(value)).toThrow(/loopback/u);
  });

  it("prints NDJSON, marks duplicates, and forwards exact body and headers", async () => {
    const body = Buffer.from('{"id":"evt_test","type":"webhook.test"}');
    const output: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((value) => {
      output.push(String(value));
      return true;
    });
    const forwarded: Array<{body: Buffer; headers: Headers}> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      forwarded.push({
        body: Buffer.from(init?.body as Uint8Array),
        headers: new Headers(init?.headers),
      });
      return new Response("accepted", {headers: {"x-receiver": "yes"}, status: 202});
    }));
    const options: ListenOptions = {
      forwardTo: "http://127.0.0.1:3000/webhook",
      json: true,
      port: 8978,
      secret,
    };
    const seen = new Set<string>();
    for (let index = 0; index < 2; index += 1) {
      const capture = responseCapture();
      await handleWebhook(
        signedRequest(body, secret) as never,
        capture.response as never,
        options,
        seen,
      );
      expect(capture.result).toMatchObject({status: 202, body: Buffer.from("accepted")});
    }
    expect(forwarded).toHaveLength(2);
    expect(forwarded[0]!.body).toEqual(body);
    expect(forwarded[0]!.headers.get("webhook-id")).toBe("whd_test");
    expect(forwarded[0]!.headers.get("x-microfeed-event")).toBe("webhook.test");
    expect(output.map((line) => JSON.parse(line))).toMatchObject([
      {delivery_id: "whd_test", duplicate: false, verified: true},
      {delivery_id: "whd_test", duplicate: true, verified: true},
    ]);
  });

  it("returns 204 locally and maps forwarding failures to 502 or 504", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const body = Buffer.from("{}");
    const local = responseCapture();
    await handleWebhook(
      signedRequest(body, secret) as never,
      local.response as never,
      {json: false, port: 8978, secret},
      new Set(),
    );
    expect(local.result.status).toBe(204);

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("connection refused");
    }));
    const failed = responseCapture();
    await handleWebhook(
      signedRequest(body, secret, "whd_failed") as never,
      failed.response as never,
      {forwardTo: "http://127.0.0.1:3000/webhook", json: false, port: 8978, secret},
      new Set(),
    );
    expect(failed.result.status).toBe(502);

    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })
    ));
    const timedOut = responseCapture();
    const handling = handleWebhook(
      signedRequest(body, secret, "whd_timeout") as never,
      timedOut.response as never,
      {forwardTo: "http://127.0.0.1:3000/webhook", json: false, port: 8978, secret},
      new Set(),
    );
    await vi.advanceTimersByTimeAsync(9_000);
    await handling;
    expect(timedOut.result.status).toBe(504);
  });
});

describe("microfeed webhook samples", () => {
  it("reads the exact named example from the selected instance OpenAPI contract", async () => {
    vi.stubEnv("MICROFEED_URL", "https://feed.example.com");
    const sample = {id: "evt_example", test: true, type: "item.published"};
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://feed.example.com/api/v1/openapi.json");
      return new Response(JSON.stringify({
        webhooks: {
          microfeedEvent: {
            post: {
              requestBody: {
                content: {
                  "application/json": {
                    examples: {"item.published": {value: sample}},
                  },
                },
              },
            },
          },
        },
      }), {headers: {"content-type": "application/json"}});
    });
    await expect(readWebhookSample(
      "item.published",
      {json: true},
      fetcher as typeof fetch,
    )).resolves.toEqual(sample);
  });

  it("explains how to recover when published API docs are unavailable", async () => {
    vi.stubEnv("MICROFEED_URL", "https://feed.example.com");
    await expect(readWebhookSample(
      "item.published",
      {json: true},
      vi.fn(async () => new Response("", {status: 404})) as typeof fetch,
    )).rejects.toThrow(/Event explorer/u);
  });
});
