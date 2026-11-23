import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Switch} from "@/components/ui/switch";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {showToast} from "@/client/ToastUtils";
import {adminUrl} from "@/shared/AdminPath";
import type {McpSettings} from "@/shared/Mcp";

interface Props {
  initialSettings: McpSettings;
  endpoint: string;
  adminPath: string;
  enablementError: string | null;
}

export default function McpServerApp({initialSettings, endpoint, adminPath, enablementError}: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (enabled: boolean) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(adminUrl("ajax/mcp/settings", adminPath), {
        method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({enabled}),
      });
      const data = await response.json() as {settings?: McpSettings; error?: string};
      if (!response.ok || !data.settings) throw new Error(data.error ?? "Unable to update MCP settings.");
      setSettings(data.settings);
      showToast(enabled ? "MCP server enabled." : "MCP server disabled.", "success");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to update MCP settings.");
    } finally { setSaving(false); }
  };
  return <div className="grid gap-6">
    <Card>
      <CardHeader><CardTitle>MCP server</CardTitle></CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex items-start justify-between gap-5">
          <div><label className="font-medium" htmlFor="enable-mcp">Enable MCP server</label>
            <p className="mt-1 text-sm text-muted-foreground">Let AI apps read and manage this microfeed after you sign in and approve their permissions. This setting is independent of REST API access.</p>
          </div>
          <Switch id="enable-mcp" checked={settings.enabled} disabled={saving || Boolean(enablementError && !settings.enabled)} onCheckedChange={enabled => void save(enabled)} />
        </div>
        {enablementError && <p className="text-sm text-muted-foreground">{enablementError}</p>}
        <p className="text-sm">Status: <strong>{settings.enabled ? "Enabled" : "Disabled"}</strong></p>
        <div><p className="mb-2 text-sm font-medium">Server URL</p><div className="flex flex-wrap items-center gap-3">
          <code className="min-w-0 break-all rounded-md bg-muted px-3 py-2 text-sm">{endpoint}</code>
          <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(endpoint).then(() => showToast("Server URL copied.", "success"), () => setError("Unable to copy the URL. Select and copy it manually."))}>Copy URL</Button>
        </div></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Connect an app</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm leading-6">
      <ol className="list-decimal space-y-2 pl-5"><li>Enable the MCP server.</li><li>Add the server URL to your desktop or hosted AI app using Streamable HTTP.</li><li>Sign in to this microfeed in the browser and review the permissions before choosing Allow.</li></ol>
      <p>New connections request read and write access so your app can create items after you approve. Read permission allows content lookup. Write permission includes creating, publishing, updating, and deleting items, Pages, tags, and Site Files. Media tools prepare uploads; your app uploads the bytes separately.</p>
      <p>Manage and revoke connections in <a className="underline underline-offset-4" href={adminUrl("account", adminPath)}>Account settings → App access</a>. Turning off the MCP server immediately blocks MCP requests.</p>
      <p>Direct calls from apps on other browser origins are blocked. Dashboard WebMCP tools remain separate.</p>
      <a className="underline underline-offset-4" href="https://docs.microfeed.org/automation/mcp/" target="_blank" rel="noopener noreferrer">MCP connection guide</a>
    </CardContent></Card>
  </div>;
}
