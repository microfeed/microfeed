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

async function freshModules() {
  const directory = await mkdtemp(
    path.join(tmpdir(), "microfeed-instance-test-"),
  );
  temporaryDirectories.push(directory);
  process.env.MICROFEED_STATE_DIRECTORY = directory;
  // `yarn manage init --instance <name>` runs the suite with this variable
  // set to its deployment target. These tests exercise instance selection
  // themselves, so they must not inherit the outer management command.
  vi.stubEnv("MICROFEED_INSTANCE", "");
  vi.resetModules();
  // Import commands first so its config and prompt dependencies populate
  // Vitest's module cache before the test requests those modules directly.
  // Concurrent imports after resetModules can otherwise create duplicate
  // module instances that capture different temporary state directories.
  const commands = await import("../../../manage-cli/commands");
  const config = await import("../../../manage-cli/lib/config");
  const promptModule = await import("../../../manage-cli/lib/prompts");
  return {commands, config, directory, prompts: promptModule.prompts};
}

function commandResult(
  stdout = "",
  stderr = "",
  exitCode = 0,
) {
  return {exitCode, stderr, stdout};
}

function existingLocalOwnerRunner(): CommandRunner {
  return vi.fn<CommandRunner>(async (_executable, args) => {
    const command = args.join(" ");
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
    r2: {name: "feed-media", reuse: false},
  };
}

function completedRemoteRunner(input: {
  ownerExists: boolean;
  pendingEmail?: string;
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
      return commandResult("Executed");
    }
    throw new Error(`Unexpected command: ${command}`);
  });
}

afterEach(async () => {
  delete process.env.MICROFEED_STATE_DIRECTORY;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, {force: true, recursive: true})
    ),
  );
});

describe("first-class local instances", () => {
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
      command.includes("instances/personal/local-state")
    )).toBe(true);
    expect(persistPaths.some((command) =>
      command.includes("instances/company/local-state")
    )).toBe(true);
    expect(persistPaths.every((command) => !command.includes("--remote")))
      .toBe(true);
  });

  it("keeps auth setup compatibility and explains the local sandbox", async () => {
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

    await commands.devCommand({instance: "local"}, runner);
    const text = output.mock.calls.map(([value]) => String(value)).join("");
    expect(text).toContain(
      "Production D1 and R2 data will not be accessed or changed.",
    );
    expect(text).toContain("Instance type: Local only");
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
      "yarn manage auth setup --local --instance",
    );

    ownerExists = true;
    await commands.authCommand({
      action: "setup",
      instance: "practice",
      local: true,
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
});

describe("initialization lifecycle", () => {
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
      .replaceAll(/[\s│]+/gu, "");
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
    expect(persisted).not.toHaveProperty("localInstance");
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
        ]});
      }
      if (url.pathname.endsWith("/feed-worker/subdomain")) {
        return apiResult({enabled: true});
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
        ]),
        customDomain: "feed.example.com",
        hosting: "cloudflare",
        instanceId: "instance-id",
        instanceName: "feed",
        workerName: "feed-worker",
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
