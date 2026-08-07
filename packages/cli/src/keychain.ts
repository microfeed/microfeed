import {randomBytes} from "node:crypto";

import {CliError} from "./errors.js";

const SERVICE = "microfeed-cli";
const ACCOUNT = "token-store-encryption-key";

interface KeyringEntry {
  getPassword(): string | null;
  setPassword(password: string): void;
}

export interface Keychain {
  get(): Promise<Buffer | null>;
  set(key: Buffer): Promise<void>;
}

let keychainOverride: Keychain | undefined;

export function setKeychainForTests(keychain?: Keychain): void {
  keychainOverride = keychain;
}

async function nativeEntry(): Promise<KeyringEntry> {
  try {
    const module = await import("@napi-rs/keyring");
    return new module.Entry(SERVICE, ACCOUNT) as KeyringEntry;
  } catch {
    throw new CliError(
      "The OS keychain is unavailable. Install the optional @napi-rs/keyring dependency and ensure your login keychain is unlocked. No credentials were stored.",
    );
  }
}

const nativeKeychain: Keychain = {
  async get() {
    const encoded = (await nativeEntry()).getPassword();
    if (!encoded) return null;
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) {
      throw new CliError("The microfeed keychain entry is invalid. Remove it and log in again.");
    }
    return key;
  },
  async set(key) {
    (await nativeEntry()).setPassword(key.toString("base64"));
  },
};

export async function encryptionKey(create: boolean): Promise<Buffer> {
  const keychain = keychainOverride ?? nativeKeychain;
  const existing = await keychain.get();
  if (existing) return existing;
  if (!create) {
    throw new CliError(
      "The microfeed encryption key is missing from the OS keychain. Log in again; encrypted credentials cannot be read without it.",
    );
  }
  const key = randomBytes(32);
  await keychain.set(key);
  return key;
}
