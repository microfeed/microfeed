import {afterEach, describe, expect, it, vi} from "vitest";

import {
  allowedGithubFetch,
  parseGithubSource,
} from "../../../manage-cli/theme";
import {CloudflareClient} from "../../../manage-cli/lib/cloudflare";
import type {
  CommandRunner,
  MicrofeedConfig,
} from "../../../manage-cli/types";

afterEach(() => vi.unstubAllGlobals());

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
