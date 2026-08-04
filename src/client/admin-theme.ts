import {
  ADMIN_THEME_STORAGE_KEY,
  parseAdminTheme,
  resolveAdminTheme,
  type AdminTheme,
} from "@/shared/AdminTheme";

export const ADMIN_THEME_CHANGE_EVENT = "microfeed:admin-theme-change";

export function currentAdminTheme(): AdminTheme {
  try {
    return parseAdminTheme(window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY));
  } catch {
    return "light";
  }
}

export function applyAdminTheme(preference = currentAdminTheme()): void {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveAdminTheme(preference, systemDark);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.dataset.adminTheme = preference;
  document.documentElement.dataset.colorMode = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function setAdminTheme(preference: AdminTheme): void {
  try {
    window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, preference);
  } catch {
    // The theme still applies for this page when storage is unavailable.
  }
  applyAdminTheme(preference);
  window.dispatchEvent(new CustomEvent(ADMIN_THEME_CHANGE_EVENT, {
    detail: {preference},
  }));
}
