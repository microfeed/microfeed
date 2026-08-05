export const ADMIN_SETTINGS_SECTIONS = [
  {
    icon: "activity",
    id: "tracking-urls",
    name: "Tracking URLs",
  },
  {
    icon: "shield",
    id: "access-control",
    name: "Access control",
  },
  {
    icon: "rss",
    id: "subscribe-methods",
    name: "Subscribe methods",
  },
  {
    icon: "storage",
    id: "media-file-storage",
    name: "Media file storage",
  },
  {
    icon: "list",
    id: "items-settings",
    name: "Items settings",
  },
  {
    icon: "image",
    id: "favicon",
    name: "Favicon",
  },
  {
    icon: "code",
    id: "custom-code",
    name: "Custom code",
  },
] as const;

export type AdminSettingsSection = typeof ADMIN_SETTINGS_SECTIONS[number];

export function filterAdminSettingsSections(
  query: string,
): readonly AdminSettingsSection[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return ADMIN_SETTINGS_SECTIONS;
  }

  return ADMIN_SETTINGS_SECTIONS.filter((section) =>
    section.name.toLocaleLowerCase().includes(normalizedQuery)
  );
}
