import {useState} from "react";

import AdminSectionCard from "@/components/admin/shared/AdminSectionCard";
import {Button} from "@/components/ui/button";
import {showToast} from "@/client/ToastUtils";
import type {
  WebhookDeliverySummary,
  WebhookEndpointSummary,
} from "@/shared/Webhooks";
import {adminUrl, browserAdminPath} from "@/shared/AdminPath";
import {WEBHOOK_DELIVERY_STATUSES, WEBHOOK_EVENT_TYPES} from "@/shared/Webhooks";

function ajax(path: string): string {
  return adminUrl(`ajax/webhooks/${path}`, browserAdminPath());
}

async function read(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(ajax(path), init);
  const result = await response.json().catch(() => ({})) as {error?: string};
  if (!response.ok) throw new Error(result.error ?? "The webhook request failed.");
  return result;
}

export default function WebhookDeliveriesApp({initialDeliveries, endpoints, initialSelected}: {initialDeliveries: WebhookDeliverySummary[]; endpoints: WebhookEndpointSummary[]; initialSelected?: any}) {
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [selected, setSelected] = useState<any>(initialSelected);
  const [filters, setFilters] = useState({endpoint_id: "", event_type: "", status: ""});
  const [busy, setBusy] = useState(false);

  const applyFilters = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      setDeliveries(await read(`deliveries?${query}`));
      setSelected(undefined);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };
  const inspect = async (id: string) => {
    setBusy(true);
    try { setSelected(await read(`deliveries/${id}`)); }
    catch (error) { showToast(error instanceof Error ? error.message : String(error), "error"); }
    finally { setBusy(false); }
  };
  const redeliver = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await read(`deliveries/${selected.id}/redeliver`, {method: "POST"});
      showToast(result.suppressed ? "Redelivery was suppressed by the daily budget." : "Redelivery queued.", result.suppressed ? "error" : "success");
    } catch (error) { showToast(error instanceof Error ? error.message : String(error), "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
      <AdminSectionCard description="Filter up to 200 retained deliveries from the last 30 days." title="Delivery history">
        <form className="mb-5 grid gap-3 sm:grid-cols-3" onSubmit={applyFilters}>
          <select aria-label="Endpoint" className="h-10 rounded-md border bg-background px-3 text-sm" onChange={(event) => setFilters({...filters, endpoint_id: event.target.value})} value={filters.endpoint_id}>
            <option value="">All endpoints</option>
            {endpoints.map((endpoint) => <option key={endpoint.id} value={endpoint.id}>{endpoint.name}</option>)}
          </select>
          <select aria-label="Event type" className="h-10 rounded-md border bg-background px-3 text-sm" onChange={(event) => setFilters({...filters, event_type: event.target.value})} value={filters.event_type}>
            <option value="">All events</option>
            {WEBHOOK_EVENT_TYPES.map((eventType) => <option key={eventType} value={eventType}>{eventType}</option>)}
          </select>
          <div className="flex gap-2">
            <select aria-label="Status" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" onChange={(event) => setFilters({...filters, status: event.target.value})} value={filters.status}>
              <option value="">All statuses</option>
              {WEBHOOK_DELIVERY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <Button disabled={busy} type="submit" variant="outline">Apply</Button>
          </div>
        </form>
        {deliveries.length === 0 ? <p className="text-sm text-muted-foreground">No deliveries match these filters.</p> : (
          <ul className="divide-y rounded-xl border">
            {deliveries.map((delivery) => (
              <li key={delivery.id}>
                <button className="grid w-full gap-1 p-4 text-left hover:bg-muted/50 sm:grid-cols-[1fr_auto]" onClick={() => inspect(delivery.id)} type="button">
                  <span><span className="font-medium">{delivery.eventType}</span>{delivery.isTest && <span className="ml-2 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase">test</span>}<span className="ml-2 text-xs text-muted-foreground">{delivery.endpointName ?? delivery.endpointUrl}</span></span>
                  <span className="text-xs font-medium">{delivery.status}</span>
                  <span className="text-xs text-muted-foreground">{new Date(delivery.createdAt).toLocaleString()} · {delivery.attemptCount} attempts</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminSectionCard>
      <AdminSectionCard description="Payload, correlation chain, response diagnostics, and individual attempts." title="Delivery details">
        {!selected ? <p className="text-sm text-muted-foreground">Choose a delivery to inspect it.</p> : (
          <div className="grid gap-5 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Delivery</dt><dd className="break-all font-mono text-xs">{selected.id}</dd>
              <dt className="text-muted-foreground">Event</dt><dd className="break-all font-mono text-xs">{selected.eventId}</dd>
              <dt className="text-muted-foreground">Status</dt><dd>{selected.status}</dd>
              <dt className="text-muted-foreground">Test</dt><dd>{selected.isTest ? "Yes" : "No"}</dd>
              <dt className="text-muted-foreground">Response</dt><dd>{selected.responseStatus ?? "—"}</dd>
            </dl>
            <Button disabled={busy || selected.status === "pending" || selected.status === "retrying"} onClick={redeliver} type="button" variant="outline">Manual redelivery</Button>
            <div><h3 className="mb-2 font-medium">Payload</h3><pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(selected.payload, null, 2)}</pre></div>
            <div><h3 className="mb-2 font-medium">Attempts</h3><ul className="grid gap-2">{selected.attempts.map((attempt: any) => <li className="rounded-lg border p-3" key={attempt.attemptNumber}><p>Attempt {attempt.attemptNumber}: {attempt.outcome} {attempt.responseStatus ?? ""}</p>{(attempt.error || attempt.responseBody) && <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{attempt.error ?? attempt.responseBody}</pre>}</li>)}</ul></div>
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
