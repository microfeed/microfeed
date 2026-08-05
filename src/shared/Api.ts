export interface ApiAccessSettings {
  enabled: boolean;
  publicDocsEnabled: boolean;
}

export interface ApiKeyRecord {
  apiKey: string;
  createdAtMs: number;
  id: string;
  name: string;
  updatedAtMs: number;
}

export function updateApiAccessEnabled(
  settings: ApiAccessSettings,
  enabled: boolean,
): ApiAccessSettings {
  return {
    ...settings,
    enabled,
    publicDocsEnabled: enabled ? settings.publicDocsEnabled : false,
  };
}

export function resolveApiAccessSettings(value: unknown): ApiAccessSettings {
  const settings = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const enabled = settings.enabled === true;
  return {
    enabled,
    publicDocsEnabled: typeof settings.publicDocsEnabled === "boolean"
      ? settings.publicDocsEnabled
      : enabled,
  };
}
