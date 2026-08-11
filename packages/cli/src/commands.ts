import {createInterface} from "node:readline/promises";
import {randomUUID} from "node:crypto";
import {hostname, platform} from "node:os";

import {parseOptions, stringFlag} from "./arguments.js";
import {discoverInstance} from "./discovery.js";
import {CliError} from "./errors.js";
import {
  apiRequest,
  currentTokenBundle,
  type GlobalOptions,
  type ApiResponse,
  readInput,
  readJsonObjectInput,
  writeApiResponse,
} from "./http.js";
import {browserLogin, revokeToken} from "./oauth.js";
import {
  uploadAttachmentFile,
  uploadImageFile,
  uploadStandaloneMediaFile,
} from "./media.js";
import {
  decryptTokens,
  encryptTokens,
  readStore,
  writeStore,
} from "./store.js";

const ITEM_VALUE_FLAGS = new Set([
  "attachment-file",
  "content-html",
  "date-published",
  "image",
  "image-file",
  "input",
  "status",
  "title",
  "url",
]);
const ITEM_CREATE_VALUE_FLAGS = new Set([
  ...ITEM_VALUE_FLAGS,
  "idempotency-key",
]);

const ITEM_OUTPUT_FIELDS = new Set([
  "attachments",
  "content_html",
  "content_text",
  "date_modified",
  "date_published",
  "id",
  "image",
  "status",
  "title",
  "url",
]);
const DEFAULT_ITEM_SUMMARY_FIELDS = [
  "id",
  "title",
  "status",
  "date_published",
  "date_modified",
  "url",
] as const;

const ITEM_SEARCH_VALUE_FLAGS = new Set([
  "date-published-ms-gt",
  "date-published-ms-lt",
  "fields",
  "limit",
  "next-cursor",
  "status",
]);

function instanceName(siteUrl: string): string {
  return new URL(siteUrl).hostname.toLowerCase().replace(/[^a-z0-9.-]+/gu, "-");
}

function validateInstanceName(name: string): string {
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/iu.test(name)) {
    throw new CliError("Instance names use 1–64 letters, numbers, dots, underscores, or hyphens.");
  }
  return name;
}

function defaultConnectionName(): string {
  const computerName = hostname().trim();
  const length = Array.from(computerName).length;
  return computerName && length <= 64 && !/[\p{Cc}\p{Cf}]/u.test(computerName)
    ? computerName
    : `${platform()} computer`;
}

function validateConnectionName(name: string): string {
  const normalized = name.trim();
  const length = Array.from(normalized).length;
  if (length < 1 || length > 64 || /[\p{Cc}\p{Cf}]/u.test(normalized)) {
    throw new CliError(
      "Connection names must contain 1–64 printable characters.",
    );
  }
  return normalized;
}

function isConnectionId(value: string | undefined): value is string {
  return Boolean(value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value));
}

export async function loginCommand(args: string[], globals: GlobalOptions): Promise<void> {
  const parsed = parseOptions(args, new Set(["connection-name"]));
  if (parsed.positionals.length !== 1) {
    throw new CliError(
      "Usage: yarn microfeed login <site-url> [--instance <local-name>] [--connection-name <computer-name>]",
    );
  }
  const discovered = await discoverInstance(parsed.positionals[0]!);
  const name = validateInstanceName(
    globals.instance ?? instanceName(discovered.origin),
  );
  const store = await readStore();
  const existing = store.instances[name];
  const sameSite = existing?.instanceId === discovered.identity.instanceId &&
    existing.origin === discovered.origin;
  const connectionId = sameSite && isConnectionId(existing.connectionId)
    ? existing.connectionId
    : randomUUID();
  const connectionName = validateConnectionName(
    stringFlag(parsed, "connection-name") ??
      (sameSite ? existing?.connectionName : undefined) ??
      defaultConnectionName(),
  );
  let previousTokens: Awaited<ReturnType<typeof decryptTokens>> | undefined;
  if (existing) {
    previousTokens = await decryptTokens(name, existing).catch(() => undefined);
  }
  const tokens = await browserLogin(discovered.metadata, {
    id: connectionId,
    name: connectionName,
  });
  store.instances[name] = {
    authorizationEndpoint: discovered.metadata.authorization_endpoint,
    connectionId,
    connectionName,
    encryptedTokens: await encryptTokens(name, discovered.origin, tokens),
    instanceId: discovered.identity.instanceId,
    issuer: discovered.metadata.issuer,
    origin: discovered.origin,
    tokenEndpoint: discovered.metadata.token_endpoint,
  };
  store.current = name;
  await writeStore(store);
  if (existing && previousTokens) {
    if (previousTokens.refreshToken) {
      await revokeToken(existing.issuer, previousTokens.refreshToken, "refresh_token");
    } else {
      await revokeToken(existing.issuer, previousTokens.accessToken, "access_token");
    }
  }
  const result = {
    connectionName,
    instanceId: discovered.identity.instanceId,
    name,
    siteUrl: discovered.origin,
  };
  process.stdout.write(globals.json
    ? `${JSON.stringify(result)}\n`
    : `Saved instance “${name}” for ${discovered.origin} on “${connectionName}”.\n`);
}

export async function logoutCommand(globals: GlobalOptions): Promise<void> {
  const store = await readStore();
  const name = globals.instance ?? store.current;
  if (!name || !store.instances[name]) throw new CliError("No matching saved instance was found.");
  const {bundle, instance} = await currentTokenBundle(name);
  if (bundle.refreshToken) await revokeToken(instance.issuer, bundle.refreshToken, "refresh_token");
  else await revokeToken(instance.issuer, bundle.accessToken, "access_token");
  delete store.instances[name];
  if (store.current === name) store.current = Object.keys(store.instances).sort()[0];
  await writeStore(store);
  process.stdout.write(globals.json
    ? `${JSON.stringify({loggedOut: name})}\n`
    : `Logged out and removed saved instance “${name}”.\n`);
}

export async function instancesCommand(args: string[], globals: GlobalOptions): Promise<void> {
  const [action, name, ...rest] = args;
  if (rest.length || !["list", "use", "remove"].includes(action ?? "")) {
    throw new CliError("Usage: yarn microfeed instances list|use|remove [name]");
  }
  const store = await readStore();
  if (action === "list") {
    const instances = Object.entries(store.instances).map(([name, instance]) => ({
      current: store.current === name,
      connectionName: instance.connectionName ?? null,
      instanceId: instance.instanceId,
      name,
      siteUrl: instance.origin,
    }));
    if (globals.json) process.stdout.write(`${JSON.stringify({instances})}\n`);
    else if (!instances.length) process.stdout.write("No saved microfeed instances.\n");
    else for (const instance of instances) {
      process.stdout.write(`${instance.current ? "*" : " "} ${instance.name}\t${instance.siteUrl}\n`);
    }
    return;
  }
  if (!name || !store.instances[name]) throw new CliError(`Unknown saved instance: ${name ?? ""}`);
  if (action === "use") {
    store.current = name;
    await writeStore(store);
    process.stdout.write(globals.json ? `${JSON.stringify({current: name})}\n` : `Using saved instance “${name}”.\n`);
    return;
  }
  delete store.instances[name];
  if (store.current === name) store.current = Object.keys(store.instances).sort()[0];
  await writeStore(store);
  process.stdout.write(globals.json ? `${JSON.stringify({removed: name})}\n` : `Removed saved instance “${name}”.\n`);
}

function itemPayload(parsed: ReturnType<typeof parseOptions>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const mapping: Record<string, string> = {
    "content-html": "content_html",
    "date-published": "date_published",
    image: "image",
    status: "status",
    title: "title",
    url: "url",
  };
  for (const [flag, field] of Object.entries(mapping)) {
    const value = stringFlag(parsed, flag);
    if (value !== undefined) payload[field] = value;
  }
  return payload;
}

async function itemBody(
  parsed: ReturnType<typeof parseOptions>,
  globals: GlobalOptions,
  itemId?: string,
  includeAttachment = true,
): Promise<string> {
  const input = stringFlag(parsed, "input");
  const attachmentFile = stringFlag(parsed, "attachment-file");
  const imageFile = stringFlag(parsed, "image-file");
  const hasFlags = ["attachment-file", "content-html", "date-published", "image", "image-file", "status", "title", "url"]
    .some((name) => stringFlag(parsed, name) !== undefined);
  if (input && hasFlags) {
    throw new CliError("Use either --input or item flags, not both.");
  }
  if (imageFile && stringFlag(parsed, "image")) {
    throw new CliError("Use either --image-file or --image, not both.");
  }
  if (!input) {
    const payload = itemPayload(parsed);
    if (imageFile) {
      payload.image = await uploadImageFile(imageFile, itemId, globals);
    }
    if (attachmentFile && includeAttachment) {
      if (!itemId) {
        throw new CliError("A media attachment upload requires an item ID.");
      }
      payload.attachments = [
        await uploadAttachmentFile(attachmentFile, itemId, globals),
      ];
    }
    return JSON.stringify(payload);
  }
  const text = await readJsonObjectInput(input);
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
  } catch {
    throw new CliError("Item input must be a JSON object.");
  }
  return text;
}

function booleanFlag(
  parsed: ReturnType<typeof parseOptions>,
  name: string,
): boolean {
  return parsed.flags[name] === true;
}

function outputFields(
  parsed: ReturnType<typeof parseOptions>,
  requiredFlag: "summary" | "unwrap",
): readonly string[] | undefined {
  const raw = stringFlag(parsed, "fields");
  if (raw === undefined) return undefined;
  if (!booleanFlag(parsed, requiredFlag)) {
    throw new CliError(`--fields requires --${requiredFlag}.`);
  }
  const fields = [...new Set(raw.split(",").map((field) => field.trim()))];
  if (!fields.length || fields.some((field) => !ITEM_OUTPUT_FIELDS.has(field))) {
    throw new CliError(
      `--fields accepts: ${[...ITEM_OUTPUT_FIELDS].sort().join(",")}.`,
    );
  }
  return fields;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function projectItem(
  item: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  const microfeed = record(item._microfeed);
  for (const field of fields) {
    const value = field === "status"
      ? item.status ?? microfeed?.status
      : item[field];
    if (value !== undefined) projected[field] = value;
  }
  return projected;
}

function feedItems(response: ApiResponse): {
  body: Record<string, unknown>;
  items: Record<string, unknown>[];
} {
  const body = record(response.body);
  const items = body?.items;
  if (!response.ok || !body || !Array.isArray(items) ||
      items.some((item) => !record(item))) {
    throw new CliError("The instance returned an invalid item feed response.");
  }
  return {body, items: items as Record<string, unknown>[]};
}

function summarizeFeed(
  response: ApiResponse,
  fields: readonly string[],
): ApiResponse {
  if (!response.ok) return response;
  const {body, items} = feedItems(response);
  const microfeed = record(body._microfeed);
  const nextUrl = body.next_url ?? microfeed?.next_url;
  const prevUrl = microfeed?.prev_url;
  return {
    ...response,
    body: {
      items: items.map((item) => projectItem(item, fields)),
      ...(nextUrl !== undefined ? {next_url: nextUrl} : {}),
      ...(prevUrl !== undefined ? {prev_url: prevUrl} : {}),
    },
  };
}

function unwrapItem(
  response: ApiResponse,
  fields?: readonly string[],
): ApiResponse {
  if (!response.ok) return response;
  const {items} = feedItems(response);
  if (items.length !== 1) {
    throw new CliError("The instance did not return exactly one item.");
  }
  return {
    ...response,
    body: fields ? projectItem(items[0]!, fields) : items[0],
  };
}

function createdItemId(response: ApiResponse): string | undefined {
  const body = record(response.body);
  return typeof body?.id === "string" ? body.id : undefined;
}

function idempotencyKey(parsed: ReturnType<typeof parseOptions>): string | undefined {
  const key = stringFlag(parsed, "idempotency-key");
  if (key === undefined) return undefined;
  if (key.length < 1 || key.length > 128 || key.trim() !== key ||
      !/^[\x20-\x7e]+$/u.test(key)) {
    throw new CliError(
      "--idempotency-key uses 1–128 printable ASCII characters without surrounding whitespace.",
    );
  }
  return key;
}

async function verifyCreatedItem(
  itemId: string,
  globals: GlobalOptions,
): Promise<ApiResponse> {
  const verified = await apiRequest(
    "GET",
    `/api/v1/items/${encodeURIComponent(itemId)}/`,
    globals,
  );
  if (!verified.ok) {
    throw new CliError(
      `Item ${itemId} was created, but read-back verification failed (${verified.status}).`,
    );
  }
  try {
    return unwrapItem(verified);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid response.";
    throw new CliError(
      `Item ${itemId} was created, but read-back verification failed. ${detail}`,
    );
  }
}

async function confirmDelete(itemId: string, confirmation?: string): Promise<void> {
  if (confirmation === itemId) return;
  if (confirmation !== undefined) throw new CliError(`--confirm must exactly match ${itemId}.`);
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError(`Deletion requires --confirm ${itemId} in non-interactive use.`);
  }
  const prompt = createInterface({input: process.stdin, output: process.stdout});
  const answer = await prompt.question(`Delete item ${itemId}? Type the item ID to confirm: `);
  prompt.close();
  if (answer.trim() !== itemId) throw new CliError("Item deletion cancelled.");
}

export async function itemCommand(args: string[], globals: GlobalOptions): Promise<void> {
  const [action, ...rest] = args;
  if (action === "list") {
    const parsed = parseOptions(
      rest,
      new Set(["fields", "limit", "next-cursor", "order", "prev-cursor", "sort"]),
      new Set(["summary"]),
    );
    if (parsed.positionals.length) throw new CliError("item list does not accept positional arguments.");
    const fields = outputFields(parsed, "summary");
    const query = new URLSearchParams();
    for (const name of ["limit", "next-cursor", "order", "prev-cursor", "sort"]) {
      const value = stringFlag(parsed, name);
      if (value) query.set(name.replaceAll("-", "_"), value);
    }
    const path = `/api/v1/feed/${query.size ? `?${query}` : ""}`;
    const response = await apiRequest("GET", path, globals);
    writeApiResponse(
      booleanFlag(parsed, "summary")
        ? summarizeFeed(
          response,
          fields ?? DEFAULT_ITEM_SUMMARY_FIELDS,
        )
        : response,
      globals.json,
    );
    return;
  }
  if (action === "search") {
    const parsed = parseOptions(rest, ITEM_SEARCH_VALUE_FLAGS);
    if (parsed.positionals.length !== 1) {
      throw new CliError("Usage: yarn microfeed item search <query> [options]");
    }
    const searchQuery = parsed.positionals[0]!.trim();
    if (!searchQuery || Array.from(searchQuery).length > 200) {
      throw new CliError("Search queries must contain 1–200 characters.");
    }
    const query = new URLSearchParams({q: searchQuery});
    for (const name of ITEM_SEARCH_VALUE_FLAGS) {
      const value = stringFlag(parsed, name);
      if (value) query.set(name.replaceAll("-", "_"), value);
    }
    writeApiResponse(
      await apiRequest("GET", `/api/v1/search/?${query}`, globals),
      globals.json,
    );
    return;
  }
  if (action === "get") {
    const parsed = parseOptions(
      rest,
      new Set(["fields"]),
      new Set(["unwrap"]),
    );
    if (parsed.positionals.length !== 1) throw new CliError("Usage: yarn microfeed item get <item-id>");
    const fields = outputFields(parsed, "unwrap");
    const response = await apiRequest("GET", `/api/v1/items/${encodeURIComponent(parsed.positionals[0]!)}/`, globals);
    writeApiResponse(
      booleanFlag(parsed, "unwrap")
        ? unwrapItem(response, fields)
        : response,
      globals.json,
    );
    return;
  }
  if (action === "create") {
    const parsed = parseOptions(
      rest,
      ITEM_CREATE_VALUE_FLAGS,
      new Set(["validate-only", "verify"]),
    );
    if (parsed.positionals.length) throw new CliError("item create does not accept positional arguments.");
    const attachmentFile = stringFlag(parsed, "attachment-file");
    const imageFile = stringFlag(parsed, "image-file");
    const validateOnly = booleanFlag(parsed, "validate-only");
    const verify = booleanFlag(parsed, "verify");
    const retryKey = idempotencyKey(parsed);
    if (validateOnly && (verify || retryKey || attachmentFile || imageFile)) {
      throw new CliError(
        "--validate-only cannot be combined with --verify, --idempotency-key, --attachment-file, or --image-file.",
      );
    }
    const body = await itemBody(parsed, globals, undefined, false);
    if (validateOnly) {
      writeApiResponse(await apiRequest(
        "POST",
        "/api/v1/items/validate/",
        globals,
        {body},
      ), globals.json);
      return;
    }
    const created = await apiRequest("POST", "/api/v1/items/", globals, {
      body,
      headers: retryKey ? [`Idempotency-Key: ${retryKey}`] : undefined,
    });
    if (!created.ok) {
      writeApiResponse(created, globals.json);
      return;
    }
    const itemId = createdItemId(created);
    if (verify && !itemId) {
      throw new CliError(
        "The instance created an item but did not return its item ID, so the requested follow-up could not run.",
      );
    }
    if (!attachmentFile) {
      writeApiResponse(
        verify ? await verifyCreatedItem(itemId!, globals) : created,
        globals.json,
      );
      return;
    }
    if (!itemId) {
      throw new CliError(
        "The instance created an item but did not return its item ID, so the media attachment could not be added.",
      );
    }
    let attachment: Awaited<ReturnType<typeof uploadAttachmentFile>>;
    try {
      attachment = await uploadAttachmentFile(attachmentFile, itemId, globals);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unexpected upload failure.";
      throw new CliError(
        `Item ${itemId} was created, but its media attachment was not added. ${detail}`,
      );
    }
    const updated = await apiRequest(
      "PUT",
      `/api/v1/items/${encodeURIComponent(itemId)}/`,
      globals,
      {body: JSON.stringify({attachments: [attachment]})},
    );
    if (!updated.ok) {
      process.stderr.write(
        `Item ${itemId} was created, but its media attachment could not be saved.\n`,
      );
    }
    writeApiResponse(
      verify && updated.ok
        ? await verifyCreatedItem(itemId, globals)
        : updated,
      globals.json,
    );
    return;
  }
  if (action === "update") {
    const parsed = parseOptions(rest, ITEM_VALUE_FLAGS);
    if (parsed.positionals.length !== 1) throw new CliError("Usage: yarn microfeed item update <item-id> [flags]");
    const itemId = parsed.positionals[0]!;
    writeApiResponse(await apiRequest("PUT", `/api/v1/items/${encodeURIComponent(itemId)}/`, globals, {body: await itemBody(parsed, globals, itemId)}), globals.json);
    return;
  }
  if (action === "delete") {
    const parsed = parseOptions(rest, new Set(["confirm"]));
    if (parsed.positionals.length !== 1) throw new CliError("Usage: yarn microfeed item delete <item-id> [--confirm <item-id>]");
    const itemId = parsed.positionals[0]!;
    await confirmDelete(itemId, stringFlag(parsed, "confirm"));
    writeApiResponse(await apiRequest("DELETE", `/api/v1/items/${encodeURIComponent(itemId)}/`, globals), globals.json);
    return;
  }
  throw new CliError("Usage: yarn microfeed item list|search|get|create|update|delete");
}

export async function mediaCommand(args: string[], globals: GlobalOptions): Promise<void> {
  const [action, ...rest] = args;
  if (action !== "upload") {
    throw new CliError("Usage: yarn microfeed media upload <file> [--item-id <item-id>]");
  }
  const parsed = parseOptions(rest, new Set(["item-id"]));
  if (parsed.positionals.length !== 1) {
    throw new CliError("Usage: yarn microfeed media upload <file> [--item-id <item-id>]");
  }
  const uploaded = await uploadStandaloneMediaFile(
    parsed.positionals[0]!,
    stringFlag(parsed, "item-id"),
    globals,
  );
  process.stdout.write(
    globals.json
      ? `${JSON.stringify(uploaded)}\n`
      : `${uploaded.media_url}\n`,
  );
}

export async function rawApiCommand(args: string[], globals: GlobalOptions): Promise<void> {
  const parsed = parseOptions(args, new Set(["header", "input"]), new Set(), new Set(["header"]));
  if (parsed.positionals.length !== 2) {
    throw new CliError("Usage: yarn microfeed api <method> </api/v1/path> [--input <file|->] [--header <name:value>]");
  }
  const method = parsed.positionals[0]!;
  const path = parsed.positionals[1]!;
  if (!/^[A-Z]+$/u.test(method.toUpperCase())) throw new CliError("Provide a valid HTTP method.");
  const input = stringFlag(parsed, "input");
  const headers = Array.isArray(parsed.flags.header) ? parsed.flags.header : [];
  writeApiResponse(await apiRequest(method.toUpperCase(), path, globals, {
    body: input ? await readInput(input) : undefined,
    headers,
  }), globals.json);
}
