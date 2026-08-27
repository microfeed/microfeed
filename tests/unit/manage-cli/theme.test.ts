import {afterEach, describe, expect, it, vi} from "vitest";

import {
  allowedGithubFetch,
  githubThemeSource,
  parseGithubSource,
  themeManagementRequest,
} from "../../../manage-cli/theme";
import {CloudflareClient} from "../../../manage-cli/lib/cloudflare";
import type {
  CommandRunner,
  MicrofeedConfig,
} from "../../../manage-cli/types";

afterEach(() => vi.unstubAllGlobals());

const GITHUB_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const THEME_FILES = {
  rssStylesheet: "source/rss.xsl",
  webBodyEnd: "source/end.mustache",
  webBodyStart: "source/start.mustache",
  webFeed: "source/feed.mustache",
  webHeader: "source/header.mustache",
  webItem: "source/item.mustache",
} as const;

const THEME_PACKAGE_FILES = new Map<string, string>([
  ["microfeed-theme.json", JSON.stringify({
    assets: [],
    author: "Theme author",
    files: THEME_FILES,
    formatVersion: 1,
    license: "MIT",
    microfeed: "*",
    name: "GitHub theme",
    packageId: "example.github-theme",
    version: "1.2.3",
  })],
  [THEME_FILES.rssStylesheet, "<xsl:stylesheet xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\" version=\"1.0\"></xsl:stylesheet>"],
  [THEME_FILES.webBodyEnd, "body end"],
  [THEME_FILES.webBodyStart, "body start"],
  [THEME_FILES.webFeed, "feed {{title}}"],
  [THEME_FILES.webHeader, "header"],
  [THEME_FILES.webItem, "item {{items.0.title}}"],
]);

function githubRunner(
  modeOverrides: Record<string, string> = {},
): ReturnType<typeof vi.fn<CommandRunner>> {
  const tree = [...THEME_PACKAGE_FILES.keys()].map((repositoryPath) =>
    `${modeOverrides[repositoryPath] ?? "100644"} blob ${"a".repeat(40)}\t${repositoryPath}\0`
  ).join("");
  return vi.fn<CommandRunner>(async (executable, args) => {
    expect(executable).toBe("git");
    if (args.includes("fetch") || args[0] === "init" || args[0] === "check-ref-format") {
      return {exitCode: 0, stderr: "", stdout: ""};
    }
    if (args[0] === "rev-parse") {
      return {exitCode: 0, stderr: "", stdout: `${GITHUB_COMMIT}\n`};
    }
    if (args[0] === "ls-tree") {
      return {exitCode: 0, stderr: "", stdout: tree};
    }
    throw new Error(`Unexpected Git command: ${args.join(" ")}`);
  });
}

function stubGithubRawFiles(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
    const url = new URL(String(input));
    const prefix = `/owner/repo/${GITHUB_COMMIT}/`;
    expect(url.hostname).toBe("raw.githubusercontent.com");
    expect(url.pathname.startsWith(prefix)).toBe(true);
    const relativePath = decodeURIComponent(url.pathname.slice(prefix.length));
    const content = THEME_PACKAGE_FILES.get(relativePath);
    return new Response(content ?? "missing", {status: content === undefined ? 404 : 200});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("theme GitHub source resolution", () => {
  it("accepts repository, directory, and manifest URLs", () => {
    expect(parseGithubSource("https://github.com/owner/repo")).toEqual({
      owner: "owner",
      path: "",
      ref: "HEAD",
      repo: "repo",
    });
    expect(parseGithubSource(
      "https://github.com/owner/repo/tree/v1/themes/dark",
    )).toMatchObject({path: "themes/dark", ref: "v1"});
    expect(parseGithubSource(
      "https://github.com/owner/repo/blob/main/themes/dark/microfeed-theme.json",
    )).toMatchObject({path: "themes/dark", ref: "main"});
    expect(parseGithubSource(
      "https://github.com/owner/repo/tree/main/themes/my%20theme",
    )).toMatchObject({path: "themes/my theme", ref: "main"});
  });

  it("lets explicit ref and path disambiguate branch names containing slashes", () => {
    expect(parseGithubSource(
      "https://github.com/owner/repo",
      "feature/theme-v2",
      "packages/theme",
    )).toMatchObject({path: "packages/theme", ref: "feature/theme-v2"});
  });

  it("rejects non-GitHub and non-HTTPS sources", () => {
    expect(() => parseGithubSource("https://example.com/owner/repo")).toThrow("github.com");
    expect(() => parseGithubSource("http://github.com/owner/repo")).toThrow("https://github.com");
    expect(() => parseGithubSource(
      "https://github.com/owner/repo",
      "main",
      "../theme",
    )).toThrow("traversal");
  });

  it("allows only GitHub API/content redirects and reports rate limits", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, {
      headers: {location: "https://evil.example/theme"},
      status: 302,
    })));
    await expect(allowedGithubFetch(
      "https://api.github.com/repos/owner/repo/commits/main",
    )).rejects.toThrow("disallowed host");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("limited", {
      headers: {"x-ratelimit-remaining": "0"},
      status: 403,
    })));
    await expect(allowedGithubFetch(
      "https://api.github.com/repos/owner/repo/commits/main",
    )).rejects.toThrow("rate limit exhausted");
  });

  it("resolves exact commits with Git without using GitHub's REST API", async () => {
    const runner = githubRunner();
    const fetchMock = stubGithubRawFiles();

    const resolved = await githubThemeSource(
      "https://github.com/owner/repo",
      "main",
      undefined,
      runner,
    );

    expect(resolved.source).toMatchObject({
      commit: GITHUB_COMMIT,
      kind: "github",
      path: null,
      ref: "main",
      url: "https://github.com/owner/repo",
    });
    expect(resolved.loaded.manifest).toMatchObject({
      packageId: "example.github-theme",
      version: "1.2.3",
    });
    expect(fetchMock).toHaveBeenCalledTimes(THEME_PACKAGE_FILES.size);
    expect(fetchMock.mock.calls.every(([input]) =>
      String(input).startsWith("https://raw.githubusercontent.com/")
    )).toBe(true);
    const gitFetch = runner.mock.calls.find(([, args]) => args.includes("fetch"));
    expect(gitFetch?.[1]).toEqual(expect.arrayContaining([
      "--",
      "credential.helper=",
      "http.extraHeader=",
      "--filter=blob:none",
      "https://github.com/owner/repo.git",
      "main",
    ]));
  });

  it("rejects declared symlinks before downloading package files", async () => {
    const runner = githubRunner({[THEME_FILES.webHeader]: "120000"});
    const fetchMock = stubGithubRawFiles();

    await expect(githubThemeSource(
      "https://github.com/owner/repo",
      "main",
      undefined,
      runner,
    )).rejects.toThrow(`GitHub theme symlinks are not allowed: ${THEME_FILES.webHeader}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects option-like or wildcard Git refs before fetching", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      exitCode: 1,
      stderr: "invalid ref",
      stdout: "",
    });

    await expect(githubThemeSource(
      "https://github.com/owner/repo",
      "--upload-pack=malicious",
      undefined,
      runner,
    )).rejects.toThrow("Invalid GitHub theme ref");
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner.mock.calls[0]?.[1]).toEqual([
      "check-ref-format",
      "--branch",
      "--upload-pack=malicious",
    ]);
  });

  it("sends theme D1 values as REST parameters rather than interpolated SQL", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({token: "oauth-token", type: "oauth"}),
    });
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        params: ["package-value"],
        sql: "SELECT ? AS package_id",
      });
      return Response.json({
        errors: [],
        result: [{results: [{package_id: "package-value"}], success: true}],
        success: true,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const config: MicrofeedConfig = {
      accountId: "account-id",
      adminPath: "admin",
      completedSteps: [],
      customDomain: null,
      d1: {id: "database-id", name: "database", reuse: false},
      deploymentUrl: "https://feed.example.test",
      hosting: "cloudflare",
      instanceId: "instance-id",
      instanceName: "feed",
      projectName: "feed",
      r2: {name: "bucket", reuse: false, setupMode: "automatic"},
    };
    await expect(new CloudflareClient(runner).queryD1WithParameters(
      config,
      "SELECT ? AS package_id",
      ["package-value"],
    )).resolves.toEqual([{package_id: "package-value"}]);
  });
});

describe("remote theme management", () => {
  it("uses a JSON POST so Astro does not reject the one-time grant as a form submission", () => {
    const request = themeManagementRequest(
      "https://feed.example.test",
      "one-time-token",
    );

    expect(request.method).toBe("POST");
    expect(request.url).toBe(
      "https://feed.example.test/.well-known/microfeed/theme-management/",
    );
    expect(request.headers.get("authorization")).toBe("Bearer one-time-token");
    expect(request.headers.get("content-type")).toBe("application/json");
  });
});
