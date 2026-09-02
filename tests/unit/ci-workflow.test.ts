import {readFile} from "node:fs/promises";
import path from "node:path";
import {describe, expect, it} from "vitest";

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
  it("uses ephemeral device authorization without repository credentials", async () => {
    const workflow = await readFile(
      path.join(repositoryRoot, ".github/workflows/deploy.yml"),
      "utf8",
    );

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+push:/mu);
    expect(workflow).not.toMatch(/^\s+pull_request:/mu);
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
      "MICROFEED_STATE_DIRECTORY: ${{ runner.temp }}/microfeed-state",
    );
    expect(workflow).toContain(
      "XDG_CONFIG_HOME: ${{ runner.temp }}/wrangler-config",
    );
    expect(workflow.match(/args=\(--device/g)).toHaveLength(3);
    expect(workflow).toContain("yarn manage connect");
    expect(workflow).toContain("yarn manage deploy");
    expect(workflow).toContain("yarn manage status");
    expect(workflow).toContain("always() && steps.install.outcome == 'success'");
    expect(workflow).toContain("yarn wrangler logout");
    expect(workflow).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(workflow).not.toContain("secrets.");

    const cacheBlock = workflow.slice(
      workflow.indexOf("- name: Cache Yarn packages"),
      workflow.indexOf("- name: Install dependencies"),
    );
    expect(cacheBlock).toContain(".yarn/cache");
    expect(cacheBlock).not.toContain("wrangler-config");
    expect(cacheBlock).not.toContain("microfeed-state");
  });
});
