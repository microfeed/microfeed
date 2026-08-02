#!/usr/bin/env node

import {
  accessCommand,
  accountsCommand,
  authCommand,
  connectCommand,
  configCommand,
  deployCommand,
  devCommand,
  domainCommand,
  destroyCommand,
  instancesCommand,
  type Flags,
  migratePagesCommand,
  initCommand,
  statusCommand,
  snapshotCommand,
  useInstanceCommand,
} from "./commands";
import {renderCliHelp} from "./help";

function parseArguments(argv: string[]): {command: string; flags: Flags} {
  const [command = "help", ...argumentsAfterCommand] = argv;
  const rest = [...argumentsAfterCommand];
  const flags: Flags = {};
  if (command === "auth" && rest[0] && !rest[0].startsWith("--")) {
    flags.action = rest.shift()!;
  }
  if (command === "snapshot" && rest[0] && !rest[0].startsWith("--")) {
    flags.action = rest.shift()!;
  }
  if (command === "use" && rest[0] && !rest[0].startsWith("--")) {
    flags.instance = rest.shift()!;
  }
  if (command === "help" && rest[0] && !rest[0].startsWith("--")) {
    flags.command = rest.shift()!;
  }
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index]!;
    if (argument === "-h") {
      flags.help = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const [rawName, inlineValue] = argument.slice(2).split("=", 2);
    if (!rawName) {
      throw new Error(`Invalid option: ${argument}`);
    }
    if (inlineValue !== undefined) {
      flags[rawName] = inlineValue;
      continue;
    }
    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      flags[rawName] = next;
      index += 1;
    } else {
      flags[rawName] = true;
    }
  }
  return {command, flags};
}

function help(commandName?: string): void {
  process.stdout.write(renderCliHelp(commandName));
}

async function main(): Promise<void> {
  const {command, flags} = parseArguments(process.argv.slice(2));
  if (command === "help" || command === "--help" || command === "-h") {
    help(typeof flags.command === "string" ? flags.command : undefined);
    return;
  }
  if (command === "setup") {
    throw new Error(
      "The top-level `setup` command was renamed. Use `yarn manage init`.",
    );
  }
  if (flags.help === true) {
    help(command);
    return;
  }
  if (
    flags["admin-password"] !== undefined &&
    command !== "init" &&
    command !== "auth"
  ) {
    throw new Error(
      "`--admin-password` is supported only by init, `auth setup`, and " +
        "`auth reset-password`.",
    );
  }
  switch (command) {
    case "accounts":
      await accountsCommand(flags);
      break;
    case "init":
      await initCommand(flags);
      break;
    case "connect":
      await connectCommand(flags);
      break;
    case "deploy":
      await deployCommand(flags);
      break;
    case "dev":
      await devCommand(flags);
      break;
    case "status":
      await statusCommand(flags);
      break;
    case "snapshot":
      await snapshotCommand(flags);
      break;
    case "destroy":
      await destroyCommand(flags);
      break;
    case "migrate-pages":
      await migratePagesCommand(flags);
      break;
    case "domain":
      await domainCommand(flags);
      break;
    case "access":
      await accessCommand(flags);
      break;
    case "auth":
      await authCommand(flags);
      break;
    case "config":
      await configCommand(flags);
      break;
    case "instances":
      await instancesCommand(flags);
      break;
    case "use":
      await useInstanceCommand(flags);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`\n${message}\n`);
  process.exitCode = 1;
});
