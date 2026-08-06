import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

import {
  CLI_COMMANDS,
  renderCliHelp,
} from "../../../manage-cli/help";

const repositoryFile = (filename: string) =>
  readFile(new URL(`../../../${filename}`, import.meta.url), "utf8");

function commandSection(document: string, commandName: string): string {
  const heading = `## \`yarn manage ${commandName}\``;
  const start = document.indexOf(heading);
  if (start < 0) {
    return "";
  }
  const next = document.indexOf("\n## ", start + heading.length);
  return document.slice(start, next < 0 ? undefined : next);
}

describe("management CLI help and canonical reference", () => {
  it("uses one metadata inventory for every implemented command", async () => {
    const indexSource = await repositoryFile("manage-cli/index.ts");
    const implementedCommands = [...indexSource.matchAll(/case "([^"]+)":/gu)]
      .map((match) => match[1]!)
      .sort((left, right) => left.localeCompare(right));
    const documentedCommands = CLI_COMMANDS.map(({name}) => name)
      .sort((left, right) => left.localeCompare(right));

    expect(documentedCommands).toEqual(implementedCommands);
    expect(documentedCommands).toContain("init");
    expect(documentedCommands).not.toContain("setup");
  });

  it("renders top-level and per-command terminal help", () => {
    const topLevel = renderCliHelp();
    expect(topLevel).toContain("yarn manage help <command>");
    expect(topLevel).toContain("docs/manage-cli.md");

    for (const command of CLI_COMMANDS) {
      expect(topLevel).toContain(command.name);
      expect(topLevel).toContain(command.summary);
      const commandHelp = renderCliHelp(command.name);
      expect(commandHelp).toContain(command.usage);
      expect(commandHelp).toContain(`Changes: ${command.changes}`);
      expect(commandHelp).toContain("--help");
      for (const {syntax} of command.options) {
        expect(commandHelp).toContain(syntax);
      }
    }

    const initHelp = renderCliHelp("init");
    expect(initHelp).toContain("globally unique site name");
    expect(initHelp).toContain("my.domainname.com");
    expect(initHelp).toContain("my-domainname-com");
    expect(initHelp).toContain("newly created Cloudflare account");
    expect(initHelp).toContain("rerun the same init command");
    expect(initHelp).toContain("points existing microfeed installations to connect");

    const deployHelp = renderCliHelp("deploy");
    expect(deployHelp).toContain("Use connect for an existing Cloudflare microfeed");
    expect(deployHelp).toContain("init for a new installation");
  });

  it("keeps every command and option discoverable in the Markdown contract", async () => {
    const reference = await repositoryFile("docs/manage-cli.md");

    for (const command of CLI_COMMANDS) {
      const section = commandSection(reference, command.name);
      expect(section, `missing ${command.name} section`).not.toBe("");
      expect(section).toContain(command.summary);
      expect(section.replaceAll("`", "").replace(/\s+/gu, " ")).toContain(
        command.changes.replaceAll("`", "").replace(/\s+/gu, " "),
      );
      for (const {syntax} of command.options) {
        const optionName = syntax.split(" ")[0]!;
        expect(
          section,
          `${command.name} does not document ${optionName}`,
        ).toContain(`\`${optionName}`);
      }
    }
  });

  it("links the canonical reference from human and agent entry points", async () => {
    const [readme, agents, skill] = await Promise.all([
      repositoryFile("README.md"),
      repositoryFile("AGENTS.md"),
      repositoryFile(".agents/skills/deploy-microfeed/SKILL.md"),
    ]);

    expect(readme).toMatch(/\]\(docs\/manage-cli\.md\)/u);
    expect(agents).toContain("`docs/manage-cli.md`");
    expect(skill).toContain("../../../docs/manage-cli.md");
  });

  it("keeps the canonical dashboard login guidance action-oriented", async () => {
    const reference = await repositoryFile("docs/manage-cli.md");
    const section = commandSection(reference, "auth");
    const authCommand = CLI_COMMANDS.find(({name}) => name === "auth");

    expect(section).not.toBe("");
    expect(authCommand).toBeDefined();
    expect(section).toContain(authCommand!.usage);
    expect(section).toContain(
      "Without an action, `yarn manage auth` prints",
    );
    expect(section).toContain("It does not select an instance");
    for (const action of [
      "setup",
      "reset-password",
      "change-email",
      "change-path",
      "disable",
    ]) {
      expect(section).toContain(`| \`${action}\` |`);
    }
  });

  it("rejects help for an unknown command", () => {
    expect(() => renderCliHelp("unknown")).toThrow(
      "Unknown management command: unknown",
    );
  });

  it("points the removed top-level setup command to init", () => {
    expect(() => renderCliHelp("setup")).toThrow(
      "Use `yarn manage init`",
    );
  });
});
