import {access, readFile} from "node:fs/promises";
import path from "node:path";

import {describe, expect, it} from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const repositoryFile = (filename: string) =>
  readFile(path.join(repositoryRoot, filename), "utf8");

describe("coding-agent guidance", () => {
  it("routes Claude Code to the shared repository instructions and skills", async () => {
    const bridge = await repositoryFile("CLAUDE.md");

    expect(bridge).toContain("@AGENTS.md");
    expect(bridge).toContain(".agents/skills/<skill-name>/SKILL.md");
    expect(bridge).toContain("canonical workflow");
  });

  it("routes every repository workflow to a canonical skill", async () => {
    const agents = await repositoryFile("AGENTS.md");

    for (const skill of [
      "develop-microfeed",
      "document-microfeed",
      "develop-microfeed-theme",
      "deploy-microfeed",
      "export-microfeed-theme",
      "manage-microfeed-content",
    ]) {
      expect(agents).toContain(`\`${skill}\` skill`);
      await expect(access(path.join(
        repositoryRoot,
        ".agents",
        "skills",
        skill,
        "SKILL.md",
      ))).resolves.toBeUndefined();
    }
  });

  it("covers every management command in the deployment workflow", async () => {
    const deploymentSkill = await repositoryFile(
      ".agents/skills/deploy-microfeed/SKILL.md",
    );

    for (const command of [
      "accounts",
      "init",
      "connect",
      "deploy",
      "dev",
      "theme",
      "snapshot",
      "status",
      "destroy",
      "migrate-pages",
      "domain",
      "access",
      "auth",
      "config",
      "instances",
      "use",
    ]) {
      expect(deploymentSkill).toContain(`yarn manage ${command}`);
    }
  });

  it("keeps shared coding-agent guidance product-neutral", async () => {
    const skillNames = [
      "deploy-microfeed",
      "develop-microfeed",
      "develop-microfeed-theme",
      "document-microfeed",
      "export-microfeed-theme",
      "manage-microfeed-content",
    ];
    const guidance = [
      await repositoryFile("AGENTS.md"),
      ...(await Promise.all(skillNames.map((skill) =>
        repositoryFile(`.agents/skills/${skill}/SKILL.md`)
      ))),
    ].join("\n");

    expect(guidance).not.toMatch(/\bCodex\b/u);
  });
});
