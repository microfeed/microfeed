import {adminUrl} from "./AdminPath";

export const ADMIN_API_PAGES = [
  {id: "overview", name: "API Overview", icon: "overview", path: "api"},
  {
    id: "authentication",
    name: "API Authentication",
    icon: "key",
    path: "api/auth",
  },
  {
    id: "oauth",
    name: "OAuth Apps",
    icon: "oauth",
    path: "api/oauth",
  },
  {
    id: "explorer",
    name: "API Explorer",
    icon: "explorer",
    path: "api/explorer",
  },
  {
    id: "settings",
    name: "API Settings",
    icon: "settings",
    path: "api/settings",
  },
] as const;

export type AdminApiPage = typeof ADMIN_API_PAGES[number];
export type AdminApiPageId = AdminApiPage["id"];

export function adminApiPageUrl(
  page: AdminApiPage,
  adminPath?: string,
): string {
  return adminUrl(page.path, adminPath);
}
