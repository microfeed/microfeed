import {CheckIcon, CopyIcon, ExternalLinkIcon, KeyRoundIcon} from "lucide-react";
import {useState} from "react";

import ApiDocsLinks from "@/components/admin/api/ApiDocsLinks";
import ApiTryIt from "@/components/admin/api/ApiTryIt";
import AdminSectionCard from "@/components/admin/shared/AdminSectionCard";
import {Button} from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {showToast} from "@/client/ToastUtils";
import type {ApiAccessSettings, ApiKeyRecord} from "@/shared/Api";
import {API_BASE_PATH} from "@/shared/ApiVersion";

interface Props {
  apiKeys: ApiKeyRecord[];
  authenticationUrl: string;
  explorerUrl: string;
  llmsFullUrl: string;
  settings: ApiAccessSettings;
  settingsUrl: string;
}

export default function ApiOverviewApp({
  apiKeys,
  authenticationUrl,
  explorerUrl,
  llmsFullUrl,
  settings,
  settingsUrl,
}: Props) {
  const [copied, setCopied] = useState(false);
  const prompt = `Read ${llmsFullUrl} so I can ask you questions and build with this microfeed API.`;
  const promptAvailable = settings.enabled && settings.publicDocsEnabled;
  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    showToast("Prompt copied.", "success");
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid gap-5 pb-[50vh]">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatusCard label="API access" enabled={settings.enabled} />
        <StatusCard
          label="Public API docs"
          enabled={settings.enabled && settings.publicDocsEnabled}
        />
        <Card size="sm">
          <CardHeader>
            <CardDescription>Active API keys</CardDescription>
            <CardTitle className="text-2xl">{apiKeys.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminSectionCard
          description={
            <>
              Create an API key, then explore requests and generated examples in
              your browser.
            </>
          }
          title="Start building"
        >
            <div className="flex flex-wrap gap-3">
              <Button render={<a href={authenticationUrl} />}>
                <KeyRoundIcon aria-hidden="true" />
                Manage API keys
              </Button>
              <Button render={<a href={explorerUrl} />} variant="outline">
                Open API Explorer
                <ExternalLinkIcon aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-5 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground">
                API docs for people and AI agents
              </p>
              <ApiDocsLinks className="mt-2" />
            </div>
        </AdminSectionCard>

        <AdminSectionCard
          description={
            <>
              Copy this prompt into a coding agent to give it the complete API
              contract for this instance.
            </>
          }
          title="Build with an AI coding agent"
        >
            <div className="relative rounded-xl border bg-muted/40 p-4 pr-14 pb-12 font-mono text-sm leading-6">
              {prompt}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label="Copy this prompt"
                      className="absolute right-3 bottom-3"
                      disabled={!promptAvailable}
                      onClick={copy}
                      size="icon-sm"
                      type="button"
                      variant="outline"
                    >
                      {copied
                        ? <CheckIcon aria-hidden="true" />
                        : <CopyIcon aria-hidden="true" />}
                    </Button>
                  }
                />
                <TooltipContent>Copy this prompt</TooltipContent>
              </Tooltip>
            </div>
            {!promptAvailable && (
              <p className="mt-4 text-sm text-muted-foreground">
                <a className="underline underline-offset-4" href={settingsUrl}>
                  Enable API access and publish API docs
                </a>{" "}
                to use this prompt.
              </p>
            )}
        </AdminSectionCard>
      </div>

      <ApiTryIt
        apiKeys={apiKeys}
        authenticationUrl={authenticationUrl}
        endpointUrl={new URL(
          `${API_BASE_PATH}feed/?limit=3`,
          llmsFullUrl,
        ).toString()}
        settings={settings}
        settingsUrl={settingsUrl}
      />
    </div>
  );
}

function StatusCard({enabled, label}: {enabled: boolean; label: string}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={enabled ? "text-emerald-600" : "text-muted-foreground"}>
          {enabled ? "Enabled" : "Disabled"}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
