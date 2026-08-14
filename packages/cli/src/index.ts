#!/usr/bin/env node
import {realpathSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {globalOptions} from "./arguments.js";
import {
  instancesCommand,
  itemCommand,
  loginCommand,
  logoutCommand,
  mediaCommand,
  rawApiCommand,
} from "./commands.js";
import {CliError} from "./errors.js";
import {renderCliHelp} from "./help.js";
import {webhookCommand} from "./webhooks.js";

export const HELP = renderCliHelp();

function requestedHelp(args: string[]): readonly string[] | undefined {
  if (!args.some((argument) => argument === "--help" || argument === "-h")) {
    return undefined;
  }
  const [command, subcommand] = args;
  if (!command || command === "--help" || command === "-h") return [];
  if (command === "instances" || command === "item" || command === "media" || command === "webhook") {
    if (subcommand && subcommand !== "--help" && subcommand !== "-h") {
      return [command, subcommand];
    }
  }
  return [command];
}

export async function run(argv: string[]): Promise<void> {
  const {args, options} = globalOptions(argv);
  const [command, ...rest] = args;
  if (!command) {
    process.stdout.write(HELP);
    return;
  }
  if (command === "help") {
    const topic = rest.filter((argument) =>
      argument !== "--help" && argument !== "-h"
    );
    if (topic.length > 2 || topic.some((argument) => argument.startsWith("-"))) {
      throw new CliError("Usage: yarn microfeed help [command [subcommand]]");
    }
    process.stdout.write(renderCliHelp(topic));
    return;
  }
  const helpPath = requestedHelp(args);
  if (helpPath) {
    process.stdout.write(renderCliHelp(helpPath));
    return;
  }
  if (command === "login") return await loginCommand(rest, options);
  if (command === "logout") return await logoutCommand(options);
  if (command === "instances") return await instancesCommand(rest, options);
  if (command === "item") return await itemCommand(rest, options);
  if (command === "media") return await mediaCommand(rest, options);
  if (command === "api") return await rawApiCommand(rest, options);
  if (command === "webhook") return await webhookCommand(rest, options.json);
  throw new CliError(`Unknown command: ${command}\n\n${HELP}`);
}

if (process.argv[1] &&
    realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  run(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unexpected failure.";
    process.stderr.write(`microfeed: ${message}\n`);
    process.exitCode = error instanceof CliError ? error.exitCode : 1;
  });
}
