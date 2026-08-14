import {createHmac, timingSafeEqual} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse} from "node:http";
import type {AddressInfo} from "node:net";
import {parseOptions, stringFlag} from "./arguments.js";
import {CliError} from "./errors.js";

const DEFAULT_PORT = 8978;
const MAX_BODY_BYTES = 256 * 1024;
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export interface ListenOptions {
  forwardTo?: string;
  json: boolean;
  port: number;
  secret: string;
}

function signingKey(secret: string): Buffer {
  if (!secret.startsWith("whsec_")) {
    throw new CliError("Webhook signing secrets must start with whsec_.");
  }
  const encoded = secret.slice("whsec_".length);
  if (!/^(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{3}=$/u.test(encoded)) {
    throw new CliError("The webhook signing secret is not valid base64.");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new CliError("The webhook signing secret must contain 32 bytes.");
  }
  return key;
}

export function verifyWebhookSignature(input: {
  body: Buffer;
  deliveryId: string;
  nowSeconds?: number;
  secret: string;
  signature: string;
  timestamp: string;
}): boolean {
  if (!/^\d+$/u.test(input.timestamp)) return false;
  const timestamp = Number(input.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1_000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }
  const signed = Buffer.concat([
    Buffer.from(`${input.deliveryId}.${input.timestamp}.`, "utf8"),
    input.body,
  ]);
  const expected = createHmac("sha256", signingKey(input.secret)).update(signed).digest();
  return input.signature.split(" ").some((candidate) => {
    const [version, encoded] = candidate.split(",", 2);
    if (version !== "v1" || !encoded) return false;
    let supplied: Buffer;
    try { supplied = Buffer.from(encoded, "base64"); } catch { return false; }
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}

export function validatedForwardUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let url: URL;
  try { url = new URL(value); } catch { throw new CliError("--forward-to requires an absolute loopback URL."); }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  if (url.protocol !== "http:" || !loopback || !url.port || url.username || url.password || url.hash) {
    throw new CliError("--forward-to must use http:// with a loopback host and explicit port.");
  }
  return url.toString();
}

async function hiddenPrompt(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new CliError("Set MICROFEED_WEBHOOK_SECRET or use --secret-file when stdin is not a terminal.");
  }
  process.stderr.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = "";
  try {
    return await new Promise<string>((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        for (const byte of chunk) {
          if (byte === 3) {
            process.stdin.off("data", onData);
            reject(new CliError("Canceled.", 130));
          } else if (byte === 13 || byte === 10) {
            process.stdin.off("data", onData);
            process.stderr.write("\n");
            resolve(value);
          } else if (byte === 8 || byte === 127) {
            value = value.slice(0, -1);
          } else if (byte >= 32) {
            value += String.fromCharCode(byte);
          }
        }
      };
      process.stdin.on("data", onData);
    });
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
}

async function resolveSecret(secretFile: string | undefined): Promise<string> {
  const value = secretFile
    ? await readFile(secretFile, "utf8").catch((error: unknown) => {
        throw new CliError(`Could not read --secret-file: ${error instanceof Error ? error.message : String(error)}`);
      })
    : process.env.MICROFEED_WEBHOOK_SECRET ?? await hiddenPrompt("Webhook signing secret: ");
  const secret = value.trim();
  signingKey(secret);
  return secret;
}

async function requestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const value of request) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    length += chunk.length;
    if (length > MAX_BODY_BYTES) throw new CliError("Webhook body exceeds 256 KiB.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function webhookHeaders(headers: IncomingHttpHeaders): Headers {
  const forwarded = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (name === "host" || name === "content-length" || name === "connection" || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((part) => forwarded.append(name, part));
    else forwarded.set(name, value);
  }
  return forwarded;
}

function header(request: IncomingMessage, name: string): string {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function writeOutput(options: ListenOptions, input: {body: Buffer; duplicate: boolean; eventType: string; id: string}) {
  let payload: unknown = null;
  try { payload = JSON.parse(input.body.toString("utf8")); } catch { payload = input.body.toString("utf8"); }
  if (options.json) {
    process.stdout.write(`${JSON.stringify({
      delivery_id: input.id,
      duplicate: input.duplicate,
      event_type: input.eventType,
      payload,
      received_at: new Date().toISOString(),
      verified: true,
    })}\n`);
    return;
  }
  process.stdout.write(`\n${input.duplicate ? "DUPLICATE " : ""}${input.eventType || "webhook"} ${input.id}\n${JSON.stringify(payload, null, 2)}\n`);
}

export async function handleWebhook(
  request: IncomingMessage,
  response: ServerResponse,
  options: ListenOptions,
  seen: Set<string>,
): Promise<void> {
  if (request.method !== "POST" || request.url !== "/webhook") {
    response.writeHead(404).end();
    return;
  }
  let body: Buffer;
  try { body = await requestBody(request); }
  catch (error) {
    response.writeHead(413, {"content-type": "text/plain; charset=utf-8"}).end(error instanceof Error ? error.message : "Payload too large.");
    return;
  }
  const id = header(request, "webhook-id");
  const timestamp = header(request, "webhook-timestamp");
  const signature = header(request, "webhook-signature");
  if (!id || !verifyWebhookSignature({body, deliveryId: id, secret: options.secret, signature, timestamp})) {
    response.writeHead(400, {"content-type": "text/plain; charset=utf-8"}).end("Invalid webhook signature.");
    return;
  }
  const duplicate = seen.has(id);
  seen.add(id);
  if (seen.size > 10_000) seen.delete(seen.values().next().value!);
  writeOutput(options, {body, duplicate, eventType: header(request, "x-microfeed-event"), id});
  if (!options.forwardTo) {
    response.writeHead(204).end();
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const forwarded = await fetch(options.forwardTo, {
      body: new Uint8Array(body),
      headers: webhookHeaders(request.headers),
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
    });
    const forwardedBody = Buffer.from(await forwarded.arrayBuffer());
    response.writeHead(forwarded.status, Object.fromEntries(
      [...forwarded.headers].filter(([name]) => name !== "content-encoding" && name !== "content-length"),
    )).end(forwardedBody);
  } catch (error) {
    const timedOut = controller.signal.aborted;
    response.writeHead(timedOut ? 504 : 502, {"content-type": "text/plain; charset=utf-8"})
      .end(timedOut ? "Forward target timed out." : `Forward target failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function webhookCommand(args: string[], json: boolean): Promise<void> {
  const [subcommand, ...rest] = args;
  if (subcommand !== "listen") throw new CliError("Usage: yarn microfeed webhook listen [options]");
  const parsed = parseOptions(rest, new Set(["forward-to", "port", "secret-file"]));
  if (parsed.positionals.length > 0) throw new CliError("webhook listen does not accept positional arguments.");
  const portInput = stringFlag(parsed, "port");
  const port = portInput === undefined ? DEFAULT_PORT : Number(portInput);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new CliError("--port must be an integer from 1 to 65535.");
  const options: ListenOptions = {
    forwardTo: validatedForwardUrl(stringFlag(parsed, "forward-to")),
    json,
    port,
    secret: await resolveSecret(stringFlag(parsed, "secret-file")),
  };
  const seen = new Set<string>();
  const server = createServer((request, response) => {
    void handleWebhook(request, response, options, seen).catch((error) => {
      process.stderr.write(`microfeed: webhook listener error: ${error instanceof Error ? error.message : String(error)}\n`);
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  process.stderr.write(`Listening for verified microfeed webhooks at http://127.0.0.1:${address.port}/webhook${options.forwardTo ? ` and forwarding to ${options.forwardTo}` : ""}. Press Ctrl+C to stop.\n`);
  await new Promise<void>((resolve) => {
    const stop = () => server.close(() => resolve());
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
