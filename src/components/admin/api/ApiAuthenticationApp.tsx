import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import {useState} from "react";

import AdminSwitch from "@/components/admin/shared/AdminSwitch";
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
import {showToast} from "@/client/ToastUtils";
import {
  API_KEY_SCOPES,
  type ApiAccessSettings,
  type ApiKeyRecord,
  type ApiKeyScope,
  updateApiAccessEnabled,
} from "@/shared/Api";
import {API_BASE_PATH} from "@/shared/ApiVersion";
import {ADMIN_URLS} from "@/shared/StringUtils";

interface Props {
  initialApiKeys: ApiKeyRecord[];
  initialSettings: ApiAccessSettings;
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & {error?: string};
  if (!response.ok) {
    throw new Error(body.error ?? "The request failed.");
  }
  return body;
}

function maskedApiKey(apiKey: string): string {
  return `${apiKey.slice(0, 3)}${"•".repeat(18)}${apiKey.slice(-6)}`;
}

export function shouldShowApiAccessControls(
  settings: ApiAccessSettings,
): boolean {
  return !settings.enabled;
}

export default function ApiAuthenticationApp({
  initialApiKeys,
  initialSettings,
}: Props) {
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [settings, setSettings] = useState(initialSettings);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiKeyScope[]>(["content:read"]);
  const [createSettings, setCreateSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const openCreate = () => {
    setName("");
    setScopes(["content:read"]);
    setCreateSettings(settings);
    setCreateOpen(true);
  };

  const create = async () => {
    if (!createSettings.enabled) return;
    setSaving(true);
    try {
      const result = await responseJson<{
        apiKey: ApiKeyRecord;
        settings: ApiAccessSettings;
      }>(await fetch(ADMIN_URLS.ajaxApiKeys(), {
        body: JSON.stringify({name, scopes, settings: createSettings}),
        headers: {"content-type": "application/json"},
        method: "POST",
      }));
      setApiKeys((current) => [result.apiKey, ...current]);
      setSettings(result.settings);
      setRevealed((current) => new Set(current).add(result.apiKey.id));
      setCreateOpen(false);
      showToast("API key created.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to create API key.", "error");
    } finally {
      setSaving(false);
    }
  };

  const replaceApiKey = (next: ApiKeyRecord) => {
    setApiKeys((current) => current.map((entry) =>
      entry.id === next.id ? next : entry
    ));
  };

  const rename = async (apiKey: ApiKeyRecord) => {
    const nextName = window.prompt("Name this API key", apiKey.name)?.trim();
    if (!nextName || nextName === apiKey.name) return;
    try {
      const result = await responseJson<{apiKey: ApiKeyRecord}>(
        await fetch(ADMIN_URLS.ajaxApiKey(apiKey.id), {
          body: JSON.stringify({name: nextName}),
          headers: {"content-type": "application/json"},
          method: "PATCH",
        }),
      );
      replaceApiKey(result.apiKey);
      showToast("API key renamed.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to rename API key.", "error");
    }
  };

  const rotate = async (apiKey: ApiKeyRecord) => {
    if (!window.confirm(
      `Rotate “${apiKey.name}”? Existing integrations using this API key will stop working immediately.`,
    )) return;
    try {
      const result = await responseJson<{apiKey: ApiKeyRecord}>(
        await fetch(ADMIN_URLS.ajaxRotateApiKey(apiKey.id), {method: "POST"}),
      );
      replaceApiKey(result.apiKey);
      setRevealed((current) => new Set(current).add(apiKey.id));
      showToast("API key rotated.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to rotate API key.", "error");
    }
  };

  const revoke = async (apiKey: ApiKeyRecord) => {
    if (!window.confirm(
      `Revoke “${apiKey.name}”? This cannot be undone and integrations using it will stop working immediately.`,
    )) return;
    try {
      await responseJson<Record<string, never>>(
        await fetch(ADMIN_URLS.ajaxApiKey(apiKey.id), {method: "DELETE"}),
      );
      setApiKeys((current) => current.filter(({id}) => id !== apiKey.id));
      showToast("API key revoked.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to revoke API key.", "error");
    }
  };

  const copy = async (apiKey: string) => {
    await navigator.clipboard.writeText(apiKey);
    showToast("API key copied.", "success");
  };

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>API keys</CardTitle>
              <CardDescription className="mt-1">
                Use a separate named API key for each integration so it can be
                rotated or revoked independently.
              </CardDescription>
            </div>
            <Button onClick={openCreate} type="button">
              <PlusIcon aria-hidden="true" />
              Create API key
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {apiKeys.length ? (
            <ul className="divide-y">
              {apiKeys.map((apiKey) => {
                const visible = revealed.has(apiKey.id);
                return (
                  <li className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" key={apiKey.id}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <KeyRoundIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                        <h2 className="truncate font-medium">{apiKey.name}</h2>
                      </div>
                      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                        <code className="max-w-full overflow-x-auto rounded-md bg-muted px-2 py-1 text-xs">
                          {visible ? apiKey.apiKey : maskedApiKey(apiKey.apiKey)}
                        </code>
                        <Button
                          aria-label={visible ? "Hide API key" : "Reveal API key"}
                          onClick={() => setRevealed((current) => {
                            const next = new Set(current);
                            if (next.has(apiKey.id)) next.delete(apiKey.id);
                            else next.add(apiKey.id);
                            return next;
                          })}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          {visible ? <EyeOffIcon /> : <EyeIcon />}
                        </Button>
                        <Button aria-label="Copy API key" onClick={() => copy(apiKey.apiKey)} size="icon-sm" type="button" variant="ghost">
                          <CopyIcon />
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {apiKey.scopes.includes("content:write") ? "Read and write" : "Read only"}
                        {" · "}Created {new Date(apiKey.createdAtMs).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => rename(apiKey)} size="sm" type="button" variant="outline"><PencilIcon />Rename</Button>
                      <Button onClick={() => rotate(apiKey)} size="sm" type="button" variant="outline"><RefreshCwIcon />Rotate</Button>
                      <Button className="text-destructive hover:text-destructive" onClick={() => revoke(apiKey)} size="sm" type="button" variant="outline"><Trash2Icon />Revoke</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-10 text-center">
              <KeyRoundIcon aria-hidden="true" className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No API keys yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">Create one to connect an integration or use API Explorer.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Give this API key a name that identifies the integration using it.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="api-key-name">Name</Label>
            <Input
              aria-describedby="api-key-name-examples"
              autoFocus
              className="mt-2"
              id="api-key-name"
              maxLength={80}
              placeholder="e.g. Publishing automation"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p
              className="mt-2 text-xs text-muted-foreground"
              id="api-key-name-examples"
            >
              Examples: publishing automation, an AI coding agent, a mobile
              app, or content backup.
            </p>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Permissions</legend>
            <div className="mt-2 grid gap-2 rounded-lg border p-3">
              {API_KEY_SCOPES.map((scope) => (
                <label className="flex items-start gap-3" key={scope}>
                  <input
                    checked={scopes.includes(scope)}
                    className="mt-1 size-4"
                    onChange={(event) => setScopes((current) =>
                      event.target.checked
                        ? [...new Set([...current, scope])]
                        : current.filter((value) => value !== scope)
                    )}
                    type="checkbox"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {scope === "content:read" ? "Read content" : "Write content"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {scope === "content:read"
                        ? "Read feeds, items, Pages, Site Files, and search."
                        : "Create, update, publish, and delete content and prepare uploads."}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {!scopes.length && (
              <p className="mt-2 text-xs text-destructive">
                Choose at least one permission.
              </p>
            )}
          </fieldset>
          {shouldShowApiAccessControls(settings) && (
            <div className="grid gap-4 rounded-xl border bg-muted/30 p-4">
              <div>
                <AdminSwitch
                  checked={createSettings.enabled}
                  disabled={saving}
                  label="Enable API access"
                  onCheckedChange={(enabled) => setCreateSettings((current) =>
                    updateApiAccessEnabled(current, enabled)
                  )}
                />
                {!createSettings.enabled && (
                  <p className="mt-2 text-xs text-destructive">
                    API access must be enabled before an API key can be created.
                  </p>
                )}
              </div>
              <div>
                <AdminSwitch
                  checked={createSettings.publicDocsEnabled}
                  disabled={saving}
                  label="Publish API docs"
                  onCheckedChange={(publicDocsEnabled) =>
                    setCreateSettings((current) =>
                      ({...current, publicDocsEnabled})
                    )}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Optional, but recommended for AI-agent workflows using
                  {" "}<code>{API_BASE_PATH}llms-full.txt</code>.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button disabled={saving} onClick={() => setCreateOpen(false)} type="button" variant="outline">Cancel</Button>
            <Button disabled={saving || !createSettings.enabled || !name.trim() || !scopes.length} onClick={create} type="button">
              Create API key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
