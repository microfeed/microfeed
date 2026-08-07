#!/usr/bin/env node
import {realpathSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {globalOptions} from "./arguments.js";
import {
  instancesCommand,
  itemCommand,
  loginCommand,
  logoutCommand,
  rawApiCommand,
} from "./commands.js";
import {CliError} from "./errors.js";

export const HELP = `microfeed — manage content on a microfeed instance

Usage:
  microfeed login <origin> [--profile <name>]
  microfeed logout [--instance <profile>]
  microfeed instances list|use|remove [profile]
  microfeed item list|get|create|update|delete ...
  microfeed api <method> </api/v1/path> [--input <file|->]

Global options:
  --instance <profile>  Use a saved instance profile
  --json                Write deterministic JSON output
  --help                Show this help

Credentials:
  Browser login stores encrypted OAuth tokens. MICROFEED_API_KEY takes
  precedence for CI and is never persisted. Set MICROFEED_ORIGIN when CI
  does not have a saved instance profile.
`;

export async function run(argv: string[]): Promise<void> {
  const {args, options} = globalOptions(argv);
  const [command, ...rest] = args;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return;
  }
  if (command === "login") return await loginCommand(rest, options);
  if (command === "logout") return await logoutCommand(options);
  if (command === "instances") return await instancesCommand(rest, options);
  if (command === "item") return await itemCommand(rest, options);
  if (command === "api") return await rawApiCommand(rest, options);
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
