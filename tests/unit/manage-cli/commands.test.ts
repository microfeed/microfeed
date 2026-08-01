import {afterEach, describe, expect, it, vi} from "vitest";

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
  initCommand,
  localAdminAuthSetupNotice,
  redeployWithAdminAuthMode,
  siteNameGuidance,
  validateWorkerName,
  verifyDeployment,
  workersAndPagesDashboardUrl,
} from "../../../manage-cli/commands";
import {prompts} from "../../../manage-cli/lib/prompts";
import type {
  CommandRunner,
  MicrofeedConfig,
} from "../../../manage-cli/types";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Cloudflare Worker name validation", () => {
  it("recommends a globally distinctive name derived from a custom address", () => {
    const guidance = siteNameGuidance();

    expect(guidance.message).toContain("globally unique");
    expect(guidance.message).toContain("my.domainname.com");
    expect(guidance.message).toContain("my-domainname-com");
  });

  it("accepts Cloudflare's workers.dev name boundaries", () => {
    expect(validateWorkerName("a")).toBeUndefined();
    expect(validateWorkerName("Personal-Feed-123")).toBeUndefined();
    expect(validateWorkerName("a".repeat(63))).toBeUndefined();
  });

  it("reports length, character, and edge-hyphen errors separately", () => {
    expect(validateWorkerName("")).toContain("1–63");
    expect(validateWorkerName("a".repeat(64))).toContain("1–63");
    expect(validateWorkerName("personal_feed")).toContain("underscores");
    expect(validateWorkerName("personal feed")).toContain("spaces");
    expect(validateWorkerName("-personal-feed")).toContain("start or end");
    expect(validateWorkerName("personal-feed-")).toContain("start or end");
  });

  it("rejects an explicit invalid name before Cloudflare authorization", async () => {
    const runner = vi.fn<CommandRunner>();

    await expect(initCommand({"project-name": "personal_feed"}, runner))
      .rejects.toThrow(
        "Invalid Worker name `personal_feed`. Use only ASCII letters, " +
          "numbers, and hyphens",
      );
    expect(runner).not.toHaveBeenCalled();
  });
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

  it("creates and activates a separately named Cloudflare login", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command.startsWith("auth create company --scopes ")) {
        return {exitCode: 0, stderr: "", stdout: "Authorized"};
      }
      if (command === `auth activate company ${process.cwd()}`) {
        return {exitCode: 0, stderr: "", stdout: "Activated"};
      }
      if (command === "auth list") {
        return {
          exitCode: 0,
          stderr: "",
          stdout: [
            "│ Profile │ Bound Directories │",
            `│ company │ ${process.cwd()} │`,
          ].join("\n"),
        };
      }
      if (command === "whoami --json") {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify({
            accounts: [{id: "account-company", name: "Company"}],
            authType: "OAuth Token",
            email: "company@example.com",
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

    await accountsCommand({
      json: true,
      profile: "company",
      reauthorize: true,
    }, runner);

    expect(runner.mock.calls.some(([, args]) =>
      args[0] === "auth" && args[1] === "create" && args[2] === "company"
    )).toBe(true);
    expect(runner.mock.calls.some(([, args]) =>
      args[0] === "auth" && args[1] === "activate" &&
      args[2] === "company"
    )).toBe(true);
    expect(runner.mock.calls.some(([, , options]) =>
      options?.env?.CLOUDFLARE_AUTH_USE_KEYRING === "true"
    )).toBe(true);
  });

  it("selects an existing named profile without replacing its login", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "auth list") {
        return {
          exitCode: 0,
          stderr: "",
          stdout: [
            "│ Profile │ Bound Directories │",
            `│ company │ ${process.cwd()} │`,
          ].join("\n"),
        };
      }
      if (command === `auth activate company ${process.cwd()}`) {
        return {exitCode: 0, stderr: "", stdout: "Activated"};
      }
      if (command === "whoami --json") {
        return {
          exitCode: 0,
          stderr: "",
          stdout: JSON.stringify({
            accounts: [{id: "account-company", name: "Company"}],
            authType: "OAuth Token",
            email: "company@example.com",
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

    await accountsCommand({json: true, profile: "company"}, runner);

    expect(runner.mock.calls.some(([, args]) =>
      args[0] === "login" || (args[0] === "auth" && args[1] === "create")
    )).toBe(false);
  });

  it("rejects missing, illegal, and reserved profile names before authorization", async () => {
    for (const profile of [true, "company account", "default"]) {
      const runner = vi.fn<CommandRunner>();

      await expect(accountsCommand({profile}, runner)).rejects.toThrow(
        /profile|Wrangler/iu,
      );
      expect(runner).not.toHaveBeenCalled();
    }
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

  it("guides workers.dev users to protect only the dashboard path", () => {
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

describe("dashboard protection notices", () => {
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
        "Run `yarn manage access` now, or add the built-in login with " +
        "`yarn manage auth setup`.",
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
        "later with `yarn manage auth setup`.",
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
        "the built-in login later with `yarn manage auth setup`.",
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
      confirmation: "Set up an administrator email and password now?",
      message:
        "Built-in email and password authentication is optional for local " +
        "development. Set it up now to try the production sign-in flow, " +
        "or add it later with `yarn manage auth setup --local --instance " +
        "practice`.\n\nFor production, we strongly recommend protecting " +
        "`/admin/` with the built-in login, Cloudflare Zero Trust Access, " +
        "or both.",
      title: "Optional local dashboard login",
    });
  });
});

describe("anonymous dashboard protection detection", () => {
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
