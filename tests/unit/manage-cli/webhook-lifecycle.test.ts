import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {afterEach, describe, expect, it, vi} from "vitest";

import type {
  CommandRunner,
  MicrofeedConfig,
} from "../../../manage-cli/types";

const temporaryDirectories: string[] = [];

function commandResult(stdout = "", stderr = "", exitCode = 0) {
  return {exitCode, stderr, stdout};
}

async function freshModules() {
  const directory = await mkdtemp(path.join(tmpdir(), "microfeed-webhooks-"));
  temporaryDirectories.push(directory);
  process.env.MICROFEED_STATE_DIRECTORY = directory;
  vi.stubEnv("MICROFEED_INSTANCE", "");
  vi.doMock("../../../manage-cli/theme", () => ({
    installDefaultThemeForV1Appearance: vi.fn(async () => null),
  }));
  vi.resetModules();
  const commands = await import("../../../manage-cli/commands");
  const config = await import("../../../manage-cli/lib/config");
  return {commands, config};
}

function remoteConfig(): MicrofeedConfig {
  return {
    accountId: "account-id",
    adminAuthMode: "none",
    adminPath: "admin",
    completedSteps: [
      "d1-ready",
      "r2-ready",
      "upload-signing-secret-created",
      "worker-deployed",
      "deployment-verified",
    ],
    customDomain: null,
    d1: {id: "database-id", name: "feed-db", reuse: false},
    deploymentUrl: "https://feed.example.workers.dev",
    hosting: "cloudflare",
    instanceId: "instance-id",
    instanceName: "feed",
    projectName: "feed",
    r2: {name: "feed-media", reuse: false, setupMode: "automatic"},
  };
}

interface RemoteState {
  backlog: number;
  consumer: boolean;
  consumerDeleteCount: number;
  consumerScriptName: string;
  crons: string[];
  paused: boolean;
  producer: boolean;
  purgeCount: number;
  queueId: string;
  queueName: string;
  queuePresent: boolean;
}

async function lifecycleHarness(
  readConfig: () => Promise<MicrofeedConfig | null>,
) {
  const state: RemoteState = {
    backlog: 0,
    consumer: false,
    consumerDeleteCount: 0,
    consumerScriptName: "feed",
    crons: [],
    paused: false,
    producer: false,
    purgeCount: 0,
    queueId: "queue-id",
    queueName: "feed-webhooks",
    queuePresent: false,
  };
  const deployedConfigs: string[] = [];
  const secretFiles: string[] = [];
  const sql: string[] = [];
  const permissions = [
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
        tokenPermissions: permissions,
      }));
    }
    if (command === "auth token --json") {
      return commandResult(JSON.stringify({token: "oauth-token", type: "oauth"}));
    }
    if (command === "pages project list --json") return commandResult("[]");
    if (command === "rev-parse --verify HEAD") {
      return commandResult("a".repeat(40));
    }
    if (command === "queues create feed-webhooks") {
      expect(state.queuePresent).toBe(false);
      state.queuePresent = true;
      return commandResult("Created Queue");
    }
    if (command === "queues pause-delivery feed-webhooks") {
      state.paused = true;
      return commandResult("Paused");
    }
    if (command === "queues resume-delivery feed-webhooks") {
      state.paused = false;
      return commandResult("Resumed");
    }
    if (command === "queues purge feed-webhooks --force") {
      state.backlog = 0;
      state.purgeCount += 1;
      return commandResult("Purged");
    }
    if (command.startsWith("d1 migrations apply feed-db --remote ")) {
      return commandResult("Migrations applied");
    }
    if (command.startsWith("d1 execute feed-db --remote --file ")) {
      return commandResult("Executed");
    }
    if (command.startsWith("d1 execute feed-db --remote --command ")) {
      const index = args.indexOf("--command");
      const statement = args[index + 1] ?? "";
      sql.push(statement);
      const results = statement.includes("sqlite_schema")
        ? [{name: "site_search_exact"}, {name: "site_search_title_trigram"}]
        : statement.includes("COUNT(*)") ? [{count: 0}] : [];
      return commandResult(JSON.stringify([{results}]));
    }
    if (["types", "typecheck", "test:deploy", "build"].includes(args[0]!)) {
      return commandResult();
    }
    if (args[0] === "deploy") {
      const saved = await readConfig();
      const enabled = saved?.webhooks?.state === "enabled";
      state.producer = enabled;
      if (enabled) state.consumer = true;
      state.crons = enabled ? ["0 * * * *"] : [];
      const secretIndex = args.indexOf("--secrets-file");
      if (secretIndex >= 0) {
        secretFiles.push(await readFile(args[secretIndex + 1]!, "utf8"));
      }
      deployedConfigs.push(enabled ? "enabled" : "disabled");
      return commandResult("https://feed.example.workers.dev");
    }
    throw new Error(`Unexpected command: ${command}`);
  });

  const apiResult = (result: unknown) =>
    Response.json({errors: [], result, success: true});
  const fetchMock = vi.fn(async (
    input: URL | RequestInfo,
    init?: RequestInit,
  ) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const pathname = url.pathname;
    if (url.hostname === "feed.example.workers.dev") {
      return Response.json({instanceId: "instance-id", product: "microfeed"});
    }
    if (pathname.endsWith("/queues")) {
      return apiResult(state.queuePresent
        ? [{
            queue_id: state.queueId,
            queue_name: state.queueName,
            settings: {delivery_paused: state.paused},
          }]
        : []);
    }
    if (pathname.endsWith(`/queues/${state.queueId}/metrics`)) {
      return apiResult({
        backlog_bytes: state.backlog * 10,
        backlog_count: state.backlog,
        oldest_message_timestamp_ms: 0,
      });
    }
    if (
      pathname.endsWith(`/queues/${state.queueId}/consumers/consumer-id`) &&
      init?.method === "DELETE"
    ) {
      state.consumer = false;
      state.consumerDeleteCount += 1;
      return apiResult({});
    }
    if (pathname.endsWith(`/queues/${state.queueId}/consumers`)) {
      return apiResult(state.consumer
        ? [{
            consumer_id: "consumer-id",
            script_name: state.consumerScriptName,
            type: "worker",
          }]
        : []);
    }
    if (pathname.endsWith("/workers/scripts/feed/settings")) {
      const saved = await readConfig();
      return apiResult({bindings: [
        {database_id: "database-id", name: "FEED_DB", type: "d1"},
        {bucket_name: "feed-media", name: "MEDIA_BUCKET", type: "r2_bucket"},
        ...(state.producer
          ? [{name: "WEBHOOK_QUEUE", queue_name: state.queueName, type: "queue"}]
          : []),
        {
          name: "MICROFEED_WEBHOOK_QUEUE_ID",
          text: saved?.webhooks?.queueId ?? "",
          type: "plain_text",
        },
      ]});
    }
    if (pathname.endsWith("/workers/scripts/feed/schedules")) {
      return apiResult(state.crons.map((cron) => ({cron})));
    }
    throw new Error(`Unexpected API request: ${url.href}`);
  });
  return {deployedConfigs, fetchMock, runner, secretFiles, sql, state};
}

afterEach(async () => {
  delete process.env.MICROFEED_STATE_DIRECTORY;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock("../../../manage-cli/theme");
  vi.resetModules();
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})
  ));
});

describe("reversible webhook infrastructure", () => {
  it("rejects conflicting lifecycle flags before doing work", async () => {
    const {commands} = await freshModules();
    const runner = vi.fn<CommandRunner>();
    await expect(commands.deployCommand({
      "disable-webhooks": true,
      "enable-webhooks": true,
      instance: "feed",
    }, runner)).rejects.toThrow("cannot be combined");
    await expect(commands.devCommand({
      "disable-webhooks": true,
      "enable-webhooks": true,
      instance: "feed",
    }, runner)).rejects.toThrow("cannot be combined");
    expect(runner).not.toHaveBeenCalled();
  });

  it("stores production and preview Queue identities independently", async () => {
    const {config} = await freshModules();
    const production = {
      ...remoteConfig(),
      webhooks: {
        queueId: "production-queue-id",
        queueName: "feed-webhooks",
        state: "enabled" as const,
      },
    };
    const preview = {
      ...remoteConfig(),
      deploymentEnvironment: "preview" as const,
      projectName: "feed",
      workerName: "feed-preview",
      webhooks: {
        queueId: "preview-queue-id",
        queueName: "feed-preview-webhooks",
        state: "disabled" as const,
      },
    };
    await config.writeConfig(production);
    await config.writeConfig(preview);

    expect((await config.readConfig(false, "feed"))?.webhooks).toEqual(
      production.webhooks,
    );
    expect((await config.readConfig(true, "feed"))?.webhooks).toEqual(
      preview.webhooks,
    );
    expect(config.wranglerConfigPath(production)).not.toBe(
      config.wranglerConfigPath(preview),
    );
  });

  it("creates once, disables completely, and re-enables the same Queue", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(remoteConfig());
    const harness = await lifecycleHarness(() => config.readConfig(false, "feed"));
    vi.stubGlobal("fetch", harness.fetchMock);

    await commands.deployCommand({
      "enable-webhooks": true,
      instance: "feed",
    }, harness.runner);
    const firstEnabled = await config.readConfig(false, "feed");
    expect(firstEnabled?.webhooks).toEqual({
      queueId: "queue-id",
      queueName: "feed-webhooks",
      state: "enabled",
    });
    expect(harness.secretFiles).toHaveLength(1);
    expect(harness.secretFiles[0]).toContain("WEBHOOK_SECRET_KEY");

    harness.state.backlog = 3;
    await commands.deployCommand({
      "disable-webhooks": true,
      instance: "feed",
    }, harness.runner);
    const disabled = await config.readConfig(false, "feed");
    expect(disabled?.webhooks).toEqual({
      queueId: "queue-id",
      queueName: "feed-webhooks",
      state: "disabled",
    });
    expect(harness.state).toMatchObject({
      backlog: 0,
      consumer: false,
      consumerDeleteCount: 1,
      crons: [],
      paused: true,
      producer: false,
      purgeCount: 1,
      queueId: "queue-id",
      queuePresent: true,
    });
    expect(harness.sql.filter((statement) =>
      statement.includes("canceled_webhooks_disabled")
    )).toHaveLength(2);

    const deploysBeforeRepeatedDisable = harness.deployedConfigs.length;
    await commands.deployCommand({
      "disable-webhooks": true,
      instance: "feed",
    }, harness.runner);
    expect(harness.deployedConfigs).toHaveLength(deploysBeforeRepeatedDisable);
    expect(harness.state.purgeCount).toBe(1);

    await commands.deployCommand({
      "enable-webhooks": true,
      instance: "feed",
    }, harness.runner);
    const reenabled = await config.readConfig(false, "feed");
    expect(reenabled?.webhooks).toEqual(firstEnabled?.webhooks);
    expect(harness.state).toMatchObject({
      consumer: true,
      crons: ["0 * * * *"],
      paused: false,
      producer: true,
      queueId: "queue-id",
      queuePresent: true,
    });
    expect(harness.secretFiles).toHaveLength(1);
    expect(harness.runner.mock.calls.filter(([, args]) =>
      args.join(" ") === "queues create feed-webhooks"
    )).toHaveLength(1);
    expect(harness.deployedConfigs).toEqual([
      "enabled",
      "disabled",
      "enabled",
    ]);
  });

  it("fails closed when a provisioned Queue identity changes", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig({
      ...remoteConfig(),
      completedSteps: [
        ...remoteConfig().completedSteps,
        "webhook-queue-ready",
        "webhook-secret-created",
      ],
      webhooks: {
        queueId: "original-queue-id",
        queueName: "feed-webhooks",
        state: "disabled",
      },
    });
    const harness = await lifecycleHarness(() => config.readConfig(false, "feed"));
    harness.state.queuePresent = true;
    harness.state.queueId = "replacement-queue-id";
    harness.state.paused = true;
    vi.stubGlobal("fetch", harness.fetchMock);

    await expect(commands.deployCommand({
      "enable-webhooks": true,
      instance: "feed",
    }, harness.runner)).rejects.toThrow("replacement Queue was not changed");
    expect(harness.runner.mock.calls.some(([, args]) => args[0] === "deploy"))
      .toBe(false);
  });

  it("resumes consumer detachment without redeploying an already detached Worker", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig({
      ...remoteConfig(),
      completedSteps: [
        ...remoteConfig().completedSteps,
        "webhook-queue-ready",
        "webhook-secret-created",
        "webhook-disable-queue-purged",
      ],
      webhooks: {
        queueId: "queue-id",
        queueName: "feed-webhooks",
        state: "disabled",
        transition: "disabling",
      },
    });
    const harness = await lifecycleHarness(() => config.readConfig(false, "feed"));
    harness.state.consumer = true;
    harness.state.paused = true;
    harness.state.queuePresent = true;
    vi.stubGlobal("fetch", harness.fetchMock);

    await commands.deployCommand({
      "disable-webhooks": true,
      instance: "feed",
    }, harness.runner);

    expect(harness.state.consumer).toBe(false);
    expect(harness.state.consumerDeleteCount).toBe(1);
    expect(harness.state.purgeCount).toBe(0);
    expect(harness.deployedConfigs).toEqual([]);
    await expect(config.readConfig(false, "feed")).resolves.toMatchObject({
      webhooks: {
        queueId: "queue-id",
        queueName: "feed-webhooks",
        state: "disabled",
      },
    });
    expect((await config.readConfig(false, "feed"))?.webhooks?.transition)
      .toBeUndefined();
  });

  it("refuses to detach an unexpected Queue consumer", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig({
      ...remoteConfig(),
      completedSteps: [
        ...remoteConfig().completedSteps,
        "webhook-queue-ready",
        "webhook-secret-created",
      ],
      webhooks: {
        queueId: "queue-id",
        queueName: "feed-webhooks",
        state: "enabled",
      },
    });
    const harness = await lifecycleHarness(() => config.readConfig(false, "feed"));
    harness.state.consumer = true;
    harness.state.consumerScriptName = "unrelated-worker";
    harness.state.crons = ["0 * * * *"];
    harness.state.producer = true;
    harness.state.queuePresent = true;
    vi.stubGlobal("fetch", harness.fetchMock);

    await expect(commands.deployCommand({
      "disable-webhooks": true,
      instance: "feed",
    }, harness.runner)).rejects.toThrow("unexpected consumer configuration");
    expect(harness.state.consumer).toBe(true);
    expect(harness.state.consumerDeleteCount).toBe(0);
  });
});
