import {useState} from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
} from "lucide-react";

import {showToast} from "@/client/ToastUtils";
import AdminCodeEditor from "@/components/admin/shared/AdminCodeEditor";
import AdminSectionCard from "@/components/admin/shared/AdminSectionCard";
import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {adminUrl, browserAdminPath} from "@/shared/AdminPath";
import {
  WEBHOOK_QUICKSTARTS,
  WEBHOOK_QUICKSTART_ENDPOINT_URL,
  type WebhookQuickstartLanguage,
} from "@/shared/WebhookQuickstarts";
import type {WebhookOverview} from "@/shared/Webhooks";
import {WEBHOOK_EVENT_TYPES, WEBHOOK_LIMITS} from "@/shared/Webhooks";

interface Props {
  deploymentEnvironment?: "preview" | "production";
  instanceName?: string;
  localDevelopment?: boolean;
  overview: WebhookOverview;
}

function ajax(path: string): string {
  return adminUrl(`ajax/webhooks/${path}`, browserAdminPath());
}

async function requestJson(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(ajax(path), {
    ...init,
    headers: {"content-type": "application/json", ...init?.headers},
  });
  const payload = await response.json().catch(() => ({})) as {error?: string};
  if (!response.ok) {
    throw new Error(payload.error ?? "The webhook request failed.");
  }
  return payload;
}

export default function WebhookOverviewApp({
  deploymentEnvironment = "production",
  instanceName = "<name>",
  localDevelopment = false,
  overview: initialOverview,
}: Props) {
  const [overview, setOverview] = useState(initialOverview);
  const [previewLanguage, setPreviewLanguage] =
    useState<WebhookQuickstartLanguage>("javascript");
  const quickstart = WEBHOOK_QUICKSTARTS[previewLanguage];
  const remaining = Math.max(
    overview.dailyLimit - overview.deliveriesToday,
    0,
  );
  const endpointUrl = adminUrl("webhooks/endpoints", browserAdminPath());
  const endpointCreateUrl = `${endpointUrl}?quickstart=1`;
  const explorerUrl = `${adminUrl(
    "webhooks/events",
    browserAdminPath(),
  )}?event=webhook.test`;
  const deploymentLabel = deploymentEnvironment === "preview"
    ? "Preview"
    : "Production";
  const deploymentCommand = `yarn manage deploy ${
    deploymentEnvironment === "preview" ? "--preview " : ""
  }--enable-webhooks --instance ${instanceName}`;
  const agentDeploymentPrompt = `Enable ${deploymentLabel.toLowerCase()} webhooks for my saved microfeed site "${instanceName}". Follow the deploy-microfeed skill, review the deploy section of docs/manage-cli.md, and run ${deploymentCommand}. Do not change another site or environment. After deployment, run yarn manage status --instance ${instanceName} and report whether the webhook Queue and binding are ready.`;

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    showToast(`${label} copied.`, "success");
  };

  return (
    <div className="grid gap-6">
      <AdminSectionCard
        action={<WebhookEnablementDialog
          agentPrompt={agentDeploymentPrompt}
          command={deploymentCommand}
          deploymentLabel={deploymentLabel}
          enabled={overview.enabled}
          endpointUrl={endpointUrl}
          localDevelopment={localDevelopment}
          onCopy={copy}
        />}
        description="Queue-backed, signed notifications for content integrations and AI agents."
        title="Webhook availability"
      >
        <div className="flex items-start gap-3">
          {localDevelopment || overview.enabled
            ? <CheckCircle2Icon className="mt-0.5 size-5 text-emerald-600" aria-hidden="true" />
            : <AlertTriangleIcon className="mt-0.5 size-5 text-amber-600" aria-hidden="true" />}
          <div>
            <p className="font-medium">
              {localDevelopment
                ? "Webhook simulation is running locally"
                : overview.enabled
                ? `${deploymentLabel} webhooks are enabled`
                : `${deploymentLabel} webhooks are not enabled`}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {localDevelopment
                ? "yarn dev uses Wrangler's local Queue simulation. It creates no Cloudflare resources, requests no Queue permissions, and incurs no Cloudflare charge."
                : overview.enabled
                ? "Deliveries are stored in D1 and dispatched through this deployment's dedicated Cloudflare Queue. Reconciliation runs hourly and cleanup runs once daily while at least one endpoint is configured."
                : "Ordinary deployments keep webhooks off. Enable them explicitly only when this deployment is ready to create and use a dedicated Cloudflare Queue."}
            </p>
            {!localDevelopment && !overview.enabled && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted p-3">
                <code className="min-w-0 flex-1 overflow-x-auto text-xs">
                  {deploymentCommand}
                </code>
                <button
                  aria-label="Copy deployment command"
                  className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={() => void copy(deploymentCommand, "Deployment command")}
                  type="button"
                >
                  <CopyIcon aria-hidden="true" className="size-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </AdminSectionCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Endpoints" value={`${overview.endpoints} configured`}>
          <p>{overview.activeEndpoints} active · limit {overview.endpointLimit}</p>
          <a className="font-medium text-foreground underline underline-offset-4" href={endpointUrl}>
            Manage endpoints
          </a>
        </Metric>
        <BudgetMetric
          onUpdate={(dailyLimit) => setOverview((current) => ({
            ...current,
            dailyLimit,
          }))}
          overview={overview}
          remaining={remaining}
        />
        <Metric
          label="Estimated Queue operations today"
          value={`~${overview.estimatedQueueOperationsToday.toLocaleString("en-US")}`}
        >
          <p>Usually 3 per delivery; retries can raise that to 8.</p>
        </Metric>
        <Metric label="Failures in the last 24 hours" value={overview.recentFailures}>
          <p>Terminal delivery failures after all configured attempts.</p>
        </Metric>
      </div>

      {overview.alerts.length > 0 && (
        <AdminSectionCard
          description="These conditions need an administrator's attention."
          title="Webhook alerts"
        >
          <ul className="grid gap-3">
            {overview.alerts.map((alert) => (
              <li className="rounded-lg border border-amber-500/35 bg-amber-500/8 p-3" key={alert.id}>
                <p className="font-medium">{alert.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </AdminSectionCard>
      )}

      <AdminSectionCard
        description="Run a complete receiver locally, create an endpoint, and send a real signed test."
        title="Build and test your first endpoint"
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(22rem,1.15fr)]">
          <div className="grid content-start gap-3 text-sm leading-6">
            <QuickstartStep
              description={`Create the ${quickstart.label} receiver project in the repository root.`}
              number={1}
              title={`Scaffold the ${quickstart.label} receiver`}
            >
              <p>
                From the microfeed repository root, run the command below. It
                writes to the ignored <code>.microfeed/webhooks/</code>
                {" "}workspace—not <code>packages/cli/.microfeed/</code>—and does
                not install or start anything.
              </p>
              <QuickstartCommand onCopy={copy} value={quickstart.scaffoldCommand} />
              <p>
                After it starts in step 3, this receiver will listen at
                {" "}<code>{WEBHOOK_QUICKSTART_ENDPOINT_URL}</code>.
              </p>
            </QuickstartStep>

            <QuickstartStep
              description="Register the local URL and reveal its signing secret."
              number={2}
              title="Create the webhook endpoint"
            >
              <p>
                Open the prefilled endpoint form, enter a name, choose the
                events you want, and create the endpoint for
                {" "}<code>{WEBHOOK_QUICKSTART_ENDPOINT_URL}</code>.
              </p>
              <Button
                render={<a href={endpointCreateUrl} rel="noreferrer" target="_blank" />}
                size="sm"
              >
                Create endpoint
              </Button>
              <p>
                Open <strong>Signing secret</strong> for the endpoint and
                reveal the <code>whsec_…</code> value. This is your
                {" "}<code>MICROFEED_WEBHOOK_SECRET</code>. It authenticates
                microfeed and detects changed request bytes, so no additional
                passcode is needed. You can return to reveal or rotate it
                later.
              </p>
            </QuickstartStep>

            <QuickstartStep
              description={`Install ${quickstart.label} dependencies and start the loopback server.`}
              number={3}
              title={`Install and run the ${quickstart.label} receiver`}
            >
              <p>
                In a terminal, enter the generated directory, install its
                dependencies, and replace <code>whsec_...</code> with the secret
                revealed in step 2.
              </p>
              <QuickstartCommand onCopy={copy} value={quickstart.directoryCommand} />
              {quickstart.installCommands.map((command) => (
                <QuickstartCommand key={command} onCopy={copy} value={command} />
              ))}
              <QuickstartCommand onCopy={copy} value={quickstart.runCommand} />
              <p>
                Keep this terminal open. It should print
                {" "}<code>Listening at {WEBHOOK_QUICKSTART_ENDPOINT_URL}</code>.
              </p>
            </QuickstartStep>

            <QuickstartStep
              description="Send a signed webhook.test and confirm it reaches the terminal."
              number={4}
              title="Send and verify a test event"
            >
              <p>
                With the receiver still running, open Event Explorer. Select
                the endpoint from step 2 and <code>webhook.test</code>, keep the
                generated example, then choose <strong>Send test delivery</strong>
                {" "}and confirm the budgeted delivery.
              </p>
              <Button
                render={<a href={explorerUrl} rel="noreferrer" target="_blank" />}
                size="sm"
                variant="outline"
              >
                Open Event Explorer
              </Button>
              <p>
                The receiver terminal should print the delivery ID, event type,
                {" "}<code>test: true</code>, duplicate status, and formatted
                payload. A <code>204</code> response marks the delivery as
                accepted in microfeed.
              </p>
            </QuickstartStep>
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2" role="tablist" aria-label="Receiver language">
                {(["javascript", "python"] as const).map((language) => (
                  <Button
                    aria-selected={previewLanguage === language}
                    key={language}
                    onClick={() => setPreviewLanguage(language)}
                    role="tab"
                    size="sm"
                    type="button"
                    variant={previewLanguage === language ? "default" : "outline"}
                  >
                    {WEBHOOK_QUICKSTARTS[language].label}
                  </Button>
                ))}
              </div>
              <Button
                onClick={() => void copy(quickstart.source, `${quickstart.label} receiver code`)}
                size="sm"
                type="button"
                variant="outline"
              >
                <CopyIcon aria-hidden="true" className="size-4" />
                Copy {quickstart.filename}
              </Button>
            </div>
            <AdminCodeEditor
              ariaLabel={`${quickstart.label} webhook receiver code`}
              code={quickstart.source}
              language={quickstart.highlightLanguage}
              maxHeight="36rem"
              minHeight="36rem"
              readOnly
            />
            <div className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/8 p-4 text-sm leading-6">
              <p className="font-medium">Local inspector, not production infrastructure</p>
              <p className="mt-1 text-muted-foreground">
                Duplicate state resets on restart, no job is durably queued,
                and production effects are intentionally absent. Add durable
                acknowledgement, background work, idempotency, loop
                prevention, approvals, audit logs, and cost alerts before
                deployment.
              </p>
            </div>
          </div>
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        description={`${WEBHOOK_EVENT_TYPES.length} versioned event types are documented in this instance's generated OpenAPI contract.`}
        title="Use webhooks safely"
      >
        <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
          <p>Verify the Standard Webhooks signature against the exact request bytes, deduplicate delivery IDs, durably save work, and acknowledge before running a model or external tool.</p>
          <p>The daily delivery budget is an owner-controlled cost guard, not a microfeed pricing tier. Fanout, tests, and manual redeliveries reserve deliveries; retries add Queue reads without reserving another delivery.</p>
          <details>
            <summary className="cursor-pointer font-medium text-foreground">{WEBHOOK_EVENT_TYPES.length} event types</summary>
            <p className="mt-2 font-mono text-xs">{WEBHOOK_EVENT_TYPES.join(", ")}</p>
          </details>
          <a className="inline-flex w-fit items-center gap-1.5 font-medium text-foreground underline underline-offset-4" href="https://docs.microfeed.org/automation/" rel="noreferrer" target="_blank">
            Content automation guide <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </AdminSectionCard>
    </div>
  );
}

function QuickstartStep({
  children,
  description,
  number,
  title,
}: {
  children: React.ReactNode;
  description: string;
  number: number;
  title: string;
}) {
  return (
    <details className="group overflow-hidden rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium leading-6">{title}</span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="grid gap-3 border-t px-4 py-4 text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

function QuickstartCommand({
  copyLabel = "Command",
  onCopy,
  value,
}: {
  copyLabel?: string;
  onCopy: (value: string, label: string) => Promise<void>;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-foreground">
      <code className="min-w-0 flex-1 overflow-x-auto text-xs leading-5">
        {value}
      </code>
      <button
        aria-label={copyLabel === "Command"
          ? `Copy command: ${value}`
          : `Copy ${copyLabel.toLowerCase()}`}
        className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
        onClick={() => void onCopy(value, copyLabel)}
        type="button"
      >
        <CopyIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

function Metric({
  children,
  label,
  value,
}: {
  children?: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {children && <div className="mt-3 grid gap-1 text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

function BudgetMetric({
  onUpdate,
  overview,
  remaining,
}: {
  onUpdate: (dailyLimit: number) => void;
  overview: WebhookOverview;
  remaining: number;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(overview.dailyLimit));
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const numericValue = value.trim() === "" ? Number.NaN : Number(value);
  const higherBudget = Number.isFinite(numericValue) &&
    numericValue > WEBHOOK_LIMITS.dailyDeliveries;
  const percentage = overview.dailyLimit > 0
    ? Math.min(100, overview.deliveriesToday / overview.dailyLimit * 100)
    : overview.deliveriesToday > 0 ? 100 : 0;

  const save = async () => {
    setBusy(true);
    try {
      const result = await requestJson("settings", {
        body: JSON.stringify({
          dailyDeliveryLimit: numericValue,
          highCostAcknowledged: acknowledged,
        }),
        method: "PATCH",
      });
      onUpdate(result.settings.dailyDeliveryLimit);
      setOpen(false);
      showToast("Daily delivery budget updated.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <p className="text-sm text-muted-foreground">Daily delivery budget</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">
        {overview.deliveriesToday.toLocaleString("en-US")} used of {overview.dailyLimit.toLocaleString("en-US")}
      </p>
      <div
        aria-label="Daily delivery budget used"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(percentage)}
        aria-valuetext={`${overview.deliveriesToday.toLocaleString("en-US")} used of ${overview.dailyLimit.toLocaleString("en-US")}`}
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div className="h-full rounded-full bg-brand-light" style={{width: `${percentage}%`}} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {remaining.toLocaleString("en-US")} available · resets at 00:00 UTC
      </p>
      <Dialog onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setValue(String(overview.dailyLimit));
          setAcknowledged(false);
        }
      }} open={open}>
        <DialogTrigger render={<Button className="mt-3" size="sm" type="button" variant="outline" />}>
          Change budget
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Change the daily delivery budget</DialogTitle>
            <DialogDescription>
              This owner-controlled guard limits new deliveries reserved each
              UTC day. It is not a microfeed pricing tier and changes immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {[0, 1_000, 10_000, 100_000].map((preset) => (
                <Button key={preset} onClick={() => setValue(String(preset))} size="sm" type="button" variant={value === String(preset) ? "default" : "outline"}>
                  {preset.toLocaleString("en-US")}
                </Button>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="webhook-daily-budget">Deliveries per UTC day</Label>
              <Input id="webhook-daily-budget" max={WEBHOOK_LIMITS.maximumDailyDeliveries} min={0} onChange={(event) => {
                setValue(event.target.value);
                setAcknowledged(false);
              }} step={1} type="number" value={value} />
              <p className="text-xs text-muted-foreground">
                Choose 0 to stop new reservations. Existing queued deliveries
                and attempts continue. Maximum: {WEBHOOK_LIMITS.maximumDailyDeliveries.toLocaleString("en-US")}.
              </p>
            </div>
            {Number.isFinite(numericValue) && numericValue >= 0 && (
              <div className="rounded-xl bg-muted p-4 text-sm leading-6">
                <p>Projected ordinary Queue operations: about {(numericValue * 3).toLocaleString("en-US")} per full-budget day.</p>
                <p>Worst case with six attempts: up to {(numericValue * 8).toLocaleString("en-US")}.</p>
              </div>
            )}
            {higherBudget && (
              <label className="flex items-start gap-3 rounded-xl border border-amber-500/35 bg-amber-500/8 p-4 text-sm leading-6">
                <input checked={acknowledged} className="mt-1" onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
                <span>
                  I understand Cloudflare Queue allowances are account-wide,
                  retries add operations, Worker execution is separately
                  metered, and this higher budget can create charges.
                </span>
              </label>
            )}
            <p className="text-xs text-muted-foreground">
              Lowering the budget below today's usage leaves zero available
              until you raise it or the budget resets at 00:00 UTC.
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              Cloudflare currently includes 10,000 Queue operations per day on
              Workers Free. Workers Paid includes 1,000,000 operations per
              month, then charges $0.40 per million. The allowance is shared
              account-wide, Worker execution is separate, and pricing can
              change.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !Number.isInteger(numericValue) || numericValue < 0 || numericValue > WEBHOOK_LIMITS.maximumDailyDeliveries || higherBudget && !acknowledged} onClick={() => void save()} type="button">
                Save budget
              </Button>
              <a className="inline-flex items-center gap-1.5 px-2 text-sm font-medium underline underline-offset-4" href="https://developers.cloudflare.com/queues/platform/pricing/" rel="noreferrer" target="_blank">
                Current Queue pricing <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WebhookEnablementDialog({
  agentPrompt,
  command,
  deploymentLabel,
  enabled,
  endpointUrl,
  localDevelopment,
  onCopy,
}: {
  agentPrompt: string;
  command: string;
  deploymentLabel: "Preview" | "Production";
  enabled: boolean;
  endpointUrl: string;
  localDevelopment: boolean;
  onCopy: (value: string, label: string) => Promise<void>;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" type="button" variant="outline" />}>
        {localDevelopment
          ? "How local simulation works"
          : enabled
          ? "Enable or stop webhooks"
          : `Enable ${deploymentLabel.toLowerCase()} webhooks`}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Local simulation and deployed webhook opt-in</DialogTitle>
          <DialogDescription>
            Local development is free and automatic. Cloudflare deployment is
            explicit because it changes account resources and usage.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 text-sm leading-6">
          <div className="rounded-xl border p-4">
            <p className="font-medium">Local development</p>
            <p className="mt-1 text-muted-foreground">
              Plain <code>yarn dev</code> runs Wrangler's local Queue simulation
              with an isolated D1 database and local secret. It requires no
              Cloudflare permission, resource, deployment, or payment.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-medium">Preview and production</p>
            <p className="mt-1 text-muted-foreground">
              The explicit deployment option requests Queue authorization,
              creates a dedicated Queue and Worker bindings, enables the
              hourly reconciliation trigger, and creates the endpoint-secret
              encryption key. The same trigger performs retention cleanup once
              daily at 00:00 UTC. When no non-deleted endpoint is configured,
              it exits after one D1 existence check without reconciling,
              cleaning, or using the Queue. Queue operations share the
              Cloudflare account's allowance, and Worker execution is metered
              separately. Sites that do not use webhooks should not provision
              these resources.
            </p>
            <p className="mt-3 font-medium">Run it manually</p>
            <QuickstartCommand copyLabel="Deployment command" onCopy={onCopy} value={command} />
            <p className="mt-3 font-medium">Ask a coding agent</p>
            <p className="mt-1 text-muted-foreground">
              Give a local coding agent this prompt from a trusted microfeed
              checkout. It will follow the same project-owned deployment flow.
            </p>
            <QuickstartCommand copyLabel="Coding-agent prompt" onCopy={onCopy} value={agentPrompt} />
          </div>
          <div className="rounded-xl border p-4">
            <p className="font-medium">Stop webhook delivery</p>
            <p className="mt-1 text-muted-foreground">
              Open <a className="font-medium text-foreground underline underline-offset-4" href={endpointUrl}>Webhooks → Endpoints</a>,
              then disable or delete every endpoint. Disabling cancels pending
              deliveries and prevents new reservations; deletion also frees
              the endpoint slot. The deployed Queue remains provisioned for
              later reuse, but with no configured endpoints the hourly trigger
              skips reconciliation and daily cleanup after one D1 check.
            </p>
          </div>
          {localDevelopment && (
            <p className="rounded-xl bg-emerald-500/10 p-4">
              You are viewing a loopback-hosted Admin session, so webhook Queue
              behavior is being simulated locally right now.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
