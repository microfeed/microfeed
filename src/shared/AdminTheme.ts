export const ADMIN_THEME_STORAGE_KEY = "microfeed-admin-theme";

export const ADMIN_THEMES = ["system", "light", "dark"] as const;

export type AdminTheme = typeof ADMIN_THEMES[number];
export type ResolvedAdminTheme = Exclude<AdminTheme, "system">;

export function parseAdminTheme(value: string | null): AdminTheme {
  return ADMIN_THEMES.includes(value as AdminTheme)
    ? value as AdminTheme
    : "light";
}

export function resolveAdminTheme(
  preference: AdminTheme,
  systemDark: boolean,
): ResolvedAdminTheme {
  return preference === "system"
    ? (systemDark ? "dark" : "light")
    : preference;
}
