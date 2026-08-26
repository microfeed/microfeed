import {useEffect, useMemo, useState} from "react";

import AdminCodeEditor from "@/components/admin/shared/AdminCodeEditor";
import AdminSectionCard from "@/components/admin/shared/AdminSectionCard";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {showToast} from "@/client/ToastUtils";
import {adminUrl, browserAdminPath} from "@/shared/AdminPath";
import {
  WEBHOOK_EVENT_DEFINITIONS,
  type WebhookEventDefinition,
} from "@/shared/WebhookExamples";
import type {
  WebhookEndpointSummary,
  WebhookEventType,
  WebhookExplorerPreview,
  WebhookExplorerSourceMode,
  WebhookExplorerSubject,
} from "@/shared/Webhooks";

interface Props {
  dailyLimit?: number;
  deliveriesToday?: number;
  endpoints: WebhookEndpointSummary[];
  initialEndpointId?: string;
  initialEventType?: WebhookEventType;
  localPrintAvailable: boolean;
}

type ViewName = "headers" | "payload" | "schema";

function ajax(path: string): string {
  const [pathname, query] = path.split("?", 2);
  const base = adminUrl(
    `ajax/webhooks/explorer/${pathname ?? ""}`,
    browserAdminPath(),
  );
  return query ? `${base}?${query}` : base;
}

async function requestJson(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(ajax(path), {
    ...init,
    headers: {"content-type": "application/json", ...init?.headers},
  });
  const result = await response.json().catch(() => ({})) as {error?: string};
  if (!response.ok) throw new Error(result.error ?? "The Event Explorer request failed.");
  return result;
}

function eventGroups(): Array<[string, WebhookEventDefinition[]]> {
  const groups = new Map<string, WebhookEventDefinition[]>();
  for (const event of WEBHOOK_EVENT_DEFINITIONS) {
    groups.set(event.group, [...(groups.get(event.group) ?? []), event]);
  }
  return [...groups.entries()];
}

export default function WebhookEventExplorerApp({
  dailyLimit = 1_000,
  deliveriesToday = 0,
  endpoints,
  initialEndpointId,
  initialEventType = "webhook.test",
  localPrintAvailable,
}: Props) {
  const [eventType, setEventType] = useState<WebhookEventType>(initialEventType);
  const [sourceMode, setSourceMode] = useState<WebhookExplorerSourceMode>("generated");
  const [query, setQuery] = useState("");
  const [subjects, setSubjects] = useState<WebhookExplorerSubject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [endpointId, setEndpointId] = useState(() =>
    initialEndpointId ?? endpoints.find(({status}) => status === "active")?.id ?? ""
  );
  const [preview, setPreview] = useState<WebhookExplorerPreview>();
  const [view, setView] = useState<ViewName>("payload");
  const [busy, setBusy] = useState(false);
  const [deliveryId, setDeliveryId] = useState<string>();
  const definition = WEBHOOK_EVENT_DEFINITIONS.find((event) => event.type === eventType)!;
  const endpoint = endpoints.find((entry) => entry.id === endpointId);
  const needsSubject = ["item", "page", "site_file", "theme"].includes(
    definition.sourceKind,
  );
  const subscriptionMismatch = Boolean(
    endpoint && eventType !== "webhook.test" && !endpoint.events.includes(eventType),
  );
  const selection = useMemo(() => ({
    event_type: eventType,
    source_mode: sourceMode,
    ...(sourceMode === "current" && subjectId ? {subject_id: subjectId} : {}),
  }), [eventType, sourceMode, subjectId]);

  useEffect(() => {
    setDeliveryId(undefined);
    if (sourceMode !== "current") {
      setSubjects([]);
      setSubjectId("");
      return;
    }
    if (definition.sourceKind === "webhook") {
      setSourceMode("generated");
      return;
    }
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams({event_type: eventType, q: query});
      void requestJson(`subjects?${parameters}`).then((result: WebhookExplorerSubject[]) => {
        setSubjects(result);
        setSubjectId((current) =>
          result.some(({id}) => id === current) ? current : result[0]?.id ?? ""
        );
      }).catch((error) => showToast(error.message, "error"));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [definition.sourceKind, eventType, query, sourceMode]);

  useEffect(() => {
    if (sourceMode === "current" && needsSubject && !subjectId) {
      setPreview(undefined);
      return;
    }
    let active = true;
    setBusy(true);
    void requestJson("preview", {
      body: JSON.stringify(selection),
      method: "POST",
    }).then((result: WebhookExplorerPreview) => {
      if (active) setPreview(result);
    }).catch((error) => {
      if (active) showToast(error.message, "error");
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [needsSubject, selection, sourceMode, subjectId]);

  const copy = async (formatted: boolean) => {
    if (!preview) return;
    await navigator.clipboard.writeText(
      formatted ? JSON.stringify(preview.payload, null, 2) : preview.rawBody,
    );
    showToast(formatted ? "Formatted JSON copied." : "Exact raw JSON copied.", "success");
  };
  const print = async () => {
    setBusy(true);
    try {
      const result = await requestJson("print", {
        body: JSON.stringify(selection),
        method: "POST",
      });
      setPreview(result);
      showToast("Payload printed in the yarn dev terminal.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };
  const send = async () => {
    if (!endpoint) return;
    const warning = [
      `Send ${eventType} to ${endpoint.name}?`,
      endpoint.url,
      "This is a signed test delivery and must not cause production side effects.",
      `It reserves one delivery from the daily budget (${Math.max(dailyLimit - deliveriesToday, 0).toLocaleString("en-US")} currently available) and may retry.`,
      ...(subscriptionMismatch ? ["The endpoint is not subscribed to this event; Event Explorer will bypass that subscription."] : []),
    ].join("\n\n");
    if (!window.confirm(warning)) return;
    setBusy(true);
    try {
      const result = await requestJson("send", {
        body: JSON.stringify({...selection, endpoint_id: endpoint.id}),
        method: "POST",
      });
      if (result.delivery?.payload) {
        setPreview((current) => ({
          headers: current?.headers ?? {},
          payload: result.delivery.payload,
          rawBody: JSON.stringify(result.delivery.payload),
          schema: current?.schema ?? {},
        }));
      }
      setDeliveryId(result.deliveryId);
      showToast(
        result.suppressed
          ? "The test was recorded but suppressed by the daily budget."
          : "Test delivery queued.",
        result.suppressed ? "error" : "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };
  const displayed = view === "payload"
    ? preview?.payload
    : view === "headers"
    ? preview?.headers
    : preview?.schema;
  const displayedJson = preview
    ? JSON.stringify(displayed, null, 2)
    : busy
    ? "Generating preview…"
    : "Choose content to preview.";
  const deliveriesUrl = deliveryId
    ? `${adminUrl("webhooks/deliveries", browserAdminPath())}?delivery_id=${encodeURIComponent(deliveryId)}`
    : "";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(20rem,0.75fr)_minmax(0,1.25fr)]">
      <AdminSectionCard
        description="Choose an exact event and a safe source snapshot. Previews never mutate content."
        title="Build an event"
      >
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="webhook-event-type">Event</Label>
            <select
              className="h-10 w-full cursor-pointer rounded-[10px] border border-input bg-background px-3 font-mono text-sm"
              id="webhook-event-type"
              onChange={(event) => {
                setEventType(event.target.value as WebhookEventType);
                setQuery("");
                setSubjectId("");
              }}
              value={eventType}
            >
              {eventGroups().map(([group, events]) => (
                <optgroup key={group} label={group}>
                  {events.map((event) => <option key={event.type} value={event.type}>{event.type}</option>)}
                </optgroup>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">{definition.description}</p>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Data source</legend>
            <label className="flex items-start gap-3 rounded-xl border p-3">
              <input checked={sourceMode === "generated"} name="source" onChange={() => setSourceMode("generated")} type="radio" />
              <span><span className="block text-sm font-medium">Generated example</span><span className="text-xs text-muted-foreground">The same canonical example published in OpenAPI.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border p-3">
              <input disabled={definition.sourceKind === "webhook"} checked={sourceMode === "current"} name="source" onChange={() => setSourceMode("current")} type="radio" />
              <span><span className="block text-sm font-medium">Current content</span><span className="text-xs text-muted-foreground">Copy a current snapshot and adjust only fields required by the simulated event.</span></span>
            </label>
          </fieldset>

          {sourceMode === "current" && needsSubject && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="webhook-subject-search">Search current content</Label>
                <Input id="webhook-subject-search" onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${definition.sourceKind.replace("_", " ")}s`} value={query} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="webhook-subject">Subject</Label>
                <select className="h-10 w-full cursor-pointer rounded-[10px] border border-input bg-background px-3 text-sm" id="webhook-subject" onChange={(event) => setSubjectId(event.target.value)} value={subjectId}>
                  {subjects.length === 0 && <option value="">No matching content</option>}
                  {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.label}{subject.description ? ` — ${subject.description}` : ""}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="webhook-endpoint">Send to endpoint</Label>
            <select className="h-10 w-full cursor-pointer rounded-[10px] border border-input bg-background px-3 text-sm" id="webhook-endpoint" onChange={(event) => setEndpointId(event.target.value)} value={endpointId}>
              <option value="">Choose an endpoint</option>
              {endpoints.map((entry) => <option disabled={entry.status === "disabled"} key={entry.id} value={entry.id}>{entry.name} — {entry.status.replace("_", " ")}</option>)}
            </select>
            {subscriptionMismatch && <p className="rounded-lg bg-amber-500/10 p-3 text-sm">Subscription mismatch: Event Explorer can still send this test directly to the selected endpoint.</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !endpoint || endpoint.status === "disabled" || !preview} onClick={send} type="button">Send test delivery</Button>
            {localPrintAvailable && <Button disabled={busy || !preview} onClick={print} type="button" variant="outline">Print in yarn dev</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Sending reserves 1 delivery from the {dailyLimit.toLocaleString("en-US")}-delivery daily budget and can retry. Previewing, copying, and local printing are free and side-effect-free.</p>
          {deliveryId && <p className="rounded-lg border p-3 text-sm">Delivery <code>{deliveryId}</code> was created. <a className="underline underline-offset-4" href={deliveriesUrl}>Open Delivery details</a>.</p>}
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        description="The preview is read-only. Generated event IDs and timestamps are replaced when a delivery is sent."
        title="Exact contract"
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-[10px] bg-muted p-1" role="tablist">
              {(["payload", "schema", "headers"] as const).map((tab) => (
                <button aria-selected={view === tab} className={`h-9 cursor-pointer rounded-lg px-3 text-sm font-medium ${view === tab ? "bg-background shadow-xs" : "text-muted-foreground"}`} key={tab} onClick={() => setView(tab)} role="tab" type="button">{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!preview} onClick={() => void copy(false)} size="sm" type="button" variant="outline">Copy raw JSON</Button>
              <Button disabled={!preview} onClick={() => void copy(true)} size="sm" type="button" variant="outline">Copy formatted JSON</Button>
            </div>
          </div>
          <AdminCodeEditor
            ariaLabel={`${view.charAt(0).toUpperCase() + view.slice(1)} JSON`}
            code={displayedJson}
            language="json"
            maxHeight="44rem"
            minHeight="24rem"
            readOnly
          />
        </div>
      </AdminSectionCard>
    </div>
  );
}
