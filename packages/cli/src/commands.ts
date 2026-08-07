import {createInterface} from "node:readline/promises";

import {parseOptions, stringFlag} from "./arguments.js";
import {discoverInstance} from "./discovery.js";
import {CliError} from "./errors.js";
import {
  apiRequest,
  currentTokenBundle,
  type GlobalOptions,
  readInput,
  writeApiResponse,
} from "./http.js";
import {browserLogin, revokeToken} from "./oauth.js";
import {
  encryptTokens,
  readStore,
  writeStore,
} from "./store.js";

const ITEM_VALUE_FLAGS = new Set([
  "content-html",
  "date-published",
  "image",
  "input",
  "status",
  "title",
  "url",
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

export async function loginCommand(args: string[], globals: GlobalOptions): Promise<void> {
  const parsed = parseOptions(args, new Set());
  if (parsed.positionals.length !== 1) {
    throw new CliError("Usage: yarn microfeed login <site-url> [--instance <name>]");
  }
  const discovered = await discoverInstance(parsed.positionals[0]!);
  const name = validateInstanceName(
    globals.instance ?? instanceName(discovered.origin),
  );
  const tokens = await browserLogin(discovered.metadata);
  const store = await readStore();
  store.instances[name] = {
    authorizationEndpoint: discovered.metadata.authorization_endpoint,
    encryptedTokens: await encryptTokens(name, discovered.origin, tokens),
    instanceId: discovered.identity.instanceId,
    issuer: discovered.metadata.issuer,
    origin: discovered.origin,
    tokenEndpoint: discovered.metadata.token_endpoint,
  };
  store.current = name;
  await writeStore(store);
  const result = {instanceId: discovered.identity.instanceId, name, siteUrl: discovered.origin};
  process.stdout.write(globals.json
    ? `${JSON.stringify(result)}\n`
    : `Saved instance “${name}” for ${discovered.origin}.\n`);
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

async function itemBody(parsed: ReturnType<typeof parseOptions>): Promise<string> {
  const input = stringFlag(parsed, "input");
  if (!input) return JSON.stringify(itemPayload(parsed));
  const hasFlags = ["content-html", "date-published", "image", "status", "title", "url"]
    .some((name) => stringFlag(parsed, name) !== undefined);
  if (hasFlags) throw new CliError("Use either --input or item flags, not both.");
  const text = await readInput(input);
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
  } catch {
    throw new CliError("Item input must be a JSON object.");
  }
  return text;
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
    const parsed = parseOptions(rest, new Set(["limit", "next-cursor", "order", "prev-cursor", "sort"]));
    if (parsed.positionals.length) throw new CliError("item list does not accept positional arguments.");
    const query = new URLSearchParams();
    for (const name of ["limit", "next-cursor", "order", "prev-cursor", "sort"]) {
      const value = stringFlag(parsed, name);
      if (value) query.set(name.replaceAll("-", "_"), value);
    }
    const path = `/api/v1/feed/${query.size ? `?${query}` : ""}`;
    writeApiResponse(await apiRequest("GET", path, globals), globals.json);
    return;
  }
  if (action === "get") {
    if (rest.length !== 1) throw new CliError("Usage: yarn microfeed item get <item-id>");
    writeApiResponse(await apiRequest("GET", `/api/v1/items/${encodeURIComponent(rest[0]!)}/`, globals), globals.json);
    return;
  }
  if (action === "create") {
    const parsed = parseOptions(rest, ITEM_VALUE_FLAGS);
    if (parsed.positionals.length) throw new CliError("item create does not accept positional arguments.");
    writeApiResponse(await apiRequest("POST", "/api/v1/items/", globals, {body: await itemBody(parsed)}), globals.json);
    return;
  }
  if (action === "update") {
    const parsed = parseOptions(rest, ITEM_VALUE_FLAGS);
    if (parsed.positionals.length !== 1) throw new CliError("Usage: yarn microfeed item update <item-id> [flags]");
    writeApiResponse(await apiRequest("PUT", `/api/v1/items/${encodeURIComponent(parsed.positionals[0]!)}/`, globals, {body: await itemBody(parsed)}), globals.json);
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
  throw new CliError("Usage: yarn microfeed item list|get|create|update|delete");
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
