const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) =>
    character.charCodeAt(0)
  );
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) =>
    character.charCodeAt(0)
  );
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const bytes = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptWebhookSecret(
  plaintext: string,
  encryptionSecret: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {name: "AES-GCM", iv},
    await encryptionKey(encryptionSecret),
    textEncoder.encode(plaintext),
  );
  return JSON.stringify({
    ciphertext: base64UrlEncode(new Uint8Array(ciphertext)),
    iv: base64UrlEncode(iv),
    version: 1,
  });
}

export async function decryptWebhookSecret(
  encrypted: string,
  encryptionSecret: string,
): Promise<string> {
  const parsed = JSON.parse(encrypted) as Record<string, unknown>;
  if (
    parsed.version !== 1 || typeof parsed.iv !== "string" ||
    typeof parsed.ciphertext !== "string"
  ) {
    throw new Error("Unsupported webhook secret encryption format.");
  }
  const plaintext = await crypto.subtle.decrypt(
    {name: "AES-GCM", iv: arrayBuffer(base64UrlDecode(parsed.iv))},
    await encryptionKey(encryptionSecret),
    arrayBuffer(base64UrlDecode(parsed.ciphertext)),
  );
  return textDecoder.decode(plaintext);
}

export function generateWebhookSecret(): string {
  return `whsec_${base64Encode(crypto.getRandomValues(new Uint8Array(32)))}`;
}

function signingSecretBytes(secret: string): Uint8Array {
  if (!secret.startsWith("whsec_")) {
    throw new Error("Webhook signing secrets must start with whsec_.");
  }
  return base64Decode(secret.slice("whsec_".length));
}

export async function standardWebhookSignature(
  secret: string,
  deliveryId: string,
  timestamp: number,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    arrayBuffer(signingSecretBytes(secret)),
    {hash: "SHA-256", name: "HMAC"},
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(`${deliveryId}.${timestamp}.${payload}`),
  );
  return `v1,${base64Encode(new Uint8Array(signature))}`;
}
