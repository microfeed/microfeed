import {createHmac, timingSafeEqual} from "node:crypto";
import {mkdir, readFile, readdir, stat, writeFile} from "node:fs/promises";
import {createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse} from "node:http";
import type {AddressInfo} from "node:net";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {parseOptions, stringFlag} from "./arguments.js";
import {CliError} from "./errors.js";
import {publicSiteOrigin, type GlobalOptions} from "./http.js";

const DEFAULT_PORT = 8978;
const MAX_BODY_BYTES = 256 * 1024;
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const WEBHOOK_STARTER_LANGUAGES = ["javascript", "python"] as const;
type WebhookStarterLanguage = typeof WEBHOOK_STARTER_LANGUAGES[number];

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

interface WebhookOpenApiDocument {
  webhooks?: {
    microfeedEvent?: {
      post?: {
        requestBody?: {
          content?: {
            "application/json"?: {
              examples?: Record<string, {value?: unknown}>;
            };
          };
        };
      };
    };
  };
}

export async function readWebhookSample(
  eventType: string,
  options: GlobalOptions,
  fetcher: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  if (!/^[a-z_]+\.[a-z_]+$/u.test(eventType)) {
    throw new CliError("Provide an exact webhook event such as item.published.");
  }
  const origin = await publicSiteOrigin(options);
  const target = new URL("/api/v1/openapi.json", origin);
  let response: Response;
  try {
    response = await fetcher(target, {
      headers: {accept: "application/json"},
      redirect: "manual",
    });
  } catch (error) {
    throw new CliError(
      `Could not read the generated OpenAPI contract from ${origin}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (response.status >= 300 && response.status < 400) {
    throw new CliError(
      "The OpenAPI contract returned a redirect. Verify the selected microfeed site URL.",
    );
  }
  if (!response.ok) {
    throw new CliError(
      `The generated OpenAPI contract is unavailable (${response.status}). Enable published API documentation in Admin → API → API Settings, or open Admin → Webhooks → Event explorer.`,
    );
  }
  const document = await response.json().catch(() => null) as
    | WebhookOpenApiDocument
    | null;
  const value = document?.webhooks?.microfeedEvent?.post?.requestBody?.content?.[
    "application/json"
  ]?.examples?.[eventType]?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError(
      `The selected instance does not publish an example for ${eventType}. List exact event names in its OpenAPI webhook operation or use Admin → Webhooks → Event explorer.`,
    );
  }
  const sample = value as Record<string, unknown>;
  if (sample.type !== eventType || sample.test !== true) {
    throw new CliError(
      `The OpenAPI example for ${eventType} is inconsistent. Use Admin → Webhooks → Event explorer and update the instance before building against it.`,
    );
  }
  return sample;
}

async function webhookSampleCommand(
  args: string[],
  options: GlobalOptions,
): Promise<void> {
  const parsed = parseOptions(args, new Set());
  if (parsed.positionals.length !== 1) {
    throw new CliError(
      "Usage: yarn microfeed webhook sample <event> [--instance <name>] [--json]",
    );
  }
  const eventType = parsed.positionals[0]!;
  const sample = await readWebhookSample(eventType, options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(sample)}\n`);
    return;
  }
  process.stdout.write(
    `Webhook example: ${eventType}\n\n${JSON.stringify(sample, null, 2)}\n`,
  );
}

interface WebhookScaffoldResult {
  createdFiles: string[];
  directory: string;
  language: WebhookStarterLanguage;
  localEndpointUrl: string;
  nextStepCommands: string[];
}

function starterDirectory(language: WebhookStarterLanguage): string {
  return fileURLToPath(
    new URL(`../templates/webhook/${language}/`, import.meta.url),
  );
}

export function resolveWebhookScaffoldDirectory(
  directoryInput: string,
  workingDirectory = process.cwd(),
  projectDirectory = process.env.PROJECT_CWD,
): string {
  const baseDirectory = projectDirectory?.trim()
    ? path.resolve(projectDirectory)
    : workingDirectory;
  return path.resolve(baseDirectory, directoryInput);
}

export async function scaffoldWebhookReceiver(
  directoryInput: string,
  language: WebhookStarterLanguage = "javascript",
): Promise<WebhookScaffoldResult> {
  const directory = resolveWebhookScaffoldDirectory(directoryInput);
  try {
    await stat(directory);
    throw new CliError(
      `The scaffold destination already exists: ${directory}. Choose a new directory; webhook scaffold never overwrites files.`,
    );
  } catch (error) {
    if (error instanceof CliError) throw error;
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw new CliError(
        `Could not inspect the scaffold destination: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const sourceDirectory = starterDirectory(language);
  const entries = (await readdir(sourceDirectory, {withFileTypes: true}))
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      output: entry.name === "gitignore" ? ".gitignore" : entry.name,
      source: entry.name,
    }))
    .sort((left, right) => left.output.localeCompare(right.output));
  await mkdir(path.dirname(directory), {recursive: true});
  await mkdir(directory);
  try {
    for (const entry of entries) {
      await writeFile(
        path.join(directory, entry.output),
        await readFile(path.join(sourceDirectory, entry.source)),
        {flag: "wx"},
      );
    }
  } catch (error) {
    throw new CliError(
      `Could not create the webhook starter: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const nextStepCommands = language === "javascript"
    ? [
        `cd ${JSON.stringify(directory)}`,
        "yarn install",
        "MICROFEED_WEBHOOK_SECRET=whsec_... yarn start",
      ]
    : [
        `cd ${JSON.stringify(directory)}`,
        "python3 -m venv .venv",
        ". .venv/bin/activate",
        "pip install -r requirements.txt",
        "MICROFEED_WEBHOOK_SECRET=whsec_... python server.py",
      ];
  return {
    createdFiles: entries.map(({output}) => output),
    directory,
    language,
    localEndpointUrl: "http://127.0.0.1:3000/webhook",
    nextStepCommands,
  };
}

async function webhookScaffoldCommand(
  args: string[],
  json: boolean,
): Promise<void> {
  const parsed = parseOptions(args, new Set(["language"]));
  if (parsed.positionals.length !== 1) {
    throw new CliError(
      "Usage: yarn microfeed webhook scaffold <directory> [--language javascript|python] [--json]",
    );
  }
  const languageInput = stringFlag(parsed, "language") ?? "javascript";
  if (!WEBHOOK_STARTER_LANGUAGES.includes(
    languageInput as WebhookStarterLanguage,
  )) {
    throw new CliError("--language must be javascript or python.");
  }
  const result = await scaffoldWebhookReceiver(
    parsed.positionals[0]!,
    languageInput as WebhookStarterLanguage,
  );
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  process.stdout.write([
    `Created the ${result.language} webhook receiver in ${result.directory}.`,
    `After it starts, the receiver will listen at ${result.localEndpointUrl}.`,
    "",
    `Before starting it, create a webhook endpoint for ${result.localEndpointUrl} in Admin → Webhooks → Endpoints.`,
    "Open Signing secret for that endpoint and reveal the whsec_… value; this is your MICROFEED_WEBHOOK_SECRET.",
    "",
    "Then install dependencies and run the receiver with that secret:",
    ...result.nextStepCommands,
    "",
    "With the receiver running, send a signed test from Admin → Webhooks → Event explorer.",
    "This starter is a local inspector. Add durable work, deduplication, idempotency, loop prevention, and approval policy before production.",
    "",
  ].join("\n"));
}

async function webhookListenCommand(args: string[], json: boolean): Promise<void> {
  const parsed = parseOptions(args, new Set(["forward-to", "port", "secret-file"]));
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

export async function webhookCommand(
  args: string[],
  options: GlobalOptions,
): Promise<void> {
  const [subcommand, ...rest] = args;
  if (subcommand === "listen") {
    return webhookListenCommand(rest, options.json);
  }
  if (subcommand === "sample") {
    return webhookSampleCommand(rest, options);
  }
  if (subcommand === "scaffold") {
    return webhookScaffoldCommand(rest, options.json);
  }
  throw new CliError(
    "Usage: yarn microfeed webhook <listen|sample|scaffold> [arguments] [options]",
  );
}
