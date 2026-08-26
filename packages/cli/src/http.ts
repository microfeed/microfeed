import {readFile} from "node:fs/promises";

import {API_PATH_PREFIX} from "./constants.js";
import {normalizeOrigin} from "./discovery.js";
import {CliError} from "./errors.js";
import {refreshTokens} from "./oauth.js";
import {
  decryptTokens,
  encryptTokens,
  type SavedInstance,
  readStore,
  type TokenBundle,
  writeStore,
} from "./store.js";

const BLOCKED_HEADERS = new Set(["authorization", "cookie", "host"]);
const SAFE_RESPONSE_HEADERS = new Set([
  "cache-control",
  "content-length",
  "content-type",
  "etag",
  "idempotency-replayed",
  "last-modified",
  "x-request-id",
]);
const API_ACCESS_HELP_URL =
  "https://docs.microfeed.org/api/authentication/#enable-the-api";
const API_NOT_FOUND_RECOVERY = {
  code: "api_access_or_resource_not_found",
  documentationUrl: API_ACCESS_HELP_URL,
  instructions: [
    "New microfeed instances keep API access disabled by default.",
    "The site owner should sign in to the admin dashboard, open API → API Settings, and turn on Enable API access.",
    "If you are an AI agent, pause and ask the site owner to complete that browser step; do not request their dashboard password, API key, or OAuth token.",
    "After API access is enabled, retry the same command. If it is already enabled, verify that the requested resource and /api/v1/ path exist.",
  ],
  message: "API access may be disabled, or the requested resource may not exist.",
} as const;

export interface GlobalOptions {
  instance?: string;
  json: boolean;
}

export interface ApiResponse {
  body: unknown;
  headers: Record<string, string>;
  ok: boolean;
  status: number;
}

export async function readInput(filename: string): Promise<string> {
  if (filename !== "-") return await readFile(filename, "utf8");
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function jsonObjectEnd(
  text: string,
  state: {
    escaped: boolean;
    inString: boolean;
    index: number;
    stack: string[];
    started: boolean;
  },
): number | undefined {
  for (; state.index < text.length; state.index += 1) {
    const character = text[state.index]!;
    if (!state.started) {
      if (/\s/u.test(character)) continue;
      if (character !== "{") {
        throw new CliError("Item input must be a JSON object.");
      }
      state.started = true;
      state.stack.push("}");
      continue;
    }
    if (state.inString) {
      if (state.escaped) {
        state.escaped = false;
      } else if (character === "\\") {
        state.escaped = true;
      } else if (character === '"') {
        state.inString = false;
      }
      continue;
    }
    if (character === '"') {
      state.inString = true;
    } else if (character === "{") {
      state.stack.push("}");
    } else if (character === "[") {
      state.stack.push("]");
    } else if (character === "}" || character === "]") {
      if (state.stack.pop() !== character) {
        throw new CliError("Item input must be a JSON object.");
      }
      if (!state.stack.length) return state.index + 1;
    }
  }
  return undefined;
}

export async function readJsonObjectInput(
  filename: string,
  input: AsyncIterable<Uint8Array | string> = process.stdin,
): Promise<string> {
  if (filename !== "-") return await readFile(filename, "utf8");
  const decoder = new TextDecoder("utf-8", {fatal: true});
  const encoder = new TextEncoder();
  let text = "";
  const state = {
    escaped: false,
    inString: false,
    index: 0,
    stack: [] as string[],
    started: false,
  };
  try {
    for await (const chunk of input) {
      text += decoder.decode(
        typeof chunk === "string" ? encoder.encode(chunk) : chunk,
        {stream: true},
      );
      const end = jsonObjectEnd(text, state);
      if (end !== undefined) {
        if (text.slice(end).trim()) {
          throw new CliError("Item input must contain exactly one JSON object.");
        }
        const framed = text.slice(0, end);
        let parsed: unknown;
        try {
          parsed = JSON.parse(framed);
        } catch {
          throw new CliError("Item input must be a valid JSON object.");
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new CliError("Item input must be a JSON object.");
        }
        return framed;
      }
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError("Item input must be a valid UTF-8 JSON object.");
  }
  throw new CliError("Item input ended before one complete JSON object was received.");
}

function selectedInstance(
  store: Awaited<ReturnType<typeof readStore>>,
  requested?: string,
): {instance: SavedInstance; name: string} {
  const name = requested ?? process.env.MICROFEED_INSTANCE?.trim() ?? store.current;
  if (!name || !store.instances[name]) {
    throw new CliError(
      "No microfeed instance is selected. Run `yarn microfeed login <site-url>` or choose one with `yarn microfeed instances use <name>`.",
    );
  }
  return {instance: store.instances[name], name};
}

async function credentials(options: GlobalOptions): Promise<{
  origin: string;
  token: string;
}> {
  const store = await readStore();
  const environmentToken = process.env.MICROFEED_API_KEY?.trim();
  if (environmentToken) {
    const selected = options.instance || process.env.MICROFEED_INSTANCE || store.current;
    const siteUrlFromEnvironment = process.env.MICROFEED_URL?.trim();
    const origin = siteUrlFromEnvironment
      ? normalizeOrigin(siteUrlFromEnvironment)
      : selected && store.instances[selected]?.origin;
    if (!origin) {
      throw new CliError(
        "MICROFEED_API_KEY is set, but no site URL is available. Set MICROFEED_URL or select a saved instance.",
      );
    }
    return {origin, token: environmentToken};
  }

  const {instance, name} = selectedInstance(store, options.instance);
  let bundle = await decryptTokens(name, instance);
  if (bundle.expiresAt <= Date.now() + 60_000) {
    if (!bundle.refreshToken) {
      throw new CliError(
        `Authentication for “${name}” expired. Run \`yarn microfeed login ${instance.origin} --instance ${name}\`.`,
      );
    }
    const priorRefresh = bundle.refreshToken;
    try {
      bundle = await refreshTokens(instance.tokenEndpoint, priorRefresh);
    } catch {
      throw new CliError(
        `Authentication for “${name}” could not be refreshed. Run \`yarn microfeed login ${instance.origin} --instance ${name}\`.`,
      );
    }
    if (!bundle.refreshToken) bundle.refreshToken = priorRefresh;
    instance.encryptedTokens = await encryptTokens(name, instance.origin, bundle);
    await writeStore(store);
  }
  return {origin: instance.origin, token: bundle.accessToken};
}

export async function apiOrigin(options: GlobalOptions): Promise<string> {
  return (await credentials(options)).origin;
}

export async function publicSiteOrigin(options: GlobalOptions): Promise<string> {
  const environmentUrl = process.env.MICROFEED_URL?.trim();
  if (environmentUrl) return normalizeOrigin(environmentUrl);
  const store = await readStore();
  return selectedInstance(store, options.instance).instance.origin;
}

function responseBody(text: string, contentType: string | null): unknown {
  if (!text) return null;
  if (contentType?.includes("json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
  return text;
}

export async function apiRequest(
  method: string,
  relativePath: string,
  options: GlobalOptions,
  request?: {body?: string; headers?: string[]},
): Promise<ApiResponse> {
  if (!relativePath.startsWith(API_PATH_PREFIX) || relativePath.startsWith("//")) {
    throw new CliError("API paths must be relative and begin with /api/v1/.");
  }
  const {origin, token} = await credentials(options);
  const target = new URL(relativePath, origin);
  if (target.origin !== origin || !target.pathname.startsWith(API_PATH_PREFIX)) {
    throw new CliError("The API path cannot change the selected site URL.");
  }
  const headers = new Headers({
    accept: "application/json",
    authorization: `Bearer ${token}`,
  });
  for (const header of request?.headers ?? []) {
    const separator = header.indexOf(":");
    if (separator <= 0) throw new CliError(`Invalid header: ${header}`);
    const name = header.slice(0, separator).trim();
    const value = header.slice(separator + 1).trim();
    if (BLOCKED_HEADERS.has(name.toLowerCase())) {
      throw new CliError(`The ${name} header is managed by microfeed and cannot be supplied.`);
    }
    headers.append(name, value);
  }
  if ((request?.body !== undefined || method.toUpperCase() === "DELETE") &&
      !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(target, {
    body: request?.body,
    headers,
    method,
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) {
    throw new CliError("The API returned a redirect. Credentials were not forwarded.");
  }
  const text = await response.text();
  const safeHeaders: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    if (SAFE_RESPONSE_HEADERS.has(name.toLowerCase())) safeHeaders[name] = value;
  });
  return {
    body: responseBody(text, response.headers.get("content-type")),
    headers: safeHeaders,
    ok: response.ok,
    status: response.status,
  };
}

export function writeApiResponse(response: ApiResponse, json: boolean): void {
  if (json) {
    const output = response.status === 404
      ? {...response, recovery: API_NOT_FOUND_RECOVERY}
      : response;
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } else if (typeof response.body === "string") {
    process.stdout.write(response.body);
    if (response.body && !response.body.endsWith("\n")) process.stdout.write("\n");
  } else if (response.body !== null) {
    process.stdout.write(`${JSON.stringify(response.body, null, 2)}\n`);
  }
  if (!response.ok) {
    const diagnostic = response.status === 404
      ? [
        `microfeed API request failed (${response.status}).`,
        API_NOT_FOUND_RECOVERY.message,
        ...API_NOT_FOUND_RECOVERY.instructions,
        `Guide: ${API_NOT_FOUND_RECOVERY.documentationUrl}`,
      ].join("\n")
      : `microfeed API request failed (${response.status}).`;
    process.stderr.write(`${diagnostic}\n`);
    process.exitCode = 1;
  }
}

export async function currentTokenBundle(
  instanceName: string,
): Promise<{bundle: TokenBundle; instance: SavedInstance}> {
  const store = await readStore();
  const instance = store.instances[instanceName];
  if (!instance) throw new CliError(`Unknown saved instance: ${instanceName}`);
  return {bundle: await decryptTokens(instanceName, instance), instance};
}
