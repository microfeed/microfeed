import {createCipheriv, createDecipheriv, randomBytes} from "node:crypto";
import {mkdir, readFile, rename, writeFile} from "node:fs/promises";
import {homedir} from "node:os";
import path from "node:path";

import {CliError} from "./errors.js";
import {encryptionKey} from "./keychain.js";

export interface TokenBundle {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  scope: string;
  tokenType: "Bearer";
}

interface EncryptedBundle {
  algorithm: "aes-256-gcm";
  ciphertext: string;
  iv: string;
  tag: string;
  version: 1;
}

export interface InstanceProfile {
  authorizationEndpoint: string;
  encryptedTokens: EncryptedBundle;
  instanceId: string;
  issuer: string;
  origin: string;
  tokenEndpoint: string;
}

export interface InstanceStore {
  current?: string;
  instances: Record<string, InstanceProfile>;
  version: 1;
}

export function configDirectory(): string {
  if (process.env.MICROFEED_CONFIG_DIR?.trim()) {
    return path.resolve(process.env.MICROFEED_CONFIG_DIR.trim());
  }
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "microfeed");
  }
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config"), "microfeed");
}

export function storePath(): string {
  return path.join(configDirectory(), "instances.json");
}

export async function readStore(): Promise<InstanceStore> {
  try {
    const value: unknown = JSON.parse(await readFile(storePath(), "utf8"));
    if (!value || typeof value !== "object" ||
      (value as {version?: unknown}).version !== 1 ||
      typeof (value as {instances?: unknown}).instances !== "object") {
      throw new Error("unsupported store format");
    }
    return value as InstanceStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {instances: {}, version: 1};
    }
    throw new CliError("Unable to read the microfeed instance store.");
  }
}
export async function writeStore(store: InstanceStore): Promise<void> {
  const directory = configDirectory();
  await mkdir(directory, {recursive: true, mode: 0o700});
  const filename = storePath();
  const temporary = `${filename}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, filename);
}

function additionalData(profile: string, origin: string): Buffer {
  return Buffer.from(`microfeed-cli\0${profile}\0${origin}`, "utf8");
}

export async function encryptTokens(
  profile: string,
  origin: string,
  tokens: TokenBundle,
): Promise<EncryptedBundle> {
  const key = await encryptionKey(true);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(additionalData(profile, origin));
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(tokens), "utf8"),
    cipher.final(),
  ]);
  return {
    algorithm: "aes-256-gcm",
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    version: 1,
  };
}

export async function decryptTokens(
  profile: string,
  instance: InstanceProfile,
): Promise<TokenBundle> {
  const key = await encryptionKey(false);
  try {
    const encrypted = instance.encryptedTokens;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(encrypted.iv, "base64"),
    );
    decipher.setAAD(additionalData(profile, instance.origin));
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext) as TokenBundle;
  } catch {
    throw new CliError(
      `Credentials for instance “${profile}” could not be decrypted. Log in again.`,
    );
  }
}
