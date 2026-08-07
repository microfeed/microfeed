import {KeyRoundIcon, PlusIcon, ShieldCheckIcon, Trash2Icon} from "lucide-react";
import {useState} from "react";

import {showToast} from "@/client/ToastUtils";
import {Button} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  OAUTH_SCOPE_DESCRIPTIONS,
  OAUTH_SCOPES,
  type OAuthClientSummary,
  type OAuthConsentSummary,
} from "@/shared/OAuth";
import {ADMIN_URLS} from "@/shared/StringUtils";

interface Props {
  available: boolean;
  initialClients: OAuthClientSummary[];
  initialConsents: OAuthConsentSummary[];
}

interface CreatedOAuthClient {
  client_id: string;
  client_secret?: string;
  client_name?: string;
  client_id_issued_at?: number;
  public?: boolean;
  redirect_uris?: string[];
  scope?: string;
}

async function responseJson<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => ({})) as T & {error?: string};
  if (!response.ok) throw new Error(value.error ?? "The request failed.");
  return value;
}

function displayDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "Unknown date";
}

function ScopeList({scopes}: {scopes: string[]}) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {scopes.map((scope) => (
        <li className="rounded-full bg-muted px-2.5 py-1 text-xs" key={scope}>
          {OAUTH_SCOPE_DESCRIPTIONS[scope] ?? scope}
        </li>
      ))}
    </ul>
  );
}

export default function OAuthAppsApp({
  available,
  initialClients,
  initialConsents,
}: Props) {
  const [clients, setClients] = useState(initialClients);
  const [consents, setConsents] = useState(initialConsents);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [publicClient, setPublicClient] = useState(true);
  const [scopes, setScopes] = useState<string[]>([
    OAUTH_SCOPES.READ,
    OAUTH_SCOPES.WRITE,
    OAUTH_SCOPES.OFFLINE,
  ]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedOAuthClient | null>(null);

  const toggleScope = (scope: string) => setScopes((current) =>
    current.includes(scope)
      ? current.filter((entry) => entry !== scope)
      : [...current, scope]
  );

  const create = async () => {
    setSaving(true);
    try {
      const result = await responseJson<{client: CreatedOAuthClient}>(
        await fetch(ADMIN_URLS.ajaxOAuth(), {
          body: JSON.stringify({
            name,
            public: publicClient,
            redirectUris: [redirectUrl],
            scopes,
          }),
          headers: {"content-type": "application/json"},
          method: "POST",
        }),
      );
      const next = result.client;
      setClients((current) => [{
        clientId: next.client_id,
        createdAt: next.client_id_issued_at
          ? new Date(next.client_id_issued_at * 1000).toISOString()
          : new Date().toISOString(),
        name: next.client_name || name,
        public: Boolean(next.public ?? publicClient),
        redirectUris: next.redirect_uris ?? [redirectUrl],
        scopes: next.scope?.split(" ").filter(Boolean) ?? scopes,
      }, ...current]);
      setCreateOpen(false);
      setCreated(next);
      showToast("OAuth app registered.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to register OAuth app.", "error");
    } finally {
      setSaving(false);
    }
  };

  const removeClient = async (client: OAuthClientSummary) => {
    if (!window.confirm(
      `Delete “${client.name}”? Its grants and tokens will be revoked immediately.`,
    )) return;
    const response = await fetch(ADMIN_URLS.ajaxOAuthClient(client.clientId), {
      method: "DELETE",
    });
    if (!response.ok) {
      showToast("Unable to delete OAuth app.", "error");
      return;
    }
    setClients((current) => current.filter(({clientId}) =>
      clientId !== client.clientId
    ));
    setConsents((current) => current.filter(({clientId}) =>
      clientId !== client.clientId
    ));
    showToast("OAuth app deleted and tokens revoked.", "success");
  };

  const revokeConsent = async (consent: OAuthConsentSummary) => {
    if (!window.confirm(
      `Revoke access for “${consent.clientName}”? It must be authorized again before it can access this instance.`,
    )) return;
    const response = await fetch(ADMIN_URLS.ajaxOAuthConsent(consent.id), {
      method: "DELETE",
    });
    if (!response.ok) {
      showToast("Unable to revoke this authorization.", "error");
      return;
    }
    setConsents((current) => current.filter(({id}) => id !== consent.id));
    showToast("Application access revoked.", "success");
  };

  if (!available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>OAuth Apps</CardTitle>
          <CardDescription>
            OAuth requires the built-in administrator email and password login.
            This instance can continue using API keys.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Registered OAuth apps</CardTitle>
              <CardDescription className="mt-1">
                Register third-party public or confidential clients. Redirect
                URLs are matched exactly and authorization-code flows require PKCE.
              </CardDescription>
            </div>
            <Button onClick={() => setCreateOpen(true)} type="button">
              <PlusIcon aria-hidden="true" /> Register app
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {clients.length ? (
            <ul className="divide-y">
              {clients.map((client) => (
                <li className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" key={client.clientId}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <KeyRoundIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                      <h2 className="font-medium">{client.name}</h2>
                      <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                        {client.public ? "Public" : "Confidential"}
                      </span>
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                      {client.clientId}
                    </p>
                    <p className="mt-2 break-all text-sm text-muted-foreground">
                      {client.redirectUris.join(", ")} · Created {displayDate(client.createdAt)}
                    </p>
                    <ScopeList scopes={client.scopes} />
                  </div>
                  <Button onClick={() => void removeClient(client)} size="sm" type="button" variant="destructive">
                    <Trash2Icon aria-hidden="true" /> Delete
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">No third-party OAuth apps are registered.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Authorized applications</CardTitle>
          <CardDescription>
            Revoking an authorization immediately invalidates its access and refresh tokens.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {consents.length ? (
            <ul className="divide-y">
              {consents.map((consent) => (
                <li className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" key={consent.id}>
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheckIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                      <h2 className="font-medium">{consent.clientName}</h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Authorized {displayDate(consent.updatedAt)}
                    </p>
                    <ScopeList scopes={consent.scopes} />
                  </div>
                  <Button onClick={() => void revokeConsent(consent)} size="sm" type="button" variant="outline">
                    Revoke access
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">No applications are currently authorized.</p>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register OAuth app</DialogTitle>
            <DialogDescription>
              Use a public client for installed software and a confidential client only when the app can protect a secret.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="oauth-app-name">Application name</Label>
              <Input id="oauth-app-name" onChange={(event) => setName(event.target.value)} value={name} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="oauth-redirect-url">Exact redirect URL</Label>
              <Input id="oauth-redirect-url" onChange={(event) => setRedirectUrl(event.target.value)} placeholder="https://app.example/callback" type="url" value={redirectUrl} />
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Client type</legend>
              <label className="flex items-center gap-2 text-sm">
                <input checked={publicClient} name="oauth-client-type" onChange={() => setPublicClient(true)} type="radio" />
                Public client (no secret)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input checked={!publicClient} name="oauth-client-type" onChange={() => setPublicClient(false)} type="radio" />
                Confidential client (secret shown once)
              </label>
            </fieldset>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Allowed permissions</legend>
              {Object.values(OAUTH_SCOPES).map((scope) => (
                <label className="flex items-start gap-2 text-sm" key={scope}>
                  <input checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} type="checkbox" />
                  <span>{OAUTH_SCOPE_DESCRIPTIONS[scope]}</span>
                </label>
              ))}
            </fieldset>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreateOpen(false)} type="button" variant="outline">Cancel</Button>
            <Button disabled={saving || !name.trim() || !redirectUrl.trim() || scopes.length === 0} onClick={() => void create()} type="button">
              {saving ? "Registering…" : "Register app"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setCreated(null)} open={Boolean(created)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>OAuth app registered</DialogTitle>
            <DialogDescription>
              Save these values now. A confidential client secret cannot be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Client ID</Label>
              <code className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{created?.client_id}</code>
            </div>
            {created?.client_secret && (
              <div className="grid gap-2">
                <Label>Client secret (shown once)</Label>
                <code className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{created.client_secret}</code>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setCreated(null)} type="button">I saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
