import {readFile} from "node:fs/promises";

import {describe, expect, it} from "vitest";

import {
  CLI_COMMANDS,
  renderCliHelp,
} from "../../../manage-cli/help";

const repositoryFile = (filename: string) =>
  readFile(new URL(`../../../${filename}`, import.meta.url), "utf8");

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
