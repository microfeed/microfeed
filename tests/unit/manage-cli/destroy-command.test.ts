import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";

import {afterEach, describe, expect, it, vi} from "vitest";

import type {
  CommandRunner,
  MicrofeedConfig,
} from "../../../manage-cli/types";

const temporaryDirectories: string[] = [];

interface CloudflareState {
  d1: boolean;
  domain: boolean;
  objects: string[];
  r2: boolean;
  r2DeleteFailures?: number;
  webhook?: {
    consumers: Array<{
      id: string;
      scriptName?: string;
      type: string;
    }>;
    id: string;
    name: string;
    paused: boolean;
    schedules: string[];
    state: "enabled" | "disabled";
  };
  worker: boolean;
  workerDeleteFailures?: number;
}

function commandResult(
  stdout = "",
  stderr = "",
  exitCode = 0,
) {
  return {exitCode, stderr, stdout};
}

async function freshModules() {
  const directory = await mkdtemp(path.join(tmpdir(), "microfeed-destroy-"));
  temporaryDirectories.push(directory);
  process.env.MICROFEED_STATE_DIRECTORY = directory;
  vi.stubEnv("MICROFEED_INSTANCE", "");
  vi.resetModules();
  const commands = await import("../../../manage-cli/commands");
  const config = await import("../../../manage-cli/lib/config");
  return {commands, config};
}

function savedConfig(
  overrides: Partial<MicrofeedConfig> = {},
): MicrofeedConfig {
  return {
    accountId: "account-id",
    adminAuthMode: "built-in",
    adminPath: "admin",
    completedSteps: ["r2-ready"],
    customDomain: "feed.example.com",
    d1: {id: "database-id", name: "feed-db", reuse: false},
    deploymentUrl: "https://feed.example.workers.dev",
    hosting: "cloudflare",
    instanceId: "instance-id",
    instanceName: "feed",
    projectName: "feed",
    r2: {name: "feed-media", reuse: false, setupMode: "automatic"},
    ...overrides,
  };
}

function cloudflareHarness(state: CloudflareState): {
  fetchMock: ReturnType<typeof vi.fn>;
  runner: ReturnType<typeof vi.fn<CommandRunner>>;
} {
  const permissions = [
    "account:read",
    "user:read",
    "workers:write",
    "workers_scripts:write",
    "d1:write",
    "pages:write",
    "zone:read",
    ...(state.webhook ? ["queues:write"] : []),
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
      return commandResult(JSON.stringify({
        token: "oauth-token",
        type: "oauth",
      }));
    }
    if (command === "versions list --name feed --json") {
      return state.worker
        ? commandResult("[]")
        : commandResult("", "Worker not found", 1);
    }
    if (command === "d1 list --json") {
      return commandResult(JSON.stringify(
        state.d1 ? [{name: "feed-db", uuid: "database-id"}] : [],
      ));
    }
    if (command === "r2 bucket info feed-media --json") {
      return state.r2
        ? commandResult(JSON.stringify({name: "feed-media"}))
        : commandResult("", "Bucket not found", 1);
    }
    if (command === "r2 bucket delete feed-media") {
      expect(state.objects).toEqual([]);
      if ((state.r2DeleteFailures ?? 0) > 0) {
        state.r2DeleteFailures = (state.r2DeleteFailures ?? 0) - 1;
        throw new Error("Cloudflare temporarily refused bucket deletion");
      }
      state.r2 = false;
      return commandResult("Deleted bucket");
    }
    if (command === `queues pause-delivery ${state.webhook?.name}`) {
      state.webhook!.paused = true;
      return commandResult("Paused");
    }
    if (command === `queues delete ${state.webhook?.name}`) {
      delete state.webhook;
      return commandResult("Deleted Queue");
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
    const pathname = url.pathname;
    if (pathname.endsWith("/workers/scripts") && !init?.method) {
      return apiResult(state.worker ? [{id: "feed"}] : []);
    }
    if (pathname.endsWith("/workers/domains") && !init?.method) {
      return apiResult(
        state.domain
          ? [{
              cert_id: "certificate-id",
              hostname: "feed.example.com",
              id: "domain-id",
              service: "feed",
              zone_id: "zone-id",
            }]
          : [],
      );
    }
    if (pathname.endsWith("/workers/subdomain") && !init?.method) {
      return apiResult({subdomain: "personal"});
    }
    if (pathname.endsWith("/feed/settings") && !init?.method) {
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
        ...(state.webhook
          ? [
              {
                name: "MICROFEED_WEBHOOK_QUEUE_ID",
                text: state.webhook.id,
                type: "plain_text",
              },
              {
                name: "MICROFEED_WEBHOOK_QUEUE_NAME",
                text: state.webhook.name,
                type: "plain_text",
              },
              {
                name: "MICROFEED_WEBHOOK_STATE",
                text: state.webhook.state,
                type: "plain_text",
              },
              ...(state.webhook.state === "enabled"
                ? [{
                    name: "WEBHOOK_QUEUE",
                    queue_name: state.webhook.name,
                    type: "queue",
                  }]
                : []),
            ]
          : []),
      ]});
    }
    if (pathname.endsWith("/feed/subdomain") && !init?.method) {
      return apiResult({enabled: false});
    }
    if (pathname.endsWith("/workers/scripts/feed/schedules") && !init?.method) {
      return apiResult((state.webhook?.schedules ?? []).map((cron) => ({cron})));
    }
    if (pathname.endsWith("/workers/scripts/feed/schedules") && init?.method === "PUT") {
      const schedules = JSON.parse(String(init.body)) as Array<{cron: string}>;
      if (state.webhook) state.webhook.schedules = schedules.map(({cron}) => cron);
      return apiResult(schedules);
    }
    if (pathname.endsWith("/queues") && !init?.method) {
      return apiResult(state.webhook
        ? [{
            queue_id: state.webhook.id,
            queue_name: state.webhook.name,
            settings: {delivery_paused: state.webhook.paused},
          }]
        : []);
    }
    if (state.webhook &&
      pathname.endsWith(`/queues/${state.webhook.id}/metrics`) &&
      !init?.method) {
      return apiResult({
        backlog_bytes: 0,
        backlog_count: 0,
        oldest_message_timestamp_ms: 0,
      });
    }
    if (state.webhook &&
      pathname.endsWith(`/queues/${state.webhook.id}/consumers`) &&
      !init?.method) {
      return apiResult(state.webhook.consumers.map((consumer) => ({
        consumer_id: consumer.id,
        script_name: consumer.scriptName,
        type: consumer.type,
      })));
    }
    if (state.webhook && init?.method === "DELETE" &&
      pathname.includes(`/queues/${state.webhook.id}/consumers/`)) {
      const consumerId = decodeURIComponent(pathname.slice(
        pathname.lastIndexOf("/") + 1,
      ));
      state.webhook.consumers = state.webhook.consumers.filter(
        ({id}) => id !== consumerId,
      );
      return apiResult({});
    }
    if (
      pathname.endsWith("/d1/database/database-id") &&
      init?.method === "DELETE"
    ) {
      state.d1 = false;
      return apiResult({});
    }
    if (pathname.endsWith("/workers/scripts/feed") && init?.method === "DELETE") {
      if ((state.webhook?.consumers.length ?? 0) > 0) {
        return Response.json({
          errors: [{message: "Cannot delete Worker with a Queue consumer"}],
          result: null,
          success: false,
        }, {status: 409});
      }
      if ((state.workerDeleteFailures ?? 0) > 0) {
        state.workerDeleteFailures = (state.workerDeleteFailures ?? 0) - 1;
        return Response.json({
          errors: [{message: "Temporary Worker deletion failure"}],
          result: null,
          success: false,
        }, {status: 503});
      }
      expect(url.searchParams.get("force")).toBe("false");
      state.worker = false;
      state.domain = false;
      return new Response(null, {status: 204});
    }
    if (pathname.includes("/r2/buckets/feed-media/objects")) {
      if (!init?.method) {
        return apiResult(state.objects.map((key) => ({key})));
      }
      const marker = "/objects/";
      const key = decodeURIComponent(pathname.slice(
        pathname.indexOf(marker) + marker.length,
      ));
      state.objects = state.objects.filter((candidate) => candidate !== key);
      return apiResult({key});
    }
    throw new Error(`Unexpected API request: ${url.href}`);
  });
  return {fetchMock, runner};
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

describe("guarded Cloudflare destroy", () => {
  it("prints an exact dashboard-linked dry run without mutations", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(savedConfig());
    await config.setActiveInstance("feed");
    const state: CloudflareState = {
      d1: true,
      domain: true,
      objects: ["photo.jpg"],
      r2: true,
      worker: true,
    };
    const {fetchMock, runner} = cloudflareHarness(state);
    vi.stubGlobal("fetch", fetchMock);
    const output = vi.spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );

    await commands.destroyCommand({
      "dry-run": true,
      instance: "feed",
    }, runner);

    expect(state).toEqual({
      d1: true,
      domain: true,
      objects: ["photo.jpg"],
      r2: true,
      worker: true,
    });
    await expect(config.readConfig(false, "feed")).resolves.not.toBeNull();
    const noteText = output.mock.calls.flat().join("\n");
    expect(noteText).toContain("Permanent deletion plan");
    expect(noteText).toContain("Cloudflare account: Personal (account-id)");
    expect(noteText).toContain("feed-db (database-id) — DELETE permanently");
    expect(noteText).toContain(
      "https://dash.cloudflare.com/account-id/workers-and-pages",
    );
    expect(noteText).toContain(
      "https://dash.cloudflare.com/account-id/workers/d1",
    );
    expect(noteText).toContain(
      "https://dash.cloudflare.com/account-id/r2/overview",
    );
    expect(noteText).toContain("Look for: feed");
    expect(noteText).toContain("Look for: feed-db (database-id)");
    expect(noteText).toContain("Look for: feed-media");
    expect(noteText).not.toContain("access-controls");
    expect(noteText).not.toContain("ssl-tls");
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });

  it("deletes owned resources in order and removes local state last", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(savedConfig());
    await config.setActiveInstance("feed");
    const state: CloudflareState = {
      d1: true,
      domain: true,
      objects: ["folder/photo.jpg", "post.pdf"],
      r2: true,
      worker: true,
    };
    const {fetchMock, runner} = cloudflareHarness(state);
    vi.stubGlobal("fetch", fetchMock);
    const output = vi.spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );

    await commands.destroyCommand({
      confirm: "feed",
      instance: "feed",
    }, runner);

    expect(state).toEqual({
      d1: false,
      domain: false,
      objects: [],
      r2: false,
      worker: false,
    });
    await expect(config.readConfig(false, "feed")).resolves.toBeNull();
    expect(runner.mock.calls.map(([, args]) => args.join(" "))).toEqual(
      expect.arrayContaining(["r2 bucket delete feed-media"]),
    );
    const noteText = output.mock.calls.flat().join("\n");
    expect(noteText).toContain("Confirm the result in Cloudflare");
    expect(noteText.match(/workers-and-pages/gu)).toHaveLength(2);
    expect(noteText.match(/workers\/d1/gu)).toHaveLength(2);
    expect(noteText.match(/r2\/overview/gu)).toHaveLength(2);
    expect(noteText).not.toContain("Cloudflare Access applications");
    expect(noteText).not.toContain("certificate-id");
    expect(noteText).not.toContain("ssl-tls/edge-certificates");
  });

  it.each(["enabled", "disabled"] as const)(
    "deletes a verified %s webhook Queue and removes Cron schedules",
    async (webhookState) => {
      const {commands, config} = await freshModules();
      await config.writeConfig(savedConfig({
        completedSteps: [
          "r2-ready",
          "webhook-queue-ready",
          "webhook-secret-created",
        ],
        webhooks: {
          queueId: "queue-id",
          queueName: "feed-webhooks",
          state: webhookState,
        },
      }));
      const state: CloudflareState = {
        d1: true,
        domain: true,
        objects: [],
        r2: true,
        webhook: {
          consumers: webhookState === "enabled"
            ? [{id: "consumer-id", scriptName: "feed", type: "worker"}]
            : [],
          id: "queue-id",
          name: "feed-webhooks",
          paused: webhookState === "disabled",
          schedules: webhookState === "enabled" ? ["0 * * * *"] : [],
          state: webhookState,
        },
        worker: true,
      };
      const {fetchMock, runner} = cloudflareHarness(state);
      vi.stubGlobal("fetch", fetchMock);
      const output = vi.spyOn(process.stdout, "write").mockImplementation(
        () => true,
      );

      await commands.destroyCommand({
        "dry-run": true,
        instance: "feed",
      }, runner);
      expect(output.mock.calls.flat().join("\n")).toContain(
        "Webhook Queue: feed-webhooks (queue-id) — DELETE",
      );
      expect(output.mock.calls.flat().join("\n")).toContain(
        webhookState === "enabled"
          ? "Webhook Queue consumer: feed (consumer-id) — REMOVE"
          : "Webhook Queue consumer: none",
      );

      await commands.destroyCommand({
        confirm: "feed",
        instance: "feed",
      }, runner);
      expect(state.webhook).toBeUndefined();
      expect(runner.mock.calls.filter(([, args]) =>
        args.join(" ") === "queues delete feed-webhooks"
      )).toHaveLength(1);
      const consumerDeleteIndex = fetchMock.mock.calls.findIndex(
        ([input, init]) =>
          new URL(input instanceof Request ? input.url : input.toString())
            .pathname.endsWith("/queues/queue-id/consumers/consumer-id") &&
          init?.method === "DELETE",
      );
      const workerDeleteIndex = fetchMock.mock.calls.findIndex(
        ([input, init]) =>
          new URL(input instanceof Request ? input.url : input.toString())
            .pathname.endsWith("/workers/scripts/feed") &&
          init?.method === "DELETE",
      );
      if (webhookState === "enabled") {
        expect(consumerDeleteIndex).toBeGreaterThanOrEqual(0);
        expect(workerDeleteIndex).toBeGreaterThan(consumerDeleteIndex);
      } else {
        expect(consumerDeleteIndex).toBe(-1);
      }
      if (webhookState === "enabled") {
        expect(runner.mock.calls.map(([, args]) => args.join(" "))).toContain(
          "queues pause-delivery feed-webhooks",
        );
        expect(fetchMock.mock.calls.some(([input, init]) =>
          new URL(input instanceof Request ? input.url : input.toString())
            .pathname.endsWith("/workers/scripts/feed/schedules") &&
          init?.method === "PUT"
        )).toBe(true);
      }
      await expect(config.readConfig(false, "feed")).resolves.toBeNull();
    },
  );

  it("refuses to detach an unexpected Queue consumer", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(savedConfig({
      completedSteps: ["r2-ready", "webhook-queue-ready"],
      webhooks: {
        queueId: "queue-id",
        queueName: "feed-webhooks",
        state: "enabled",
      },
    }));
    const state: CloudflareState = {
      d1: true,
      domain: true,
      objects: [],
      r2: true,
      webhook: {
        consumers: [{
          id: "foreign-consumer-id",
          scriptName: "another-worker",
          type: "worker",
        }],
        id: "queue-id",
        name: "feed-webhooks",
        paused: false,
        schedules: ["0 * * * *"],
        state: "enabled",
      },
      worker: true,
    };
    const {fetchMock, runner} = cloudflareHarness(state);
    vi.stubGlobal("fetch", fetchMock);

    await expect(commands.destroyCommand({
      confirm: "feed",
      instance: "feed",
    }, runner)).rejects.toThrow(/unexpected consumer configuration/u);

    expect(state.webhook?.paused).toBe(false);
    expect(state.webhook?.consumers).toEqual([{
      id: "foreign-consumer-id",
      scriptName: "another-worker",
      type: "worker",
    }]);
    expect(state.worker).toBe(true);
    expect(state.d1).toBe(true);
    expect(state.r2).toBe(true);
  });

  it("resumes after detaching the Queue consumer before Worker deletion", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(savedConfig({
      completedSteps: ["r2-ready", "webhook-queue-ready"],
      webhooks: {
        queueId: "queue-id",
        queueName: "feed-webhooks",
        state: "enabled",
      },
    }));
    const state: CloudflareState = {
      d1: true,
      domain: true,
      objects: [],
      r2: true,
      webhook: {
        consumers: [{
          id: "consumer-id",
          scriptName: "feed",
          type: "worker",
        }],
        id: "queue-id",
        name: "feed-webhooks",
        paused: false,
        schedules: ["0 * * * *"],
        state: "enabled",
      },
      worker: true,
      workerDeleteFailures: 1,
    };
    const {fetchMock, runner} = cloudflareHarness(state);
    vi.stubGlobal("fetch", fetchMock);

    await expect(commands.destroyCommand({
      confirm: "feed",
      instance: "feed",
    }, runner)).rejects.toThrow(/Temporary Worker deletion failure/u);
    expect(state.webhook?.consumers).toEqual([]);
    await expect(config.readConfig(false, "feed")).resolves.toEqual(
      expect.objectContaining({
        completedSteps: expect.arrayContaining([
          "destroy-webhook-consumer-detached",
        ]),
      }),
    );

    await commands.destroyCommand({
      confirm: "feed",
      instance: "feed",
    }, runner);

    const consumerDeletes = fetchMock.mock.calls.filter(([input, init]) =>
      new URL(input instanceof Request ? input.url : input.toString())
        .pathname.endsWith("/queues/queue-id/consumers/consumer-id") &&
      init?.method === "DELETE"
    );
    expect(consumerDeletes).toHaveLength(1);
    expect(state.worker).toBe(false);
    expect(state.webhook).toBeUndefined();
    await expect(config.readConfig(false, "feed")).resolves.toBeNull();
  });

  it("always preserves reused data resources", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(savedConfig({
      d1: {id: "database-id", name: "feed-db", reuse: true},
      r2: {name: "feed-media", reuse: true, setupMode: "automatic"},
    }));
    const state: CloudflareState = {
      d1: true,
      domain: true,
      objects: ["shared.jpg"],
      r2: true,
      worker: true,
    };
    const {fetchMock, runner} = cloudflareHarness(state);
    vi.stubGlobal("fetch", fetchMock);

    await commands.destroyCommand({
      confirm: "feed",
      instance: "feed",
    }, runner);

    expect(state.d1).toBe(true);
    expect(state.r2).toBe(true);
    expect(state.objects).toEqual(["shared.jpg"]);
    expect(runner.mock.calls.map(([, args]) => args.join(" "))).not.toEqual(
      expect.arrayContaining(["r2 bucket delete feed-media"]),
    );
  });

  it("refuses mismatched confirmation and unexpected domains before deletion", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(savedConfig());
    const state: CloudflareState = {
      d1: true,
      domain: true,
      objects: [],
      r2: true,
      worker: true,
    };
    const {fetchMock, runner} = cloudflareHarness(state);
    vi.stubGlobal("fetch", fetchMock);

    await expect(commands.destroyCommand({
      confirm: "another-site",
      instance: "feed",
    }, runner)).rejects.toThrow("must exactly match the site name");
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method)).toBe(true);

    const originalFetch = fetchMock.getMockImplementation() as (
      input: URL | RequestInfo,
      init?: RequestInit,
    ) => Promise<Response>;
    vi.stubGlobal("fetch", vi.fn(async (
      input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      const url = new URL(
        input instanceof Request ? input.url : input.toString(),
      );
      if (url.pathname.endsWith("/workers/domains") && !init?.method) {
        return Response.json({
          result: [{
            hostname: "unexpected.example.com",
            id: "other-domain",
            service: "feed",
          }],
          success: true,
        });
      }
      return originalFetch(input, init);
    }));
    await expect(commands.destroyCommand({
      confirm: "feed",
      instance: "feed",
    }, runner)).rejects.toThrow("unexpected custom-domain configuration");
    expect(state.worker).toBe(true);
    expect(state.d1).toBe(true);
    expect(state.r2).toBe(true);
  });

  it("refuses production deletion while a preview still uses shared media", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(savedConfig());
    await config.writeConfig(savedConfig({
      customDomain: null,
      d1: {id: "preview-db-id", name: "feed-preview-db", reuse: false},
      deploymentEnvironment: "preview",
      deploymentUrl: "https://feed-preview.example.workers.dev",
      projectName: "feed",
      r2: {name: "feed-media", reuse: true, setupMode: "automatic"},
      workerName: "feed-preview",
    }));
    const runner = vi.fn<CommandRunner>();

    await expect(commands.destroyCommand({
      confirm: "feed",
      instance: "feed",
    }, runner)).rejects.toThrow("still has a preview deployment");
    expect(runner).not.toHaveBeenCalled();
  });

  it("resumes after partial deletion without repeating completed data loss", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(savedConfig());
    const state: CloudflareState = {
      d1: true,
      domain: true,
      objects: ["photo.jpg"],
      r2: true,
      r2DeleteFailures: 1,
      worker: true,
    };
    const {fetchMock, runner} = cloudflareHarness(state);
    vi.stubGlobal("fetch", fetchMock);

    await expect(commands.destroyCommand({
      confirm: "feed",
      instance: "feed",
    }, runner)).rejects.toThrow("could not be fully removed");
    expect(state).toEqual({
      d1: false,
      domain: false,
      objects: [],
      r2: true,
      r2DeleteFailures: 0,
      worker: false,
    });
    await expect(config.readConfig(false, "feed")).resolves.toEqual(
      expect.objectContaining({
        completedSteps: expect.arrayContaining([
          "destroy-worker-deleted",
          "destroy-domains-detached",
          "destroy-d1-deleted",
        ]),
      }),
    );

    await commands.destroyCommand({
      confirm: "feed",
      instance: "feed",
    }, runner);

    expect(state.r2).toBe(false);
    await expect(config.readConfig(false, "feed")).resolves.toBeNull();
    expect(
      fetchMock.mock.calls.filter(([input, init]) =>
        new URL(input instanceof Request ? input.url : input.toString())
            .pathname.endsWith("/d1/database/database-id") &&
        init?.method === "DELETE"
      ),
    ).toHaveLength(1);
  });

  it("refuses a bucket that reappears after a completed destroy step", async () => {
    const {commands, config} = await freshModules();
    await config.writeConfig(savedConfig({
      completedSteps: [
        "r2-ready",
        "destroy-worker-deleted",
        "destroy-domains-detached",
        "destroy-d1-deleted",
        "destroy-r2-deleted",
      ],
      customDomain: null,
    }));
    const state: CloudflareState = {
      d1: false,
      domain: false,
      objects: ["replacement.jpg"],
      r2: true,
      worker: false,
    };
    const {fetchMock, runner} = cloudflareHarness(state);
    vi.stubGlobal("fetch", fetchMock);

    await expect(commands.destroyCommand({
      confirm: "feed",
      instance: "feed",
    }, runner)).rejects.toThrow("replacement bucket");
    expect(state.r2).toBe(true);
    expect(state.objects).toEqual(["replacement.jpg"]);
    expect(
      runner.mock.calls.map(([, args]) => args.join(" ")),
    ).not.toContain("r2 bucket delete feed-media");
  });
});
