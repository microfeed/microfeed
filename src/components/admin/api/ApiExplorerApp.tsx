import {useState} from "react";

import ApiReference from "@/components/api/ApiReference";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import type {ApiAccessSettings, ApiKeyRecord} from "@/shared/Api";

interface Props {
  authenticationUrl: string;
  document: Record<string, unknown>;
  initialApiKeys: ApiKeyRecord[];
  origin: string;
  settings: ApiAccessSettings;
  settingsUrl: string;
}

export default function ApiExplorerApp({
  authenticationUrl,
  document,
  initialApiKeys,
  origin,
  settings,
  settingsUrl,
}: Props) {
  const [selectedId, setSelectedId] = useState(initialApiKeys[0]?.id ?? "");
  const selected = initialApiKeys.find(({id}) => id === selectedId);
  const disabled = !settings.enabled || !selected;

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-sm">
          <Label htmlFor="api-key-select">API key for test requests</Label>
          <select
            className="mt-2 h-10 w-full rounded-[10px] border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            id="api-key-select"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {!initialApiKeys.length && <option value="">No API keys</option>}
            {initialApiKeys.map((apiKey) => (
              <option key={apiKey.id} value={apiKey.id}>{apiKey.name}</option>
            ))}
          </select>
        </div>
        {!settings.enabled ? (
          <p className="text-sm text-muted-foreground">
            API access is disabled. <a className="underline" href={settingsUrl}>Enable it in API Settings</a> to send requests.
          </p>
        ) : !selected ? (
          <Button render={<a href={authenticationUrl} />}>Create an API key</Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            This API key stays in memory and is never stored by the explorer.
          </p>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border bg-background">
        <ApiReference
          key={`${selected?.id ?? "none"}-${settings.enabled}`}
          apiKey={selected?.apiKey}
          document={document}
          followDocumentColorMode
          origin={origin}
          pinSidebarFooterToPageBottom
          requestsDisabled={disabled}
        />
      </div>
    </div>
  );
}
