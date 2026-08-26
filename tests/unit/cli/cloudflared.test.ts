import {createHash} from "node:crypto";
import {chmod, mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {gzipSync} from "node:zlib";

import {afterEach, describe, expect, it} from "vitest";

import {
  cachedCloudflaredPath,
  cloudflaredAsset,
  cloudflaredCacheDirectory,
  cloudflaredQuickTunnelUrl,
  downloadCloudflared,
  extractCloudflaredTgz,
  findCloudflaredOnPath,
  resolveCloudflared,
  startCloudflaredQuickTunnel,
  type CloudflaredAsset,
} from "../../../packages/cli/src/cloudflared";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(name: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), name));
  temporaryDirectories.push(directory);
  return directory;
}

function tgzWithExecutable(content: Buffer): Buffer {
  const header = Buffer.alloc(512);
  header.write("release/cloudflared", 0, "utf8");
  header.write(`${content.length.toString(8).padStart(11, "0")}\0`, 124, "ascii");
  header[156] = 48;
  const padding = Buffer.alloc(Math.ceil(content.length / 512) * 512 - content.length);
  return gzipSync(Buffer.concat([header, content, padding, Buffer.alloc(1_024)]));
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})
  ));
});

describe("cloudflared helper resolution", () => {
  it("uses platform-specific app cache directories", () => {
    expect(cloudflaredCacheDirectory(
      {MICROFEED_CACHE_DIR: "/custom/cache"},
      "linux",
      "/home/person",
    )).toBe(path.resolve("/custom/cache", "cloudflared"));
    expect(cloudflaredCacheDirectory({}, "darwin", "/Users/person"))
      .toBe("/Users/person/Library/Caches/microfeed/cloudflared");
    expect(cloudflaredCacheDirectory({}, "linux", "/home/person"))
      .toBe("/home/person/.cache/microfeed/cloudflared");
    expect(cloudflaredCacheDirectory(
      {LOCALAPPDATA: "C:\\Users\\person\\AppData\\Local"},
      "win32",
      "C:\\Users\\person",
    )).toContain(path.join("microfeed", "cloudflared"));
  });

  it("maps supported assets and rejects unsupported platforms", () => {
    expect(cloudflaredAsset("darwin", "arm64")).toMatchObject({
      archive: "tgz",
      name: "cloudflared-darwin-arm64.tgz",
    });
    expect(cloudflaredAsset("linux", "x64")).toMatchObject({
      archive: "binary",
      name: "cloudflared-linux-amd64",
    });
    expect(() => cloudflaredAsset("freebsd", "x64"))
      .toThrow(/not available for freebsd\/x64/u);
  });

  it("prefers an installed executable and then the verified cache", async () => {
    const directory = await temporaryDirectory("microfeed-cloudflared-path-");
    const installed = path.join(directory, "cloudflared");
    await writeFile(installed, "#!/bin/sh\n", {mode: 0o700});
    await chmod(installed, 0o700);
    await expect(findCloudflaredOnPath({
      environment: {PATH: directory},
      platform: "linux",
    })).resolves.toBe(installed);
    await expect(resolveCloudflared({
      architecture: "x64",
      cacheDirectory: path.join(directory, "cache"),
      environment: {PATH: directory},
      platform: "linux",
    })).resolves.toEqual({path: installed, source: "path"});

    await rm(installed);
    const cached = cachedCloudflaredPath({
      architecture: "x64",
      cacheDirectory: path.join(directory, "cache"),
      platform: "linux",
    });
    await mkdir(path.dirname(cached), {recursive: true});
    await writeFile(cached, "cached", {flag: "wx", mode: 0o700});
    await expect(resolveCloudflared({
      architecture: "x64",
      cacheDirectory: path.join(directory, "cache"),
      confirmDownload: async () => {
        throw new Error("should not prompt");
      },
      environment: {PATH: ""},
      platform: "linux",
    })).resolves.toEqual({path: cached, source: "cache"});
  });

  it("requires explicit approval before downloading", async () => {
    const directory = await temporaryDirectory("microfeed-cloudflared-decline-");
    await expect(resolveCloudflared({
      architecture: "x64",
      cacheDirectory: directory,
      confirmDownload: async () => false,
      environment: {PATH: ""},
      platform: "linux",
    })).rejects.toThrow(/--install-cloudflared/u);
  });
});

describe("cloudflared verified download", () => {
  it("extracts the executable from a verified Darwin tgz", async () => {
    const executable = Buffer.from("darwin cloudflared executable");
    await expect(extractCloudflaredTgz(tgzWithExecutable(executable)))
      .resolves.toEqual(executable);
  });

  it("verifies SHA-256 before caching a downloaded executable", async () => {
    const directory = await temporaryDirectory("microfeed-cloudflared-download-");
    const executable = Buffer.from("test cloudflared executable");
    const asset: CloudflaredAsset = {
      archive: "binary",
      name: "cloudflared-test",
      sha256: createHash("sha256").update(executable).digest("hex"),
    };
    const fetcher = async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://downloads.example/cloudflared-test");
      return new Response(executable);
    };
    const installed = await downloadCloudflared({
      architecture: "x64",
      asset,
      cacheDirectory: directory,
      fetcher: fetcher as typeof fetch,
      platform: "linux",
      releaseBaseUrl: "https://downloads.example",
    });
    expect(await readFile(installed)).toEqual(executable);
  });

  it("fails closed when a downloaded digest does not match", async () => {
    const directory = await temporaryDirectory("microfeed-cloudflared-digest-");
    await expect(downloadCloudflared({
      architecture: "x64",
      asset: {
        archive: "binary",
        name: "cloudflared-test",
        sha256: "0".repeat(64),
      },
      cacheDirectory: directory,
      fetcher: (async () => new Response("changed")) as typeof fetch,
      platform: "linux",
      releaseBaseUrl: "https://downloads.example",
    })).rejects.toThrow(/failed SHA-256 verification/u);
  });
});

describe("cloudflared Quick Tunnel lifecycle", () => {
  it("recognizes only temporary trycloudflare HTTPS URLs", () => {
    expect(cloudflaredQuickTunnelUrl(
      "INF Your quick Tunnel has been created! Visit it at https://First-Test.trycloudflare.com",
    )).toBe("https://first-test.trycloudflare.com");
    expect(cloudflaredQuickTunnelUrl("https://example.com")).toBeUndefined();
  });

  it("starts a helper, returns /webhook, and stops the child", async () => {
    const directory = await temporaryDirectory("microfeed-cloudflared-process-");
    const helper = path.join(directory, "fake-cloudflared");
    await writeFile(helper, [
      "#!/usr/bin/env node",
      "const expected = ['tunnel', '--url', 'http://127.0.0.1:8978', '--no-autoupdate'];",
      "if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(expected)) process.exit(2);",
      "process.stderr.write('Quick Tunnel: https://unit-test.trycloudflare.com\\n');",
      "setInterval(() => undefined, 1000);",
      "",
    ].join("\n"), {mode: 0o700});
    await chmod(helper, 0o700);
    const tunnel = await startCloudflaredQuickTunnel({
      executablePath: helper,
      port: 8978,
      startupTimeoutMs: 2_000,
    });
    expect(tunnel.publicEndpointUrl)
      .toBe("https://unit-test.trycloudflare.com/webhook");
    await tunnel.stop();
    await expect(tunnel.exited).resolves.toMatchObject({signal: "SIGTERM"});
  });

  it("terminates a helper that never produces a tunnel URL", async () => {
    const directory = await temporaryDirectory("microfeed-cloudflared-timeout-");
    const helper = path.join(directory, "silent-cloudflared");
    await writeFile(helper, [
      "#!/usr/bin/env node",
      "setInterval(() => undefined, 1000);",
      "",
    ].join("\n"), {mode: 0o700});
    await chmod(helper, 0o700);
    await expect(startCloudflaredQuickTunnel({
      executablePath: helper,
      port: 8978,
      startupTimeoutMs: 25,
    })).rejects.toThrow(/within 30 seconds/u);
  });
});
