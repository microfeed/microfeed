import * as prompts from "@clack/prompts";

import type {Account} from "../types";

const MAX_VISIBLE_PAGES_PROJECTS = 5;
const TYPE_PAGES_PROJECT = "__microfeed_type_pages_project__";

function unwrap<T>(value: T | symbol): T {
  if (prompts.isCancel(value)) {
    prompts.cancel("Operation cancelled. No Cloudflare resources were deleted.");
    process.exitCode = 1;
    throw new Error("Operation cancelled.");
  }
  return value;
}

export async function askText(
  message: string,
  initialValue?: string,
): Promise<string> {
  return unwrap(await prompts.text({
    initialValue,
    message,
    validate(value) {
      if (!value?.trim()) {
        return "A value is required.";
      }
      return undefined;
    },
  })).trim();
}

export async function askConfirm(
  message: string,
  initialValue = false,
): Promise<boolean> {
  return unwrap(await prompts.confirm({initialValue, message}));
}

export async function askPassword(
  message: string,
): Promise<string> {
  return unwrap(await prompts.password({
    mask: "•",
    message,
    validate: (value) => {
      if (!value) {
        return "A value is required.";
      }
      return undefined;
    },
  }));
}

export const adminAuthSetupOptions = [
  {
    hint: "Protect the dashboard with an email and password",
    label: "Set up admin login (Recommended)",
    value: "built-in",
  },
  {
    hint: "Your admin dashboard will be public until you configure Access",
    label: "Skip authentication",
    value: "none",
  },
] as const;

export async function chooseAdminAuthSetup(): Promise<"built-in" | "none"> {
  return unwrap(await prompts.select({
    message: "How should the admin dashboard be protected?",
    options: [...adminAuthSetupOptions],
  }));
}

export type AuthAction =
  | "change-email"
  | "change-path"
  | "disable"
  | "reset-password"
  | "setup";

export function authActionOptions(
  includeSetup = false,
): Array<{label: string; value: AuthAction}> {
  return [
    ...(includeSetup
      ? [{label: "Set up admin login", value: "setup" as const}]
      : []),
    {label: "Reset owner password", value: "reset-password"},
    {label: "Change owner email", value: "change-email"},
    {label: "Change admin path", value: "change-path"},
    ...(!includeSetup
      ? [{label: "Disable built-in login", value: "disable" as const}]
      : []),
  ];
}

export async function chooseAuthAction(
  includeSetup = false,
): Promise<AuthAction> {
  return unwrap(await prompts.select({
    message: "What would you like to change?",
    options: authActionOptions(includeSetup),
  }));
}

export async function chooseAccount(accounts: Account[]): Promise<Account> {
  if (accounts.length === 1) {
    return accounts[0]!;
  }
  const id = unwrap(await prompts.select({
    message: "Which Cloudflare account should microfeed use?",
    options: accounts.map((account) => ({
      label: `${account.name} (${account.id.slice(-8)})`,
      value: account.id,
    })),
  }));
  return accounts.find((account) => account.id === id)!;
}

export async function chooseLocalInstance(
  instanceNames: string[],
  message = "Which microfeed instance should be used?",
): Promise<string> {
  return unwrap(await prompts.select({
    message,
    options: instanceNames.map((name) => ({
      label: name,
      value: name,
    })),
  }));
}

export function visiblePagesProjects(projectNames: string[]): string[] {
  return projectNames.slice(0, MAX_VISIBLE_PAGES_PROJECTS);
}

export function pagesProjectOptions(
  projectNames: string[],
): Array<{label: string; value: string}> {
  const visibleProjects = visiblePagesProjects(projectNames);
  const hiddenProjectCount = projectNames.length - visibleProjects.length;
  return [
    ...visibleProjects.map((name) => ({
      label: name,
      value: name,
    })),
    {
      label: hiddenProjectCount > 0
        ? `Type another project name (${hiddenProjectCount} more not shown)`
        : "Type a project name",
      value: TYPE_PAGES_PROJECT,
    },
  ];
}

export async function choosePagesProject(
  projectNames: string[],
): Promise<string> {
  const selected = unwrap(await prompts.select({
    message: "Which Pages project do you want to migrate?",
    options: pagesProjectOptions(projectNames),
  }));
  if (selected === TYPE_PAGES_PROJECT) {
    return askText("Existing Pages project name");
  }
  return selected;
}

export {prompts};
