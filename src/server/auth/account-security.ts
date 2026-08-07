const OAUTH_CONNECTION_COOKIE = "microfeed.oauth_connection";
const PASSKEY_STEP_UP_COOKIE = "microfeed.passkey_step_up";
const OAUTH_CONNECTION_MAX_AGE_SECONDS = 10 * 60;
const PASSKEY_STEP_UP_MAX_AGE_SECONDS = 5 * 60;

export type PasskeyStepUpAction = "add" | "delete";

export interface OAuthConnectionHandoff {
  connectionId: string;
  connectionName: string;
}

interface SignedEnvelope<T> {
  expiresAt: number;
  value: T;
}

interface PasskeyStepUpValue {
  action: PasskeyStepUpAction;
  passkeyId?: string;
  userId: string;
}

function base64UrlEncode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + (4 - normalized.length % 4) % 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signature(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {hash: "SHA-256", name: "HMAC"},
    false,
    ["sign"],
  );
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  )));
}

async function signedValue<T>(
  secret: string,
  value: T,
  maxAgeSeconds: number,
): Promise<string> {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    expiresAt: Date.now() + maxAgeSeconds * 1000,
    value,
  } satisfies SignedEnvelope<T>)));
  return `${payload}.${await signature(secret, payload)}`;
}

async function verifiedValue<T>(
  secret: string,
  encoded: string | undefined,
): Promise<T | null> {
  if (!encoded) return null;
  const [payload, providedSignature, ...rest] = encoded.split(".");
  if (!payload || !providedSignature || rest.length) return null;
  const expectedSignature = await signature(secret, payload);
  if (providedSignature.length !== expectedSignature.length) return null;
  let difference = 0;
  for (let index = 0; index < expectedSignature.length; index += 1) {
    difference |= providedSignature.charCodeAt(index) ^
      expectedSignature.charCodeAt(index);
  }
  if (difference !== 0) return null;
  try {
    const envelope = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payload)),
    ) as SignedEnvelope<T>;
    return envelope.expiresAt > Date.now() ? envelope.value : null;
  } catch {
    return null;
  }
}

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

function serializedCookie(
  request: Request,
  name: string,
  value: string,
  maxAgeSeconds: number,
  path: string,
): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=${path}; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Strict${secure}`;
}

export function clearOAuthConnectionCookie(request: Request): string {
  return serializedCookie(request, OAUTH_CONNECTION_COOKIE, "", 0, "/");
}

export function clearPasskeyStepUpCookie(request: Request): string {
  return serializedCookie(
    request,
    PASSKEY_STEP_UP_COOKIE,
    "",
    0,
    "/api/auth/passkey/",
  );
}

export function normalizeConnectionName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const length = Array.from(normalized).length;
  return length >= 1 && length <= 64 && !/[\p{Cc}\p{Cf}]/u.test(normalized)
    ? normalized
    : null;
}

export function validConnectionId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export async function createOAuthConnectionCookie(
  request: Request,
  secret: string,
  handoff: OAuthConnectionHandoff,
): Promise<string> {
  return serializedCookie(
    request,
    OAUTH_CONNECTION_COOKIE,
    await signedValue(secret, handoff, OAUTH_CONNECTION_MAX_AGE_SECONDS),
    OAUTH_CONNECTION_MAX_AGE_SECONDS,
    "/",
  );
}

export async function oauthConnectionHandoff(
  request: Request,
  secret: string,
): Promise<OAuthConnectionHandoff | null> {
  const value = await verifiedValue<OAuthConnectionHandoff>(
    secret,
    cookieValue(request, OAUTH_CONNECTION_COOKIE),
  );
  return value && validConnectionId(value.connectionId) &&
      normalizeConnectionName(value.connectionName) === value.connectionName
    ? value
    : null;
}

export async function createPasskeyStepUpCookie(
  request: Request,
  secret: string,
  value: PasskeyStepUpValue,
): Promise<string> {
  return serializedCookie(
    request,
    PASSKEY_STEP_UP_COOKIE,
    await signedValue(secret, value, PASSKEY_STEP_UP_MAX_AGE_SECONDS),
    PASSKEY_STEP_UP_MAX_AGE_SECONDS,
    "/api/auth/passkey/",
  );
}

export async function validPasskeyStepUp(
  request: Request,
  secret: string,
  expected: PasskeyStepUpValue,
): Promise<boolean> {
  const value = await verifiedValue<PasskeyStepUpValue>(
    secret,
    cookieValue(request, PASSKEY_STEP_UP_COOKIE),
  );
  return value?.userId === expected.userId &&
    value.action === expected.action &&
    value.passkeyId === expected.passkeyId;
}
