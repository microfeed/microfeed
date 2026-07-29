import {mediaPrefix} from "@/server/media/R2Utils";
import type {SignedUpload, UploadRequest} from "@/types";

export const UPLOAD_TTL_SECONDS = 15 * 60;

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function normalizeObjectKey(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/^\/+/u, "");
  if (
    !normalized ||
    normalized.length > 1024 ||
    normalized.includes("\\") ||
    normalized.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    return null;
  }
  return normalized;
}

function signingPayload(
  objectKey: string,
  expires: number,
  contentType: string,
  size: string,
): string {
  return `PUT\n${objectKey}\n${expires}\n${contentType}\n${size}`;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {hash: "SHA-256", name: "HMAC"},
    false,
    ["sign", "verify"],
  );
}

export async function createSignedUpload(
  request: Request,
  runtimeEnv: Env,
  input: UploadRequest,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<SignedUpload> {
  const key = normalizeObjectKey(input.key);
  if (!key) {
    throw new Error("Invalid media object key.");
  }

  const mediaBaseUrl = mediaPrefix(runtimeEnv, request.url);
  const objectKey = `${mediaBaseUrl}/${key}`;
  const expires = nowSeconds + UPLOAD_TTL_SECONDS;
  const contentType = input.type?.slice(0, 255) ?? "";
  const size = input.size === undefined ? "" : String(input.size);
  if (
    size &&
    (
      !Number.isSafeInteger(input.size) ||
      (input.size ?? -1) < 0
    )
  ) {
    throw new Error("Invalid media object size.");
  }
  const signingKey = await importSigningKey(runtimeEnv.UPLOAD_SIGNING_KEY);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      signingKey,
      encoder.encode(signingPayload(objectKey, expires, contentType, size)),
    ),
  );
  const encodedPath = objectKey
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const uploadUrl = new URL(`/media-upload/${encodedPath}`, request.url);
  uploadUrl.searchParams.set("expires", String(expires));
  uploadUrl.searchParams.set("signature", bytesToBase64Url(signature));
  if (contentType) {
    uploadUrl.searchParams.set("content-type", contentType);
  }
  if (size) {
    uploadUrl.searchParams.set("size", size);
  }

  return {
    mediaBaseUrl,
    presignedUrl: uploadUrl.toString(),
  };
}

export async function verifySignedUpload(
  objectKey: string,
  expiresValue: string | null,
  signatureValue: string | null,
  secret: string,
  contentType = "",
  nowSeconds = Math.floor(Date.now() / 1000),
  sizeValue = "",
): Promise<boolean> {
  const expires = Number(expiresValue);
  const size = Number(sizeValue);
  const signature = signatureValue ? decodeBase64Url(signatureValue) : null;
  if (
    !Number.isSafeInteger(expires) ||
    (
      sizeValue !== "" &&
      (!Number.isSafeInteger(size) || size < 0)
    ) ||
    !signature ||
    expires < nowSeconds ||
    expires > nowSeconds + UPLOAD_TTL_SECONDS
  ) {
    return false;
  }

  const signingKey = await importSigningKey(secret);
  return crypto.subtle.verify(
    "HMAC",
    signingKey,
    signature as unknown as BufferSource,
    encoder.encode(signingPayload(objectKey, expires, contentType, sizeValue)),
  );
}
