import {createHash} from "node:crypto";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {afterEach, describe, expect, it, vi} from "vitest";

import type {ThemeBundleV1, ThemeManifestV1} from "@/shared/themes/ThemeContract";
import {MICROFEED_VERSION} from "@/shared/Version";
import type {CommandRunner, MicrofeedConfig} from "../../../manage-cli/types";

const temporaryDirectories: string[] = [];

const manifest: ThemeManifestV1 = {
  assets: [],
  author: "Theme author",
  files: {
    rssStylesheet: "source/rss.xsl",
    webBodyEnd: "source/end.mustache",
    webBodyStart: "source/start.mustache",
    webFeed: "source/feed.mustache",
    webHeader: "source/header.mustache",
    webItem: "source/item.mustache",
  },
  formatVersion: 1,
  license: "MIT",
  microfeed: "*",
  name: "Active source",
  packageId: "example.active",
  version: "2.3.4",
};

const bundle: ThemeBundleV1 = {
  assets: [],
  rssStylesheet: "<xsl:stylesheet xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\" version=\"1.0\"></xsl:stylesheet>",
  webBodyEnd: "active end",
  webBodyStart: "active start",
  webFeed: "active feed {{title}}",
  webHeader: "active header",
  webItem: "active item {{items.0.title}}",
};

function savedConfig(): MicrofeedConfig {
  return {
    accountId: "account-id",
    adminAuthMode: "built-in",
    adminPath: "admin",
    completedSteps: ["r2-ready"],
    customDomain: "feed.example.test",
    d1: {id: "database-id", name: "feed-db", reuse: false},
    deploymentUrl: "https://feed.example.workers.dev",
    hosting: "cloudflare",
    instanceId: "instance-id",
    instanceName: "personal",
    projectName: "feed",
    r2: {name: "feed-media", reuse: false, setupMode: "automatic"},
  };
}

function d1Response(rows: Array<Record<string, unknown>>): Response {
  return Response.json({
    errors: [],
    result: [{results: rows, success: true}],
    success: true,
  });
}

async function freshModules() {
  const directory = await mkdtemp(path.join(tmpdir(), "microfeed-theme-init-"));
  temporaryDirectories.push(directory);
  process.env.MICROFEED_STATE_DIRECTORY = path.join(directory, "state");
  vi.stubEnv("MICROFEED_INSTANCE", "");
  vi.resetModules();
  const config = await import("../../../manage-cli/lib/config");
  const theme = await import("../../../manage-cli/theme");
  await config.writeConfig(savedConfig());
  return {directory, theme};
}

function commandRunner(): ReturnType<typeof vi.fn<CommandRunner>> {
  return vi.fn<CommandRunner>(async (executable, args) => {
    if (executable === "git") {
      return {exitCode: 0, stderr: "", stdout: "Initialized empty Git repository"};
    }
    expect(args).toContain("token");
    return {
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({token: "oauth-token", type: "oauth"}),
    };
  });
}

afterEach(async () => {
  delete process.env.MICROFEED_STATE_DIRECTORY;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})
  ));
});

describe("theme repository initialization", () => {
  it("installs and activates the bundled default only for pristine initialization", async () => {
    const {theme} = await freshModules();
    const runner = commandRunner();
    let stored: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {params?: unknown[]; sql: string};
      if (request.sql.includes("FROM theme_state") && request.sql.includes("LIMIT 1")) {
        return d1Response([{active_theme_id: null, previous_theme_id: null, updated_at: "2026-08-10"}]);
      }
      if (request.sql.startsWith("SELECT\n    (SELECT count(*) FROM channels)")) {
        return d1Response([{channels: 0, drafts: 0, items: 0, other_themes: 0, settings: 0}]);
      }
      if (request.sql.includes("WHERE package_id = ? AND version = ?")) {
        return d1Response([]);
      }
      if (request.sql.includes("INSERT INTO themes")) {
        const values = request.params!;
        stored = {
          asset_owner_theme_id: values[13],
          bundle_json: values[5],
          checksum_sha256: values[11],
          created_at: "2026-08-10T00:00:00.000Z",
          deleted_at: null,
          id: values[0],
          manifest_json: values[4],
          name: values[3],
          origin_theme_id: values[12],
          package_id: values[1],
          source_commit: values[10],
          source_kind: values[6],
          source_path: values[9],
          source_ref: values[8],
          source_url: values[7],
          version: values[2],
        };
        return d1Response([{id: values[0]}]);
      }
      if (request.sql.includes("SELECT * FROM themes WHERE id = ?")) {
        return d1Response(stored ? [stored] : []);
      }
      if (request.sql.includes("UPDATE theme_state SET active_theme_id")) {
        return d1Response([{active_theme_id: request.params?.[0]}]);
      }
      throw new Error(`Unexpected D1 query: ${request.sql}`);
    }));

    await expect(theme.installDefaultThemeForInitialization(
      savedConfig(),
      runner,
      false,
    )).resolves.toMatchObject({
      packageId: "microfeed.default",
      sourceKind: "bundled",
      sourcePath: "default",
      version: "1.0.2",
    });
    expect(stored).toMatchObject({
      package_id: "microfeed.default",
      source_kind: "bundled",
      source_path: "default",
      version: "1.0.2",
    });
  });

  it("creates a new Git-ready package from the active immutable version", async () => {
    const {directory, theme} = await freshModules();
    const output = path.join(directory, "My Active Theme");
    const runner = commandRunner();
    const assetBytes = new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");
    const assetPath = "assets/logo.svg";
    const activeManifest = {...manifest, assets: [assetPath]};
    const activeBundle = {
      ...bundle,
      assets: [{
        contentType: "image/svg+xml",
        key: "production/themes/active-theme-id/assets/logo.svg",
        path: assetPath,
        sha256: createHash("sha256").update(assetBytes).digest("hex"),
        size: assetBytes.byteLength,
      }],
    };
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      if (String(input).includes("/r2/buckets/feed-media/objects/")) {
        return new Response(assetBytes, {headers: {"content-type": "image/svg+xml"}});
      }
      const request = JSON.parse(String(init?.body)) as {sql: string};
      if (request.sql.includes("sqlite_master")) {
        return d1Response([{name: "themes"}, {name: "theme_state"}]);
      }
      if (request.sql.includes("FROM theme_state")) {
        return d1Response([{
          asset_owner_theme_id: null,
          bundle_json: JSON.stringify(activeBundle),
          checksum_sha256: "a".repeat(64),
          created_at: "2026-08-10T00:00:00.000Z",
          deleted_at: null,
          id: "active-theme-id",
          manifest_json: JSON.stringify(activeManifest),
          name: manifest.name,
          origin_theme_id: null,
          package_id: manifest.packageId,
          requested_active_theme_id: "active-theme-id",
          source_commit: "b".repeat(40),
          source_kind: "github",
          source_path: null,
          source_ref: "main",
          source_url: "https://github.com/example/active",
          version: manifest.version,
        }]);
      }
      if (request.sql.includes("FROM settings")) {
        return d1Response([{data: "{}"}]);
      }
      throw new Error(`Unexpected D1 query: ${request.sql}`);
    }));
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await theme.themeCommand({
      action: "init",
      instance: "personal",
      output,
      json: true,
    }, runner);

    const initializedManifest = JSON.parse(
      await readFile(path.join(output, "microfeed-theme.json"), "utf8"),
    ) as ThemeManifestV1;
    expect(initializedManifest).toMatchObject({
      author: "Site owner",
      license: "MIT",
      packageId: "local.my-active-theme",
      version: "0.1.0",
    });
    await expect(readFile(path.join(output, "web-feed.mustache"), "utf8"))
      .resolves.toBe("active feed {{title}}\n");
    const initializedPackage = JSON.parse(
      await readFile(path.join(output, "package.json"), "utf8"),
    ) as {devDependencies?: Record<string, string>};
    expect(initializedPackage.devDependencies?.["@microfeed/theme-kit"])
      .toBe(`^${MICROFEED_VERSION}`);
    await expect(readFile(
      path.join(output, ".agents/skills/develop-microfeed-theme/SKILL.md"),
      "utf8",
    )).resolves.toContain("Never create screenshots unless the user explicitly asks");
    await expect(readFile(path.join(output, assetPath), "utf8"))
      .resolves.toContain("<svg");
    expect(runner).toHaveBeenCalledWith(
      "git",
      ["init", "--initial-branch", "main"],
      {cwd: output},
    );
    const result = JSON.parse(stdout.mock.calls.flat().join("")) as {
      source: {kind: string; packageId: string; themeId: string};
    };
    expect(result.source).toMatchObject({
      kind: "installed",
      packageId: "example.active",
      themeId: "active-theme-id",
    });
  });

  it("can fork the selected theme from a pre-versioning instance", async () => {
    const {directory, theme} = await freshModules();
    const output = path.join(directory, "legacy-fork");
    const runner = commandRunner();
    vi.stubGlobal("fetch", vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {sql: string};
      if (request.sql.includes("sqlite_master")) return d1Response([]);
      if (request.sql.includes("FROM settings")) {
        return d1Response([{data: JSON.stringify({
          currentTheme: "Owner Classic",
          themes: {"Owner Classic": {webFeed: "legacy active feed"}},
        })}]);
      }
      throw new Error(`Unexpected D1 query: ${request.sql}`);
    }));
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await theme.themeCommand({
      action: "init",
      instance: "personal",
      output,
      "no-git": true,
      json: true,
    }, runner);

    await expect(readFile(path.join(output, "web-feed.mustache"), "utf8"))
      .resolves.toBe("legacy active feed\n");
    const result = JSON.parse(stdout.mock.calls.flat().join("")) as {
      gitInitialized: boolean;
      source: {kind: string; packageId: string};
    };
    expect(result).toMatchObject({
      gitInitialized: false,
      source: {kind: "legacy", packageId: "legacy.owner-classic"},
    });
    expect(runner).not.toHaveBeenCalledWith("git", expect.anything(), expect.anything());
  });
});
