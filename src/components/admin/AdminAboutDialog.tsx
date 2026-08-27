import {useState} from "react";
import {
  BookOpenIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GitCommitHorizontalIcon,
  GitForkIcon,
  GlobeIcon,
} from "lucide-react";

import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {OUR_BRAND} from "@/shared/Constants";
import {
  MICROFEED_MANAGE_COMMAND,
  managementCommand,
} from "@/shared/ManagementCli";
import {MICROFEED_VERSION} from "@/shared/Version";
import type {AdminDeploymentSummary} from "./admin-shell-types";

export const ADMIN_UPDATE_PROMPT =
  `Run \`${MICROFEED_MANAGE_COMMAND}\` and follow every instruction it prints ` +
  "to update this microfeed site to the latest version. Continue until " +
  "`status` verifies it.";
const CLOUDFLARE_WORKER_NAME_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu;

export function adminUpdatePrompt(
  deployment: AdminDeploymentSummary,
): string {
  const workerName = deployment.productionWorkerName?.trim();
  if (
    !deployment.protected ||
    !workerName ||
    !CLOUDFLARE_WORKER_NAME_PATTERN.test(workerName)
  ) {
    return ADMIN_UPDATE_PROMPT;
  }

  return [
    `Run \`${MICROFEED_MANAGE_COMMAND}\` and follow every instruction it ` +
      `prints to update the existing Cloudflare Worker \`${workerName}\` to ` +
      "the latest version.",
    "Do not initialize a new site or target another Worker. Continue until " +
      "`status` verifies it.",
  ].join("\n\n");
}

interface Props {
  defaultOpen?: boolean;
  deployment: AdminDeploymentSummary;
}

export type AdminSourceCommitView =
  | {kind: "authenticated-required"}
  | {kind: "commit"; full: string; short: string}
  | {kind: "legacy"};

export function adminSourceCommitView(
  deployment: AdminDeploymentSummary,
): AdminSourceCommitView {
  if (!deployment.protected) return {kind: "authenticated-required"};
  if (deployment.sourceCommit && /^[0-9a-f]{40}$/u.test(deployment.sourceCommit)) {
    return {
      full: deployment.sourceCommit,
      kind: "commit",
      short: deployment.sourceCommit.slice(0, 12),
    };
  }
  return {kind: "legacy"};
}

export default function AdminAboutDialog({defaultOpen = false, deployment}: Props) {
  const [copied, setCopied] = useState<"commit" | "prompt" | null>(null);
  const sourceCommit = adminSourceCommitView(deployment);
  const updatePrompt = adminUpdatePrompt(deployment);

  async function copy(value: string, kind: "commit" | "prompt") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger
        render={
          <button
            className="group flex w-full items-center justify-center rounded-xl px-3 py-3 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/40"
            type="button"
          />
        }
      >
        <img
          alt="microfeed by Listen Notes"
          className="h-auto w-full max-w-48 object-contain dark:hidden"
          src="/assets/brands/microfeed/horizontal-logo.png"
        />
        <img
          alt="microfeed by Listen Notes"
          className="hidden h-auto w-full max-w-48 object-contain dark:block"
          src="/assets/brands/microfeed/horizontal-logo-dark.png"
        />
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">About this microfeed</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <a
            className="flex items-center gap-3 rounded-xl border bg-card p-3 text-card-foreground hover:border-brand-light hover:text-card-foreground"
            href={OUR_BRAND.whatsnewWebsite}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GlobeIcon aria-hidden="true" className="size-5 text-brand-light" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Project website</span>
              <span className="block text-xs font-normal text-muted-foreground">www.microfeed.org</span>
            </span>
            <ExternalLinkIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          </a>
          <a
            className="flex items-center gap-3 rounded-xl border bg-card p-3 text-card-foreground hover:border-brand-light hover:text-card-foreground"
            href={OUR_BRAND.documentationWebsite}
            rel="noopener noreferrer"
            target="_blank"
          >
            <BookOpenIcon aria-hidden="true" className="size-5 text-brand-light" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Documentation</span>
              <span className="block text-xs font-normal text-muted-foreground">docs.microfeed.org</span>
            </span>
            <ExternalLinkIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          </a>
          <a
            className="flex items-center gap-3 rounded-xl border bg-card p-3 text-card-foreground hover:border-brand-light hover:text-card-foreground"
            href={OUR_BRAND.githubRepository}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitForkIcon aria-hidden="true" className="size-5 text-brand-light" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Github repo</span>
              <span className="block text-xs font-normal text-muted-foreground">github.com/microfeed</span>
            </span>
            <ExternalLinkIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          </a>
        </div>

        <section className="rounded-xl border bg-muted/30 p-4" aria-labelledby="deployment-details-title">
          <h3 className="text-sm font-semibold" id="deployment-details-title">Deployment details</h3>
          <dl className="mt-3 grid gap-3 text-sm">
            <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-center">
              <dt className="text-muted-foreground">Version</dt>
              <dd><code>{MICROFEED_VERSION}</code></dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-center">
              <dt className="text-muted-foreground">Deployed</dt>
              <dd>
                <time dateTime={deployment.deployedAt} suppressHydrationWarning>
                  {new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short"}).format(new Date(deployment.deployedAt))}
                </time>
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-center">
              <dt className="text-muted-foreground">Source commit</dt>
              <dd className="min-w-0">
                {sourceCommit.kind === "authenticated-required" ? (
                  <span className="text-muted-foreground">Enable dashboard authentication to view</span>
                ) : sourceCommit.kind === "commit" ? (
                  <span className="flex items-center gap-2">
                    <GitCommitHorizontalIcon aria-hidden="true" className="size-4 shrink-0 text-brand-light" />
                    <code className="truncate text-xs">{sourceCommit.short}</code>
                    <Button
                      aria-label="Copy full source commit"
                      className="ml-auto"
                      onClick={() => void copy(sourceCommit.full, "commit")}
                      size="icon-sm"
                      variant="ghost"
                    >
                      {copied === "commit" ? <CheckIcon /> : <CopyIcon />}
                    </Button>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Available after the next <code>{managementCommand("deploy")}</code>.</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="update-title">
          <h3 className="text-sm font-semibold" id="update-title">Update to the latest version</h3>
          <ol className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <li className="flex gap-3"><span className="font-semibold text-brand-light">1</span><span>Open a local AI coding agent in any folder.</span></li>
            <li className="flex gap-3"><span className="font-semibold text-brand-light">2</span><span>Paste the prompt below.</span></li>
            <li className="flex gap-3"><span className="font-semibold text-brand-light">3</span><span>Complete any requested Cloudflare browser authorization or choices while the agent deploys and verifies the site.</span></li>
          </ol>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-brand-dark p-3 text-white dark:bg-background dark:ring-1 dark:ring-border">
            <code className="min-w-0 flex-1 whitespace-pre-wrap text-xs leading-relaxed">{updatePrompt}</code>
            <Button
              aria-label="Copy update prompt"
              className="shrink-0 text-white hover:bg-white/10 hover:text-white"
              onClick={() => void copy(updatePrompt, "prompt")}
              size="icon-sm"
              variant="ghost"
            >
              {copied === "prompt" ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
