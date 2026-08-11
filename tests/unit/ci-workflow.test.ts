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
