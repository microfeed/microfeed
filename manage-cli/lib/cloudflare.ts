import nodePath from "node:path";

import {
  normalizeAdminAuthMode,
  type AdminAuthMode,
} from "@/shared/AdminAuth";
import {normalizeAdminPath} from "@/shared/AdminPath";
import type {Account, CommandRunner, MicrofeedConfig} from "../types";
import type {AuthOwner, AuthPasswordSetup} from "./auth";
import {
  builtWranglerConfigPath,
  cloudflareAccountId,
  localPersistencePath,
  wranglerConfigPath,
} from "./config";
import {repositoryRoot, runWrangler} from "./process";

export const OAUTH_SCOPES = [
  "account:read",
  "user:read",
  "workers:write",
  "workers_scripts:write",
  "d1:write",
  "pages:write",
  "zone:read",
] as const;

function parseJsonOutput<T>(output: string): T {
  const lines = output.trim().split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const candidate = lines.slice(index).join("\n").trim();
    if (!candidate.startsWith("{") && !candidate.startsWith("[")) {
      continue;
    }
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Wrangler can print status lines before JSON. Keep looking.
    }
  }
  throw new Error(`Could not parse Wrangler JSON output:\n${output}`);
}

function accountEnvironment(accountId: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_AUTH_USE_KEYRING: "true",
  };
}

function parseAuthOwnerOutput(output: string): AuthOwner | null {
  const data = parseJsonOutput<unknown>(output);
  const resultSets = Array.isArray(data) ? data : [data];
  for (const resultSet of resultSets) {
    if (!resultSet || typeof resultSet !== "object") {
      continue;
    }
    const rows = (resultSet as {results?: unknown}).results;
    if (!Array.isArray(rows) || rows.length === 0) {
      continue;
    }
    const row = rows[0] as Record<string, unknown>;
    return {
      email: String(row.email ?? ""),
      id: String(row.id ?? ""),
      role: row.role === null || row.role === undefined
        ? null
        : String(row.role),
    };
  }
  return null;
}

function parseAuthPasswordSetupOutput(
  output: string,
): AuthPasswordSetup | null {
  const data = parseJsonOutput<unknown>(output);
  const resultSets = Array.isArray(data) ? data : [data];
  for (const resultSet of resultSets) {
    if (!resultSet || typeof resultSet !== "object") {
      continue;
    }
    const rows = (resultSet as {results?: unknown}).results;
    if (!Array.isArray(rows) || rows.length === 0) {
      continue;
    }
    const row = rows[0] as Record<string, unknown>;
    if (row.purpose !== "initial" && row.purpose !== "reset") {
      continue;
    }
    return {
      createdAt: String(row.createdAt ?? ""),
      email: String(row.email ?? ""),
      expiresAt: String(row.expiresAt ?? ""),
      purpose: row.purpose,
      userId: row.userId === null || row.userId === undefined
        ? null
        : String(row.userId),
    };
  }
  return null;
}

function parseSecretNames(output: string): Set<string> {
  const data = parseJsonOutput<unknown>(output);
  const candidates = Array.isArray(data)
    ? data
    : (
        data &&
        typeof data === "object" &&
        Array.isArray((data as {secrets?: unknown}).secrets)
          ? (data as {secrets: unknown[]}).secrets
          : []
      );
  return new Set(candidates.flatMap((candidate) => {
    if (typeof candidate === "string") {
      return [candidate];
    }
    if (!candidate || typeof candidate !== "object") {
      return [];
    }
    const name = (candidate as {name?: unknown}).name;
    return typeof name === "string" ? [name] : [];
  }));
}

interface PagesProject {
  domains: string[];
  name: string;
}

interface ApiTokenCredentials {
  token: string;
  type: "api_token" | "oauth";
}

interface ApiKeyCredentials {
  email: string;
  key: string;
  type: "api_key";
}

type CloudflareCredentials = ApiKeyCredentials | ApiTokenCredentials;

interface WorkerBinding extends Record<string, unknown> {
  name?: string;
  type?: string;
}

interface CloudflareApiResultInfo {
  cursor?: unknown;
  is_truncated?: unknown;
}

interface CloudflareApiEnvelope<T> {
  errors?: Array<{message?: unknown}>;
  result?: T;
  result_info?: CloudflareApiResultInfo;
  success?: boolean;
}

export interface R2ObjectListing {
  customMetadata: Record<string, string>;
  etag: string | null;
  httpMetadata: {
    cacheControl?: string;
    cacheExpiry?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    contentLanguage?: string;
    contentType?: string;
  };
  key: string;
  size: number;
  storageClass: string | null;
  uploaded: string | null;
}

export interface WorkerDomain {
  hostname: string;
  id: string;
  service: string;
}

export interface DiscoveredMicrofeedWorker {
  accountId: string;
  accountName: string;
  adminAuthMode: AdminAuthMode;
  adminPath: string;
  customDomains: string[];
  d1: {
    id: string;
    name: string;
  };
  instanceId: string | null;
  projectName: string;
  r2Name: string;
  workerName: string;
  workersDevUrl: string | null;
}

export interface CloudflareIdentity {
  accounts: Account[];
  email: string | null;
  profile: string | null;
  profiles: WranglerProfileSummary[];
}

export interface WranglerProfileSummary {
  active: boolean;
  name: string;
}

const RESERVED_WRANGLER_PROFILE_NAMES = new Set(["default", "staging"]);

export function validateWranglerProfileName(
  name: string,
): string | undefined {
  if (RESERVED_WRANGLER_PROFILE_NAMES.has(name.toLowerCase())) {
    return `\`${name}\` is reserved by Wrangler. Choose another name.`;
  }
  if (!/^[A-Za-z0-9_-]+$/u.test(name)) {
    return "Use only ASCII letters, numbers, hyphens, and underscores.";
  }
  return undefined;
}

function accountsFromWhoami(data: Record<string, unknown>): Account[] {
  const candidates = (
    Array.isArray(data.accounts)
      ? data.accounts
      : Array.isArray(data.memberships)
        ? data.memberships
        : []
  ) as Array<Record<string, unknown>>;
  return candidates.flatMap((candidate) => {
    const nested = candidate.account as Record<string, unknown> | undefined;
    const id = String(candidate.id ?? nested?.id ?? "");
    if (!id) {
      return [];
    }
    return [{
      id,
      name: String(candidate.name ?? nested?.name ?? id),
    }];
  });
}

interface WranglerProfile {
  boundDirectories: string;
  name: string;
}

function profilesFromList(output: string): WranglerProfile[] {
  const withoutAnsi = output.replace(
    /\u001B\[[0-?]*[ -/]*[@-~]/gu,
    "",
  );
  const profiles: WranglerProfile[] = [];
  for (const line of withoutAnsi.split(/\r?\n/u)) {
    const cells = line.split("│").map((cell) => cell.trim());
    if (cells.length < 4) {
      continue;
    }
    const profile = cells[1];
    const boundDirectories = cells[2];
    if (!profile || profile === "Profile") {
      continue;
    }
    profiles.push({boundDirectories: boundDirectories ?? "", name: profile});
  }
  return profiles;
}

function bindingContainsRepository(binding: string): boolean {
  const relative = nodePath.relative(
    nodePath.resolve(binding),
    repositoryRoot,
  );
  return relative === "" || (
    relative !== ".." &&
    !relative.startsWith(`..${nodePath.sep}`) &&
    !nodePath.isAbsolute(relative)
  );
}

function activeProfileFromProfiles(
  profiles: WranglerProfile[],
): string | null {
  const activeBinding = profiles.flatMap(({boundDirectories, name}) =>
    boundDirectories.split(",").flatMap((directory) => {
      const binding = directory.trim();
      return binding && binding !== "-" && bindingContainsRepository(binding)
        ? [{binding: nodePath.resolve(binding), name}]
        : [];
    })
  ).sort((left, right) => right.binding.length - left.binding.length)[0];
  return activeBinding?.name ?? (profiles.some(({name}) => name === "default")
    ? "default"
    : null);
}

function parsePagesProjects(output: string): PagesProject[] {
  const data = parseJsonOutput<unknown>(output);
  const projects = Array.isArray(data)
    ? data
    : (
        data &&
        typeof data === "object" &&
        Array.isArray((data as {result?: unknown}).result)
          ? (data as {result: unknown[]}).result
          : []
      );
  return projects.flatMap((project) => {
    if (!project || typeof project !== "object") {
      return [];
    }
    const record = project as Record<string, unknown>;
    const name = record.name ??
      record.project_name ??
      record["Project Name"];
    if (typeof name !== "string") {
      return [];
    }
    const rawDomains = record.domains ??
      record.project_domains ??
      record["Project Domains"];
    const domains = Array.isArray(rawDomains)
      ? rawDomains.filter(
          (domain): domain is string => typeof domain === "string",
        )
      : typeof rawDomains === "string"
        ? rawDomains.split(",")
        : [];
    return [{
      domains: domains.map((domain) => domain.trim()).filter(Boolean),
      name,
    }];
  });
}

export class CloudflareClient {
  private credentialsPromise?: Promise<CloudflareCredentials>;

  constructor(private readonly runner: CommandRunner) {}

  async login(): Promise<void> {
    try {
      await runWrangler(
        this.runner,
        ["login", "--use-keyring", "--scopes", ...OAUTH_SCOPES],
        {interactive: true},
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        "Cloudflare browser authorization did not complete. No Cloudflare " +
          "resources were changed. Approve the requested permissions and " +
          "keep this command open until the browser callback finishes, then " +
          `retry. ${detail}`,
      );
    }
    this.credentialsPromise = undefined;
  }

  async authorizeProfile(profile: string): Promise<void> {
    try {
      await runWrangler(
        this.runner,
        ["auth", "create", profile, "--scopes", ...OAUTH_SCOPES],
        {
          env: {
            ...process.env,
            CLOUDFLARE_AUTH_USE_KEYRING: "true",
          },
          interactive: true,
        },
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cloudflare authorization for Wrangler profile \`${profile}\` did ` +
          "not complete. No Cloudflare resources were changed. Approve the " +
          "requested permissions and keep this command open until the " +
          `browser callback finishes, then retry. ${detail}`,
      );
    }
    this.credentialsPromise = undefined;
  }

  async activateProfile(profile: string): Promise<void> {
    try {
      await runWrangler(
        this.runner,
        ["auth", "activate", profile, repositoryRoot],
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Wrangler profile \`${profile}\` could not be activated for this ` +
          "local repository. No Cloudflare resources were changed. " + detail,
      );
    }
    this.credentialsPromise = undefined;
  }

  async profileExists(profile: string): Promise<boolean> {
    try {
      const result = await runWrangler(
        this.runner,
        ["auth", "list"],
        {allowFailure: true},
      );
      return result.exitCode === 0 &&
        profilesFromList(result.stdout).some(({name}) => name === profile);
    } catch {
      return false;
    }
  }

  async accounts(): Promise<Account[]> {
    const result = await runWrangler(
      this.runner,
      ["whoami", "--json"],
      {allowFailure: true},
    );
    if (result.exitCode !== 0) {
      return [];
    }
    const data = parseJsonOutput<Record<string, unknown>>(result.stdout);
    return accountsFromWhoami(data);
  }

  private async profileState(): Promise<{
    profile: string | null;
    profiles: WranglerProfileSummary[];
  }> {
    try {
      const result = await runWrangler(
        this.runner,
        ["auth", "list"],
        {allowFailure: true},
      );
      if (result.exitCode !== 0) {
        return {profile: null, profiles: []};
      }
      const profiles = profilesFromList(result.stdout);
      const profile = activeProfileFromProfiles(profiles);
      return {
        profile,
        profiles: profiles.map(({name}) => ({
          active: name === profile,
          name,
        })),
      };
    } catch {
      // Auth profiles are experimental and may not exist in older Wrangler.
      return {profile: null, profiles: []};
    }
  }

  async identity(): Promise<CloudflareIdentity> {
    const result = await runWrangler(
      this.runner,
      ["whoami", "--json"],
      {allowFailure: true},
    );
    if (result.exitCode !== 0) {
      return {accounts: [], email: null, profile: null, profiles: []};
    }
    const data = parseJsonOutput<Record<string, unknown>>(result.stdout);
    const email = typeof data.email === "string" && data.email
      ? data.email
      : null;
    const authType = typeof data.authType === "string" ? data.authType : "";
    const profileState = /oauth/iu.test(authType)
      ? await this.profileState()
      : {profile: null, profiles: []};
    return {
      accounts: accountsFromWhoami(data),
      email,
      ...profileState,
    };
  }

  async hasRequiredScopes(): Promise<boolean> {
    const result = await runWrangler(
      this.runner,
      ["whoami", "--json"],
      {allowFailure: true},
    );
    if (result.exitCode !== 0) {
      return false;
    }
    const data = parseJsonOutput<{tokenPermissions?: unknown}>(
      result.stdout,
    );
    const permissions = Array.isArray(data.tokenPermissions)
      ? data.tokenPermissions.filter(
          (permission): permission is string => typeof permission === "string",
        )
      : [];
    return OAUTH_SCOPES.every((scope) => permissions.includes(scope));
  }

  private async credentials(): Promise<CloudflareCredentials> {
    this.credentialsPromise ??= (async () => {
      const result = await runWrangler(
        this.runner,
        ["auth", "token", "--json"],
        {allowFailure: true},
      );
      if (result.exitCode !== 0) {
        throw new Error(
          "Wrangler is not signed in. Run `yarn manage connect` to sign in.",
        );
      }
      const data = parseJsonOutput<Record<string, unknown>>(result.stdout);
      if (
        (data.type === "api_token" || data.type === "oauth") &&
        typeof data.token === "string" &&
        data.token.length > 0
      ) {
        return {
          token: data.token,
          type: data.type,
        };
      }
      if (
        data.type === "api_key" &&
        typeof data.key === "string" &&
        data.key.length > 0 &&
        typeof data.email === "string" &&
        data.email.length > 0
      ) {
        return {
          email: data.email,
          key: data.key,
          type: "api_key",
        };
      }
      throw new Error("Wrangler returned unsupported Cloudflare credentials.");
    })();
    return this.credentialsPromise;
  }

  private async apiRequest<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<{
    result: T;
    resultInfo: CloudflareApiResultInfo | undefined;
  }> {
    const credentials = await this.credentials();
    const headers: Record<string, string> = credentials.type === "api_key"
      ? {
          "X-Auth-Email": credentials.email,
          "X-Auth-Key": credentials.key,
        }
      : {Authorization: `Bearer ${credentials.token}`};
    const response = await fetch(
      `https://api.cloudflare.com/client/v4${path}`,
      {...init, headers: {...headers, ...init.headers}},
    );
    const body = await response.text();
    if (!body.trim()) {
      if (response.ok) {
        return {
          result: undefined as T,
          resultInfo: undefined,
        };
      }
      throw new Error(
        `Cloudflare API request failed for ${path} (HTTP ${response.status}).`,
      );
    }
    let data: CloudflareApiEnvelope<T>;
    try {
      data = JSON.parse(body) as CloudflareApiEnvelope<T>;
    } catch {
      throw new Error(
        `Cloudflare returned an invalid API response for ${path}.`,
      );
    }
    if (!response.ok || data.success === false) {
      const detail = data.errors
        ?.map(({message}) => typeof message === "string" ? message : "")
        .filter(Boolean)
        .join("; ");
      throw new Error(
        detail ||
          `Cloudflare API request failed for ${path} (HTTP ${response.status}).`,
      );
    }
    if (data.result === undefined && init.method !== "DELETE") {
      throw new Error(
        `Cloudflare returned an invalid API response for ${path}.`,
      );
    }
    return {
      result: data.result as T,
      resultInfo: data.result_info,
    };
  }

  private async apiRawRequest(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const credentials = await this.credentials();
    const headers: Record<string, string> = credentials.type === "api_key"
      ? {
          "X-Auth-Email": credentials.email,
          "X-Auth-Key": credentials.key,
        }
      : {Authorization: `Bearer ${credentials.token}`};
    const response = await fetch(
      `https://api.cloudflare.com/client/v4${path}`,
      {...init, headers: {...headers, ...init.headers}},
    );
    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(
        detail ||
          `Cloudflare API request failed for ${path} (HTTP ${response.status}).`,
      );
    }
    return response;
  }

  private async apiGet<T>(path: string): Promise<T> {
    return (await this.apiRequest<T>(path)).result;
  }

  private async apiDelete(path: string): Promise<void> {
    await this.apiRequest<unknown>(path, {method: "DELETE"});
  }

  private async workerSettings(
    accountId: string,
    workerName: string,
  ): Promise<WorkerBinding[]> {
    const settings = await this.apiGet<{bindings?: unknown}>(
      `/accounts/${encodeURIComponent(accountId)}/workers/scripts/` +
        `${encodeURIComponent(workerName)}/settings`,
    );
    return Array.isArray(settings.bindings)
      ? settings.bindings.filter(
          (binding): binding is WorkerBinding =>
            Boolean(binding) && typeof binding === "object",
        )
      : [];
  }

  async workerDomains(
    accountId: string,
    selectedWorkerName?: string,
  ): Promise<WorkerDomain[]> {
    const domains = await this.apiGet<Array<{
      hostname?: unknown;
      id?: unknown;
      service?: unknown;
    }>>(
      `/accounts/${encodeURIComponent(accountId)}/workers/domains`,
    );
    return domains.flatMap((domain) => {
      if (
        typeof domain.id !== "string" ||
        typeof domain.hostname !== "string" ||
        typeof domain.service !== "string" ||
        (
          selectedWorkerName !== undefined &&
          domain.service !== selectedWorkerName
        )
      ) {
        return [];
      }
      return [{
        hostname: domain.hostname,
        id: domain.id,
        service: domain.service,
      }];
    }).sort((left, right) => left.hostname.localeCompare(right.hostname));
  }

  async deleteWorker(accountId: string, name: string): Promise<void> {
    await this.apiDelete(
      `/accounts/${encodeURIComponent(accountId)}/workers/scripts/` +
        `${encodeURIComponent(name)}?force=false`,
    );
  }

  async deleteWorkerDomain(
    accountId: string,
    domainId: string,
  ): Promise<void> {
    await this.apiDelete(
      `/accounts/${encodeURIComponent(accountId)}/workers/domains/` +
        encodeURIComponent(domainId),
    );
  }

  async discoverMicrofeedWorkers(
    account: Account,
  ): Promise<DiscoveredMicrofeedWorker[]> {
    const accountPath = `/accounts/${encodeURIComponent(account.id)}/workers`;
    const [scripts, domains, accountSubdomain, databases] = await Promise.all([
      this.apiGet<Array<{id?: unknown}>>(`${accountPath}/scripts`),
      this.apiGet<Array<{
        hostname?: unknown;
        service?: unknown;
      }>>(`${accountPath}/domains`),
      this.apiGet<{subdomain?: unknown}>(`${accountPath}/subdomain`)
        .catch(() => ({subdomain: undefined})),
      this.d1Databases(account.id),
    ]);
    const d1Names = new Map(
      databases.map(({id, name}) => [id, name]),
    );
    const domainsByWorker = new Map<string, string[]>();
    for (const domain of domains) {
      if (
        typeof domain.service !== "string" ||
        typeof domain.hostname !== "string"
      ) {
        continue;
      }
      const hostnames = domainsByWorker.get(domain.service) ?? [];
      hostnames.push(domain.hostname);
      domainsByWorker.set(domain.service, hostnames);
    }
    const workersDevSubdomain = typeof accountSubdomain.subdomain === "string"
      ? accountSubdomain.subdomain
      : null;

    const inspectionErrors: string[] = [];
    const candidates = await Promise.all(
      scripts.flatMap(({id}) => typeof id === "string" ? [id] : [])
        .map(async (workerName) => {
          try {
            const bindings = await this.workerSettings(account.id, workerName);
            const d1 = bindings.find(
              ({name, type}) => name === "FEED_DB" && type === "d1",
            );
            const r2 = bindings.find(
              ({name, type}) => name === "MEDIA_BUCKET" && type === "r2_bucket",
            );
            const d1Id = typeof d1?.database_id === "string"
              ? d1.database_id
              : typeof d1?.id === "string"
                ? d1.id
                : null;
            const r2Name = typeof r2?.bucket_name === "string"
              ? r2.bucket_name
              : null;
            const d1Name = d1Id ? d1Names.get(d1Id) : undefined;
            if (!d1Id || !d1Name || !r2Name) {
              return null;
            }
            const variables = new Map(
              bindings.flatMap((binding) =>
                binding.type === "plain_text" &&
                  typeof binding.name === "string" &&
                  typeof binding.text === "string"
                  ? [[binding.name, binding.text] as const]
                  : []
              ),
            );
            const subdomain = workersDevSubdomain
              ? await this.apiGet<{enabled?: unknown}>(
                  `${accountPath}/scripts/${encodeURIComponent(workerName)}` +
                    "/subdomain",
                ).catch(() => ({enabled: false}))
              : {enabled: false};
            return {
              accountId: account.id,
              accountName: account.name,
              adminAuthMode: normalizeAdminAuthMode(
                variables.get("MICROFEED_ADMIN_AUTH_MODE"),
              ),
              adminPath: normalizeAdminPath(
                variables.get("MICROFEED_ADMIN_PATH"),
              ),
              customDomains: (domainsByWorker.get(workerName) ?? [])
                .sort((left, right) => left.localeCompare(right)),
              d1: {id: d1Id, name: d1Name},
              instanceId: variables.get("MICROFEED_INSTANCE_ID") ?? null,
              projectName: variables.get("CLOUDFLARE_PROJECT_NAME") ??
                workerName,
              r2Name,
              workerName,
              workersDevUrl:
                subdomain.enabled === true && workersDevSubdomain
                  ? `https://${workerName}.${workersDevSubdomain}.workers.dev`
                  : null,
            } satisfies DiscoveredMicrofeedWorker;
          } catch (error) {
            inspectionErrors.push(
              `${workerName}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            return null;
          }
        }),
    );
    const compatible = candidates.filter(
      (candidate): candidate is DiscoveredMicrofeedWorker =>
        candidate !== null,
    ).sort((left, right) => left.workerName.localeCompare(right.workerName));
    if (compatible.length === 0 && inspectionErrors.length > 0) {
      throw new Error(
        "Cloudflare did not allow microfeed to inspect Worker settings:\n" +
          inspectionErrors.join("\n"),
      );
    }
    return compatible;
  }

  private async pagesProjectDetails(accountId: string): Promise<PagesProject[]> {
    const result = await runWrangler(
      this.runner,
      ["pages", "project", "list", "--json"],
      {env: accountEnvironment(accountId)},
    );
    return parsePagesProjects(result.stdout);
  }

  async pagesProjects(accountId: string): Promise<string[]> {
    return (await this.pagesProjectDetails(accountId))
      .map(({name}) => name);
  }

  async pagesProjectDomains(
    accountId: string,
    projectName: string,
  ): Promise<string[]> {
    return (await this.pagesProjectDetails(accountId))
      .find(({name}) => name === projectName)
      ?.domains ?? [];
  }

  async workerExists(accountId: string, name: string): Promise<boolean> {
    const result = await runWrangler(
      this.runner,
      ["versions", "list", "--name", name, "--json"],
      {
        allowFailure: true,
        env: accountEnvironment(accountId),
      },
    );
    if (result.exitCode === 0) {
      return true;
    }
    const detail = `${result.stdout}\n${result.stderr}`.toLowerCase();
    if (
      detail.includes("not found") ||
      detail.includes("does not exist") ||
      detail.includes("no worker")
    ) {
      return false;
    }
    if (
      detail.includes("authentication error") ||
      detail.includes("code: 10000")
    ) {
      throw new Error(
        "Cloudflare did not allow microfeed to inspect Workers in this " +
        "account. Rerun the command and approve Worker Scripts access. If " +
        "it is already approved, ask a Cloudflare account administrator to " +
        "grant permission to edit Workers Scripts.",
      );
    }
    throw new Error(result.stderr.trim() || "Unable to check Worker name.");
  }

  async d1Databases(
    accountId: string,
  ): Promise<Array<{id: string; name: string}>> {
    const result = await runWrangler(this.runner, ["d1", "list", "--json"], {
      env: accountEnvironment(accountId),
    });
    const data = parseJsonOutput<Array<Record<string, unknown>>>(result.stdout);
    return data.map((database) => ({
      id: String(database.uuid ?? database.id ?? ""),
      name: String(database.name ?? ""),
    })).filter((database) => Boolean(database.id && database.name));
  }

  async r2BucketExists(accountId: string, name: string): Promise<boolean> {
    const result = await runWrangler(
      this.runner,
      ["r2", "bucket", "info", name, "--json"],
      {
        allowFailure: true,
        env: accountEnvironment(accountId),
      },
    );
    if (result.exitCode === 0) {
      return true;
    }
    const detail = `${result.stdout}\n${result.stderr}`.toLowerCase();
    if (detail.includes("not found") || detail.includes("does not exist")) {
      return false;
    }
    throw new Error(result.stderr.trim() || "Unable to check R2 bucket.");
  }

  async listR2Objects(
    accountId: string,
    name: string,
  ): Promise<R2ObjectListing[]> {
    const bucketPath = `/accounts/${encodeURIComponent(accountId)}/r2/buckets/` +
      `${encodeURIComponent(name)}/objects`;
    const objects: R2ObjectListing[] = [];
    let cursor: string | undefined;
    do {
      const query = new URLSearchParams();
      if (cursor) {
        query.set("cursor", cursor);
      }
      const response = await this.apiRequest<Array<Record<string, unknown>>>(
        `${bucketPath}${query.size > 0 ? `?${query}` : ""}`,
      );
      for (const object of response.result) {
        const key = object.key;
        const size = object.size;
        if (typeof key !== "string" || !Number.isSafeInteger(size) ||
            Number(size) < 0) {
          throw new Error("Cloudflare returned invalid R2 object metadata.");
        }
        const rawHttpMetadata = object.http_metadata ?? object.httpMetadata;
        const rawCustomMetadata = object.custom_metadata ?? object.customMetadata;
        const httpMetadata = rawHttpMetadata && typeof rawHttpMetadata === "object"
          ? rawHttpMetadata as Record<string, unknown>
          : {};
        const customMetadata = rawCustomMetadata &&
            typeof rawCustomMetadata === "object"
          ? Object.fromEntries(Object.entries(rawCustomMetadata).flatMap(
              ([metadataKey, metadataValue]) =>
                typeof metadataValue === "string"
                  ? [[metadataKey, metadataValue]]
                  : [],
            ))
          : {};
        const metadataValue = (camel: string, snake: string) => {
          const value = httpMetadata[camel] ?? httpMetadata[snake];
          return typeof value === "string" && value ? value : undefined;
        };
        objects.push({
          customMetadata,
          etag: typeof object.etag === "string" ? object.etag : null,
          httpMetadata: {
            ...(metadataValue("cacheControl", "cache_control")
              ? {cacheControl: metadataValue("cacheControl", "cache_control")}
              : {}),
            ...(metadataValue("cacheExpiry", "cache_expiry")
              ? {cacheExpiry: metadataValue("cacheExpiry", "cache_expiry")}
              : {}),
            ...(metadataValue("contentDisposition", "content_disposition")
              ? {contentDisposition: metadataValue("contentDisposition", "content_disposition")}
              : {}),
            ...(metadataValue("contentEncoding", "content_encoding")
              ? {contentEncoding: metadataValue("contentEncoding", "content_encoding")}
              : {}),
            ...(metadataValue("contentLanguage", "content_language")
              ? {contentLanguage: metadataValue("contentLanguage", "content_language")}
              : {}),
            ...(metadataValue("contentType", "content_type")
              ? {contentType: metadataValue("contentType", "content_type")}
              : {}),
          },
          key,
          size: Number(size),
          storageClass: typeof object.storage_class === "string"
            ? object.storage_class
            : typeof object.storageClass === "string"
              ? object.storageClass
              : null,
          uploaded: typeof object.last_modified === "string"
            ? object.last_modified
            : typeof object.uploaded === "string"
              ? object.uploaded
              : null,
        });
      }
      const nextCursor = response.resultInfo?.cursor;
      cursor = response.resultInfo?.is_truncated === true &&
          typeof nextCursor === "string" && nextCursor
        ? nextCursor
        : undefined;
    } while (cursor);
    return objects.sort((left, right) => left.key.localeCompare(right.key));
  }

  async r2ObjectResponse(
    accountId: string,
    bucketName: string,
    key: string,
  ): Promise<Response> {
    const encodedKey = encodeURIComponent(key).replaceAll("%2F", "/");
    return this.apiRawRequest(
      `/accounts/${encodeURIComponent(accountId)}/r2/buckets/` +
        `${encodeURIComponent(bucketName)}/objects/${encodedKey}`,
    );
  }

  async deleteD1(accountId: string, databaseId: string): Promise<void> {
    await this.apiDelete(
      `/accounts/${encodeURIComponent(accountId)}/d1/database/` +
        encodeURIComponent(databaseId),
    );
  }

  async emptyR2Bucket(accountId: string, name: string): Promise<number> {
    let deletedObjects = 0;
    while (true) {
      const path = `/accounts/${encodeURIComponent(accountId)}/r2/buckets/` +
        `${encodeURIComponent(name)}/objects`;
      const response = await this.apiRequest<Array<{key?: unknown}>>(path);
      const keys = response.result.flatMap(({key}) =>
        typeof key === "string" ? [key] : []
      );
      if (keys.length === 0) {
        return deletedObjects;
      }
      for (const key of keys) {
        const encodedKey = encodeURIComponent(key).replaceAll("%2F", "/");
        await this.apiDelete(`${path}/${encodedKey}`);
        deletedObjects += 1;
      }
    }
  }

  async deleteR2Bucket(accountId: string, name: string): Promise<void> {
    await runWrangler(
      this.runner,
      ["r2", "bucket", "delete", name],
      {env: accountEnvironment(accountId)},
    );
  }

  async createD1(accountId: string, name: string): Promise<string> {
    const result = await runWrangler(
      this.runner,
      ["d1", "create", name, "--no-update-config"],
      {env: accountEnvironment(accountId)},
    );
    try {
      const data = parseJsonOutput<Record<string, unknown>>(result.stdout);
      const id = String(data.uuid ?? data.id ?? data.database_id ?? "");
      if (id) {
        return id;
      }
    } catch {
      // Fall back to the UUID printed in human-readable Wrangler output.
    }
    const match = result.stdout.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu,
    );
    if (!match) {
      throw new Error("Wrangler created D1 but did not return its UUID.");
    }
    return match[0];
  }

  async createR2(accountId: string, name: string): Promise<void> {
    await runWrangler(
      this.runner,
      ["r2", "bucket", "create", name, "--no-update-config"],
      {env: accountEnvironment(accountId)},
    );
  }

  async applyMigrations(config: MicrofeedConfig): Promise<void> {
    const accountId = cloudflareAccountId(config);
    await runWrangler(
      this.runner,
      [
        "d1",
        "migrations",
        "apply",
        config.d1.name,
        "--remote",
        "--config",
        wranglerConfigPath(config),
      ],
      {env: accountEnvironment(accountId)},
    );
  }

  async queryD1(
    config: MicrofeedConfig,
    sql: string,
    options: {local?: boolean; persistTo?: string} = {},
  ): Promise<Array<Record<string, unknown>>> {
    const local = options.local === true;
    const result = await runWrangler(
      this.runner,
      [
        "d1",
        "execute",
        local ? "FEED_DB" : config.d1.name,
        local ? "--local" : "--remote",
        "--command",
        sql,
        "--json",
        "--config",
        wranglerConfigPath(config),
        ...(local
          ? ["--persist-to", options.persistTo ?? localPersistencePath(config)]
          : []),
      ],
      {
        env: local
          ? process.env
          : accountEnvironment(cloudflareAccountId(config)),
      },
    );
    const data = parseJsonOutput<unknown>(result.stdout);
    const resultSets = Array.isArray(data) ? data : [data];
    return resultSets.flatMap((resultSet) => {
      if (!resultSet || typeof resultSet !== "object") {
        return [];
      }
      const rows = (resultSet as {results?: unknown}).results;
      return Array.isArray(rows)
        ? rows.filter(
            (row): row is Record<string, unknown> =>
              Boolean(row) && typeof row === "object" && !Array.isArray(row),
          )
        : [];
    });
  }

  async exportD1(
    config: MicrofeedConfig,
    output: string,
    tables: readonly string[],
    mode: "data" | "schema",
  ): Promise<void> {
    await runWrangler(
      this.runner,
      [
        "d1",
        "export",
        config.d1.name,
        "--remote",
        "--output",
        output,
        "--skip-confirmation",
        mode === "schema" ? "--no-data" : "--no-schema",
        ...tables.flatMap((table) => ["--table", table]),
        "--config",
        wranglerConfigPath(config),
      ],
      {env: accountEnvironment(cloudflareAccountId(config))},
    );
  }

  async executeSqlFile(
    config: MicrofeedConfig,
    filename: string,
    options: {local?: boolean; persistTo?: string} = {},
  ): Promise<void> {
    const local = options.local === true;
    await runWrangler(
      this.runner,
      [
        "d1",
        "execute",
        local ? "FEED_DB" : config.d1.name,
        local ? "--local" : "--remote",
        "--file",
        filename,
        "--yes",
        "--config",
        wranglerConfigPath(config),
        ...(local
          ? ["--persist-to", options.persistTo ?? localPersistencePath(config)]
          : []),
      ],
      {
        env: local
          ? process.env
          : accountEnvironment(cloudflareAccountId(config)),
      },
    );
  }

  async authOwner(
    config: MicrofeedConfig,
    local = false,
  ): Promise<AuthOwner | null> {
    const args = [
      "d1",
      "execute",
      local ? "FEED_DB" : config.d1.name,
      local ? "--local" : "--remote",
      "--command",
      "SELECT \"id\", \"email\", \"role\" FROM \"auth_user\" " +
        "ORDER BY \"createdAt\" LIMIT 1",
      "--json",
      "--config",
      wranglerConfigPath(config),
      ...(local
        ? ["--persist-to", localPersistencePath(config)]
        : []),
    ];
    const result = await runWrangler(this.runner, args, {
      allowFailure: true,
      env: local
        ? process.env
        : accountEnvironment(cloudflareAccountId(config)),
    });
    if (result.exitCode !== 0) {
      const detail = `${result.stdout}\n${result.stderr}`;
      if (detail.includes("no such table: auth_user")) {
        return null;
      }
      throw new Error(result.stderr.trim() || "Unable to inspect dashboard login.");
    }
    return parseAuthOwnerOutput(result.stdout);
  }

  async authPasswordSetup(
    config: MicrofeedConfig,
  ): Promise<AuthPasswordSetup | null> {
    const result = await runWrangler(
      this.runner,
      [
        "d1",
        "execute",
        config.d1.name,
        "--remote",
        "--command",
        'SELECT "purpose", "email", "userId", "createdAt", "expiresAt" ' +
          'FROM "auth_password_setup" WHERE "id" = \'owner\'',
        "--json",
        "--config",
        wranglerConfigPath(config),
      ],
      {
        allowFailure: true,
        env: accountEnvironment(cloudflareAccountId(config)),
      },
    );
    if (result.exitCode !== 0) {
      const detail = `${result.stdout}\n${result.stderr}`;
      if (detail.includes("no such table: auth_password_setup")) {
        return null;
      }
      throw new Error(
        result.stderr.trim() || "Unable to inspect password setup state.",
      );
    }
    return parseAuthPasswordSetupOutput(result.stdout);
  }

  async executeAuthSql(
    config: MicrofeedConfig,
    filename: string,
    local = false,
  ): Promise<void> {
    await this.executeSqlFile(config, filename, {local});
  }

  async deploy(
    config: MicrofeedConfig,
    secretsFile?: string,
  ): Promise<string | null> {
    const args = [
      "deploy",
      "--strict",
      "--config",
      builtWranglerConfigPath,
    ];
    if (secretsFile) {
      args.push("--secrets-file", secretsFile);
    }
    const result = await runWrangler(this.runner, args, {
      env: accountEnvironment(cloudflareAccountId(config)),
    });
    const match = `${result.stdout}\n${result.stderr}`.match(
      /https:\/\/[a-z0-9.-]+\.workers\.dev/iu,
    );
    return match?.[0] ?? null;
  }

  async deployWithConfig(
    config: MicrofeedConfig,
    configPath: string,
  ): Promise<void> {
    await runWrangler(
      this.runner,
      ["deploy", "--strict", "--config", configPath],
      {env: accountEnvironment(cloudflareAccountId(config))},
    );
  }

  async applyLocalMigrations(
    config: MicrofeedConfig,
    persistTo = localPersistencePath(config),
  ): Promise<void> {
    await runWrangler(
      this.runner,
      [
        "d1",
        "migrations",
        "apply",
        "FEED_DB",
        "--local",
        "--config",
        wranglerConfigPath(config),
        "--persist-to",
        persistTo,
      ],
    );
  }

  async workerSecretNames(
    accountId: string,
    workerName: string,
  ): Promise<Set<string>> {
    const result = await runWrangler(
      this.runner,
      ["secret", "list", "--name", workerName, "--format", "json"],
      {env: accountEnvironment(accountId)},
    );
    return parseSecretNames(result.stdout);
  }
}

export function pagesCollisionMessage(name: string): string {
  return `A Cloudflare Pages project named \`${name}\` already exists. ` +
    "Initialization will not modify it. Change CLOUDFLARE_PROJECT_NAME to a " +
    `different name, such as \`${name}-worker\`, and try again. After ` +
    "verifying the Worker, switch your custom domain if needed. See " +
    "“Migrating an existing Pages installation” in README.md.";
}

export function pagesDomainAttachedMessage(
  accountId: string,
  projectName: string,
  hostname: string,
): string {
  return `Custom domain \`${hostname}\` is still attached to Cloudflare ` +
    `Pages project \`${projectName}\`.\n` +
    `Open its Custom Domains page:\n` +
    `${pagesProjectDomainsDashboardUrl(accountId, projectName)}\n\n` +
    `1. Remove only \`${hostname}\` from the Pages project.\n` +
    "2. Come back and run `yarn manage domain` again.\n\n" +
    "microfeed did not change Pages or the Worker custom domain.";
}

export function pagesProjectDomainsDashboardUrl(
  accountId: string,
  projectName: string,
): string {
  return `https://dash.cloudflare.com/${encodeURIComponent(accountId)}/` +
    `pages/view/${encodeURIComponent(projectName)}/domains`;
}

export async function pagesDomainIsAttached(
  cloudflare: Pick<CloudflareClient, "pagesProjectDomains">,
  accountId: string,
  projectName: string,
  hostname: string,
): Promise<boolean> {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/u, "");
  const domains = await cloudflare.pagesProjectDomains(accountId, projectName);
  return domains.some(
    (domain) =>
      domain.toLowerCase().replace(/\.$/u, "") === normalizedHostname,
  );
}

export async function assertNoPagesCollision(
  cloudflare: Pick<CloudflareClient, "pagesProjects">,
  accountId: string,
  projectName: string,
): Promise<void> {
  const pagesProjects = await cloudflare.pagesProjects(accountId);
  if (pagesProjects.includes(projectName)) {
    throw new Error(pagesCollisionMessage(projectName));
  }
}
