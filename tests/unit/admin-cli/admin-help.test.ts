import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

import {
  ADMIN_COMMANDS,
  renderAdminHelp,
} from "../../../admin-cli/help";

const repositoryFile = (filename: string) =>
  readFile(new URL(`../../../${filename}`, import.meta.url), "utf8");

function commandSection(document: string, commandName: string): string {
  const heading = `## \`yarn admin ${commandName}\``;
  const start = document.indexOf(heading);
  if (start < 0) {
    return "";
  }
  const next = document.indexOf("\n## ", start + heading.length);
  return document.slice(start, next < 0 ? undefined : next);
}

describe("admin CLI help and canonical reference", () => {
  it("uses one metadata inventory for every implemented command", async () => {
    const indexSource = await repositoryFile("admin-cli/index.ts");
    const implementedCommands = [...indexSource.matchAll(/case "([^"]+)":/gu)]
      .map((match) => match[1]!)
      .sort((left, right) => left.localeCompare(right));
    const documentedCommands = ADMIN_COMMANDS.map(({name}) => name)
      .sort((left, right) => left.localeCompare(right));

    expect(documentedCommands).toEqual(implementedCommands);
  });

  it("renders top-level and per-command terminal help", () => {
    const topLevel = renderAdminHelp();
    expect(topLevel).toContain("yarn admin help <command>");
    expect(topLevel).toContain("docs/admin-cli.md");

    for (const command of ADMIN_COMMANDS) {
      expect(topLevel).toContain(command.name);
      expect(topLevel).toContain(command.summary);
      const commandHelp = renderAdminHelp(command.name);
      expect(commandHelp).toContain(command.usage);
      expect(commandHelp).toContain(`Changes: ${command.changes}`);
      expect(commandHelp).toContain("--help");
      for (const {syntax} of command.options) {
        expect(commandHelp).toContain(syntax);
      }
    }
  });

  it("keeps every command and option discoverable in the Markdown contract", async () => {
    const reference = await repositoryFile("docs/admin-cli.md");

    for (const command of ADMIN_COMMANDS) {
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

    expect(readme).toContain("[`yarn admin` command reference](docs/admin-cli.md)");
    expect(agents).toContain("`docs/admin-cli.md`");
    expect(skill).toContain("../../../docs/admin-cli.md");
  });

  it("rejects help for an unknown command", () => {
    expect(() => renderAdminHelp("unknown")).toThrow(
      "Unknown admin command: unknown",
    );
  });
});
