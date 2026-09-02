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
    const setupNodeIndex = workflow.indexOf("uses: actions/setup-node@v6");
    const corepackIndex = workflow.indexOf("run: corepack enable");
    const cacheIndex = workflow.indexOf("uses: actions/cache@v5");
    const yarnVersionIndex = workflow.indexOf("run: yarn --version");
    const installIndex = workflow.indexOf("run: yarn install --immutable");

    expect(setupNodeIndex).toBeGreaterThanOrEqual(0);
    expect(corepackIndex).toBeGreaterThan(setupNodeIndex);
    expect(cacheIndex).toBeGreaterThan(corepackIndex);
    expect(yarnVersionIndex).toBeGreaterThan(cacheIndex);
    expect(installIndex).toBeGreaterThan(yarnVersionIndex);
    expect(workflow.slice(setupNodeIndex, corepackIndex)).not.toContain(
      "cache: yarn",
    );
    expect(workflow).toContain(".yarn/cache");
    expect(workflow).toContain("~/.cache/node/corepack");
    expect(workflow).toContain("hashFiles('package.json', 'yarn.lock')");
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
      on?: Record<string, unknown>;
    };

    expect(Object.keys(parsed.on ?? {})).toEqual(["workflow_dispatch"]);
    expect(JSON.stringify(parsed.jobs?.deploy?.env ?? {})).not.toContain(
      "runner.",
    );
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain(
      "inputs.worker_name || vars.MICROFEED_WORKER_NAME",
    );
    expect(workflow).toContain(
      "inputs.cloudflare_account_id || " +
        "vars.MICROFEED_CLOUDFLARE_ACCOUNT_ID",
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
    expect(workflow).toContain("yarn manage init");
    expect(workflow).toContain("yarn manage connect");
    expect(workflow).toContain("yarn manage deploy");
    expect(workflow).toContain("yarn manage status");
    expect(workflow).toContain("always() && steps.install.outcome == 'success'");
    expect(workflow).toContain("yarn wrangler logout");
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(workflow).not.toContain("CLOUDFLARE_API_KEY");
    expect(workflow).not.toMatch(/secrets\.CLOUDFLARE_/u);

    const cacheBlock = workflow.slice(
      workflow.indexOf("- name: Cache Yarn packages"),
      workflow.indexOf("- name: Install dependencies"),
    );
    expect(cacheBlock).toContain(".yarn/cache");
    expect(cacheBlock).not.toContain("wrangler-config");
    expect(cacheBlock).not.toContain("microfeed-state");
  });
});
