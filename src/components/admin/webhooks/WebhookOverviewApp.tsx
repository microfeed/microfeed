import {AlertTriangleIcon, CheckCircle2Icon, ExternalLinkIcon} from "lucide-react";

import AdminSectionCard from "@/components/admin/shared/AdminSectionCard";
import type {WebhookOverview} from "@/shared/Webhooks";
import {WEBHOOK_EVENT_TYPES} from "@/shared/Webhooks";

export default function WebhookOverviewApp({overview}: {overview: WebhookOverview}) {
  const remaining = Math.max(overview.dailyLimit - overview.deliveriesToday, 0);
  return (
    <div className="grid gap-6">
      <AdminSectionCard
        description="Queue-backed, signed notifications for content integrations and AI agents."
        title="Webhook availability"
      >
        <div className="flex items-start gap-3">
          {overview.enabled
            ? <CheckCircle2Icon className="mt-0.5 size-5 text-emerald-600" aria-hidden="true" />
            : <AlertTriangleIcon className="mt-0.5 size-5 text-amber-600" aria-hidden="true" />}
          <div>
            <p className="font-medium">
              {overview.enabled ? "Webhooks are enabled" : "Webhooks are not enabled"}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {overview.enabled
                ? "Deliveries are stored in D1 and dispatched through the deployment's dedicated Cloudflare Queue."
                : "Redeploy with yarn manage deploy --enable-webhooks to create the Queue, binding, and signing-key encryption secret."}
            </p>
          </div>
        </div>
      </AdminSectionCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Endpoints" value={`${overview.endpoints} / ${overview.endpointLimit}`} />
        <Metric label="Active endpoints" value={overview.activeEndpoints} />
        <Metric label="Daily deliveries remaining" value={`${remaining} / ${overview.dailyLimit}`} />
        <Metric label="Estimated Queue operations today" value={overview.estimatedQueueOperationsToday} />
        <Metric label="Failures in the last 24 hours" value={overview.recentFailures} />
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
        description={`${WEBHOOK_EVENT_TYPES.length} versioned event types are documented in this instance's generated OpenAPI contract.`}
        title="Use webhooks safely"
      >
        <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
          <p>Verify the Standard Webhooks signature against the exact request bytes, deduplicate delivery IDs, durably save work, and acknowledge before running a model or external tool.</p>
          <div className="rounded-lg bg-muted p-3 font-mono text-xs text-foreground">
            <p>signed bytes: {"<webhook-id>.<webhook-timestamp>.<raw-body>"}</p>
            <p>webhook-signature: v1,{"<base64-hmac-sha256>"}</p>
          </div>
          <details>
            <summary className="font-medium text-foreground">{WEBHOOK_EVENT_TYPES.length} event types</summary>
            <p className="mt-2 font-mono text-xs">{WEBHOOK_EVENT_TYPES.join(", ")}</p>
          </details>
          <p>A normal successful delivery generally consumes three Queue operations. Six failed attempts use at most eight Queue operations under this design; Worker execution is metered separately.</p>
          <a className="inline-flex w-fit items-center gap-1.5 font-medium text-foreground underline underline-offset-4" href="https://docs.microfeed.org/automation/" rel="noreferrer" target="_blank">
            Content automation guide <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </AdminSectionCard>
    </div>
  );
}

function Metric({label, value}: {label: string; value: number | string}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
