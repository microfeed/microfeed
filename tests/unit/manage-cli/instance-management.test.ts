import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {afterEach, describe, expect, it, vi} from "vitest";

import type {
  CommandRunner,
  MicrofeedConfig,
} from "../../../manage-cli/types";

const temporaryDirectories: string[] = [];

async function freshModules(
  options: {
    confirmAnswers?: boolean[];
    passwordAnswers?: string[];
    selectAnswers?: string[];
  } = {},
) {
  const directory = await mkdtemp(
    path.join(tmpdir(), "microfeed-instance-test-"),
  );
  temporaryDirectories.push(directory);
  process.env.MICROFEED_STATE_DIRECTORY = directory;
  // `yarn manage init --instance <name>` runs the suite with this variable
  // set to its deployment target. These tests exercise instance selection
  // themselves, so they must not inherit the outer management command.
  vi.stubEnv("MICROFEED_INSTANCE", "");
  if (
    options.confirmAnswers || options.passwordAnswers || options.selectAnswers
  ) {
    const confirmAnswers = [...(options.confirmAnswers ?? [])];
    const passwordAnswers = [...(options.passwordAnswers ?? [])];
    const selectAnswers = [...(options.selectAnswers ?? [])];
    vi.doMock("@clack/prompts", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@clack/prompts")>();
      return {
        ...actual,
        ...(options.confirmAnswers
          ? {
              confirm: vi.fn(async () => {
                const answer = confirmAnswers.shift();
                if (answer === undefined) {
                  throw new Error("No test confirmation answer remains.");
                }
                return answer;
              }),
            }
          : {}),
        ...(options.passwordAnswers
          ? {
              password: vi.fn(async () => {
                const answer = passwordAnswers.shift();
                if (answer === undefined) {
                  throw new Error("No test password answer remains.");
                }
                return answer;
              }),
            }
          : {}),
        ...(options.selectAnswers
          ? {
              select: vi.fn(async () => {
                const answer = selectAnswers.shift();
                if (answer === undefined) {
                  throw new Error("No test selection answer remains.");
                }
                return answer;
              }),
            }
          : {}),
      };
    });
  } else {
    vi.doUnmock("@clack/prompts");
  }
  vi.doMock("../../../manage-cli/theme", () => ({
    installBundledThemesForInitialization: vi.fn(async () => ({
      id: "bundled-default-test",
      packageId: "microfeed.default",
      version: "1.2.3",
    })),
    synchronizeBundledThemes: vi.fn(async () => []),
  }));
  vi.resetModules();
  // Import commands first so its config and prompt dependencies populate
  // Vitest's module cache before the test requests those modules directly.
  // Concurrent imports after resetModules can otherwise create duplicate
  // module instances that capture different temporary state directories.
  const commands = await import("../../../manage-cli/commands");
  const config = await import("../../../manage-cli/lib/config");
  const promptModule = await import("../../../manage-cli/lib/prompts");
  const theme = await import("../../../manage-cli/theme");
  return {commands, config, directory, prompts: promptModule.prompts, theme};
}

function commandResult(
  stdout = "",
  stderr = "",
  exitCode = 0,
) {
  return {exitCode, stderr, stdout};
}

function itemSearchCommandResult(args: readonly string[]) {
  const command = args.join(" ");
  if (
    command.startsWith("d1 execute FEED_DB --local --file ") &&
    command.includes("microfeed-item-search-")
  ) {
    return commandResult();
  }
  if (!command.startsWith("d1 execute FEED_DB --local --command ")) {
    return undefined;
  }
  const commandIndex = args.indexOf("--command");
  const sql = args[commandIndex + 1] ?? "";
  if (!sql.includes("site_search") && !sql.includes("content_text_updated_at")) {
    return undefined;
  }
  const results = sql.includes("sqlite_schema")
    ? [{name: "site_search_exact"}, {name: "site_search_title_trigram"}]
    : sql.includes("COUNT(*)")
    ? [{count: 0}]
    : [];
  return commandResult(JSON.stringify([{results}]));
}

function existingLocalOwnerRunner(): CommandRunner {
  return vi.fn<CommandRunner>(async (_executable, args) => {
    const command = args.join(" ");
    const itemSearch = itemSearchCommandResult(args);
    if (itemSearch) return itemSearch;
    if (command.startsWith("d1 migrations apply FEED_DB --local ")) {
      return commandResult("Migrations applied");
    }
    if (command.startsWith("d1 execute FEED_DB --local --command ")) {
      return commandResult(JSON.stringify([{
        results: [{
          email: "owner@example.com",
          id: "owner-id",
          role: "admin",
        }],
      }]));
    }
    if (args[0] === "dev:astro") {
      return commandResult();
    }
    throw new Error(`Unexpected command: ${command}`);
  });
}

function configurableLocalOwnerRunner(
  ownerExists: () => boolean,
): CommandRunner {
  return vi.fn<CommandRunner>(async (_executable, args) => {
    const command = args.join(" ");
    const itemSearch = itemSearchCommandResult(args);
    if (itemSearch) return itemSearch;
    if (command.startsWith("d1 migrations apply FEED_DB --local ")) {
      return commandResult("Migrations applied");
    }
    if (command.startsWith("d1 execute FEED_DB --local --command ")) {
      return commandResult(JSON.stringify([{
        results: ownerExists()
          ? [{
              email: "owner@example.com",
              id: "owner-id",
              role: "admin",
            }]
          : [],
      }]));
    }
    throw new Error(`Unexpected command: ${command}`);
  });
}

function localAuthMutationRunner(sqlStatements: string[]): CommandRunner {
  return vi.fn<CommandRunner>(async (_executable, args) => {
    const command = args.join(" ");
    const itemSearch = itemSearchCommandResult(args);
    if (itemSearch) return itemSearch;
    if (command.startsWith("d1 migrations apply FEED_DB --local ")) {
      return commandResult("Migrations applied");
    }
    if (command.startsWith("d1 execute FEED_DB --local --command ")) {
      return commandResult(JSON.stringify([{
        results: [{
          email: "owner@example.com",
          id: "owner-id",
          role: "admin",
        }],
      }]));
    }
    if (command.startsWith("d1 execute FEED_DB --local --file ")) {
      const fileIndex = args.indexOf("--file");
      sqlStatements.push(await readFile(args[fileIndex + 1]!, "utf8"));
      return commandResult("SQL executed");
    }
    throw new Error(`Unexpected command: ${command}`);
  });
}

const requiredScopes = [
  "account:read",
  "user:read",
  "workers:write",
  "workers_scripts:write",
  "d1:write",
  "pages:write",
  "zone:read",
];

function completedRemoteConfig(): MicrofeedConfig {
  return {
    accountId: "account-id",
    adminAuthMode: "built-in",
    adminPath: "admin",
    completedSteps: [
      "d1-ready",
      "r2-ready",
      "worker-deployed",
      "deployment-verified",
    ],
    customDomain: null,
    d1: {id: "database-id", name: "feed-db", reuse: false},
    deploymentUrl: "https://feed.example.workers.dev",
    hosting: "cloudflare",
    instanceId: "installation-id",
    instanceName: "feed",
    projectName: "feed",
    r2: {name: "feed-media", reuse: false, setupMode: "automatic"},
  };
}

function completedRemoteRunner(input: {
  ownerExists: boolean;
  pendingEmail?: string;
  sqlStatements?: string[];
}): CommandRunner {
  return vi.fn<CommandRunner>(async (_executable, args) => {
    const command = args.join(" ");
    if (command === "whoami --json") {
      return commandResult(JSON.stringify({
        accounts: [{id: "account-id", name: "Personal"}],
        authType: "OAuth Token",
        email: "cloudflare@example.com",
        tokenPermissions: requiredScopes,
      }));
    }
    if (
      command.includes("d1 execute feed-db --remote --command") &&
      command.includes("FROM \"auth_user\"")
    ) {
      return commandResult(JSON.stringify([{
        results: input.ownerExists
          ? [{email: "owner@example.com", id: "owner-id", role: "admin"}]
          : [],
      }]));
    }
    if (
      command.includes("d1 execute feed-db --remote --command") &&
      command.includes("FROM \"auth_password_setup\"")
    ) {
      return commandResult(JSON.stringify([{
        results: input.pendingEmail
          ? [{
              createdAt: "2026-07-31T00:00:00.000Z",
              email: input.pendingEmail,
              expiresAt: "2026-07-31T00:30:00.000Z",
              purpose: "initial",
              userId: null,
            }]
          : [],
      }]));
    }
    if (
      command.includes("d1 execute feed-db --remote --file")
    ) {
      const fileIndex = args.indexOf("--file");
      if (input.sqlStatements && fileIndex >= 0) {
        input.sqlStatements.push(await readFile(args[fileIndex + 1]!, "utf8"));
      }
      return commandResult("Executed");
    }
    if (command.startsWith("d1 migrations apply feed-db --remote ")) {
      return commandResult("Migrations applied");
    }
    throw new Error(`Unexpected command: ${command}`);
  });
}

afterEach(async () => {
  delete process.env.MICROFEED_STATE_DIRECTORY;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock("@clack/prompts");
  vi.resetModules();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {force: true, recursive: true})
    ),
  );
});

describe("first-class local instances", () => {
  it("describes the exact dashboard login target before authentication changes", async () => {
    const {commands, config} = await freshModules();
    const remote = {
      ...completedRemoteConfig(),
      customDomain: "podcast.example.com",
      workerName: "podcast-worker",
    };

    expect(
      commands.authTargetNotice(remote, "setup", false, false),
    ).toEqual({
      message: [
        "Instance: feed",
        "Target: Cloudflare production",
        "Worker: podcast-worker",
        "Dashboard: https://podcast.example.com/admin/",
        "Action: Set up dashboard login",
      ].join("\n"),
      title: "Dashboard login target",
    });
    expect(
      commands.authTargetNotice(remote, "change-path", false, true).message,
    ).toContain("Target: Cloudflare preview");

    const localOnly = await config.ensureLocalOnlyConfig("restored-local");
    expect(
      commands.authTargetNotice(
        localOnly,
        "reset-password",
        true,
        false,
      ),
    ).toEqual({
      message: [
        "Instance: restored-local",
        "Target: Local instance",
        "Dashboard path: /admin/",
        "Action: Reset dashboard password",
      ].join("\n"),
      title: "Dashboard login target",
    });
    expect(
      commands.authTargetNotice(remote, "change-email", true, false).message,
    ).toContain("Target: Local development sandbox");
  });

  it("creates and isolates multiple named local instances", async () => {
    const {commands, config, prompts} = await freshModules();
    const runner = existingLocalOwnerRunner();
    vi.spyOn(prompts.log, "success").mockImplementation(() => undefined);

    await commands.initCommand(
      {instance: "personal", local: true},
      runner,
    );
    const personal = await config.readConfig(false, "personal");
    const personalSecrets = await readFile(
      config.localDevVarsPath(personal!),
      "utf8",
    );

    await commands.initCommand(
      {instance: "company", local: true},
      runner,
    );
    const company = await config.readConfig(false, "company");
    const companySecrets = await readFile(
      config.localDevVarsPath(company!),
      "utf8",
    );

    expect(personal).toEqual(expect.objectContaining({
      accountId: null,
      hosting: "local",
      instanceName: "personal",
    }));
    expect(company).toEqual(expect.objectContaining({
      accountId: null,
      hosting: "local",
      instanceName: "company",
    }));
    expect(personal?.instanceId).not.toBe(company?.instanceId);
    expect(personal?.d1.name).not.toBe(company?.d1.name);
    expect(personal?.r2.name).not.toBe(company?.r2.name);
    expect(personalSecrets).not.toBe(companySecrets);
    expect(await config.readActiveInstance()).toBe("company");

    const callsBeforeRepeatedInit = (runner as ReturnType<typeof vi.fn>)
      .mock.calls.length;
    await expect(
      commands.initCommand(
        {instance: "personal", local: true},
        runner,
      ),
    ).rejects.toThrow(
      "Use `yarn manage dev --instance personal`",
    );
    expect((runner as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(
      callsBeforeRepeatedInit,
    );

    const persistPaths = (runner as ReturnType<typeof vi.fn>).mock.calls
      .map(([, args]) => args.join(" "))
      .filter((command) => command.includes("--persist-to"));
    expect(persistPaths.some((command) =>
      command.includes(path.join("instances", "personal", "local-state"))
    )).toBe(true);
    expect(persistPaths.some((command) =>
      command.includes(path.join("instances", "company", "local-state"))
    )).toBe(true);
    expect(persistPaths.every((command) => !command.includes("--remote")))
      .toBe(true);
  });

  it("keeps explicit local auth compatibility and infers the active local instance", async () => {
    const {commands, config} = await freshModules();
    const runner = existingLocalOwnerRunner();
    const output = vi.spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );

    await commands.authCommand({action: "setup", local: true}, runner);
    await expect(config.readConfig(false, "local")).resolves.toEqual(
      expect.objectContaining({
        hosting: "local",
        instanceName: "local",
      }),
    );
    await expect(
      commands.authCommand({
        action: "setup",
        instance: "local",
        preview: true,
      }, runner),
    ).rejects.toThrow(
      "Instance `local` is local only and has no preview environment.",
    );

    await commands.devCommand({instance: "local"}, runner);
    const text = output.mock.calls.map(([value]) => String(value)).join("");
    expect(text).toContain("Dashboard login target");
    expect(text).toContain("Instance: local");
    expect(text).toContain("Target: Local instance");
    expect(text).toContain("Action: Set up dashboard login");
    expect(text).toContain(
      "Production D1 and R2 data will not be accessed or changed.",
    );
    expect(text).toContain("Instance type: Local only");
    const devCall = (runner as ReturnType<typeof vi.fn>).mock.calls.find(
      ([, args]) => args[0] === "dev:astro",
    );
    expect(devCall?.[2]).toMatchObject({
      env: expect.objectContaining({
        ASTRO_DEV_BACKGROUND: "1",
        MICROFEED_WRANGLER_CONFIG: expect.any(String),
      }),
      interactive: true,
    });
    expect(path.isAbsolute(
      devCall?.[2]?.env?.MICROFEED_WRANGLER_CONFIG ?? "",
    )).toBe(false);
    expect(devCall?.[2]?.env?.MICROFEED_WRANGLER_CONFIG)
      .not.toMatch(/^file:/u);
  });

  it("changes the local login email and resets its password safely", async () => {
    const password = "a replacement private password";
    const {commands, config} = await freshModules({
      passwordAnswers: [password, password],
    });
    const sqlStatements: string[] = [];
    const runner = localAuthMutationRunner(sqlStatements);
    await config.ensureLocalOnlyConfig("restored-local");

    await commands.authCommand({
      action: "change-email",
      instance: "restored-local",
      "owner-email": " New-Owner@Example.com ",
    }, runner);
    await commands.authCommand({
      action: "reset-password",
      instance: "restored-local",
    }, runner);

    expect(sqlStatements).toHaveLength(2);
    expect(sqlStatements[0]).toContain("new-owner@example.com");
    expect(sqlStatements[0]).toContain('DELETE FROM "auth_session"');
    expect(sqlStatements[1]).toContain('UPDATE "auth_account"');
    expect(sqlStatements[1]).toContain('DELETE FROM "auth_session"');
    expect(sqlStatements[1]).toContain('DELETE FROM "auth_password_setup"');
    expect(sqlStatements[1]).not.toContain(password);
    const fileCommands = (runner as ReturnType<typeof vi.fn>).mock.calls
      .map(([, args]) => args.join(" "))
      .filter((command) => command.includes("--file"));
    expect(fileCommands).toHaveLength(2);
    expect(fileCommands.every((command) =>
      command.includes(path.join("instances", "restored-local", "local-state")) &&
      command.includes("--local") &&
      !command.includes("--remote")
    )).toBe(true);
  });

  it("can skip local login and enable it later for the same instance", async () => {
    const {commands, config} = await freshModules();
    let ownerExists = false;
    const runner = configurableLocalOwnerRunner(() => ownerExists);
    const output = vi.spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );

    await commands.initCommand({
      "admin-auth": "none",
      instance: "practice",
      local: true,
    }, runner);

    const skipped = await config.readConfig(false, "practice");
    expect(skipped).toEqual(expect.objectContaining({
      adminAuthMode: "none",
      hosting: "local",
      instanceName: "practice",
    }));
    await expect(
      readFile(config.wranglerConfigPath(skipped!), "utf8"),
    ).resolves.toContain('"MICROFEED_ADMIN_AUTH_MODE": "none"');
    const setupOutput = output.mock.calls
      .flat()
      .join("\n")
      .replaceAll(/\s+/gu, " ");
    expect(setupOutput).toContain(
      "yarn manage auth setup --instance",
    );

    ownerExists = true;
    await commands.authCommand({
      action: "setup",
      instance: "practice",
    }, runner);

    const enabled = await config.readConfig(false, "practice");
    expect(enabled).toEqual(expect.objectContaining({
      adminAuthMode: "built-in",
      instanceName: "practice",
    }));
    await expect(
      readFile(config.wranglerConfigPath(enabled!), "utf8"),
    ).resolves.toContain('"MICROFEED_ADMIN_AUTH_MODE": "built-in"');
  });

  it("disables an existing local-only login without changing local data", async () => {
    const {commands, config, prompts} = await freshModules({
      confirmAnswers: [true],
    });
    const sqlStatements: string[] = [];
    const runner = localAuthMutationRunner(sqlStatements);
    const initial = await config.ensureLocalOnlyConfig("practice");
    const localDataDirectory = config.localPersistencePath(initial);
    const sentinelPath = path.join(localDataDirectory, "keep.txt");
    await mkdir(localDataDirectory, {recursive: true});
    await writeFile(sentinelPath, "preserved", "utf8");
    const note = vi.spyOn(prompts, "note").mockImplementation(
      () => undefined,
    );
    const outro = vi.spyOn(prompts, "outro").mockImplementation(
      () => undefined,
    );

    await commands.authCommand({
      action: "disable",
      instance: "practice",
    }, runner);

    const disabled = await config.readConfig(false, "practice");
    expect(disabled).toEqual(expect.objectContaining({
      adminAuthMode: "none",
      d1: initial.d1,
      r2: initial.r2,
    }));
    await expect(readFile(sentinelPath, "utf8")).resolves.toBe("preserved");
    await expect(
      readFile(config.wranglerConfigPath(disabled!), "utf8"),
    ).resolves.toContain('"MICROFEED_ADMIN_AUTH_MODE": "none"');
    expect(sqlStatements).toHaveLength(1);
    expect(sqlStatements[0]).toContain('DELETE FROM "oauth_access_token"');
    expect(sqlStatements[0]).toContain('DELETE FROM "oauth_refresh_token"');
    expect(sqlStatements[0]).toContain('DELETE FROM "oauth_consent"');
    expect(note).toHaveBeenCalledWith(
      expect.stringContaining("Anyone who can reach the local development server"),
      "Local dashboard login will be disabled",
    );
    expect(outro).toHaveBeenCalledWith(
      "Built-in login disabled for this local instance. Restart " +
        "`yarn dev --instance practice` if it is running.",
    );

    await commands.authCommand({
      action: "disable",
      instance: "practice",
    }, runner);
    expect(outro).toHaveBeenLastCalledWith(
      "The built-in dashboard login is already disabled.",
    );
  });

  it("does not let a local sandbox override Cloudflare authentication", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(completedRemoteConfig());

    await expect(commands.authCommand({
      action: "disable",
      instance: "feed",
      local: true,
      yes: true,
    }, vi.fn<CommandRunner>())).rejects.toThrow(
      "local sandbox cannot override the saved production authentication mode",
    );
    await expect(config.readConfig(false, "feed")).resolves.toEqual(
      expect.objectContaining({adminAuthMode: "built-in"}),
    );
  });

  it("shows saved local instances while signed out of Cloudflare", async () => {
    const {commands, prompts} = await freshModules();
    const localRunner = existingLocalOwnerRunner();
    vi.spyOn(prompts.log, "success").mockImplementation(() => undefined);
    await commands.initCommand(
      {instance: "personal", local: true},
      localRunner,
    );
    const signedOutRunner = vi.fn<CommandRunner>().mockResolvedValue(
      commandResult("", "Not logged in", 1),
    );
    const output = vi.spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );

    await commands.instancesCommand({}, signedOutRunner);

    const text = output.mock.calls.map(([value]) => String(value)).join("");
    expect(text).toContain("personal (active)");
    expect(text).toContain("Type: Local only");
    expect(text).toContain("Cloudflare discovery skipped");

    output.mockClear();
    await commands.instancesCommand({json: true}, signedOutRunner);
    const result = JSON.parse(
      output.mock.calls.map(([value]) => String(value)).join(""),
    ) as {
      accounts: unknown[];
      local: Array<{active: boolean; name: string}>;
      messages: string[];
    };
    expect(result.accounts).toEqual([]);
    expect(result.local).toEqual([
      expect.objectContaining({active: true, name: "personal"}),
    ]);
    expect(result.messages).toEqual([
      expect.stringContaining("Cloudflare discovery skipped"),
    ]);
  });

  it("rejects Cloudflare operations for a local-only instance", async () => {
    const {commands, config} = await freshModules();
    await config.ensureLocalOnlyConfig("personal");
    const runner = vi.fn<CommandRunner>();

    await expect(
      commands.deployCommand({instance: "personal"}, runner),
    ).rejects.toThrow("is local only and has no Cloudflare deployment");
    expect(runner).not.toHaveBeenCalled();
  });

  it("distinguishes connecting from initializing when deploy has no local state", async () => {
    const {commands} = await freshModules();
    const runner = vi.fn<CommandRunner>();

    await expect(
      commands.deployCommand({instance: "existing-feed"}, runner),
    ).rejects.toThrow(
      "No saved local microfeed configuration was found for instance " +
        "`existing-feed`. To connect an existing Cloudflare microfeed " +
        "under this local name, run `yarn manage connect --instance " +
        "existing-feed`. To create a new Cloudflare installation, run " +
        "`yarn manage init --instance existing-feed`.",
    );
    expect(runner).not.toHaveBeenCalled();
  });

  it("resumes an incomplete first deployment with its upload-signing secret", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig({
      ...completedRemoteConfig(),
      adminAuthMode: "none",
      completedSteps: ["d1-ready", "r2-ready"],
      deploymentUrl: null,
    });
    let deployedSecrets: Record<string, string> | undefined;
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "whoami --json") {
        return commandResult(JSON.stringify({
          accounts: [{id: "account-id", name: "Personal"}],
          authType: "OAuth Token",
          email: "cloudflare@example.com",
          tokenPermissions: requiredScopes,
        }));
      }
      if (command === "pages project list --json") {
        return commandResult("[]");
      }
      if (command === "rev-parse --verify HEAD") {
        return commandResult("a".repeat(40));
      }
      if (command.startsWith("d1 migrations apply feed-db --remote ")) {
        return commandResult("Migrations applied");
      }
      if (command.startsWith("d1 execute feed-db --remote --file ")) {
        return commandResult("Executed");
      }
      if (command.startsWith("d1 execute feed-db --remote --command ")) {
        const sql = args[args.indexOf("--command") + 1] ?? "";
        const results = sql.includes("sqlite_schema")
          ? [{name: "site_search_exact"}, {name: "site_search_title_trigram"}]
          : sql.includes("COUNT(*)") ? [{count: 0}] : [];
        return commandResult(JSON.stringify([{results}]));
      }
      if (["types", "typecheck", "test:deploy", "build"].includes(args[0]!)) {
        return commandResult();
      }
      if (args[0] === "deploy") {
        const secretIndex = args.indexOf("--secrets-file");
        expect(secretIndex).toBeGreaterThan(-1);
        deployedSecrets = JSON.parse(
          await readFile(args[secretIndex + 1]!, "utf8"),
        ) as Record<string, string>;
        return commandResult("https://feed.example.workers.dev");
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      instanceId: "installation-id",
      product: "microfeed",
    })));

    await commands.deployCommand({instance: "feed"}, runner);

    expect(deployedSecrets).toEqual({
      UPLOAD_SIGNING_KEY: expect.any(String),
    });
    expect(deployedSecrets?.UPLOAD_SIGNING_KEY).toHaveLength(43);
    await expect(config.readConfig(false, "feed")).resolves.toEqual(
      expect.objectContaining({
        completedSteps: expect.arrayContaining([
          "upload-signing-secret-created",
          "worker-deployed",
          "deployment-verified",
        ]),
        deploymentUrl: "https://feed.example.workers.dev",
      }),
    );
  });

  it("creates a content-only local instance and enables simulated R2 later", async () => {
    const {commands, config, theme} = await freshModules();
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      const itemSearch = itemSearchCommandResult(args);
      if (itemSearch) return itemSearch;
      if (command.startsWith("d1 migrations apply FEED_DB --local ")) {
        return commandResult("Migrations applied");
      }
      if (command.startsWith("d1 execute FEED_DB --local --command ")) {
        return commandResult(JSON.stringify([{results: []}]));
      }
      if (
        ["types", "typecheck", "test:deploy", "build"].includes(args[0]!)
      ) {
        return commandResult();
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await commands.initCommand({
      "admin-auth": "none",
      instance: "content-only",
      local: true,
      "no-r2": true,
      "r2-name": "future-media",
      yes: true,
    }, runner);
    const disabled = await config.readConfig(false, "content-only");
    expect(disabled?.r2).toEqual({
      name: "future-media",
      reuse: false,
      setupMode: "disabled",
    });
    expect(disabled?.completedSteps).not.toContain("r2-ready");
    const disabledWrangler = await readFile(
      config.wranglerConfigPath(disabled!),
      "utf8",
    );
    expect(disabledWrangler).not.toContain('"r2_buckets"');
    expect(() => JSON.parse(disabledWrangler)).not.toThrow();
    expect(disabledWrangler).toContain(
      '"MICROFEED_R2_SETUP_MODE": "disabled"',
    );

    const preservedFile = path.join(
      config.localPersistencePath(disabled!),
      "preserved.txt",
    );
    await mkdir(path.dirname(preservedFile), {recursive: true});
    await writeFile(preservedFile, "keep me", "utf8");
    await commands.deployCommand({
      "enable-r2": true,
      instance: "content-only",
      local: true,
    }, runner);

    expect(theme.synchronizeBundledThemes).toHaveBeenCalledWith(
      expect.objectContaining({instanceName: "content-only"}),
      runner,
      true,
    );

    const enabled = await config.readConfig(false, "content-only");
    expect(enabled?.r2.setupMode).toBe("automatic");
    expect(enabled?.completedSteps).toContain("r2-ready");
    await expect(readFile(preservedFile, "utf8")).resolves.toBe("keep me");
    await expect(
      readFile(config.wranglerConfigPath(enabled!), "utf8"),
    ).resolves.toContain('"binding": "MEDIA_BUCKET"');
    const yarnScripts = runner.mock.calls
      .filter(([executable]) =>
        /^yarn(?:\.cmd|\.js)?$/u.test(path.basename(executable))
      )
      .map(([, args]) => args[0]);
    expect(yarnScripts).toEqual([
      "types",
      "typecheck",
      "test:deploy",
      "build",
    ]);
    expect(yarnScripts).not.toContain("test");
    expect(runner.mock.calls
      .filter(([executable]) =>
        /^yarn(?:\.cmd|\.js)?$/u.test(path.basename(executable))
      )
      .every(([, , options]) =>
        !path.isAbsolute(options?.env?.MICROFEED_WRANGLER_CONFIG ?? "") &&
        !options?.env?.MICROFEED_WRANGLER_CONFIG?.startsWith("file:")
      )).toBe(true);
  });

  it("simulates webhooks automatically in dev without changing deployment opt-in", async () => {
    const {commands, config, prompts} = await freshModules();
    const info = vi.spyOn(prompts.log, "info").mockImplementation(
      () => undefined,
    );
    const generatedDuringDev: string[] = [];
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      const itemSearch = itemSearchCommandResult(args);
      if (itemSearch) return itemSearch;
      if (command.startsWith("d1 migrations apply FEED_DB --local ")) {
        return commandResult("Migrations applied");
      }
      if (command.startsWith("d1 execute FEED_DB --local --command ")) {
        return commandResult(JSON.stringify([{results: []}]));
      }
      if (args[0] === "dev:astro") {
        const current = await config.readConfig(false, "webhook-local");
        generatedDuringDev.push(await readFile(
          config.wranglerConfigPath(current!),
          "utf8",
        ));
        return commandResult();
      }
      if (["types", "typecheck", "test:deploy", "build"].includes(args[0]!)) {
        return commandResult();
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    await config.ensureLocalOnlyConfig("webhook-local");

    await commands.deployCommand({instance: "webhook-local", local: true}, runner);
    let saved = await config.readConfig(false, "webhook-local");
    let generated = await readFile(config.wranglerConfigPath(saved!), "utf8");
    expect(saved?.webhooks).toMatchObject({state: "unprovisioned"});
    expect(generated).not.toContain('"WEBHOOK_QUEUE"');
    expect(generated).toContain('"queues": {"consumers": [], "producers": []}');
    expect(generated).toContain('"crons": []');
    expect(generated).not.toContain('"WEBHOOK_SECRET_KEY"');

    await commands.devCommand({instance: "webhook-local"}, runner);
    saved = await config.readConfig(false, "webhook-local");
    generated = await readFile(config.wranglerConfigPath(saved!), "utf8");
    expect(generatedDuringDev[0]).toContain('"binding": "WEBHOOK_QUEUE"');
    expect(generatedDuringDev[0]).toContain('"WEBHOOK_SECRET_KEY"');
    expect(saved?.webhooks).toMatchObject({state: "unprovisioned"});
    expect(generated).not.toContain('"WEBHOOK_QUEUE"');

    await commands.devCommand({
      "disable-webhooks": true,
      instance: "webhook-local",
    }, runner);
    expect(generatedDuringDev[1]).not.toContain('"WEBHOOK_QUEUE"');
    expect(generatedDuringDev[1]).toContain('"crons": []');
    expect((await config.readConfig(false, "webhook-local"))?.webhooks)
      .toMatchObject({state: "unprovisioned"});

    await commands.devCommand({
      "enable-webhooks": true,
      instance: "webhook-local",
    }, runner);
    expect(info).toHaveBeenCalledWith(expect.stringContaining(
      "already enabled for every local development session",
    ));

    await commands.deployCommand({
      "enable-webhooks": true,
      instance: "webhook-local",
      local: true,
    }, runner);
    saved = await config.readConfig(false, "webhook-local");
    generated = await readFile(config.wranglerConfigPath(saved!), "utf8");
    expect(saved?.webhooks).toMatchObject({state: "enabled"});
    expect(saved?.webhooks?.queueName).toBe("microfeed-webhook-local-webhooks");
    expect(generated).toContain('"binding": "WEBHOOK_QUEUE"');
    expect(generated).toContain('"max_retries": 5');
    expect(generated).toContain('"0 * * * *"');
    expect(generated).toContain('"WEBHOOK_SECRET_KEY"');
  });

  it("stops local deployment preparation when smoke tests fail", async () => {
    const {commands, config} = await freshModules();
    await config.ensureLocalOnlyConfig("smoke-failure");
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      const itemSearch = itemSearchCommandResult(args);
      if (itemSearch) return itemSearch;
      if (command.startsWith("d1 migrations apply FEED_DB --local ")) {
        return commandResult("Migrations applied");
      }
      if (["types", "typecheck"].includes(args[0]!)) {
        return commandResult();
      }
      if (args[0] === "test:deploy") {
        throw new Error("deployment smoke tests failed");
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(commands.deployCommand({
      instance: "smoke-failure",
      local: true,
    }, runner)).rejects.toThrow("deployment smoke tests failed");
    const yarnScripts = runner.mock.calls
      .filter(([executable]) =>
        /^yarn(?:\.cmd|\.js)?$/u.test(path.basename(executable))
      )
      .map(([, args]) => args[0]);
    expect(yarnScripts).toEqual(["types", "typecheck", "test:deploy"]);
    expect(yarnScripts).not.toContain("build");
  });

  it("rejects incompatible no-R2 flags and never detaches ready local R2", async () => {
    const {commands, config} = await freshModules();
    const runner = vi.fn<CommandRunner>();

    await expect(commands.initCommand({
      "no-r2": true,
      preview: true,
    }, runner)).rejects.toThrow("cannot be used together");
    await expect(commands.initCommand({
      "no-r2": true,
      "reuse-r2": true,
    }, runner)).rejects.toThrow("cannot be used together");
    await config.ensureLocalOnlyConfig("ready-local");
    await expect(commands.initCommand({
      instance: "ready-local",
      local: true,
      "no-r2": true,
    }, runner)).rejects.toThrow("never removes an existing media binding");
    expect(runner).not.toHaveBeenCalled();
  });
});

describe("initialization lifecycle", () => {
  it("points an existing same-named Worker to connect", async () => {
    const {commands} = await freshModules();
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "whoami --json") {
        return commandResult(JSON.stringify({
          accounts: [{id: "account-id", name: "Personal"}],
          authType: "OAuth Token",
          email: "cloudflare@example.com",
          tokenPermissions: requiredScopes,
        }));
      }
      if (command === "pages project list --json") {
        return commandResult("[]");
      }
      if (
        command === "versions list --name existing-feed --json"
      ) {
        return commandResult("[]");
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(commands.initCommand({
      "account-id": "account-id",
      "admin-path": "admin",
      "d1-name": "existing-feed-db",
      instance: "local-feed",
      "project-name": "existing-feed",
      "r2-name": "existing-feed-media",
      yes: true,
    }, runner)).rejects.toThrow(
      "A Worker named `existing-feed` already exists, but this clone has " +
        "no saved state for it. microfeed will not overwrite it. If it is " +
        "an existing microfeed installation, connect it with " +
        "`yarn manage connect --worker existing-feed --instance " +
        "local-feed`. Otherwise, choose a different project name.",
    );
    const commandsRun = runner.mock.calls.map(([, args]) => args.join(" "));
    expect(commandsRun.some((command) =>
      /(?:d1 create|r2 bucket create|deploy)/u.test(command)
    )).toBe(false);
  });

  it("defers, explicitly enables, and collision-guards Cloudflare R2", async () => {
    const {commands, config} = await freshModules();
    const {CloudflareClient} = await import(
      "../../../manage-cli/lib/cloudflare"
    );
    const pending = {
      ...completedRemoteConfig(),
      completedSteps: completedRemoteConfig().completedSteps.filter(
        (step) => step !== "r2-ready",
      ),
      r2: {
        name: "feed-media",
        reuse: false,
        setupMode: "automatic" as const,
      },
    };
    await config.writeConfig(pending);

    const notEntitledRunner = vi.fn<CommandRunner>().mockResolvedValue(
      commandResult("", "[code: 10042] NotEntitled", 1),
    );
    const notEntitledContext = {
      cloudflare: new CloudflareClient(notEntitledRunner),
      flags: {"enable-r2": true},
      instanceName: "feed",
      runner: notEntitledRunner,
    };
    await expect(
      commands.prepareR2ForDeployment(notEntitledContext, pending, true),
    ).rejects.toThrow(
      "https://dash.cloudflare.com/account-id/r2/overview",
    );
    expect(pending.completedSteps).not.toContain("r2-ready");

    const createRunner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "r2 bucket info feed-media --json") {
        return commandResult("", "Bucket not found", 1);
      }
      if (command ===
        "r2 bucket create feed-media --no-update-config") {
        return commandResult("Created");
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const createContext = {
      cloudflare: new CloudflareClient(createRunner),
      flags: {"enable-r2": true},
      instanceName: "feed",
      runner: createRunner,
    };
    await expect(
      commands.prepareR2ForDeployment(createContext, pending, true),
    ).resolves.toBe(true);
    expect(pending.completedSteps).toContain("r2-ready");
    expect(pending.completedSteps).toContain("r2-enable-pending");
    expect(pending.r2.setupMode).toBe("automatic");
    await expect(
      readFile(config.wranglerConfigPath(pending), "utf8"),
    ).resolves.toContain('"binding": "MEDIA_BUCKET"');

    const verificationContext = {
      ...createContext,
      cloudflare: {
        r2BucketExists: vi.fn().mockResolvedValue(true),
        workerBindings: vi.fn().mockResolvedValue([]),
      },
    };
    await expect(
      commands.verifyR2Deployment(
        verificationContext as never,
        pending,
      ),
    ).rejects.toThrow("could not be verified");
    expect(pending.completedSteps).toContain("r2-enable-pending");
    verificationContext.cloudflare.workerBindings.mockResolvedValue([{
      bucket_name: "feed-media",
      name: "MEDIA_BUCKET",
      type: "r2_bucket",
    }]);
    await expect(
      commands.verifyR2Deployment(
        verificationContext as never,
        pending,
      ),
    ).resolves.toBeUndefined();
    expect(pending.completedSteps).not.toContain("r2-enable-pending");

    const collision = {
      ...pending,
      completedSteps: pending.completedSteps.filter(
        (step) => step !== "r2-ready",
      ),
      r2: {...pending.r2, reuse: false},
    };
    const collisionRunner = vi.fn<CommandRunner>().mockResolvedValue(
      commandResult(JSON.stringify({name: "feed-media"})),
    );
    await expect(commands.prepareR2ForDeployment({
      cloudflare: new CloudflareClient(collisionRunner),
      flags: {"enable-r2": true, yes: true},
      instanceName: "feed",
      runner: collisionRunner,
    }, collision, true)).rejects.toThrow("Pass --reuse-r2");
    await expect(commands.prepareR2ForDeployment({
      cloudflare: new CloudflareClient(collisionRunner),
      flags: {"enable-r2": true, "reuse-r2": true},
      instanceName: "feed",
      runner: collisionRunner,
    }, collision, true)).resolves.toBe(true);
    expect(collision.r2.reuse).toBe(true);
  });

  it("suppresses disabled R2 and keeps automatic non-interactive setup pending", async () => {
    const {commands} = await freshModules();
    const {CloudflareClient} = await import(
      "../../../manage-cli/lib/cloudflare"
    );
    const runner = vi.fn<CommandRunner>().mockResolvedValue(
      commandResult("", "Bucket not found", 1),
    );
    const disabled: MicrofeedConfig = {
      ...completedRemoteConfig(),
      completedSteps: ["d1-ready", "worker-deployed", "deployment-verified"],
      r2: {
        name: "feed-media",
        reuse: false,
        setupMode: "disabled",
      },
    };
    const context = {
      cloudflare: new CloudflareClient(runner),
      flags: {yes: true},
      instanceName: "feed",
      runner,
    };
    await expect(
      commands.prepareR2ForDeployment(context, disabled, false),
    ).resolves.toBe(false);
    expect(runner).not.toHaveBeenCalled();

    disabled.r2.setupMode = "automatic";
    await expect(
      commands.prepareR2ForDeployment(context, disabled, false),
    ).resolves.toBe(false);
    expect(disabled.r2.setupMode).toBe("automatic");
    expect(disabled.completedSteps).not.toContain("r2-ready");
  });

  it("remembers an interactive decline when automatic R2 becomes available", async () => {
    const {commands} = await freshModules({confirmAnswers: [false]});
    const {CloudflareClient} = await import(
      "../../../manage-cli/lib/cloudflare"
    );
    const stdinDescriptor = Object.getOwnPropertyDescriptor(
      process.stdin,
      "isTTY",
    );
    const stdoutDescriptor = Object.getOwnPropertyDescriptor(
      process.stdout,
      "isTTY",
    );
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: true,
    });
    const runner = vi.fn<CommandRunner>().mockResolvedValue(
      commandResult("", "Bucket not found", 1),
    );
    const pending: MicrofeedConfig = {
      ...completedRemoteConfig(),
      completedSteps: ["d1-ready", "worker-deployed", "deployment-verified"],
      r2: {
        name: "feed-media",
        reuse: false,
        setupMode: "automatic",
      },
    };

    try {
      await expect(commands.prepareR2ForDeployment({
        cloudflare: new CloudflareClient(runner),
        flags: {},
        instanceName: "feed",
        runner,
      }, pending, false)).resolves.toBe(false);
      expect(pending.r2.setupMode).toBe("disabled");
      expect(pending.completedSteps).not.toContain("r2-ready");
    } finally {
      if (stdinDescriptor) {
        Object.defineProperty(process.stdin, "isTTY", stdinDescriptor);
      } else {
        Reflect.deleteProperty(process.stdin, "isTTY");
      }
      if (stdoutDescriptor) {
        Object.defineProperty(process.stdout, "isTTY", stdoutDescriptor);
      } else {
        Reflect.deleteProperty(process.stdout, "isTTY");
      }
    }
  });

  it("reloads custom-domain state before recording the restore baseline", async () => {
    const {commands, config} = await freshModules();
    const initial = completedRemoteConfig();
    await config.writeConfig(initial);

    const latest = await commands.updateAndReloadInitializationConfig(
      initial,
      () => config.writeConfig({
        ...initial,
        completedSteps: [...initial.completedSteps, "custom-domain-verified"],
        customDomain: "feed.example.com",
      }),
    );
    const fingerprint = "f".repeat(64);
    latest.restoreBaseline = {
      createdAt: "2026-08-02T00:00:00.000Z",
      fingerprint,
    };
    await config.writeConfig(latest);

    await expect(config.readConfig(false, "feed")).resolves.toEqual(
      expect.objectContaining({
        completedSteps: expect.arrayContaining(["custom-domain-verified"]),
        customDomain: "feed.example.com",
        restoreBaseline: {
          createdAt: "2026-08-02T00:00:00.000Z",
          fingerprint,
        },
      }),
    );
  });

  it("confirms public-dashboard risk before creating D1 or R2", async () => {
    const {commands} = await freshModules({
      confirmAnswers: [false],
      selectAnswers: ["none"],
    });
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "whoami --json") {
        return commandResult(JSON.stringify({
          accounts: [{id: "account-id", name: "Personal"}],
          authType: "OAuth Token",
          email: "cloudflare@example.com",
          tokenPermissions: requiredScopes,
        }));
      }
      if (command === "pages project list --json") {
        return commandResult("[]");
      }
      if (command.startsWith("versions list --name fresh-target ")) {
        return commandResult("", "No Worker found", 1);
      }
      if (command === "d1 list --json") {
        return commandResult("[]");
      }
      if (command.startsWith("r2 bucket info fresh-target-media ")) {
        return commandResult("", "Bucket not found", 1);
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(commands.initCommand({
      "account-id": "account-id",
      "admin-path": "admin",
      "d1-name": "fresh-target-db",
      instance: "fresh-target",
      "project-name": "fresh-target",
      "r2-name": "fresh-target-media",
    }, runner)).rejects.toThrow(
      "Deployment cancelled. No authentication setting was changed.",
    );

    const commandsRun = runner.mock.calls.map(([, args]) => args.join(" "));
    expect(commandsRun.some((command) =>
      /(?:d1 create|r2 bucket create|deploy)/u.test(command)
    )).toBe(false);
  });

  it("stops a completed Cloudflare installation before deployment mutations", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(completedRemoteConfig());
    const runner = completedRemoteRunner({ownerExists: true});

    await expect(
      commands.initCommand({instance: "feed", yes: true}, runner),
    ).rejects.toThrow("Use `yarn manage deploy --instance feed`");

    const commandsRun = (runner as ReturnType<typeof vi.fn>).mock.calls
      .map(([, args]) => args.join(" "));
    expect(commandsRun).toEqual([
      "whoami --json",
      "whoami --json",
      "whoami --json",
      expect.stringContaining("FROM \"auth_user\""),
    ]);
    expect(commandsRun.some((command) =>
      /(?:deploy|d1 create|r2 bucket create)/u.test(command)
    )).toBe(false);
  });

  it("resumes only the pending first-password handoff", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(completedRemoteConfig());
    const runner = completedRemoteRunner({
      ownerExists: false,
      pendingEmail: "owner@example.com",
    });
    const output = vi.spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );

    await commands.initCommand({
      instance: "feed",
      "no-open": true,
      yes: true,
    }, runner);

    const text = output.mock.calls.map(([value]) => String(value)).join("")
      .replaceAll(/[\s│|]+/gu, "");
    expect(text).toMatch(
      /https:\/\/feed\.example\.workers\.dev\/admin\/login\/[a-f0-9]{64}\/set_password\//u,
    );
    const commandsRun = (runner as ReturnType<typeof vi.fn>).mock.calls
      .map(([, args]) => args.join(" "));
    expect(commandsRun.some((command) => command.includes("--file"))).toBe(
      true,
    );
    expect(commandsRun.some((command) =>
      /(?:deploy|d1 create|r2 bucket create)/u.test(command)
    )).toBe(false);
  });

  it("uses the Cloudflare login email for non-interactive admin setup", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(completedRemoteConfig());
    const sqlStatements: string[] = [];
    const runner = completedRemoteRunner({
      ownerExists: false,
      sqlStatements,
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await commands.initCommand({
      instance: "feed",
      "no-open": true,
      yes: true,
    }, runner);

    expect(sqlStatements.join("\n")).toContain("cloudflare@example.com");
  });

  it("prints auth subcommand usage without selecting or changing an instance", async () => {
    const {commands} = await freshModules();
    const runner = vi.fn<CommandRunner>();
    const output = vi.spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );

    await commands.authCommand({}, runner);

    const text = output.mock.calls.map(([value]) => String(value)).join("");
    expect(text).toContain(
      "yarn manage auth <setup|reset-password|change-email|change-path|disable>",
    );
    expect(text).toContain("yarn manage auth setup --instance personal");
    expect(text).toContain("yarn manage auth reset-password --instance personal");
    expect(text).toContain("yarn manage auth change-email --instance personal");
    expect(text).toContain("yarn manage auth change-path --instance personal");
    expect(text).toContain("yarn manage auth disable --instance personal");
    expect(runner).not.toHaveBeenCalled();

    await expect(commands.authCommand({action: "unknown"}, runner))
      .rejects.toThrow("Unknown auth action: unknown");
    expect(runner).not.toHaveBeenCalled();
  });
});

describe("saved configuration migration", () => {
  it("rewrites legacy local fields into the new instance model", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "microfeed-instance-test-"),
    );
    temporaryDirectories.push(directory);
    const instanceDirectory = path.join(directory, "instances", "legacy");
    await mkdir(instanceDirectory, {recursive: true});
    await writeFile(
      path.join(instanceDirectory, "config.json"),
      JSON.stringify({
        accountId: "local",
        adminPath: "admin",
        completedSteps: [],
        customDomain: null,
        d1: {
          id: "00000000-0000-0000-0000-000000000000",
          name: "legacy-db",
          reuse: false,
        },
        deploymentUrl: "http://localhost:4321",
        instanceId: "legacy-id",
        localInstance: "legacy",
        projectName: "legacy",
        r2: {name: "legacy-media", reuse: false},
      }),
      "utf8",
    );
    process.env.MICROFEED_STATE_DIRECTORY = directory;
    vi.resetModules();
    const config = await import("../../../manage-cli/lib/config");

    await expect(config.readConfig(false, "legacy")).resolves.toEqual(
      expect.objectContaining({
        accountId: null,
        hosting: "local",
        instanceName: "legacy",
      }),
    );
    const persisted = JSON.parse(
      await readFile(path.join(instanceDirectory, "config.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(persisted.hosting).toBe("local");
    expect(persisted.instanceName).toBe("legacy");
    expect(persisted.accountId).toBeNull();
    expect((persisted.r2 as Record<string, unknown>).setupMode).toBe(
      "automatic",
    );
    expect(persisted.completedSteps).toContain("r2-ready");
    expect(persisted).not.toHaveProperty("localInstance");
  });

  it("maps legacy webhook booleans to lifecycle state", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "microfeed-instance-test-"),
    );
    temporaryDirectories.push(directory);
    const instanceDirectory = path.join(directory, "instances", "legacy");
    await mkdir(instanceDirectory, {recursive: true});
    const filename = path.join(instanceDirectory, "config.json");
    const legacy = {
      ...completedRemoteConfig(),
      completedSteps: ["d1-ready", "webhook-queue-ready"],
      webhooks: {
        enabled: true,
        queueName: "feed-webhooks",
        reuse: false,
      },
    };
    await writeFile(filename, JSON.stringify(legacy), "utf8");
    process.env.MICROFEED_STATE_DIRECTORY = directory;
    vi.resetModules();
    const config = await import("../../../manage-cli/lib/config");

    await expect(config.readConfig(false, "legacy")).resolves.toEqual(
      expect.objectContaining({
        webhooks: expect.objectContaining({state: "enabled"}),
      }),
    );
    await writeFile(filename, JSON.stringify({
      ...legacy,
      webhooks: {...legacy.webhooks, enabled: false},
    }), "utf8");
    await expect(config.readConfig(false, "legacy")).resolves.toEqual(
      expect.objectContaining({
        webhooks: expect.objectContaining({state: "disabled"}),
      }),
    );
    await writeFile(filename, JSON.stringify({
      ...legacy,
      completedSteps: ["d1-ready"],
      webhooks: {...legacy.webhooks, enabled: false},
    }), "utf8");
    await expect(config.readConfig(false, "legacy")).resolves.toEqual(
      expect.objectContaining({
        webhooks: expect.objectContaining({state: "unprovisioned"}),
      }),
    );
  });
});

describe("connecting an existing Cloudflare instance", () => {
  it("lists, verifies, and saves a Worker using read-only operations", async () => {
    const {commands, config} = await freshModules();
    const scopes = [
      "account:read",
      "user:read",
      "workers:write",
      "workers_scripts:write",
      "d1:write",
      "pages:write",
      "zone:read",
      "queues:write",
    ];
    const runner = vi.fn<CommandRunner>(async (_executable, args) => {
      const command = args.join(" ");
      if (command === "whoami --json") {
        return commandResult(JSON.stringify({
          accounts: [{id: "account-id", name: "Personal"}],
          authType: "OAuth Token",
          email: "admin@example.com",
          tokenPermissions: scopes,
        }));
      }
      if (command === "auth list") {
        return commandResult([
          "┌──────────┬───────────────────────────────────────┐",
          "│ Profile  │ Bound Directories                     │",
          "├──────────┼───────────────────────────────────────┤",
          `│ personal │ ${process.cwd()} │`,
          "└──────────┴───────────────────────────────────────┘",
        ].join("\n"));
      }
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
      if (
        command ===
          "secret list --name feed-worker --format json"
      ) {
        return commandResult(JSON.stringify([
          {name: "BETTER_AUTH_SECRET", type: "secret_text"},
          {name: "UPLOAD_SIGNING_KEY", type: "secret_text"},
          {name: "WEBHOOK_SECRET_KEY", type: "secret_text"},
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
      if (url.hostname === "feed.example.com") {
        return Response.json({
          instanceId: "instance-id",
          product: "microfeed",
        });
      }
      if (url.pathname.endsWith("/workers/scripts")) {
        return apiResult([{id: "feed-worker"}]);
      }
      if (url.pathname.endsWith("/workers/domains")) {
        return apiResult([{
          hostname: "feed.example.com",
          service: "feed-worker",
        }]);
      }
      if (url.pathname.endsWith("/workers/subdomain")) {
        return apiResult({subdomain: "personal"});
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
            name: "WEBHOOK_QUEUE",
            queue_name: "feed-worker-webhooks",
            type: "queue",
          },
        ]});
      }
      if (url.pathname.endsWith("/feed-worker/subdomain")) {
        return apiResult({enabled: true});
      }
      if (url.pathname.endsWith("/queues")) {
        return apiResult([{
          queue_id: "queue-id",
          queue_name: "feed-worker-webhooks",
          settings: {delivery_paused: false},
        }]);
      }
      throw new Error(`Unexpected request: ${url.href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const beforeOutput = vi.spyOn(
      process.stdout,
      "write",
    ).mockImplementation(() => true);
    await commands.instancesCommand({}, runner);
    const beforeText = beforeOutput.mock.calls
      .map(([value]) => String(value))
      .join("");
    expect(beforeText).toContain("=== Local ===");
    expect(beforeText).toContain("=== Cloudflare — Personal ===");
    expect(beforeText).toContain("Wrangler profile: personal");
    expect(beforeText).toContain("Wrangler login email: admin@example.com");
    expect(beforeText).toContain("Account ID: account-id");
    expect(beforeText).toContain("Cloudflare — available to connect");
    beforeOutput.mockRestore();

    await commands.connectCommand({
      "account-id": "account-id",
      instance: "feed",
      worker: "feed-worker",
      yes: true,
    }, runner);

    await expect(config.readConfig(false, "feed")).resolves.toEqual(
      expect.objectContaining({
        accountId: "account-id",
        completedSteps: expect.arrayContaining([
          "better-auth-secret-created",
          "upload-signing-secret-created",
          "webhook-queue-ready",
          "webhook-secret-created",
        ]),
        customDomain: "feed.example.com",
        hosting: "cloudflare",
        instanceId: "instance-id",
        instanceName: "feed",
        workerName: "feed-worker",
        webhooks: {
          queueId: "queue-id",
          queueName: "feed-worker-webhooks",
          state: "enabled",
        },
      }),
    );
    expect(await config.readActiveInstance()).toBe("feed");

    const afterOutput = vi.spyOn(
      process.stdout,
      "write",
    ).mockImplementation(() => true);
    await commands.instancesCommand({}, runner);
    const afterText = afterOutput.mock.calls
      .map(([value]) => String(value))
      .join("");
    expect(afterText).toContain("Cloudflare — managed here");
    expect(afterText).not.toContain("Cloudflare — available to connect");

    const commandsRun = runner.mock.calls
      .map(([, args]) => args.join(" "));
    expect(commandsRun.some((command) => command.startsWith("deploy ")))
      .toBe(false);
    expect(commandsRun.some((command) => command.includes("--remote")))
      .toBe(false);
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });
});
