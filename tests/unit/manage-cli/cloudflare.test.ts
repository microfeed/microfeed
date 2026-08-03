import nodePath from "node:path";

import {afterEach, describe, expect, it, vi} from "vitest";

import {
  assertNoPagesCollision,
  CloudflareClient,
  OAUTH_SCOPES,
  pagesCollisionMessage,
  pagesDomainAttachedMessage,
  pagesDomainIsAttached,
  pagesProjectDomainsDashboardUrl,
  R2NotEntitledError,
  validateWranglerProfileName,
} from "../../../manage-cli/lib/cloudflare";
import type {
  CommandRunner,
  MicrofeedConfig,
} from "../../../manage-cli/types";
import {repositoryRoot} from "../../../manage-cli/lib/process";

function commandResult(
  stdout = "",
  stderr = "",
  exitCode = 0,
) {
  return {exitCode, stderr, stdout};
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Pages collision preflight", () => {
  it("aborts before any Cloudflare mutation", async () => {
    const mutations = {
      createD1: vi.fn(),
      createR2: vi.fn(),
      deployWorker: vi.fn(),
      putSecret: vi.fn(),
      updateDomain: vi.fn(),
      updatePages: vi.fn(),
    };
    const cloudflare = {
      pagesProjects: vi.fn().mockResolvedValue(["microfeed"]),
      ...mutations,
    };

    await expect(
      assertNoPagesCollision(cloudflare, "account-id", "microfeed"),
    ).rejects.toThrow(pagesCollisionMessage("microfeed"));
    for (const mutation of Object.values(mutations)) {
      expect(mutation).not.toHaveBeenCalled();
    }
  });

  it("identifies when the custom domain is still attached to Pages", async () => {
    const cloudflare = {
      pagesProjectDomains: vi.fn().mockResolvedValue([
        "old-pages.pages.dev",
        "WWW.ListenHost.com.",
      ]),
    };

    await expect(
      pagesDomainIsAttached(
        cloudflare,
        "account-id",
        "old-pages",
        "www.listenhost.com",
      ),
    ).resolves.toBe(true);
  });

  it("continues after the custom domain is detached from Pages", async () => {
    const cloudflare = {
      pagesProjectDomains: vi.fn().mockResolvedValue([
        "old-pages.pages.dev",
      ]),
    };

    await expect(
      pagesDomainIsAttached(
        cloudflare,
        "account-id",
        "old-pages",
        "www.listenhost.com",
      ),
    ).resolves.toBe(false);
  });

  it("links directly to the Pages project's custom domains", () => {
    const dashboardUrl = pagesProjectDomainsDashboardUrl(
      "account-id",
      "old pages/project",
    );

    expect(dashboardUrl).toBe(
      "https://dash.cloudflare.com/account-id/pages/view/" +
        "old%20pages%2Fproject/domains",
    );
    expect(
      pagesDomainAttachedMessage(
        "account-id",
        "old pages/project",
        "www.listenhost.com",
      ),
    ).toContain(dashboardUrl);
    expect(
      pagesDomainAttachedMessage(
        "account-id",
        "old pages/project",
        "www.listenhost.com",
      ),
    ).toContain(
      "microfeed did not change Pages or the Worker custom domain",
    );
    expect(
      pagesDomainAttachedMessage(
        "account-id",
        "old pages/project",
        "www.listenhost.com",
      ),
    ).not.toContain("CNAME");
  });
});

describe("CloudflareClient", () => {
  it("requests only the selected OAuth scopes and OS keyring storage", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue(commandResult());
    await new CloudflareClient(runner).login();

    expect(OAUTH_SCOPES).toContain("workers_scripts:write");
    expect(runner).toHaveBeenCalledWith(
      expect.stringMatching(/wrangler(?:\.cmd)?$/u),
      ["login", "--use-keyring", "--scopes", ...OAUTH_SCOPES],
      expect.objectContaining({interactive: true}),
    );
  });

  it("turns OAuth rejection or callback failure into a non-destructive error", async () => {
    const runner = vi.fn<CommandRunner>().mockRejectedValue(
      new Error("callback server closed"),
    );

    await expect(new CloudflareClient(runner).login()).rejects.toThrow(
      "No Cloudflare resources were changed",
    );
  });

  it("creates named OAuth profiles in the keyring and activates the repository binding", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue(commandResult());
    const cloudflare = new CloudflareClient(runner);

    await cloudflare.authorizeProfile("company");
    await cloudflare.activateProfile("company");

    expect(runner).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/wrangler(?:\.cmd)?$/u),
      ["auth", "create", "company", "--scopes", ...OAUTH_SCOPES],
      expect.objectContaining({
        env: expect.objectContaining({
          CLOUDFLARE_AUTH_USE_KEYRING: "true",
        }),
        interactive: true,
      }),
    );
    expect(runner).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/wrangler(?:\.cmd)?$/u),
      ["auth", "activate", "company", repositoryRoot],
      expect.objectContaining({cwd: repositoryRoot}),
    );
  });

  it("validates named profiles before Wrangler runs", () => {
    expect(validateWranglerProfileName("company")).toBeUndefined();
    expect(validateWranglerProfileName("team_login-2")).toBeUndefined();
    expect(validateWranglerProfileName("company account")).toContain(
      "ASCII letters",
    );
    expect(validateWranglerProfileName("default")).toContain("reserved");
    expect(validateWranglerProfileName("STAGING")).toContain("reserved");
  });

  it("parses accounts and confirms the required permission set", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue(commandResult(
      "Wrangler status\n" + JSON.stringify({
        accounts: [
          {id: "account-a", name: "Personal"},
          {id: "account-b", name: "Team"},
        ],
        tokenPermissions: [...OAUTH_SCOPES, "offline_access"],
      }),
    ));
    const cloudflare = new CloudflareClient(runner);

    await expect(cloudflare.accounts()).resolves.toEqual([
      {id: "account-a", name: "Personal"},
      {id: "account-b", name: "Team"},
    ]);
    await expect(cloudflare.hasRequiredScopes()).resolves.toBe(true);
  });

  it("reports the login email and directory-bound Wrangler profile", async () => {
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "whoami --json") {
        return commandResult(JSON.stringify({
          accounts: [{id: "account-a", name: "Personal"}],
          authType: "OAuth Token",
          email: "admin@example.com",
        }));
      }
      if (command === "auth list") {
        return commandResult([
          "┌──────────┬───────────────────────────────────────┐",
          "│ Profile  │ Bound Directories                     │",
          "├──────────┼───────────────────────────────────────┤",
          `│ company  │ ${repositoryRoot} │`,
          "│ default  │ -                                     │",
          `│ personal │ ${nodePath.dirname(repositoryRoot)} │`,
          "└──────────┴───────────────────────────────────────┘",
        ].join("\n"));
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(new CloudflareClient(runner).identity()).resolves.toEqual({
      accounts: [{id: "account-a", name: "Personal"}],
      email: "admin@example.com",
      profile: "company",
      profiles: [
        {active: true, name: "company"},
        {active: false, name: "default"},
        {active: false, name: "personal"},
      ],
    });
  });

  it("reads the pending password state without returning its token hash", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue(commandResult(
      JSON.stringify([{results: [{
        createdAt: "2026-07-31T12:00:00.000Z",
        email: "owner@example.com",
        expiresAt: "2026-07-31T12:30:00.000Z",
        purpose: "initial",
        tokenHash: "must-not-be-returned",
        userId: null,
      }]}]),
    ));
    const config = {
      accountId: "account-a",
      adminPath: "admin",
      completedSteps: [],
      customDomain: null,
      d1: {id: "database-id", name: "feed-db", reuse: false},
      deploymentUrl: "https://feed.example.workers.dev",
      hosting: "cloudflare" as const,
      instanceId: "instance-id",
      instanceName: "feed",
      projectName: "feed",
      r2: {
        name: "feed-media",
        reuse: false,
        setupMode: "automatic" as const,
      },
    };

    await expect(
      new CloudflareClient(runner).authPasswordSetup(config),
    ).resolves.toEqual({
      createdAt: "2026-07-31T12:00:00.000Z",
      email: "owner@example.com",
      expiresAt: "2026-07-31T12:30:00.000Z",
      purpose: "initial",
      userId: null,
    });
    expect(JSON.stringify(runner.mock.calls)).not.toContain(
      "must-not-be-returned",
    );
  });

  it("discovers compatible microfeed Workers without changing Cloudflare", async () => {
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "auth token --json") {
        return commandResult(JSON.stringify({
          token: "oauth-token",
          type: "oauth",
        }));
      }
      if (command === "d1 list --json") {
        return commandResult(JSON.stringify([
          {name: "feed-db", uuid: "database-id"},
        ]));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const apiResult = (result: unknown) =>
      Response.json({errors: [], result, success: true});
    const fetchMock = vi.fn(async (
      input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      expect(init?.method).toBeUndefined();
      if (url.pathname.endsWith("/workers/scripts")) {
        return apiResult([{id: "feed-worker"}, {id: "other-worker"}]);
      }
      if (url.pathname.endsWith("/workers/domains")) {
        return apiResult([{
          hostname: "feed.example.com",
          service: "feed-worker",
        }]);
      }
      if (url.pathname.endsWith("/workers/subdomain")) {
        return apiResult({subdomain: "example-account"});
      }
      if (url.pathname.endsWith("/feed-worker/settings")) {
        return apiResult({bindings: [
          {database_id: "database-id", name: "FEED_DB", type: "d1"},
          {
            bucket_name: "feed-media",
            name: "MEDIA_BUCKET",
            type: "r2_bucket",
          },
          {
            name: "CLOUDFLARE_PROJECT_NAME",
            text: "feed",
            type: "plain_text",
          },
          {
            name: "MICROFEED_INSTANCE_ID",
            text: "instance-id",
            type: "plain_text",
          },
          {
            name: "MICROFEED_ADMIN_PATH",
            text: "private-admin",
            type: "plain_text",
          },
        ]});
      }
      if (url.pathname.endsWith("/other-worker/settings")) {
        return apiResult({bindings: []});
      }
      if (url.pathname.endsWith("/feed-worker/subdomain")) {
        return apiResult({enabled: true});
      }
      throw new Error(`Unexpected API request: ${url.pathname}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new CloudflareClient(runner).discoverMicrofeedWorkers({
        id: "account-id",
        name: "Personal",
      }),
    ).resolves.toEqual([{
      accountId: "account-id",
      accountName: "Personal",
      adminAuthMode: "built-in",
      adminPath: "private-admin",
      customDomains: ["feed.example.com"],
      d1: {id: "database-id", name: "feed-db"},
      instanceId: "instance-id",
      projectName: "feed",
      r2Name: "feed-media",
      r2Ready: true,
      r2SetupMode: "automatic",
      workerName: "feed-worker",
      workersDevUrl:
        "https://feed-worker.example-account.workers.dev",
    }]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/accounts/account-id/workers/scripts"),
      {headers: {Authorization: "Bearer oauth-token"}},
    );
  });

  it("discovers a content-only Worker from D1 and saved R2 variables", async () => {
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "auth token --json") {
        return commandResult(JSON.stringify({
          token: "oauth-token",
          type: "oauth",
        }));
      }
      if (command === "d1 list --json") {
        return commandResult(JSON.stringify([
          {name: "feed-db", uuid: "database-id"},
        ]));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const apiResult = (result: unknown) =>
      Response.json({errors: [], result, success: true});
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const pathname = new URL(
        input instanceof Request ? input.url : input.toString(),
      ).pathname;
      if (pathname.endsWith("/workers/scripts")) {
        return apiResult([{id: "content-worker"}]);
      }
      if (pathname.endsWith("/workers/domains")) {
        return apiResult([]);
      }
      if (pathname.endsWith("/workers/subdomain")) {
        return apiResult({subdomain: "example-account"});
      }
      if (pathname.endsWith("/content-worker/settings")) {
        return apiResult({bindings: [
          {database_id: "database-id", name: "FEED_DB", type: "d1"},
          {
            name: "MICROFEED_R2_BUCKET_NAME",
            text: "future-media",
            type: "plain_text",
          },
          {
            name: "MICROFEED_R2_SETUP_MODE",
            text: "disabled",
            type: "plain_text",
          },
        ]});
      }
      if (pathname.endsWith("/content-worker/subdomain")) {
        return apiResult({enabled: true});
      }
      throw new Error(`Unexpected API request: ${pathname}`);
    }));

    await expect(
      new CloudflareClient(runner).discoverMicrofeedWorkers({
        id: "account-id",
        name: "Personal",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        d1: {id: "database-id", name: "feed-db"},
        r2Name: "future-media",
        r2Ready: false,
        r2SetupMode: "disabled",
        workerName: "content-worker",
      }),
    ]);
  });

  it("parses Pages, D1, and missing R2 resources from Wrangler output", async () => {
    const runner: CommandRunner = vi.fn(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "pages project list --json") {
        return commandResult(JSON.stringify([
          {
            "Git Provider": "No",
            "Last Modified": "1 year ago",
            "Project Domains": "old-pages.pages.dev, www.listenhost.com",
            "Project Name": "old-pages",
          },
          {
            "Git Provider": "Yes",
            "Last Modified": "1 month ago",
            "Project Domains": "docs.pages.dev",
            "Project Name": "docs",
          },
        ]));
      }
      if (command === "d1 list --json") {
        return commandResult(JSON.stringify([
          {name: "old-pages_feed_db_production", uuid: "database-id"},
        ]));
      }
      if (command.startsWith("r2 bucket info ")) {
        return commandResult("", "Bucket not found", 1);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const cloudflare = new CloudflareClient(runner);

    await expect(cloudflare.pagesProjects("account-id")).resolves.toEqual([
      "old-pages",
      "docs",
    ]);
    await expect(
      cloudflare.pagesProjectDomains("account-id", "old-pages"),
    ).resolves.toEqual([
      "old-pages.pages.dev",
      "www.listenhost.com",
    ]);
    await expect(cloudflare.d1Databases("account-id")).resolves.toEqual([
      {id: "database-id", name: "old-pages_feed_db_production"},
    ]);
    await expect(
      cloudflare.r2BucketExists("account-id", "missing"),
    ).resolves.toBe(false);
  });

  it("classifies only Cloudflare's R2 subscription response as deferrable", async () => {
    const notEntitledRunner = vi.fn<CommandRunner>().mockResolvedValue(
      commandResult("", "[code: 10042] NotEntitled", 1),
    );
    await expect(
      new CloudflareClient(notEntitledRunner).r2BucketExists(
        "account-id",
        "future-media",
      ),
    ).rejects.toBeInstanceOf(R2NotEntitledError);

    const permissionRunner = vi.fn<CommandRunner>().mockResolvedValue(
      commandResult("", "Authentication error [code: 10000]", 1),
    );
    await expect(
      new CloudflareClient(permissionRunner).r2BucketExists(
        "account-id",
        "future-media",
      ),
    ).rejects.toThrow("Authentication error");
  });

  it("keeps compatibility with raw Pages API response fields", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue(commandResult(
      JSON.stringify({
        result: [
          {
            domains: ["raw-name.pages.dev", "feed.example.com"],
            name: "raw-name",
          },
          {project_name: "legacy-name"},
        ],
      }),
    ));

    await expect(
      new CloudflareClient(runner).pagesProjects("account-id"),
    ).resolves.toEqual(["raw-name", "legacy-name"]);
    await expect(
      new CloudflareClient(runner).pagesProjectDomains(
        "account-id",
        "raw-name",
      ),
    ).resolves.toEqual(["raw-name.pages.dev", "feed.example.com"]);
  });

  it("checks Worker collisions through the Worker Versions API", async () => {
    const runner = vi.fn<CommandRunner>()
      .mockResolvedValueOnce(commandResult("[]"))
      .mockResolvedValueOnce(commandResult(
        "",
        "The Worker was not found",
        1,
      ));
    const cloudflare = new CloudflareClient(runner);

    await expect(
      cloudflare.workerExists("account-id", "existing-worker"),
    ).resolves.toBe(true);
    await expect(
      cloudflare.workerExists("account-id", "available-worker"),
    ).resolves.toBe(false);
    expect(runner).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/wrangler(?:\.cmd)?$/u),
      [
        "versions",
        "list",
        "--name",
        "existing-worker",
        "--json",
      ],
      expect.objectContaining({
        allowFailure: true,
        env: expect.objectContaining({
          CLOUDFLARE_ACCOUNT_ID: "account-id",
          CLOUDFLARE_AUTH_USE_KEYRING: "true",
        }),
      }),
    );
  });

  it("explains missing Worker Scripts access", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue(commandResult(
      "",
      "Authentication error [code: 10000]",
      1,
    ));

    await expect(
      new CloudflareClient(runner).workerExists(
        "account-id",
        "new-worker",
      ),
    ).rejects.toThrow("approve Worker Scripts access");
  });

  it("uses the selected instance config for migrations and deployment", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue(commandResult(
      "https://art-of-war.example.workers.dev",
    ));
    const config: MicrofeedConfig = {
      accountId: "account-id",
      adminPath: "admin",
      completedSteps: [],
      customDomain: null,
      d1: {id: "database-id", name: "art-of-war-db", reuse: false},
      deploymentUrl: null,
      hosting: "cloudflare",
      instanceId: "installation-id",
      instanceName: "art-of-war",
      projectName: "art-of-war",
      r2: {
        name: "art-of-war-media",
        reuse: false,
        setupMode: "automatic",
      },
    };
    const cloudflare = new CloudflareClient(runner);

    await cloudflare.applyMigrations(config);
    await cloudflare.deploy(config);

    const migrationArgs = runner.mock.calls[0]?.[1] ?? [];
    const deployArgs = runner.mock.calls[1]?.[1] ?? [];
    expect(migrationArgs).toContain("--config");
    expect(migrationArgs.join(" ")).toContain(
      ".microfeed/instances/art-of-war/wrangler.jsonc",
    );
    expect(deployArgs).toContain("--config");
    expect(deployArgs.join(" ")).toContain(
      "dist/server/wrangler.json",
    );
  });

  it("reads existing secret names for a Worker without their values", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue(commandResult(
      JSON.stringify([
        {name: "BETTER_AUTH_SECRET", type: "secret_text"},
        {name: "UPLOAD_SIGNING_KEY", type: "secret_text"},
      ]),
    ));

    await expect(
      new CloudflareClient(runner).workerSecretNames(
        "account-id",
        "feed-worker",
      ),
    ).resolves.toEqual(
      new Set(["BETTER_AUTH_SECRET", "UPLOAD_SIGNING_KEY"]),
    );
    expect(runner).toHaveBeenCalledWith(
      expect.stringMatching(/wrangler(?:\.cmd)?$/u),
      [
        "secret",
        "list",
        "--name",
        "feed-worker",
        "--format",
        "json",
      ],
      expect.objectContaining({
        env: expect.objectContaining({
          CLOUDFLARE_ACCOUNT_ID: "account-id",
        }),
      }),
    );
  });

  it("deletes only the selected Worker and custom domain without force", async () => {
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      if (args.join(" ") === "auth token --json") {
        return commandResult(JSON.stringify({
          token: "oauth-token",
          type: "oauth",
        }));
      }
      throw new Error(`Unexpected command: ${args.join(" ")}`);
    });
    const fetchMock = vi.fn(async (
      input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      expect(init?.headers).toEqual({Authorization: "Bearer oauth-token"});
      if (url.pathname.endsWith("/workers/domains") && !init?.method) {
        return Response.json({
          result: [{
            cert_id: "certificate-id",
            hostname: "feed.example.com",
            id: "domain-id",
            service: "feed-worker",
            zone_id: "zone-id",
          }],
          success: true,
        });
      }
      if (url.pathname.endsWith("/workers/scripts/feed-worker")) {
        expect(url.searchParams.get("force")).toBe("false");
        expect(init?.method).toBe("DELETE");
        return new Response(null, {status: 204});
      }
      if (url.pathname.endsWith("/workers/domains/domain-id")) {
        expect(init?.method).toBe("DELETE");
        return Response.json({result: null, success: true});
      }
      throw new Error(`Unexpected API request: ${url.href}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const cloudflare = new CloudflareClient(runner);

    await expect(
      cloudflare.workerDomains("account-id", "feed-worker"),
    ).resolves.toEqual([{
      hostname: "feed.example.com",
      id: "domain-id",
      service: "feed-worker",
    }]);
    await cloudflare.deleteWorker("account-id", "feed-worker");
    await cloudflare.deleteWorkerDomain("account-id", "domain-id");
  });

  it("empties R2 through the object API before deleting owned storage", async () => {
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "auth token --json") {
        return commandResult(JSON.stringify({
          token: "oauth-token",
          type: "oauth",
        }));
      }
      if (command === "r2 bucket delete feed-media") {
        return commandResult("Deleted bucket");
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    let listCount = 0;
    const deletedPaths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (
      input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      if (!init?.method) {
        listCount += 1;
        return Response.json({
          result: listCount === 1
            ? [{key: "folder/a b.jpg"}, {key: "plain.txt"}]
            : [],
          success: true,
        });
      }
      expect(init.method).toBe("DELETE");
      deletedPaths.push(url.pathname);
      return Response.json({result: {key: "deleted"}, success: true});
    }));
    const cloudflare = new CloudflareClient(runner);

    await expect(
      cloudflare.emptyR2Bucket("account-id", "feed-media"),
    ).resolves.toBe(2);
    await cloudflare.deleteD1("account-id", "database-id");
    await cloudflare.deleteR2Bucket("account-id", "feed-media");

    expect(deletedPaths).toContain(
      "/client/v4/accounts/account-id/r2/buckets/feed-media/objects/" +
        "folder/a%20b.jpg",
    );
    expect(deletedPaths).toContain(
      "/client/v4/accounts/account-id/r2/buckets/feed-media/objects/plain.txt",
    );
    expect(deletedPaths).toContain(
      "/client/v4/accounts/account-id/d1/database/database-id",
    );
  });

  it("paginates R2 listings and preserves HTTP and custom metadata", async () => {
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      if (args.join(" ") === "auth token --json") {
        return commandResult(JSON.stringify({
          token: "oauth-token",
          type: "oauth",
        }));
      }
      throw new Error(`Unexpected command: ${args.join(" ")}`);
    });
    vi.stubGlobal("fetch", vi.fn(async (
      input: URL | RequestInfo,
    ) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      if (!url.searchParams.has("cursor")) {
        return Response.json({
          result: [{
            custom_metadata: {owner: "microfeed"},
            etag: "etag-b",
            http_metadata: {
              cache_control: "public, max-age=60",
              content_type: "image/jpeg",
            },
            key: "b.jpg",
            last_modified: "2026-08-01T00:00:00.000Z",
            size: 12,
            storage_class: "Standard",
            uploaded: "2026-08-01T00:00:00.000Z",
          }],
          result_info: {cursor: "next-page", is_truncated: true},
          success: true,
        });
      }
      expect(url.searchParams.get("cursor")).toBe("next-page");
      return Response.json({
        result: [{
          customMetadata: {},
          etag: "etag-a",
          httpMetadata: {contentType: "text/plain"},
          key: "a.txt",
          size: 3,
          storageClass: "InfrequentAccess",
          uploaded: "2026-07-01T00:00:00.000Z",
        }],
        result_info: {is_truncated: false},
        success: true,
      });
    }));

    await expect(
      new CloudflareClient(runner).listR2Objects("account-id", "feed-media"),
    ).resolves.toEqual([
      expect.objectContaining({
        httpMetadata: {contentType: "text/plain"},
        key: "a.txt",
        size: 3,
      }),
      expect.objectContaining({
        customMetadata: {owner: "microfeed"},
        httpMetadata: {
          cacheControl: "public, max-age=60",
          contentType: "image/jpeg",
        },
        key: "b.jpg",
        size: 12,
      }),
    ]);
  });

  it("exports selected schema/data tables and executes restore SQL through Wrangler", async () => {
    const runner = vi.fn<CommandRunner>().mockResolvedValue(commandResult(
      JSON.stringify([{results: [{name: "channels"}]}]),
    ));
    const config: MicrofeedConfig = {
      accountId: "account-id",
      adminPath: "admin",
      completedSteps: [],
      customDomain: null,
      d1: {id: "database-id", name: "feed-db", reuse: false},
      deploymentUrl: "https://feed.example.workers.dev",
      hosting: "cloudflare",
      instanceId: "instance-id",
      instanceName: "feed",
      projectName: "feed",
      r2: {name: "feed-media", reuse: false, setupMode: "automatic"},
    };
    const cloudflare = new CloudflareClient(runner);

    await cloudflare.exportD1(
      config,
      "/tmp/schema.sql",
      ["channels", "d1_migrations"],
      "schema",
    );
    await cloudflare.exportD1(
      config,
      "/tmp/data.sql",
      ["channels", "d1_migrations"],
      "data",
    );
    await cloudflare.executeSqlFile(config, "/tmp/restore.sql");
    await expect(cloudflare.queryD1(
      config,
      "SELECT name FROM sqlite_schema",
    )).resolves.toEqual([{name: "channels"}]);

    const calls = runner.mock.calls.map((call) => call[1]);
    expect(calls[0]).toEqual(expect.arrayContaining([
      "d1", "export", "feed-db", "--remote", "--no-data",
      "--table", "channels", "--table", "d1_migrations",
    ]));
    expect(calls[1]).toEqual(expect.arrayContaining([
      "d1", "export", "feed-db", "--remote", "--no-schema",
    ]));
    expect(calls[2]).toEqual(expect.arrayContaining([
      "d1", "execute", "feed-db", "--remote", "--file",
      "/tmp/restore.sql", "--yes",
    ]));
  });
});
