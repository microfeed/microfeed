import {useState} from "react";
import clsx from "clsx";
import {ExternalLinkIcon} from "lucide-react";

import AdminInput from "@/components/admin/shared/AdminInput";
import AdminSwitch from "@/components/admin/shared/AdminSwitch";
import {Button} from "@/components/ui/button";
import {Card, CardContent} from "@/components/ui/card";
import {showToast} from "@/client/ToastUtils";
import Requests from "@/client/requests";
import {SETTINGS_CATEGORIES} from "@/shared/Constants";
import {
  ADMIN_URLS,
  randomHex,
  randomShortUUID,
} from "@/shared/StringUtils";
import type {FeedContent} from "@/types";

interface ApiApp {
  createdAtMs: number;
  id: string;
  name: string;
  token: string;
}

interface ApiBundle {
  apps: ApiApp[];
  enabled: boolean;
}

interface Props {
  feed: FeedContent;
}

function initialApiBundle(feed: FeedContent): ApiBundle {
  const saved = feed.settings?.apiSettings;
  const savedApp = saved?.apps?.[0];
  return {
    enabled: saved?.enabled === true,
    apps: [{
      createdAtMs: typeof savedApp?.createdAtMs === "number"
        ? savedApp.createdAtMs
        : Date.now(),
      id: typeof savedApp?.id === "string" && savedApp.id
        ? savedApp.id
        : randomShortUUID(),
      name: typeof savedApp?.name === "string" && savedApp.name
        ? savedApp.name
        : "Default",
      token: typeof savedApp?.token === "string" && savedApp.token
        ? savedApp.token
        : randomHex(),
    }],
  };
}

export default function ApiSettingsApp({feed}: Props) {
  const [apiBundle, setApiBundle] = useState(() => initialApiBundle(feed));
  const [saving, setSaving] = useState(false);
  const app = apiBundle.apps[0]!;

  const saveBundle = async (nextBundle: ApiBundle) => {
    const previousBundle = apiBundle;
    setApiBundle(nextBundle);
    setSaving(true);
    try {
      await Requests.axiosPost(ADMIN_URLS.ajaxFeed(), {
        settings: {[SETTINGS_CATEGORIES.API_SETTINGS]: nextBundle},
      });
      showToast("API settings updated.", "success");
    } catch (error: any) {
      setApiBundle(previousBundle);
      showToast(
        error?.response
          ? "Failed to update API settings. Please try again."
          : "Network error. Please refresh the page and try again.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminSwitch
            checked={apiBundle.enabled}
            disabled={saving}
            label="API enabled"
            labelClassName={clsx(
              apiBundle.enabled ? "text-foreground" : "text-muted-foreground",
            )}
            onCheckedChange={(enabled) => saveBundle({...apiBundle, enabled})}
          />
          {saving && (
            <span aria-live="polite" className="text-xs text-muted-foreground">
              Saving...
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Use the API to create, update, and delete items in your feed.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <AdminInput
              customClass={clsx(
                "select-all font-mono text-sm",
                !apiBundle.enabled && "text-muted-foreground",
              )}
              disabled
              label="API key"
              value={app.token}
            />
          </div>
          <Button
            disabled={!apiBundle.enabled || saving}
            type="button"
            variant="outline"
            onClick={() => {
              if (window.confirm("Are you sure you want to reset the API key?")) {
                saveBundle({
                  ...apiBundle,
                  apps: [{...app, token: randomHex()}],
                });
              }
            }}
          >
            Reset key
          </Button>
        </div>
        <p className="mt-3 break-all text-xs text-muted-foreground">
          Set the <code>X-MicrofeedAPI-Key</code> request header to this key.
        </p>

        <div className="mt-8 flex flex-col items-start gap-3 text-sm">
          <a
            className="inline-flex items-center gap-1.5"
            href="/json/openapi.html"
            rel="noopener noreferrer"
            target="_blank"
          >
            API documentation
            <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
          </a>
          <a
            className="inline-flex items-center gap-1.5"
            href="/json/openapi.yaml"
            rel="noopener noreferrer"
            target="_blank"
          >
            OpenAPI specification (YAML)
            <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
