import {type ReactNode, useState} from "react";

import ApiDocsLinks from "@/components/admin/api/ApiDocsLinks";
import AdminSwitch from "@/components/admin/shared/AdminSwitch";
import SettingsBase from "@/components/admin/settings/SettingsBase";
import {showToast} from "@/client/ToastUtils";
import {
  type ApiAccessSettings,
  updateApiAccessEnabled,
} from "@/shared/Api";
import {API_BASE_PATH} from "@/shared/ApiVersion";
import {ADMIN_URLS} from "@/shared/StringUtils";

interface Props {
  initialSettings: ApiAccessSettings;
}

export default function ApiSettingsApp({initialSettings}: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);

  const save = async (next: ApiAccessSettings) => {
    const previous = settings;
    setSettings(next);
    setSaving(true);
    try {
      const response = await fetch(ADMIN_URLS.ajaxApiSettings(), {
        body: JSON.stringify(next),
        headers: {"content-type": "application/json"},
        method: "POST",
      });
      if (!response.ok) throw new Error("save failed");
      showToast("API settings updated.", "success");
    } catch {
      setSettings(previous);
      showToast("Failed to update API settings. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsBase
      description="Control integration access and public API docs."
      title="Availability"
    >
      <div>
        <SettingRow
          checked={settings.enabled}
          description={`Allow external integrations to call ${API_BASE_PATH}* with an API key. Turning this off also unpublishes the API docs and returns 404 for these routes, without affecting the dashboard or admin login.`}
          disabled={saving}
          label="Enable API access"
          onChange={(enabled) => save(updateApiAccessEnabled(settings, enabled))}
        />
        <div className="border-t pt-5">
          <div className="ml-4 divide-y border-l-2 border-border pl-5 sm:ml-6 sm:pl-6">
            <SettingRow
              checked={settings.publicDocsEnabled}
              description="Publish interactive API docs, OpenAPI files, and llms.txt files. Recommended for AI-agent workflows. API access must be enabled to publish these docs."
              disabled={saving || !settings.enabled}
              label="Publish API docs"
              onChange={(publicDocsEnabled) =>
                save({...settings, publicDocsEnabled})
              }
            >
              <ApiDocsLinks className="mt-2" />
            </SettingRow>
          </div>
        </div>
      </div>
    </SettingsBase>
  );
}

function SettingRow({
  checked,
  description,
  disabled,
  label,
  onChange,
  children,
}: {
  checked: boolean;
  children?: ReactNode;
  description: string;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
      <div className="max-w-3xl">
        <h2 className="font-medium">{label}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        {children}
      </div>
      <AdminSwitch
        checked={checked}
        disabled={disabled}
        label={checked ? "On" : "Off"}
        onCheckedChange={onChange}
      />
    </div>
  );
}
