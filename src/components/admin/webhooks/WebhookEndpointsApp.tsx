import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  LockKeyholeIcon,
  RefreshCwIcon,
} from "lucide-react";
import {useState} from "react";

import AdminSectionCard from "@/components/admin/shared/AdminSectionCard";
import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {showToast} from "@/client/ToastUtils";
import type {WebhookEndpointSummary} from "@/shared/Webhooks";
import {adminUrl, browserAdminPath} from "@/shared/AdminPath";
import {WEBHOOK_QUICKSTART_ENDPOINT_URL} from "@/shared/WebhookQuickstarts";
import {WEBHOOK_EVENT_TYPES, WEBHOOK_LIMITS, type WebhookEventType} from "@/shared/Webhooks";

interface Props {
  enabled: boolean;
  initialQuickstart?: boolean;
  initialEndpoints: WebhookEndpointSummary[];
}

interface FormValue {
  events: WebhookEventType[];
  name: string;
  url: string;
}

const selectableEvents = WEBHOOK_EVENT_TYPES.filter((event) => event !== "webhook.test");
const emptyForm: FormValue = {events: ["item.published"], name: "", url: ""};

function ajax(path: string): string {
  return adminUrl(`ajax/webhooks/${path}`, browserAdminPath());
}

async function requestJson(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(ajax(path), {
    ...init,
    headers: {"content-type": "application/json", ...init?.headers},
  });
  const payload = await response.json().catch(() => ({})) as {error?: string};
  if (!response.ok) throw new Error(payload.error ?? "The webhook request failed.");
  return payload;
}

export default function WebhookEndpointsApp({
  enabled,
  initialEndpoints,
  initialQuickstart = false,
}: Props) {
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [form, setForm] = useState<FormValue>(() => ({
    ...emptyForm,
    url: initialQuickstart ? WEBHOOK_QUICKSTART_ENDPOINT_URL : "",
  }));
  const [editingId, setEditingId] = useState<string>();
  const [formOpen, setFormOpen] = useState(
    initialQuickstart && initialEndpoints.length > 0,
  );
  const [busy, setBusy] = useState(false);
  const [secretBusy, setSecretBusy] = useState(false);
  const [secretEndpoint, setSecretEndpoint] = useState<WebhookEndpointSummary>();
  const [secretValue, setSecretValue] = useState<string>();
  const [secretVisible, setSecretVisible] = useState(false);

  const slotDescription = `${endpoints.length} of ${WEBHOOK_LIMITS.endpointCount} endpoint slots are in use. Disabled and auto-paused endpoints count until deleted.`;
  const closeForm = () => {
    setFormOpen(false);
    setEditingId(undefined);
    setForm(emptyForm);
  };
  const openCreate = () => {
    setEditingId(undefined);
    setForm(emptyForm);
    setFormOpen(true);
  };
  const openEdit = (endpoint: WebhookEndpointSummary) => {
    setEditingId(endpoint.id);
    setForm({events: endpoint.events, name: endpoint.name, url: endpoint.url});
    setFormOpen(true);
  };
  const openSecret = (
    endpoint: WebhookEndpointSummary,
    secret?: string,
  ) => {
    setSecretEndpoint(endpoint);
    setSecretValue(secret);
    setSecretVisible(Boolean(secret));
  };
  const closeSecret = () => {
    if (secretBusy) return;
    setSecretEndpoint(undefined);
    setSecretValue(undefined);
    setSecretVisible(false);
  };

  const refresh = async () => {
    setEndpoints(await requestJson("endpoints"));
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await requestJson(
        editingId ? `endpoints/${editingId}` : "endpoints",
        {body: JSON.stringify(form), method: editingId ? "PUT" : "POST"},
      );
      await refresh();
      showToast(editingId ? "Webhook endpoint updated." : "Webhook endpoint created.", "success");
      closeForm();
      if (result.secret && result.endpoint) {
        openSecret(result.endpoint, result.secret);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };
  const action = async (endpoint: WebhookEndpointSummary, actionName: string) => {
    if (actionName === "delete" && !window.confirm(`Delete ${endpoint.name}? Pending deliveries will be canceled.`)) return;
    setBusy(true);
    try {
      const method = actionName === "delete" ? "DELETE" : "POST";
      await requestJson(
        `endpoints/${endpoint.id}${actionName === "delete" ? "" : `/${actionName}`}`,
        {body: method === "POST" ? "{}" : undefined, method},
      );
      await refresh();
      showToast(actionName === "test" ? "Test delivery queued." : `Endpoint ${actionName} complete.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };
  const setStatus = async (endpoint: WebhookEndpointSummary) => {
    setBusy(true);
    try {
      await requestJson(`endpoints/${endpoint.id}`, {
        body: JSON.stringify({status: endpoint.status === "active" ? "disabled" : "active"}),
        method: "PUT",
      });
      await refresh();
      showToast(endpoint.status === "active" ? "Endpoint disabled." : "Endpoint enabled.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setBusy(false);
    }
  };
  const openTest = (endpoint: WebhookEndpointSummary) => {
    const query = new URLSearchParams({
      endpoint: endpoint.id,
      event: "webhook.test",
    });
    window.location.assign(
      `${adminUrl("webhooks/events", browserAdminPath())}?${query}`,
    );
  };
  const toggleSecret = async () => {
    if (!secretEndpoint) return;
    if (secretVisible) {
      setSecretVisible(false);
      return;
    }
    if (secretValue) {
      setSecretVisible(true);
      return;
    }
    setSecretBusy(true);
    try {
      const result = await requestJson(
        `endpoints/${secretEndpoint.id}/secret`,
      );
      setSecretValue(result.secret);
      setSecretVisible(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSecretBusy(false);
    }
  };
  const copySecret = async () => {
    if (!secretValue) return;
    await navigator.clipboard.writeText(secretValue);
    showToast("Signing secret copied.", "success");
  };
  const rotateSecret = async () => {
    if (!secretEndpoint || !window.confirm(
      `Rotate the signing secret for “${secretEndpoint.name}”? The current secret will remain valid for 24 hours so you can update the receiver.`,
    )) return;
    setSecretBusy(true);
    try {
      const result = await requestJson(
        `endpoints/${secretEndpoint.id}/rotate`,
        {body: "{}", method: "POST"},
      );
      if (!result.secret || !result.endpoint) {
        throw new Error("The rotated signing secret was not returned.");
      }
      setSecretEndpoint(result.endpoint);
      setSecretValue(result.secret);
      setSecretVisible(true);
      await refresh();
      showToast(
        "Signing secret rotated. The previous secret remains valid for 24 hours.",
        "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setSecretBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Dialog
        onOpenChange={(open) => {
          if (!open) closeSecret();
        }}
        open={Boolean(secretEndpoint)}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockKeyholeIcon aria-hidden="true" className="size-4" />
              Signing secret
            </DialogTitle>
            <DialogDescription>
              Use this endpoint-specific secret to verify that webhook events
              come from microfeed. You can reveal or rotate it here.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-w-0 items-center gap-1 rounded-lg bg-muted p-2">
            <code className="min-w-0 flex-1 overflow-x-auto px-2 py-1 text-sm">
              {secretVisible && secretValue
                ? secretValue
                : `whsec_${"•".repeat(24)}`}
            </code>
            <Button
              aria-label={secretVisible ? "Hide signing secret" : "Reveal signing secret"}
              disabled={secretBusy}
              onClick={() => void toggleSecret()}
              size="icon-sm"
              title={secretVisible ? "Hide signing secret" : "Reveal signing secret"}
              type="button"
              variant="ghost"
            >
              {secretVisible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
            </Button>
            <Button
              aria-label="Copy signing secret"
              disabled={secretBusy || !secretValue}
              onClick={() => void copySecret()}
              size="icon-sm"
              title="Copy signing secret"
              type="button"
              variant="ghost"
            >
              <CopyIcon aria-hidden="true" />
            </Button>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Store it in <code>MICROFEED_WEBHOOK_SECRET</code>, never in source
            code or the endpoint URL. The signature is the authentication;
            no separate passcode or bearer token is needed.
          </p>
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/8 p-3 text-sm leading-6">
            Rotating creates a new secret immediately. The previous secret
            remains valid for 24 hours so you can update the receiver without
            interrupting deliveries.
          </div>
          <DialogFooter>
            <Button
              disabled={secretBusy}
              onClick={() => void rotateSecret()}
              type="button"
              variant="outline"
            >
              <RefreshCwIcon aria-hidden="true" />
              Rotate signing secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {endpoints.length === 0 && (
        <AdminSectionCard description={slotDescription} title="Add endpoint">
          <EndpointForm
            busy={busy}
            editing={false}
            enabled={enabled}
            endpointCount={endpoints.length}
            form={form}
            onChange={setForm}
            onSubmit={submit}
          />
        </AdminSectionCard>
      )}

      {endpoints.length > 0 && (
        <Dialog
          onOpenChange={(open) => {
            if (!open && busy) return;
            if (open) setFormOpen(true);
            else closeForm();
          }}
          open={formOpen}
        >
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit endpoint" : "Add endpoint"}</DialogTitle>
              <DialogDescription>{slotDescription}</DialogDescription>
            </DialogHeader>
            <EndpointForm
              busy={busy}
              editing={Boolean(editingId)}
              enabled={enabled}
              endpointCount={endpoints.length}
              form={form}
              onCancel={closeForm}
              onChange={setForm}
              onSubmit={submit}
            />
          </DialogContent>
        </Dialog>
      )}

      <AdminSectionCard
        action={endpoints.length > 0 ? (
          <Button
            disabled={busy || !enabled || endpoints.length >= WEBHOOK_LIMITS.endpointCount}
            onClick={openCreate}
            size="sm"
            type="button"
          >
            Add endpoint
          </Button>
        ) : undefined}
        description={endpoints.length > 0
          ? <>{slotDescription} Tests and redeliveries count toward the daily delivery budget.</>
          : "Tests and redeliveries count toward the daily delivery budget."}
        title="Configured endpoints"
      >
        {endpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">No webhook endpoints have been created.</p>
        ) : (
          <ul className="grid gap-4">
            {endpoints.map((endpoint) => (
              <li className="rounded-xl border p-4" key={endpoint.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{endpoint.name}</h3>
                      <Status value={endpoint.status} />
                    </div>
                    <p className="mt-1 break-all text-sm text-muted-foreground">{endpoint.url}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{endpoint.events.join(", ")} · {endpoint.consecutiveTerminalFailures} consecutive terminal failures</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} onClick={() => openEdit(endpoint)} size="sm" type="button" variant="outline">Edit</Button>
                    <Button disabled={busy || endpoint.status === "disabled"} onClick={() => openTest(endpoint)} size="sm" type="button" variant="outline">Test</Button>
                    <Button disabled={busy} onClick={() => openSecret(endpoint)} size="sm" type="button" variant="outline">Signing secret</Button>
                    {endpoint.status === "auto_paused" ? (
                      <Button disabled={busy || !endpoint.resumeTestedAt} onClick={() => action(endpoint, "resume")} size="sm" type="button">Resume</Button>
                    ) : (
                      <Button disabled={busy} onClick={() => setStatus(endpoint)} size="sm" type="button" variant="outline">{endpoint.status === "active" ? "Disable" : "Enable"}</Button>
                    )}
                    <Button disabled={busy} onClick={() => action(endpoint, "delete")} size="sm" type="button" variant="destructive">Delete</Button>
                  </div>
                </div>
                {endpoint.status === "auto_paused" && <p className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm">This endpoint was paused after 10 consecutive terminal failures. Send a successful test, then explicitly resume it.</p>}
              </li>
            ))}
          </ul>
        )}
      </AdminSectionCard>
    </div>
  );
}

function EndpointForm({
  busy,
  editing,
  enabled,
  endpointCount,
  form,
  onCancel,
  onChange,
  onSubmit,
}: {
  busy: boolean;
  editing: boolean;
  enabled: boolean;
  endpointCount: number;
  form: FormValue;
  onCancel?: () => void;
  onChange: (form: FormValue) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="webhook-name">Name</Label>
        <Input id="webhook-name" maxLength={80} onChange={(event) => onChange({...form, name: event.target.value})} required value={form.name} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="webhook-url">Endpoint URL</Label>
        <Input id="webhook-url" onChange={(event) => onChange({...form, url: event.target.value})} placeholder="https://automation.example.com/webhook" required type="url" value={form.url} />
        <p className="text-xs text-muted-foreground">HTTPS is required when deployed. Local development permits http://127.0.0.1:&lt;port&gt;/webhook.</p>
      </div>
      {!editing && (
        <div className="rounded-xl bg-muted p-4 text-sm leading-6">
          <p className="font-medium">Authentication</p>
          <p className="mt-1 text-muted-foreground">
            microfeed generates one unique Standard Webhooks signing secret
            for this endpoint. Your receiver verifies the
            exact raw body, delivery ID, timestamp, and signature with that
            secret. You can reveal or rotate it later from the endpoint's
            <strong> Signing secret</strong> dialog. Put it in
            <code> MICROFEED_WEBHOOK_SECRET</code>; do not add a passcode,
            bearer token, URL credential, or custom authentication header.
          </p>
        </div>
      )}
      <fieldset>
        <legend className="text-sm font-medium">Subscribed events</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {selectableEvents.map((eventType) => (
            <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm" key={eventType}>
              <input
                checked={form.events.includes(eventType)}
                onChange={(event) => onChange({...form, events: event.target.checked ? [...form.events, eventType] : form.events.filter((value) => value !== eventType)})}
                type="checkbox"
              />
              <code>{eventType}</code>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !enabled || endpointCount >= WEBHOOK_LIMITS.endpointCount && !editing} type="submit">{editing ? "Save endpoint" : "Create endpoint"}</Button>
        {onCancel && <Button disabled={busy} onClick={onCancel} type="button" variant="outline">Cancel</Button>}
      </div>
    </form>
  );
}

function Status({value}: {value: string}) {
  return <span className="rounded-full border px-2 py-0.5 text-xs font-medium capitalize">{value.replace("_", " ")}</span>;
}
