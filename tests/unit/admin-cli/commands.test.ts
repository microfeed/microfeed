import {readFile} from "node:fs/promises";

import {afterEach, describe, expect, it, vi} from "vitest";

import {ADMIN_SETUP_SECRET_NAMES} from "@/shared/AdminCredentials";
import {
  accessApplicationDashboardUrl,
  accountsCommand,
  accessSetupInstructions,
  adminAuthDisableNotice,
  adminProtectionNotice,
  anonymousAdminProtection,
  DEPLOYMENT_VERIFICATION_RETRY_DELAYS_MS,
  deploymentOutcomeMessage,
  deploymentVerificationUrl,
  deployCommand,
  localAdminAuthSetupNotice,
  redeployWithAdminAuthMode,
  verifyDeployment,
  workersAndPagesDashboardUrl,
} from "../../../admin-cli/commands";
import {prompts} from "../../../admin-cli/lib/prompts";
import type {
  CommandRunner,
  MicrofeedConfig,
} from "../../../admin-cli/types";

afterEach(() => {
  delete process.env.WORKERS_CI;
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("read-only Cloudflare account discovery", () => {
  it("returns login, profile, and every account as JSON without mutations", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "whoami --json") {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify({
            accounts: [
              {id: "account-a", name: "Personal"},
              {id: "account-b", name: "Personal"},
            ],
            authType: "OAuth Token",
            email: "cloudflare@example.com",
            tokenPermissions: [
              "account:read",
              "user:read",
              "workers:write",
              "workers_scripts:write",
              "d1:write",
              "pages:write",
              "zone:read",
            ],
          }),
        };
      }
      if (command === "auth list") {
        return {
          exitCode: 0,
          stderr: "",
          stdout: [
            "│ Profile │ Bound Directories │",
            `│ personal │ ${process.cwd()} │`,
          ].join("\n"),
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await accountsCommand({json: true}, runner);

    expect(write).toHaveBeenCalledWith(expect.stringContaining(
      '"email": "cloudflare@example.com"',
    ));
    expect(write).toHaveBeenCalledWith(expect.stringContaining(
      '"id": "account-b"',
    ));
    const commands = runner.mock.calls.map(([, args]) => args[0]);
    expect(commands.every((command) =>
      command === "whoami" || command === "auth"
    )).toBe(true);
  });

  it("forces browser OAuth with keyring storage when reauthorization is requested", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "auth list") {
        return {exitCode: 0, stderr: "", stdout: ""};
      }
      if (command.startsWith("login --use-keyring --scopes ")) {
        return {exitCode: 0, stderr: "", stdout: "Authorized"};
      }
      if (command === "whoami --json") {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify({
            accounts: [{id: "account-a", name: "Personal"}],
            authType: "OAuth Token",
            email: "cloudflare@example.com",
            tokenPermissions: [
              "account:read",
              "user:read",
              "workers:write",
              "workers_scripts:write",
              "d1:write",
              "pages:write",
              "zone:read",
            ],
          }),
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await accountsCommand({json: true, reauthorize: true}, runner);

    expect(runner.mock.calls.some(([, args]) =>
      args[0] === "login" && args.includes("--use-keyring")
    )).toBe(true);
  });
});

describe("Cloudflare native deployment", () => {
  it("initializes auth and removes temporary setup secrets", async () => {
    process.env.WORKERS_CI = "1";
    let generatedSecrets: Record<string, unknown> | undefined;
    const runner = vi.fn<CommandRunner>(async (
      _executable,
      args,
      options,
    ) => {
      const command = args.join(" ");
      if (
        command.startsWith(
          "d1 migrations apply FEED_DB --remote --config ",
        ) &&
        command.endsWith("dist/server/wrangler.json")
      ) {
        return {exitCode: 0, stderr: "", stdout: "Migrations applied"};
      }
      if (command.startsWith("d1 execute FEED_DB --remote --command ")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify([{results: []}]),
        };
      }
      if (command.startsWith("secret list --format json --config ")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify(
            ADMIN_SETUP_SECRET_NAMES.map((name) => ({
              name,
              type: "secret_text",
            })),
          ),
        };
      }
      if (
        command.startsWith("deploy --strict --config ") &&
        command.includes("dist/server/wrangler.json") &&
        command.includes("--secrets-file")
      ) {
        const secretsFile = args[args.indexOf("--secrets-file") + 1]!;
        generatedSecrets = JSON.parse(
          await readFile(secretsFile, "utf8"),
        ) as Record<string, unknown>;
        return {
          exitCode: 0,
          stderr: "",
          stdout: "https://microfeed.example.workers.dev",
        };
      }
      if (command.startsWith("secret bulk --config ")) {
        expect(JSON.parse(options?.input ?? "{}")).toEqual(
          Object.fromEntries(
            ADMIN_SETUP_SECRET_NAMES.map((name) => [name, null]),
          ),
        );
        return {exitCode: 0, stderr: "", stdout: "Secrets updated"};
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const fetchMock = vi.fn(async (
      input: URL | RequestInfo,
      _init?: RequestInit,
    ) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      if (url.pathname === "/.well-known/microfeed/bootstrap-admin/") {
        return Response.json({status: "created"});
      }
      if (url.pathname === "/.well-known/microfeed.json") {
        return Response.json({
          instanceId: "native-build-instance",
          product: "microfeed",
        });
      }
      if (url.pathname === "/admin/login/") {
        return new Response("<html>Admin login</html>", {
          headers: {"content-type": "text/html"},
          status: 200,
        });
      }
      return new Response("404", {status: 404});
    });
    vi.stubGlobal("fetch", fetchMock);

    await deployCommand({"cloudflare-build": true}, runner);

    expect(runner).toHaveBeenCalledTimes(5);
    expect(runner).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/wrangler(?:\.cmd)?$/u),
      [
        "d1",
        "migrations",
        "apply",
        "FEED_DB",
        "--remote",
        "--config",
        expect.stringMatching(/dist[/\\]server[/\\]wrangler\.json$/u),
      ],
      expect.objectContaining({cwd: expect.any(String)}),
    );
    expect(generatedSecrets).toEqual({
      BETTER_AUTH_SECRET: expect.any(String),
      UPLOAD_SIGNING_KEY: expect.any(String),
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({method: "POST"}),
    );
    expect(JSON.stringify(runner.mock.calls)).not.toContain(
      "correct horse battery staple",
    );
  });

  it("aborts before deployment when a new owner has no setup secrets", async () => {
    process.env.WORKERS_CI = "1";
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command.startsWith("d1 migrations apply FEED_DB ")) {
        return {exitCode: 0, stderr: "", stdout: "Migrations applied"};
      }
      if (command.startsWith("d1 execute FEED_DB ")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify([{results: []}]),
        };
      }
      if (command.startsWith("secret list --format json ")) {
        return {exitCode: 0, stderr: "", stdout: "[]"};
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(
      deployCommand({"cloudflare-build": true}, runner),
    ).rejects.toThrow("no administrator yet");
    expect(runner).toHaveBeenCalledTimes(3);
  });

  it("preserves an existing owner and internal secrets on later builds", async () => {
    process.env.WORKERS_CI = "1";
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command.startsWith("d1 migrations apply FEED_DB ")) {
        return {exitCode: 0, stderr: "", stdout: "Migrations applied"};
      }
      if (command.startsWith("d1 execute FEED_DB ")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify([{
            results: [{
              email: "owner@example.com",
              id: "owner-id",
              role: "admin",
            }],
          }]),
        };
      }
      if (command.startsWith("secret list --format json ")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify([
            {name: "BETTER_AUTH_SECRET"},
            {name: "UPLOAD_SIGNING_KEY"},
          ]),
        };
      }
      if (command.startsWith("deploy --strict --config ")) {
        expect(command).not.toContain("--secrets-file");
        return {
          exitCode: 0,
          stderr: "",
          stdout: "https://microfeed.example.workers.dev",
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      return url.pathname === "/.well-known/microfeed.json"
        ? Response.json({
            instanceId: "native-build-instance",
            product: "microfeed",
          })
        : new Response("<html>Admin login</html>", {status: 200});
    });
    vi.stubGlobal("fetch", fetchMock);

    await deployCommand({"cloudflare-build": true}, runner);

    expect(runner).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.some(([input]) =>
      (
        input instanceof Request ? input.url : input.toString()
      ).includes("bootstrap-admin")
    )).toBe(false);
  });

  it("reports cleanup failures without reinitializing the owner", async () => {
    process.env.WORKERS_CI = "1";
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command.startsWith("d1 migrations apply FEED_DB ")) {
        return {exitCode: 0, stderr: "", stdout: "Migrations applied"};
      }
      if (command.startsWith("d1 execute FEED_DB ")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify([{results: []}]),
        };
      }
      if (command.startsWith("secret list --format json ")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify([
            {name: "BETTER_AUTH_SECRET"},
            {name: "UPLOAD_SIGNING_KEY"},
            ...ADMIN_SETUP_SECRET_NAMES.map((name) => ({name})),
          ]),
        };
      }
      if (command.startsWith("deploy --strict --config ")) {
        return {
          exitCode: 0,
          stderr: "",
          stdout: "https://microfeed.example.workers.dev",
        };
      }
      if (command.startsWith("secret bulk --config ")) {
        throw new Error("Cloudflare rejected cleanup");
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({status: "created"}),
    ));

    await expect(
      deployCommand({"cloudflare-build": true}, runner),
    ).rejects.toThrow(
      "admin login is ready, but Cloudflare could not remove",
    );
  });
});

describe("deployment verification URL", () => {
  const config: MicrofeedConfig = {
    accountId: "account-id",
    adminPath: "admin",
    completedSteps: [],
    customDomain: null,
    d1: {
      id: "database-id",
      name: "microfeed-db",
      reuse: false,
    },
    deploymentUrl: "https://microfeed.example.workers.dev",
    hosting: "cloudflare",
    instanceId: "instance-id",
    instanceName: "microfeed",
    projectName: "microfeed",
    r2: {
      name: "microfeed-media",
      reuse: false,
    },
  };

  it("uses workers.dev before a custom domain is configured", () => {
    expect(deploymentVerificationUrl(config)).toBe(
      "https://microfeed.example.workers.dev",
    );
  });

  it("uses the custom domain after cutover", () => {
    const customDomainConfig = {
      ...config,
      customDomain: "feed.example.com",
    };

    expect(deploymentVerificationUrl(customDomainConfig)).toBe(
      "https://feed.example.com",
    );
    expect(deploymentOutcomeMessage(customDomainConfig)).toBe(
      "Deployed and verified https://feed.example.com",
    );
  });

  it("labels preview deployment results", () => {
    expect(deploymentOutcomeMessage(config, true)).toBe(
      "Preview deployed and verified https://microfeed.example.workers.dev",
    );
  });
});

describe("deployment verification retries", () => {
  const config: MicrofeedConfig = {
    accountId: "account-id",
    adminPath: "admin",
    completedSteps: ["worker-deployed"],
    customDomain: "feed.example.com",
    d1: {
      id: "database-id",
      name: "microfeed-db",
      reuse: false,
    },
    deploymentUrl: "https://microfeed.example.workers.dev",
    hosting: "cloudflare",
    instanceId: "instance-id",
    instanceName: "microfeed",
    projectName: "microfeed",
    r2: {
      name: "microfeed-media",
      reuse: false,
    },
  };

  function dnsFailure(): TypeError {
    const cause = Object.assign(
      new Error("getaddrinfo ENOTFOUND feed.example.com"),
      {
        code: "ENOTFOUND",
        hostname: "feed.example.com",
      },
    );
    return new TypeError("fetch failed", {cause});
  }

  it("retries at staged intervals and succeeds when DNS becomes available", async () => {
    vi.useFakeTimers();
    vi.spyOn(prompts.log, "info").mockImplementation(() => undefined);
    const success = vi.spyOn(prompts.log, "success").mockImplementation(
      () => undefined,
    );
    const warning = vi.spyOn(prompts.log, "warn").mockImplementation(
      () => undefined,
    );
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(dnsFailure())
      .mockRejectedValueOnce(dnsFailure())
      .mockRejectedValueOnce(dnsFailure())
      .mockRejectedValueOnce(dnsFailure())
      .mockRejectedValueOnce(dnsFailure())
      .mockRejectedValueOnce(dnsFailure())
      .mockResolvedValueOnce(Response.json({
        instanceId: "instance-id",
        product: "microfeed",
      }));
    vi.stubGlobal("fetch", fetchMock);

    const verification = verifyDeployment(
      config,
      "https://feed.example.com",
    );
    await vi.runAllTimersAsync();
    await verification;

    expect(DEPLOYMENT_VERIFICATION_RETRY_DELAYS_MS).toEqual([
      5_000,
      10_000,
      20_000,
      40_000,
      80_000,
      160_000,
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining(
        "DNS lookup failed for feed.example.com (ENOTFOUND)",
      ),
    );
    expect(success).toHaveBeenCalledWith(
      "✅ Deployment verified at " +
        "https://feed.example.com/.well-known/microfeed.json after 6 retries.",
    );
  });

  it("confirms immediately through DoH when system DNS is stale", async () => {
    const info = vi.spyOn(prompts.log, "info").mockImplementation(
      () => undefined,
    );
    const success = vi.spyOn(prompts.log, "success").mockImplementation(
      () => undefined,
    );
    const fetchMock = vi.fn().mockRejectedValueOnce(dnsFailure());
    vi.stubGlobal("fetch", fetchMock);
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({
        instanceId: "instance-id",
        product: "microfeed",
      }) +
        "\n__MICROFEED_HTTP_STATUS__:200" +
        "\n__MICROFEED_REDIRECT_URL__:",
    });

    await verifyDeployment(
      config,
      "https://feed.example.com",
      {
        runner,
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(
      "curl",
      expect.arrayContaining([
        "--doh-url",
        "https://cloudflare-dns.com/dns-query",
        "https://feed.example.com/.well-known/microfeed.json",
      ]),
      {allowFailure: true},
    );
    expect(info).toHaveBeenCalledWith(
      "System DNS cannot resolve feed.example.com; checking immediately " +
        "through Cloudflare DNS over HTTPS.",
    );
    expect(success).toHaveBeenCalledWith(
      "✅ Deployment verified at " +
        "https://feed.example.com/.well-known/microfeed.json using " +
        "Cloudflare DNS over HTTPS because system DNS has not caught up.",
    );
  });

  it("reports the domain and manual check after the final retry", async () => {
    vi.useFakeTimers();
    vi.spyOn(prompts.log, "info").mockImplementation(() => undefined);
    vi.spyOn(prompts.log, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockRejectedValue(dnsFailure());
    vi.stubGlobal("fetch", fetchMock);

    let failure: unknown;
    const verification = verifyDeployment(
      config,
      "https://feed.example.com",
    ).catch((error: unknown) => {
      failure = error;
    });
    await vi.runAllTimersAsync();
    await verification;

    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(
      "after 7 attempts over about 315 seconds",
    );
    expect((failure as Error).message).toContain(
      "Custom domain: https://feed.example.com",
    );
    expect((failure as Error).message).toContain(
      "Manual check: https://feed.example.com/.well-known/microfeed.json",
    );
    expect((failure as Error).message).toContain(
      "Last error: DNS lookup failed for feed.example.com (ENOTFOUND)",
    );
  });
});

describe("guided Cloudflare Access setup", () => {
  it("uses account-specific dashboard links", () => {
    expect(accessApplicationDashboardUrl("account-id")).toBe(
      "https://dash.cloudflare.com/account-id/one/access-controls/apps/self-hosted/add",
    );
    expect(workersAndPagesDashboardUrl("account-id")).toBe(
      "https://dash.cloudflare.com/account-id/workers-and-pages",
    );
  });

  it("guides workers.dev users to protect only the admin path", () => {
    const instructions = accessSetupInstructions(
      "microfeed.example.workers.dev",
    );

    expect(instructions).toContain("Destination type: Public hostname");
    expect(instructions).toContain("Path: admin");
    expect(instructions).toContain("Cloudflare Account Member");
    expect(instructions).toContain("Do not choose Worker");
    expect(instructions).toContain("entire public site");
  });

  it("uses the same account-member policy for a custom domain", () => {
    const instructions = accessSetupInstructions("feed.example.com");

    expect(instructions).toContain("Hostname: feed.example.com");
    expect(instructions).toContain("Cloudflare Account Member");
    expect(instructions).not.toContain("Do not choose Worker");
  });
});

describe("admin protection notices", () => {
  const adminUrl = "https://feed.example.com/admin/";

  it("reports Cloudflare Access instead of calling the dashboard public", () => {
    expect(adminProtectionNotice("access", false, adminUrl)).toEqual({
      message:
        "Cloudflare Access (Zero Trust) protects " +
        "https://feed.example.com/admin/. Anonymous visitors are redirected " +
        "to Access, so the dashboard is not public.",
      title: "✅ Admin dashboard protected",
    });
  });

  it("reports both protection layers when they are active", () => {
    expect(adminProtectionNotice("access", true, adminUrl)).toEqual({
      message:
        "Cloudflare Access (Zero Trust) protects " +
        "https://feed.example.com/admin/, and the built-in login remains " +
        "active behind it.",
      title: "✅ Admin dashboard protected",
    });
  });

  it("only calls the dashboard public when no protection is detected", () => {
    expect(adminProtectionNotice(null, false, adminUrl)).toEqual({
      message:
        "The admin dashboard at https://feed.example.com/admin/ is public. " +
        "Run `yarn admin access` now, or add the built-in login with " +
        "`yarn admin auth setup`.",
      title: "Warning: admin dashboard is public",
    });
  });
});

describe("built-in admin authentication disable", () => {
  const adminUrl = "https://feed.example.com/admin/";

  it("explains when Cloudflare Access will remain as the admin gate", () => {
    expect(adminAuthDisableNotice("access", adminUrl)).toEqual({
      confirmation:
        "Disable the built-in login and rely on Cloudflare Access?",
      message:
        "Cloudflare Access (Zero Trust) currently protects " +
        "https://feed.example.com/admin/. After this change, Access will be " +
        "the only admin authentication gate. The existing account and " +
        "credentials will be kept, so you can restore the built-in login " +
        "later with `yarn admin auth setup`.",
      title: "✅ Cloudflare Access detected",
    });
  });

  it("warns precisely when disabling will make the dashboard public", () => {
    expect(adminAuthDisableNotice("built-in", adminUrl)).toEqual({
      confirmation:
        "Disable the built-in login and make the admin dashboard public?",
      message:
        "Cloudflare Access was not detected in front of " +
        "https://feed.example.com/admin/. Disabling the built-in login will " +
        "let anyone on the internet create, edit, or delete content. The " +
        "existing account and credentials will be kept, so you can restore " +
        "the built-in login later with `yarn admin auth setup`.",
      title: "Danger: admin dashboard will become public",
    });
  });

  it("restores the complete saved configuration when deployment fails", async () => {
    const config: MicrofeedConfig = {
      accountId: "account-id",
      adminAuthMode: "built-in",
      adminPath: "admin",
      completedSteps: ["better-auth-secret-created", "worker-deployed"],
      customDomain: null,
      d1: {id: "database-id", name: "feed-db", reuse: false},
      deploymentUrl: "https://feed.example.workers.dev",
      hosting: "cloudflare",
      instanceId: "instance-id",
      instanceName: "feed",
      projectName: "feed",
      r2: {name: "feed-media", reuse: false},
    };
    const previous = structuredClone(config);
    const writes: MicrofeedConfig[] = [];
    const write = vi.fn(async (nextConfig: MicrofeedConfig) => {
      writes.push(structuredClone(nextConfig));
    });
    const generate = vi.fn(async () => undefined);

    await expect(
      redeployWithAdminAuthMode(config, "none", {
        deploy: async (nextConfig) => {
          nextConfig.completedSteps.push("deployment-started");
          throw new Error("deployment failed");
        },
        generate,
        write,
      }),
    ).rejects.toThrow("deployment failed");

    expect(config).toEqual(previous);
    expect(writes).toEqual([
      {...previous, adminAuthMode: "none"},
      previous,
    ]);
    expect(generate).toHaveBeenCalledOnce();
    expect(generate).toHaveBeenCalledWith(config);
  });
});

describe("optional local admin authentication", () => {
  it("explains the local choice and production protection", () => {
    expect(localAdminAuthSetupNotice("practice")).toEqual({
      confirmation: "Set up a built-in admin email and password now?",
      message:
        "Built-in email and password authentication is optional for local " +
        "development. Set it up now to try the production sign-in flow, " +
        "or add it later with `yarn admin auth setup --local --instance " +
        "practice`.\n\nFor production, we strongly recommend protecting " +
        "`/admin/` with the built-in login, Cloudflare Zero Trust Access, " +
        "or both.",
      title: "Optional local admin login",
    });
  });
});

describe("anonymous admin protection detection", () => {
  it("recognizes the Cloudflare Access login redirect", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: {
          location:
            "https://example.cloudflareaccess.com/cdn-cgi/access/login/feed.example.com",
        },
        status: 302,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      anonymousAdminProtection("https://feed.example.com", "admin"),
    ).resolves.toBe("access");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://feed.example.com/admin/"),
      {redirect: "manual"},
    );
  });

  it("recognizes Access through DoH when system DNS is stale", async () => {
    const cause = Object.assign(
      new Error("getaddrinfo ENOTFOUND feed.example.com"),
      {
        code: "ENOTFOUND",
        hostname: "feed.example.com",
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed", {cause})),
    );
    const runner = vi.fn<CommandRunner>().mockResolvedValue({
      exitCode: 0,
      stderr: "",
      stdout:
        "\n__MICROFEED_HTTP_STATUS__:302" +
        "\n__MICROFEED_REDIRECT_URL__:" +
        "https://example.cloudflareaccess.com/cdn-cgi/access/login/feed.example.com",
    });

    await expect(
      anonymousAdminProtection(
        "https://feed.example.com",
        "admin",
        runner,
      ),
    ).resolves.toBe("access");
  });

  it("does not mistake a normal admin response for protection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Admin", {status: 200})),
    );

    await expect(
      anonymousAdminProtection("https://feed.example.com", "admin"),
    ).resolves.toBeNull();
  });
});
