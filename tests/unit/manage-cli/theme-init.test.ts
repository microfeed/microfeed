import {createHash} from "node:crypto";
import {execFile} from "node:child_process";
import {mkdtemp, readFile, readdir, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {promisify} from "node:util";

import {afterEach, describe, expect, it, vi} from "vitest";

import type {ThemeBundleV1, ThemeManifestV1} from "@/shared/themes/ThemeContract";
import {themeKitCompatibilityRange} from "@/shared/ThemeKitVersion";
import {
  MICROFEED_PACKAGE_MANAGER,
  MICROFEED_VERSION,
} from "@/shared/Version";
import type {CommandRunner, MicrofeedConfig} from "../../../manage-cli/types";

const temporaryDirectories: string[] = [];
const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

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
  it("reserves microfeed package IDs while defaulting user forks to local IDs", async () => {
    const {theme} = await freshModules();
    const source = {
      assetOwnerThemeId: null,
      bundle,
      checksumSha256: null,
      fallbackReason: null,
      kind: "installed" as const,
      manifest,
      themeId: "source-theme",
    };
    expect(theme.initializedThemeManifest(
      source,
      "/tmp/my-theme",
    ).packageId).toBe("local.my-theme");
    expect(() => theme.initializedThemeManifest(
      source,
      "/tmp/my-theme",
      {packageId: "microfeed.my-theme"},
    )).toThrow("reserved for bundled microfeed themes");
    expect(theme.initializedThemeManifest(
      source,
      "/tmp/my-theme",
      {packageId: "org.example.my-theme"},
    ).packageId).toBe("org.example.my-theme");

    await expect(theme.themeCommand({
      action: "install",
      instance: "personal",
      local: true,
      source: path.join(repositoryRoot, "themes/default"),
    }, commandRunner())).rejects.toThrow(
      "reserved for bundled microfeed themes",
    );
  });

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
      version: "1.1.10",
    });
    expect(stored).toMatchObject({
      package_id: "microfeed.default",
      source_kind: "bundled",
      source_path: "default",
      version: "1.1.10",
    });
  });

  it(
    "idempotently installs the bundled v2 default without activating it for a v1 appearance",
    async () => {
      const {theme} = await freshModules();
      const runner = commandRunner();
      const queries: string[] = [];
      let stored: Record<string, unknown> | null = null;
      const active = {
        asset_owner_theme_id: null,
        bundle_json: JSON.stringify(bundle),
        checksum_sha256: "a".repeat(64),
        created_at: "2026-08-10T00:00:00.000Z",
        deleted_at: null,
        id: "active-v1-theme",
        manifest_json: JSON.stringify(manifest),
        name: manifest.name,
        origin_theme_id: null,
        package_id: manifest.packageId,
        requested_active_theme_id: "active-v1-theme",
        source_commit: null,
        source_kind: "migration",
        source_path: null,
        source_ref: null,
        source_url: null,
        version: manifest.version,
      };
      vi.stubGlobal("fetch", vi.fn(async (
        _input: URL | RequestInfo,
        init?: RequestInit,
      ) => {
        const request = JSON.parse(String(init?.body)) as {
          params?: unknown[];
          sql: string;
        };
        queries.push(request.sql);
        if (request.sql.includes("sqlite_master")) {
          return d1Response([{name: "themes"}, {name: "theme_state"}]);
        }
        if (
          request.sql.includes("FROM theme_state") &&
          request.sql.includes("LEFT JOIN themes")
        ) {
          return d1Response([active]);
        }
        if (request.sql.includes("FROM settings")) {
          return d1Response([]);
        }
        if (request.sql.includes("WHERE package_id = ? AND version = ?")) {
          return d1Response(stored ? [stored] : []);
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
        throw new Error(`Unexpected D1 query: ${request.sql}`);
      }));

      await expect(theme.installDefaultThemeForV1Appearance(
        savedConfig(),
        runner,
        false,
      )).resolves.toMatchObject({
        packageId: "microfeed.default",
        sourceKind: "bundled",
        version: "1.1.10",
      });
      await expect(theme.installDefaultThemeForV1Appearance(
        savedConfig(),
        runner,
        false,
      )).resolves.toMatchObject({
        packageId: "microfeed.default",
        version: "1.1.10",
      });
      expect(stored).toMatchObject({
        package_id: "microfeed.default",
        source_kind: "bundled",
        version: "1.1.10",
      });
      expect(queries.filter((sql) => sql.includes("INSERT INTO themes")))
        .toHaveLength(1);
      expect(queries.some((sql) => sql.includes("UPDATE theme_state")))
        .toBe(false);
    },
  );

  it(
    "does not install another default when the effective theme is already v2",
    async () => {
      const {theme} = await freshModules();
      const runner = commandRunner();
      const queries: string[] = [];
      const v2Manifest = {
        ...manifest,
        files: {
          ...manifest.files,
          webPage: "source/page.mustache",
          webSearch: "source/search.mustache",
        },
        formatVersion: 2 as const,
      };
      const v2Bundle = {
        ...bundle,
        webPage: "page {{page.title}}",
        webSearch: "search {{search.query}}",
      };
      vi.stubGlobal("fetch", vi.fn(async (
        _input: URL | RequestInfo,
        init?: RequestInit,
      ) => {
        const request = JSON.parse(String(init?.body)) as {sql: string};
        queries.push(request.sql);
        if (request.sql.includes("sqlite_master")) {
          return d1Response([{name: "themes"}, {name: "theme_state"}]);
        }
        if (
          request.sql.includes("FROM theme_state") &&
          request.sql.includes("LEFT JOIN themes")
        ) {
          return d1Response([{
            asset_owner_theme_id: null,
            bundle_json: JSON.stringify(v2Bundle),
            checksum_sha256: "a".repeat(64),
            created_at: "2026-08-10T00:00:00.000Z",
            deleted_at: null,
            id: "active-v2-theme",
            manifest_json: JSON.stringify(v2Manifest),
            name: v2Manifest.name,
            origin_theme_id: null,
            package_id: v2Manifest.packageId,
            requested_active_theme_id: "active-v2-theme",
            source_commit: null,
            source_kind: "github",
            source_path: null,
            source_ref: "main",
            source_url: "https://github.com/example/active",
            version: v2Manifest.version,
          }]);
        }
        if (request.sql.includes("FROM settings")) {
          return d1Response([]);
        }
        throw new Error(`Unexpected D1 query: ${request.sql}`);
      }));

      await expect(theme.installDefaultThemeForV1Appearance(
        savedConfig(),
        runner,
        false,
      )).resolves.toBeNull();
      expect(queries.some((sql) => sql.includes("INSERT INTO themes")))
        .toBe(false);
    },
  );

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
      .toBe(themeKitCompatibilityRange(MICROFEED_VERSION));
    await expect(readFile(path.join(output, "yarn.lock"), "utf8"))
      .resolves.toBe("");
    await expect(readFile(path.join(output, "CLAUDE.md"), "utf8"))
      .resolves.toContain(
        ".agents/skills/develop-microfeed-theme/SKILL.md",
      );
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

  it("exports an installed version as a complete Git-ready repository", async () => {
    const {directory, theme} = await freshModules();
    const output = path.join(
      directory,
      ".microfeed",
      "themes",
      "example.active-2.3.4",
    );
    const runner = commandRunner();
    const assetBytes = new TextEncoder().encode(
      "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
    );
    const assetPath = "assets/logo.svg";
    const exportedManifest = {...manifest, assets: [assetPath]};
    const exportedBundle = {
      ...bundle,
      assets: [{
        contentType: "image/svg+xml",
        key: "production/themes/export-theme-id/assets/logo.svg",
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
      if (request.sql.includes("SELECT * FROM themes WHERE id = ?")) {
        return d1Response([{
          asset_owner_theme_id: "export-theme-id",
          bundle_json: JSON.stringify(exportedBundle),
          checksum_sha256: "c".repeat(64),
          created_at: "2026-08-10T00:00:00.000Z",
          deleted_at: null,
          id: "export-theme-id",
          manifest_json: JSON.stringify(exportedManifest),
          name: manifest.name,
          origin_theme_id: null,
          package_id: manifest.packageId,
          source_commit: "d".repeat(40),
          source_kind: "github",
          source_path: null,
          source_ref: "main",
          source_url: "https://github.com/example/active",
          version: manifest.version,
        }]);
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await theme.themeCommand({
      action: "export",
      instance: "personal",
      output,
      "theme-id": "export-theme-id",
      json: true,
    }, runner);

    const writtenManifest = JSON.parse(
      await readFile(path.join(output, "microfeed-theme.json"), "utf8"),
    ) as ThemeManifestV1;
    expect(writtenManifest).toEqual(exportedManifest);
    await expect(readFile(path.join(output, assetPath), "utf8"))
      .resolves.toContain("<svg");
    const exportedPackage = JSON.parse(
      await readFile(path.join(output, "package.json"), "utf8"),
    ) as {
      devDependencies?: Record<string, string>;
      packageManager?: string;
      scripts?: Record<string, string>;
    };
    expect(exportedPackage).toMatchObject({
      devDependencies: {
        "@microfeed/theme-kit": themeKitCompatibilityRange(MICROFEED_VERSION),
      },
      packageManager: MICROFEED_PACKAGE_MANAGER,
      scripts: {
        preview: "theme-kit preview .",
        test: "theme-kit test . --json",
        validate: "theme-kit validate . --json",
      },
    });
    await expect(readFile(path.join(output, "yarn.lock"), "utf8"))
      .resolves.toBe("");
    for (const relativePath of [
      ".gitignore",
      ".yarnrc.yml",
      ".microfeed/schemas/manifest.schema.json",
      ".microfeed/schemas/theme-context.schema.json",
      "CLAUDE.md",
      ".agents/skills/develop-microfeed-theme/SKILL.md",
      ".agents/skills/develop-microfeed-theme/agents/openai.yaml",
      ".agents/skills/develop-microfeed-theme/references/public-site.md",
      "fixtures/custom.json",
      "THEME.md",
    ]) {
      await expect(readFile(path.join(output, relativePath), "utf8"))
        .resolves.not.toHaveLength(0);
    }
    const conformance = JSON.parse((await execFileAsync(
      process.execPath,
      [
        "--import",
        "tsx",
        path.join(repositoryRoot, "packages/theme-kit/src/cli.ts"),
        "test",
        output,
        "--json",
      ],
      {cwd: repositoryRoot},
    )).stdout) as {ok: boolean; tests: Array<{fixture: string; ok: boolean}>};
    expect(conformance.ok).toBe(true);
    expect(conformance.tests).toHaveLength(9);
    expect(conformance.tests).toContainEqual({fixture: "package:custom.json", ok: true});
    expect(conformance.tests.every(({ok}) => ok)).toBe(true);
    expect(runner).not.toHaveBeenCalledWith(
      "git",
      expect.anything(),
      expect.anything(),
    );
    expect(JSON.parse(stdout.mock.calls.flat().join(""))).toEqual({
      gitInitialized: false,
      output,
      packageId: "example.active",
      selection: "theme-id",
      themeId: "export-theme-id",
      version: "2.3.4",
    });
    await expect(readFile(path.join(output, ".gitignore"), "utf8"))
      .resolves.toBe(".yarn/\nnode_modules/\n");
    await expect(readFile(path.join(output, ".yarnrc.yml"), "utf8"))
      .resolves.toBe(
        "nodeLinker: node-modules\n" +
          "npmPreapprovedPackages:\n" +
          "  - \"@microfeed/theme-kit\"\n",
      );

    runner.mockClear();
    await expect(theme.themeCommand({
      action: "export",
      git: true,
      instance: "personal",
      output,
      "theme-id": "export-theme-id",
    }, runner)).rejects.toThrow(`Refusing to export into non-empty directory ${output}`);
    expect(runner).not.toHaveBeenCalledWith(
      "git",
      expect.anything(),
      expect.anything(),
    );

    const gitOutput = path.join(
      directory,
      ".microfeed",
      "themes",
      "example.active-2.3.4-git",
    );
    runner.mockClear();
    stdout.mockClear();
    await theme.themeCommand({
      action: "export",
      git: true,
      instance: "personal",
      output: gitOutput,
      "theme-id": "export-theme-id",
      json: true,
    }, runner);
    expect(runner).toHaveBeenCalledWith(
      "git",
      ["init", "--initial-branch", "main"],
      {cwd: gitOutput},
    );
    await expect(readFile(path.join(gitOutput, "yarn.lock"), "utf8"))
      .resolves.toBe("");
    expect(JSON.parse(stdout.mock.calls.flat().join(""))).toEqual({
      gitInitialized: true,
      output: gitOutput,
      packageId: "example.active",
      selection: "theme-id",
      themeId: "export-theme-id",
      version: "2.3.4",
    });

    const humanOutput = path.join(
      directory,
      ".microfeed",
      "themes",
      "example.active-2.3.4-human",
    );
    runner.mockClear();
    stdout.mockClear();
    await theme.themeCommand({
      action: "export",
      git: true,
      instance: "personal",
      output: humanOutput,
      "theme-id": "export-theme-id",
    }, runner);
    expect(stdout.mock.calls.flat().join("")).toBe(
      `Exported example.active@2.3.4 to ${humanOutput} and initialized Git.\n`,
    );

    const failedGitOutput = path.join(
      directory,
      ".microfeed",
      "themes",
      "example.active-2.3.4-git-failure",
    );
    const failedGitRunner = commandRunner();
    failedGitRunner.mockImplementation(async (executable, args) => {
      if (executable === "git") throw new Error("Git initialization failed");
      expect(args).toContain("token");
      return {
        exitCode: 0,
        stderr: "",
        stdout: JSON.stringify({token: "oauth-token", type: "oauth"}),
      };
    });
    await expect(theme.themeCommand({
      action: "export",
      git: true,
      instance: "personal",
      output: failedGitOutput,
      "theme-id": "export-theme-id",
    }, failedGitRunner)).rejects.toThrow("Git initialization failed");
    await expect(readFile(
      path.join(failedGitOutput, "microfeed-theme.json"),
      "utf8",
    )).resolves.toContain('"packageId": "example.active"');
  });

  it("exports the active installed version to the collision-resistant default", async () => {
    const {directory, theme} = await freshModules();
    const runner = commandRunner();
    vi.stubGlobal("fetch", vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {sql: string};
      if (request.sql.includes("FROM theme_state")) {
        return d1Response([{
          active_theme_id: "active-theme-id",
          previous_theme_id: null,
          updated_at: "2026-08-10T00:00:00.000Z",
        }]);
      }
      if (request.sql.includes("SELECT * FROM themes WHERE id = ?")) {
        return d1Response([{
          asset_owner_theme_id: null,
          bundle_json: JSON.stringify(bundle),
          checksum_sha256: "e".repeat(64),
          created_at: "2026-08-10T00:00:00.000Z",
          deleted_at: null,
          id: "active-theme-id",
          manifest_json: JSON.stringify(manifest),
          name: manifest.name,
          origin_theme_id: null,
          package_id: manifest.packageId,
          source_commit: null,
          source_kind: "local-directory",
          source_path: "/tmp/theme",
          source_ref: null,
          source_url: null,
          version: manifest.version,
        }]);
      }
      throw new Error(`Unexpected request: ${String(_input)}`);
    }));
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const previousCwd = process.cwd();
    process.chdir(directory);
    const resolvedDirectory = process.cwd();
    try {
      await theme.themeCommand({
        action: "export",
        active: true,
        instance: "personal",
        json: true,
      }, runner);
    } finally {
      process.chdir(previousCwd);
    }

    const output = path.join(
      resolvedDirectory,
      ".microfeed",
      "themes",
      "example.active-2.3.4",
    );
    await expect(readFile(path.join(output, "microfeed-theme.json"), "utf8"))
      .resolves.toContain('"packageId": "example.active"');
    expect(JSON.parse(stdout.mock.calls.flat().join(""))).toEqual({
      gitInitialized: false,
      output,
      packageId: "example.active",
      selection: "active",
      themeId: "active-theme-id",
      version: "2.3.4",
    });
  });

  it("removes staging files when an export fails before completion", async () => {
    const {directory, theme} = await freshModules();
    const output = path.join(directory, "failed-export");
    const parent = path.dirname(output);
    const runner = commandRunner();
    const exportedManifest = {...manifest, assets: ["assets/missing.svg"]};
    const exportedBundle = {
      ...bundle,
      assets: [{
        contentType: "image/svg+xml",
        key: "production/themes/export-theme-id/assets/missing.svg",
        path: "assets/missing.svg",
        sha256: "f".repeat(64),
        size: 10,
      }],
    };
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      if (String(input).includes("/r2/buckets/feed-media/objects/")) {
        return new Response("missing", {status: 404});
      }
      const request = JSON.parse(String(init?.body)) as {sql: string};
      if (request.sql.includes("SELECT * FROM themes WHERE id = ?")) {
        return d1Response([{
          asset_owner_theme_id: "export-theme-id",
          bundle_json: JSON.stringify(exportedBundle),
          checksum_sha256: "f".repeat(64),
          created_at: "2026-08-10T00:00:00.000Z",
          deleted_at: null,
          id: "export-theme-id",
          manifest_json: JSON.stringify(exportedManifest),
          name: manifest.name,
          origin_theme_id: null,
          package_id: manifest.packageId,
          source_commit: null,
          source_kind: "local-directory",
          source_path: "/tmp/theme",
          source_ref: null,
          source_url: null,
          version: manifest.version,
        }]);
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    }));

    await expect(theme.themeCommand({
      action: "export",
      instance: "personal",
      output,
      "theme-id": "export-theme-id",
    }, runner)).rejects.toThrow();
    await expect(readdir(output)).rejects.toMatchObject({code: "ENOENT"});
    expect((await readdir(parent)).filter((entry) =>
      entry.startsWith(".failed-export.tmp-")
    )).toEqual([]);
  });

  it("does not substitute a fallback for --active export", async () => {
    const {theme} = await freshModules();
    const runner = commandRunner();
    vi.stubGlobal("fetch", vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {sql: string};
      if (request.sql.includes("FROM theme_state")) {
        return d1Response([{
          active_theme_id: null,
          previous_theme_id: null,
          updated_at: "2026-08-10T00:00:00.000Z",
        }]);
      }
      throw new Error(`Unexpected request: ${String(_input)}`);
    }));

    await expect(theme.themeCommand({
      action: "export",
      active: true,
      instance: "personal",
    }, runner)).rejects.toThrow(
      "No installed theme version is active. Use theme init",
    );
  });

  it("rejects --git for theme actions other than export", async () => {
    const {theme} = await freshModules();
    const runner = commandRunner();

    await expect(theme.themeCommand({
      action: "list",
      git: true,
      instance: "personal",
    }, runner)).rejects.toThrow("--git is supported only by theme export.");
    await expect(theme.themeCommand({
      action: "list",
      active: true,
      instance: "personal",
    }, runner)).rejects.toThrow("--active is supported only by theme export.");
    await expect(theme.themeCommand({
      action: "export",
      instance: "personal",
    }, runner)).rejects.toThrow(
      "theme export requires exactly one of <theme-id> or --active.",
    );
    await expect(theme.themeCommand({
      action: "export",
      active: true,
      instance: "personal",
      "theme-id": "theme-id",
    }, runner)).rejects.toThrow(
      "theme export requires exactly one of <theme-id> or --active.",
    );
    expect(runner).not.toHaveBeenCalled();
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
          currentTheme: "Owner Legacy",
          themes: {"Owner Legacy": {webFeed: "legacy active feed"}},
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
      source: {kind: "legacy", packageId: "legacy.owner-legacy"},
    });
    expect(runner).not.toHaveBeenCalledWith("git", expect.anything(), expect.anything());
  });
});
