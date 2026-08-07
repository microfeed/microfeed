import {CliError} from "./errors.js";
import type {GlobalOptions} from "./http.js";

export function globalOptions(argv: string[]): {
  args: string[];
  options: GlobalOptions;
} {
  const args: string[] = [];
  const options: GlobalOptions = {json: false};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]!;
    if (value === "--json") {
      options.json = true;
    } else if (value === "--instance") {
      const instance = argv[index + 1];
      if (!instance) throw new CliError("--instance requires a saved instance name.");
      options.instance = instance;
      index += 1;
    } else {
      args.push(value);
    }
  }
  return {args, options};
}

export interface ParsedOptions {
  flags: Record<string, string | boolean | string[]>;
  positionals: string[];
}

export function parseOptions(
  args: string[],
  valueOptions: ReadonlySet<string>,
  booleanOptions: ReadonlySet<string> = new Set(),
  repeatOptions: ReadonlySet<string> = new Set(),
): ParsedOptions {
  const flags: ParsedOptions["flags"] = {};
  const positionals: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]!;
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const name = value.slice(2);
    if (booleanOptions.has(name)) {
      flags[name] = true;
      continue;
    }
    if (!valueOptions.has(name)) throw new CliError(`Unknown option: ${value}`);
    const optionValue = args[index + 1];
    if (optionValue === undefined) throw new CliError(`${value} requires a value.`);
    index += 1;
    if (repeatOptions.has(name)) {
      const existing = flags[name];
      flags[name] = [...Array.isArray(existing) ? existing : [], optionValue];
    } else {
      flags[name] = optionValue;
    }
  }
  return {flags, positionals};
}

export function stringFlag(options: ParsedOptions, name: string): string | undefined {
  const value = options.flags[name];
  return typeof value === "string" ? value : undefined;
}
