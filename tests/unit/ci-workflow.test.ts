import {readFile} from "node:fs/promises";
import path from "node:path";
import {describe, expect, it} from "vitest";
import {parse} from "yaml";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

describe("CI package manager setup", () => {
  it("enables Corepack before Yarn caching or execution", async () => {
    const workflow = await readFile(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    );
    const parsed = parse(workflow) as {
      jobs: Record<string, {steps: Array<{run?: string; uses?: string; with?: {cache?: string}}>}>;
    };
    for (const {steps} of Object.values(parsed.jobs)) {
      const setup = steps.findIndex(step => step.uses?.startsWith("actions/setup-node@"));
      const corepack = steps.findIndex(step => step.run === "corepack enable");
      const firstYarn = steps.findIndex(step => step.run?.includes("yarn "));
      expect(setup).toBeGreaterThanOrEqual(0);
      expect(corepack).toBeGreaterThan(setup);
      expect(firstYarn).toBeGreaterThan(corepack);
      // setup-node's Yarn cache calls Yarn before Corepack can be enabled.
      expect(steps[setup]!.with?.cache).not.toBe("yarn");
    }
  });
});

describe("manual GitHub Actions deployment", () => {
  it("creates or updates with ephemeral Cloudflare authorization", async () => {
    const workflow = await readFile(
      path.join(
        repositoryRoot,
        ".github/workflows/create-or-update-microfeed.yml",
      ),
      "utf8",
    );
    const parsed = parse(workflow) as {
      jobs?: {deploy?: {env?: Record<string, unknown>}};
      on?: {
        workflow_dispatch?: {inputs?: Record<string, unknown>};
      };
    };

    expect(Object.keys(parsed.on ?? {})).toEqual(["workflow_dispatch"]);
    expect(parsed.on?.workflow_dispatch?.inputs).not.toHaveProperty(
      "cloudflare_account_id",
    );
    expect(Object.keys(parsed.on?.workflow_dispatch?.inputs ?? {})).toEqual([
      "operation",
    ]);
    expect(parsed.on?.workflow_dispatch?.inputs?.operation).toMatchObject({
      default: "create",
      options: ["create", "update"],
    });
    expect(JSON.stringify(parsed.jobs?.deploy?.env ?? {})).not.toContain(
      "runner.",
    );
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("secrets.MICROFEED_WORKER_NAME");
    expect(workflow).toContain("secrets.MICROFEED_ADMINISTRATOR_EMAIL");
    expect(parsed.jobs?.deploy?.env).not.toHaveProperty(
      "MICROFEED_ADMINISTRATOR_EMAIL",
    );
    expect(workflow).not.toContain("vars.MICROFEED_WORKER_NAME");
    expect(workflow).not.toContain("vars.MICROFEED_ADMINISTRATOR_EMAIL");
    expect(workflow).not.toContain("inputs.worker_name");
    expect(workflow).not.toContain("inputs.administrator_email");
    expect(workflow).toContain("secrets.CLOUDFLARE_ACCOUNT_ID");
    expect(workflow).not.toContain("inputs.cloudflare_account_id");
    expect(workflow).not.toContain("vars.MICROFEED_CLOUDFLARE_ACCOUNT_ID");
    const configuredSecrets = [
      ...workflow.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gu),
    ].map((match) => match[1]);
    expect([...new Set(configuredSecrets)].sort()).toEqual([
      "CLOUDFLARE_ACCOUNT_ID",
      "MICROFEED_ADMINISTRATOR_EMAIL",
      "MICROFEED_ADMIN_PASSWORD",
      "MICROFEED_WORKER_NAME",
    ]);
    expect(workflow).toContain(
      'if [[ -z "$MICROFEED_CLOUDFLARE_ACCOUNT_ID" ]]',
    );
    expect(workflow.match(/--account-id/g)).toHaveLength(4);
    expect(workflow).not.toContain(
      'if [[ -n "$MICROFEED_CLOUDFLARE_ACCOUNT_ID" ]]',
    );
    const authorizationWarningIndex = workflow.indexOf(
      "::warning title=Public Cloudflare verification code::",
    );
    expect(authorizationWarningIndex).toBeGreaterThanOrEqual(0);
    expect(workflow).toContain(
      "Someone else could use the code first, which would cause this run to fail.",
    );
    expect(workflow).toContain(
      "authorization for a different account is rejected before any Cloudflare resources are changed",
    );
    expect(authorizationWarningIndex).toBeLessThan(
      workflow.indexOf("yarn manage init"),
    );
    expect(authorizationWarningIndex).toBeLessThan(
      workflow.indexOf("yarn manage connect"),
    );
    expect(workflow).toContain(
      "MICROFEED_STATE_DIRECTORY=$state_directory",
    );
    expect(workflow).toContain(
      "XDG_CONFIG_HOME=$wrangler_directory",
    );
    expect(workflow).not.toContain("${{ runner.temp }}");
    expect(workflow).toContain("type: choice");
    expect(workflow).toContain("- create");
    expect(workflow).toContain("- update");
    expect(workflow).toContain("inputs.operation == 'create'");
    expect(workflow).toContain("inputs.operation == 'update'");
    expect(workflow).toContain("secrets.MICROFEED_ADMIN_PASSWORD");
    expect(workflow).not.toMatch(/^run-name:.*(?:secrets|MICROFEED_WORKER_NAME)/mu);
    expect(workflow).toContain("group: microfeed-${{ github.repository }}");
    expect(workflow).toContain(
      'if [[ -z "$MICROFEED_ADMINISTRATOR_EMAIL" ]]',
    );
    expect(workflow).toContain(
      '--owner-email "$MICROFEED_ADMINISTRATOR_EMAIL"',
    );
    expect(workflow).toContain("yarn manage init");
    expect(workflow).toContain("yarn manage connect");
    expect(workflow).toContain("yarn manage deploy");
    expect(workflow).toContain("yarn manage status");
    expect(workflow).toContain("GITHUB_STEP_SUMMARY");
    expect(workflow).toContain("microfeed deployment verified");
    expect(workflow).toContain("**Site:**");
    expect(workflow).toContain("**Admin dashboard:**");
    expect(workflow).toContain("always() && steps.install.outcome == 'success'");
    expect(workflow).toContain("yarn wrangler logout");
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(workflow).not.toContain("CLOUDFLARE_API_KEY");

    const cacheBlock = workflow.slice(
      workflow.indexOf("- name: Cache Yarn packages"),
      workflow.indexOf("- name: Install dependencies"),
    );
    expect(cacheBlock).toContain(".yarn/cache");
    expect(cacheBlock).not.toContain("wrangler-config");
    expect(cacheBlock).not.toContain("microfeed-state");
  });
});
