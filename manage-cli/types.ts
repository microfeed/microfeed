import type {AdminAuthMode} from "@/shared/AdminAuth";

export interface Account {
  id: string;
  name: string;
}

export type InstanceHosting = "cloudflare" | "local";
export type R2SetupMode = "automatic" | "disabled";

export interface MicrofeedConfig {
  accountId: string | null;
  adminAuthMode?: AdminAuthMode;
  adminPath: string;
  completedSteps: string[];
  customDomain: string | null;
  deploymentEnvironment?: "preview" | "production";
  d1: {
    id: string;
    name: string;
    reuse: boolean;
  };
  deploymentUrl: string | null;
  hosting: InstanceHosting;
  instanceId: string;
  instanceName: string;
  pagesProjectName?: string;
  projectName: string;
  r2: {
    name: string;
    reuse: boolean;
    setupMode: R2SetupMode;
  };
  restoreBaseline?: {
    createdAt: string;
    fingerprint: string;
  };
  webhooks?: {
    enabled: boolean;
    queueName: string;
    reuse: boolean;
  };
  workerName?: string;
}

export interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export interface RunOptions {
  allowFailure?: boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  interactive?: boolean;
}

export type CommandRunner = (
  executable: string,
  args: readonly string[],
  options?: RunOptions,
) => Promise<CommandResult>;
