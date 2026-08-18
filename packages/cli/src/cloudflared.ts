import {spawn, type ChildProcess} from "node:child_process";
import {createHash, randomUUID} from "node:crypto";
import {constants as fsConstants} from "node:fs";
import {
  access,
  chmod,
  mkdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import {homedir} from "node:os";
import path from "node:path";
import {createInterface} from "node:readline/promises";
import {promisify} from "node:util";
import {gunzip} from "node:zlib";

import {CliError} from "./errors.js";

type StringEnvironment = Readonly<Record<string, string | undefined>>;

export const CLOUDFLARED_VERSION = "2026.7.3";
const CLOUDFLARED_RELEASE_BASE =
  `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}`;
const CLOUDFLARED_DOWNLOAD_LIMIT = 64 * 1024 * 1024;
const CLOUDFLARED_STARTUP_TIMEOUT_MS = 30_000;
const CLOUDFLARED_STOP_TIMEOUT_MS = 3_000;
const CLOUDFLARED_DOWNLOADS_URL =
  "https://developers.cloudflare.com/tunnel/downloads/";
const CLOUDFLARED_TERMS_URL = "https://www.cloudflare.com/terms/";

export interface CloudflaredAsset {
  archive: "binary" | "tgz";
  name: string;
  sha256: string;
}

// These are GitHub's SHA-256 asset digests for Cloudflare's immutable tagged
// release, not checksum prose copied from the release description.
const CLOUDFLARED_ASSETS: Readonly<Record<string, CloudflaredAsset>> = {
  "darwin-arm64": {
    archive: "tgz",
    name: "cloudflared-darwin-arm64.tgz",
    sha256: "90c5a4f914d705fd70c135dba6d80b1791d254b08d6d4136301941f88330dd09",
  },
  "darwin-x64": {
    archive: "tgz",
    name: "cloudflared-darwin-amd64.tgz",
    sha256: "70d1c8684fa6d14b5843787ec8d1ea8e18b23650e424f4ea43d849a506487c3b",
  },
  "linux-arm64": {
    archive: "binary",
    name: "cloudflared-linux-arm64",
    sha256: "65259e652a7bea08bf5df603233ab22b8bf3116af8df9f9206209af6a1b955c0",
  },
  "linux-x64": {
    archive: "binary",
    name: "cloudflared-linux-amd64",
    sha256: "9d71c677db00134c1bd4144b7783486b654ad281b1ea62b4972098d19f770f17",
  },
  "win32-x64": {
    archive: "binary",
    name: "cloudflared-windows-amd64.exe",
    sha256: "8635da433b6df8194746e88ed9d2589566c20e38bfc2a80e431a348b7c765841",
  },
};

function platformKey(platform: NodeJS.Platform, architecture: string): string {
  return `${platform}-${architecture}`;
}

export function cloudflaredAsset(
  platform: NodeJS.Platform = process.platform,
  architecture: string = process.arch,
): CloudflaredAsset {
  const asset = CLOUDFLARED_ASSETS[platformKey(platform, architecture)];
  if (!asset) {
    throw new CliError(
      `Automatic cloudflared download is not available for ${platform}/${architecture}. ` +
        `Install cloudflared from ${CLOUDFLARED_DOWNLOADS_URL}, then rerun with ` +
        "--tunnel or pass --cloudflared-path <path>.",
    );
  }
  return asset;
}

export function cloudflaredCacheDirectory(
  environment: StringEnvironment = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDirectory: string = homedir(),
): string {
  if (environment.MICROFEED_CACHE_DIR?.trim()) {
    return path.resolve(environment.MICROFEED_CACHE_DIR.trim(), "cloudflared");
  }
  if (platform === "win32") {
    return path.join(
      environment.LOCALAPPDATA?.trim() || path.join(homeDirectory, "AppData", "Local"),
      "microfeed",
      "cloudflared",
    );
  }
  if (platform === "darwin") {
    return path.join(homeDirectory, "Library", "Caches", "microfeed", "cloudflared");
  }
  return path.join(
    environment.XDG_CACHE_HOME?.trim() || path.join(homeDirectory, ".cache"),
    "microfeed",
    "cloudflared",
  );
}

export function cachedCloudflaredPath(input: {
  architecture?: string;
  cacheDirectory?: string;
  platform?: NodeJS.Platform;
} = {}): string {
  const platform = input.platform ?? process.platform;
  const architecture = input.architecture ?? process.arch;
  const executable = platform === "win32" ? "cloudflared.exe" : "cloudflared";
  return path.join(
    input.cacheDirectory ?? cloudflaredCacheDirectory(),
    CLOUDFLARED_VERSION,
    platformKey(platform, architecture),
    executable,
  );
}

async function executableExists(
  filename: string,
  platform: NodeJS.Platform = process.platform,
): Promise<boolean> {
  try {
    await access(
      filename,
      platform === "win32" ? fsConstants.F_OK : fsConstants.X_OK,
    );
    return true;
  } catch {
    return false;
  }
}

export async function findCloudflaredOnPath(input: {
  environment?: StringEnvironment;
  platform?: NodeJS.Platform;
} = {}): Promise<string | undefined> {
  const environment = input.environment ?? process.env;
  const platform = input.platform ?? process.platform;
  const names = platform === "win32"
    ? ["cloudflared.exe", "cloudflared"]
    : ["cloudflared"];
  for (const directory of (environment.PATH ?? "").split(path.delimiter)) {
    if (!directory) continue;
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (await executableExists(candidate, platform)) return candidate;
    }
  }
  return undefined;
}

function tarString(block: Buffer): string {
  const zero = block.indexOf(0);
  return block.subarray(0, zero === -1 ? block.length : zero)
    .toString("utf8").trim();
}

function tarSize(block: Buffer): number {
  const value = tarString(block).replace(/^0+/u, "") || "0";
  if (!/^[0-7]+$/u.test(value)) {
    throw new CliError("The verified cloudflared archive has an invalid tar header.");
  }
  const size = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new CliError("The verified cloudflared archive has an invalid file size.");
  }
  return size;
}

export async function extractCloudflaredTgz(archive: Buffer): Promise<Buffer> {
  let tar: Buffer;
  try {
    tar = await promisify(gunzip)(archive);
  } catch (error) {
    throw new CliError(
      `The verified cloudflared archive could not be decompressed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = tarString(header.subarray(0, 100));
    const prefix = tarString(header.subarray(345, 500));
    const fullName = prefix ? `${prefix}/${name}` : name;
    const size = tarSize(header.subarray(124, 136));
    const start = offset + 512;
    const end = start + size;
    if (end > tar.length) {
      throw new CliError("The verified cloudflared archive is truncated.");
    }
    const type = header[156];
    if ((type === 0 || type === 48) && path.posix.basename(fullName) === "cloudflared") {
      return Buffer.from(tar.subarray(start, end));
    }
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new CliError("The verified cloudflared archive does not contain the cloudflared executable.");
}

async function responseBody(response: Response): Promise<Buffer> {
  if (!response.body) {
    throw new CliError("The cloudflared download returned an empty response.");
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > CLOUDFLARED_DOWNLOAD_LIMIT) {
    throw new CliError("The cloudflared download exceeded the 64 MiB safety limit.");
  }
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let length = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > CLOUDFLARED_DOWNLOAD_LIMIT) {
      await reader.cancel();
      throw new CliError("The cloudflared download exceeded the 64 MiB safety limit.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export async function downloadCloudflared(input: {
  architecture?: string;
  asset?: CloudflaredAsset;
  cacheDirectory?: string;
  fetcher?: typeof fetch;
  platform?: NodeJS.Platform;
  releaseBaseUrl?: string;
} = {}): Promise<string> {
  const platform = input.platform ?? process.platform;
  const architecture = input.architecture ?? process.arch;
  const asset = input.asset ?? cloudflaredAsset(platform, architecture);
  const target = cachedCloudflaredPath({
    architecture,
    cacheDirectory: input.cacheDirectory,
    platform,
  });
  if (await executableExists(target, platform)) return target;

  const response = await (input.fetcher ?? fetch)(
    `${input.releaseBaseUrl ?? CLOUDFLARED_RELEASE_BASE}/${asset.name}`,
    {headers: {accept: "application/octet-stream"}, redirect: "follow"},
  ).catch((error: unknown) => {
    throw new CliError(
      `Could not download cloudflared ${CLOUDFLARED_VERSION}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  });
  if (!response.ok) {
    throw new CliError(
      `Could not download cloudflared ${CLOUDFLARED_VERSION} (${response.status}). ` +
        `Install it from ${CLOUDFLARED_DOWNLOADS_URL} and retry.`,
    );
  }
  const downloaded = await responseBody(response);
  const digest = createHash("sha256").update(downloaded).digest("hex");
  if (digest !== asset.sha256) {
    throw new CliError(
      `cloudflared ${CLOUDFLARED_VERSION} failed SHA-256 verification. ` +
        "Nothing was installed; retry later or install it from Cloudflare's official download page.",
    );
  }
  const executable = asset.archive === "tgz"
    ? await extractCloudflaredTgz(downloaded)
    : downloaded;
  await mkdir(path.dirname(target), {recursive: true, mode: 0o700});
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, executable, {flag: "wx", mode: 0o700});
    await chmod(temporary, 0o700);
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, {force: true});
    if (await executableExists(target, platform)) return target;
    throw new CliError(
      `Could not cache cloudflared at ${target}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return target;
}

async function confirmCloudflaredDownload(target: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stderr.isTTY) return false;
  const prompt = createInterface({input: process.stdin, output: process.stderr});
  try {
    const answer = await prompt.question(
      `cloudflared was not found. Download Cloudflare's official ${
        CLOUDFLARED_VERSION
      } helper (up to 40 MB) to ${target}? Cloudflare's terms apply: ${
        CLOUDFLARED_TERMS_URL
      } [y/N] `,
    );
    return /^(?:y|yes)$/iu.test(answer.trim());
  } finally {
    prompt.close();
  }
}

export interface ResolvedCloudflared {
  path: string;
  source: "cache" | "download" | "explicit" | "path";
}

export async function resolveCloudflared(input: {
  allowDownload?: boolean;
  architecture?: string;
  cacheDirectory?: string;
  confirmDownload?: (target: string) => Promise<boolean>;
  environment?: StringEnvironment;
  explicitPath?: string;
  fetcher?: typeof fetch;
  platform?: NodeJS.Platform;
} = {}): Promise<ResolvedCloudflared> {
  const platform = input.platform ?? process.platform;
  const architecture = input.architecture ?? process.arch;
  if (input.explicitPath) {
    const explicit = path.resolve(input.explicitPath);
    if (!await executableExists(explicit, platform)) {
      throw new CliError(`--cloudflared-path is not an executable file: ${explicit}`);
    }
    return {path: explicit, source: "explicit"};
  }
  const installed = await findCloudflaredOnPath({
    environment: input.environment,
    platform,
  });
  if (installed) return {path: installed, source: "path"};

  const cached = cachedCloudflaredPath({
    architecture,
    cacheDirectory: input.cacheDirectory,
    platform,
  });
  if (await executableExists(cached, platform)) {
    return {path: cached, source: "cache"};
  }
  cloudflaredAsset(platform, architecture);
  const approved = input.allowDownload || await (
    input.confirmDownload ?? confirmCloudflaredDownload
  )(cached);
  if (!approved) {
    throw new CliError(
      "cloudflared is required for --tunnel. Rerun with --install-cloudflared " +
        `to download the verified helper, install it from ${CLOUDFLARED_DOWNLOADS_URL}, ` +
        "or pass --cloudflared-path <path>.",
    );
  }
  process.stderr.write(
    `Downloading cloudflared ${CLOUDFLARED_VERSION} from Cloudflare. ` +
      `Cloudflare's terms apply: ${CLOUDFLARED_TERMS_URL}\n`,
  );
  return {
    path: await downloadCloudflared({
      architecture,
      cacheDirectory: input.cacheDirectory,
      fetcher: input.fetcher,
      platform,
    }),
    source: "download",
  };
}

export function cloudflaredQuickTunnelUrl(output: string): string | undefined {
  const match = output.match(
    /https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.trycloudflare\.com/iu,
  );
  return match?.[0].toLowerCase();
}

export interface CloudflaredQuickTunnel {
  exited: Promise<{code: number | null; error?: Error; signal: NodeJS.Signals | null}>;
  publicEndpointUrl: string;
  stop: () => Promise<void>;
}

export async function startCloudflaredQuickTunnel(input: {
  executablePath: string;
  port: number;
  spawnProcess?: typeof spawn;
  startupTimeoutMs?: number;
}): Promise<CloudflaredQuickTunnel> {
  const child = (input.spawnProcess ?? spawn)(input.executablePath, [
    "tunnel",
    "--url",
    `http://127.0.0.1:${input.port}`,
    "--no-autoupdate",
  ], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let recentOutput = "";
  let resolveStarted!: (url: string) => void;
  let rejectStarted!: (error: Error) => void;
  let started = false;
  const publicUrl = new Promise<string>((resolve, reject) => {
    resolveStarted = resolve;
    rejectStarted = reject;
  });
  let resolveExited!: (result: {
    code: number | null;
    error?: Error;
    signal: NodeJS.Signals | null;
  }) => void;
  const exited = new Promise<{
    code: number | null;
    error?: Error;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    resolveExited = resolve;
  });
  const inspectOutput = (chunk: Buffer | string) => {
    recentOutput = `${recentOutput}${String(chunk)}`.slice(-16_384);
    const url = cloudflaredQuickTunnelUrl(recentOutput);
    if (url && !started) {
      started = true;
      resolveStarted(url);
    }
  };
  child.stdout?.on("data", inspectOutput);
  child.stderr?.on("data", inspectOutput);
  child.once("error", (error) => {
    if (!started) rejectStarted(error);
    resolveExited({code: null, error, signal: null});
  });
  child.once("exit", (code, signal) => {
    if (!started) {
      rejectStarted(new CliError(
        `cloudflared stopped before creating a Quick Tunnel${
          recentOutput.trim() ? `:\n${recentOutput.trim()}` : "."
        }`,
      ));
    }
    resolveExited({code, signal});
  });
  const timeout = setTimeout(() => {
    if (!started) {
      rejectStarted(new CliError(
        "cloudflared did not create a Quick Tunnel within 30 seconds. " +
          "Check the network connection and try again.",
      ));
    }
  }, input.startupTimeoutMs ?? CLOUDFLARED_STARTUP_TIMEOUT_MS);
  let baseUrl: string;
  try {
    baseUrl = await publicUrl;
  } catch (error) {
    await stopChild(child, exited);
    throw error instanceof CliError
      ? error
      : new CliError(
          `Could not start cloudflared: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
  } finally {
    clearTimeout(timeout);
  }
  return {
    exited,
    publicEndpointUrl: new URL("/webhook", `${baseUrl}/`).href,
    stop: () => stopChild(child, exited),
  };
}

async function stopChild(
  child: ChildProcess,
  exited: CloudflaredQuickTunnel["exited"],
): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    await exited;
    return;
  }
  child.kill("SIGTERM");
  const stopped = await Promise.race([
    exited.then(() => true),
    new Promise<false>((resolve) =>
      setTimeout(() => resolve(false), CLOUDFLARED_STOP_TIMEOUT_MS)
    ),
  ]);
  if (!stopped && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}
