import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {discoverInstance} from "../../../packages/cli/src/discovery";
import {
  apiRequest,
  writeApiResponse,
} from "../../../packages/cli/src/http";
import {
  type Keychain,
  setKeychainForTests,
} from "../../../packages/cli/src/keychain";
import {
  decryptTokens,
  encryptTokens,
  readStore,
  storePath,
  writeStore,
} from "../../../packages/cli/src/store";

let directory: string;
let key: Buffer | null;

const memoryKeychain: Keychain = {
  async get() {
    return key;
  },
  async set(value) {
    key = Buffer.from(value);
  },
};

beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "microfeed-cli-test-"));
  process.env.MICROFEED_CONFIG_DIR = directory;
  delete process.env.MICROFEED_API_KEY;
  delete process.env.MICROFEED_URL;
  delete process.env.MICROFEED_INSTANCE;
  key = null;
  setKeychainForTests(memoryKeychain);
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setKeychainForTests(undefined);
  delete process.env.MICROFEED_CONFIG_DIR;
  delete process.env.MICROFEED_API_KEY;
  delete process.env.MICROFEED_URL;
  delete process.env.MICROFEED_INSTANCE;
  await rm(directory, {recursive: true, force: true});
});

describe("CLI credentials", () => {
  it("encrypts token bundles and stores no credential plaintext", async () => {
    const encryptedTokens = await encryptTokens("feed", "https://feed.example", {
      accessToken: "access-secret-value",
      expiresAt: Date.now() + 60_000,
      refreshToken: "refresh-secret-value",
      scope: "content:read offline_access",
      tokenType: "Bearer",
    });
    await writeStore({
      current: "feed",
      instances: {
        feed: {
          authorizationEndpoint: "https://feed.example/api/auth/oauth2/authorize",
          encryptedTokens,
          instanceId: "instance-id",
          issuer: "https://feed.example/api/auth",
          origin: "https://feed.example",
          tokenEndpoint: "https://feed.example/api/auth/oauth2/token",
        },
      },
      version: 2,
    });

    const serialized = await readFile(storePath(), "utf8");
    expect(serialized).not.toContain("access-secret-value");
    expect(serialized).not.toContain("refresh-secret-value");
    expect(key).toHaveLength(32);
    const store = await readStore();
    await expect(decryptTokens("feed", store.instances.feed!)).resolves
      .toMatchObject({accessToken: "access-secret-value"});
  });

  it("migrates a version-one store without decrypting or losing credentials", async () => {
    const encryptedTokens = await encryptTokens("feed", "https://feed.example", {
      accessToken: "preserved-access-token",
      expiresAt: Date.now() + 60_000,
      refreshToken: "preserved-refresh-token",
      scope: "content:read offline_access",
      tokenType: "Bearer",
    });
    await writeStore({
      current: "feed",
      instances: {
        feed: {
          authorizationEndpoint: "https://feed.example/api/auth/oauth2/authorize",
          encryptedTokens,
          instanceId: "instance-id",
          issuer: "https://feed.example/api/auth",
          origin: "https://feed.example",
          tokenEndpoint: "https://feed.example/api/auth/oauth2/token",
        },
      },
      version: 2,
    });
    const legacy = JSON.parse(await readFile(storePath(), "utf8")) as {
      version: number;
    };
    legacy.version = 1;
    await writeFile(storePath(), JSON.stringify(legacy), "utf8");

    const migrated = await readStore();
    expect(migrated.version).toBe(2);
    expect(migrated.instances.feed?.connectionId).toBeUndefined();
    await expect(decryptTokens("feed", migrated.instances.feed!)).resolves
      .toMatchObject({refreshToken: "preserved-refresh-token"});
  });

  it("keeps multiple profiles independently bound to their origins", async () => {
    const first = await encryptTokens("first", "https://first.example", {
      accessToken: "first-access-token",
      expiresAt: Date.now() + 60_000,
      scope: "content:read",
      tokenType: "Bearer",
    });
    const second = await encryptTokens("second", "https://second.example", {
      accessToken: "second-access-token",
      expiresAt: Date.now() + 60_000,
      scope: "content:write",
      tokenType: "Bearer",
    });
    await writeStore({
      current: "second",
      instances: {
        first: {
          authorizationEndpoint: "https://first.example/api/auth/oauth2/authorize",
          encryptedTokens: first,
          instanceId: "first-instance",
          issuer: "https://first.example/api/auth",
          origin: "https://first.example",
          tokenEndpoint: "https://first.example/api/auth/oauth2/token",
        },
        second: {
          authorizationEndpoint: "https://second.example/api/auth/oauth2/authorize",
          encryptedTokens: second,
          instanceId: "second-instance",
          issuer: "https://second.example/api/auth",
          origin: "https://second.example",
          tokenEndpoint: "https://second.example/api/auth/oauth2/token",
        },
      },
      version: 2,
    });

    const store = await readStore();
    await expect(decryptTokens("first", store.instances.first!)).resolves
      .toMatchObject({accessToken: "first-access-token"});
    await expect(decryptTokens("second", store.instances.second!)).resolves
      .toMatchObject({accessToken: "second-access-token"});
    await expect(decryptTokens("first", store.instances.second!)).rejects
      .toThrow("could not be decrypted");
  });

  it("never falls back to plaintext when the keychain is unavailable", async () => {
    setKeychainForTests({
      async get() {
        return null;
      },
      async set() {
        throw new Error("keychain unavailable");
      },
    });
    await expect(encryptTokens("feed", "https://feed.example", {
      accessToken: "must-not-be-written",
      expiresAt: Date.now() + 60_000,
      scope: "content:read",
      tokenType: "Bearer",
    })).rejects.toThrow("keychain unavailable");
    await expect(readFile(storePath(), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("gives environment API keys precedence without persisting them", async () => {
    process.env.MICROFEED_API_KEY = "environment-secret";
    process.env.MICROFEED_URL = "https://feed.example";
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("authorization"))
        .toBe("Bearer environment-secret");
      return new Response(JSON.stringify({items: []}), {
        headers: {"content-type": "application/json"},
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("GET", "/api/v1/feed/", {json: true}))
      .resolves.toMatchObject({body: {items: []}, status: 200});
    expect(fetchMock).toHaveBeenCalledOnce();
    await expect(readFile(storePath(), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("blocks caller-controlled credential and authority headers", async () => {
    process.env.MICROFEED_API_KEY = "environment-secret";
    process.env.MICROFEED_URL = "https://feed.example";
    for (const header of ["Authorization: other", "Cookie: session=x", "Host: attacker.example"]) {
      await expect(apiRequest("GET", "/api/v1/feed/", {json: false}, {
        headers: [header],
      })).rejects.toThrow("managed by microfeed");
    }
  });

  it("marks bodyless DELETE requests as JSON instead of browser form submissions", async () => {
    process.env.MICROFEED_API_KEY = "environment-secret";
    process.env.MICROFEED_URL = "https://feed.example";
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.body).toBeUndefined();
      expect(init?.method).toBe("DELETE");
      expect(new Headers(init?.headers).get("content-type"))
        .toBe("application/json");
      return Response.json({});
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest(
      "DELETE",
      "/api/v1/items/item-id/",
      {json: true},
    )).resolves.toMatchObject({body: {}, status: 200});
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("CLI API diagnostics", () => {
  it("gives people and agents actionable recovery for a 404 response", () => {
    const previousExitCode = process.exitCode;
    const stdout = vi.spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const write = vi.spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    try {
      writeApiResponse({
        body: "404",
        headers: {},
        ok: false,
        status: 404,
      }, true);
      const diagnostic = String(write.mock.calls[0]?.[0]);
      expect(diagnostic).toContain("API access may be disabled");
      expect(diagnostic).toContain("disabled by default");
      expect(diagnostic).toContain("API → API Settings");
      expect(diagnostic).toContain("turn on Enable API access");
      expect(diagnostic).toContain("AI agent, pause");
      expect(diagnostic).toContain("do not request their dashboard password");
      expect(diagnostic).toContain("retry the same command");
      expect(diagnostic).toContain(
        "https://docs.microfeed.org/api/authentication/#enable-the-api",
      );

      const output = JSON.parse(String(stdout.mock.calls[0]?.[0])) as {
        recovery: {
          code: string;
          documentationUrl: string;
          instructions: string[];
        };
      };
      expect(output.recovery.code).toBe("api_access_or_resource_not_found");
      expect(output.recovery.documentationUrl).toContain("#enable-the-api");
      expect(output.recovery.instructions.join(" "))
        .toContain("site owner should sign in");
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});

describe("CLI discovery", () => {
  it("explains why Cloudflare Access cannot replace built-in OAuth login", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString();
      const response = Response.json({
        instanceId: "id",
        oauthAuthorizationAvailable: false,
        product: "microfeed",
      });
      Object.defineProperty(response, "url", {value: url});
      return response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(discoverInstance("https://feed.example"))
      .rejects.toThrow("Cloudflare Access can protect dashboard routes");
    await expect(discoverInstance("https://feed.example"))
      .rejects.toThrow("yarn manage auth setup");
    await expect(discoverInstance("https://feed.example"))
      .rejects.toThrow("domains-and-access/#enable-built-in-login");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives older sites actionable recovery when OAuth metadata is absent", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString();
      const response = url.endsWith("microfeed.json")
        ? Response.json({instanceId: "id", product: "microfeed"})
        : new Response("404", {status: 404});
      Object.defineProperty(response, "url", {value: url});
      return response;
    }));

    await expect(discoverInstance("https://feed.example"))
      .rejects.toThrow("Built-in login may be disabled");
  });

  it("rejects a cross-origin OAuth issuer without exposing identity fields", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : input.toString();
      const response = url.endsWith("microfeed.json")
        ? new Response(JSON.stringify({instanceId: "id", product: "microfeed"}))
        : new Response(JSON.stringify({
            authorization_endpoint: "https://login.attacker.example/authorize",
            code_challenge_methods_supported: ["S256"],
            grant_types_supported: ["authorization_code"],
            issuer: "https://login.attacker.example",
            token_endpoint: "https://login.attacker.example/token",
          }));
      Object.defineProperty(response, "url", {value: url});
      return response;
    }));

    await expect(discoverInstance("https://feed.example"))
      .rejects.toThrow("must use the same site URL");
  });
});
