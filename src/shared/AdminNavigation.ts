import {NAV_ITEMS, NAV_ITEMS_DICT} from "./Constants";
import {adminUrl} from "./AdminPath";
import type {OnboardingResult} from "../types";

export type AdminNavItemId = typeof NAV_ITEMS[keyof typeof NAV_ITEMS];

export interface AdminNavigationItem {
  active: boolean;
  disabled: boolean;
  id: AdminNavItemId;
  name: string;
  url: string;
}

const NAVIGATION_PATHS: Array<[AdminNavItemId, string]> = [
  [NAV_ITEMS.ADMIN_HOME, ""],
  [NAV_ITEMS.EDIT_CHANNEL, "channels/primary"],
  [NAV_ITEMS.ALL_ITEMS, "items/list"],
  [NAV_ITEMS.PAGES, "pages"],
  [NAV_ITEMS.SITE_FILES, "site-files"],
  [NAV_ITEMS.CATEGORIES, "categories"],
  [NAV_ITEMS.SERIES, "series"],
  [NAV_ITEMS.CONTACT_MESSAGES, "contact-messages"],
  [NAV_ITEMS.MEDIA_LIBRARY, "media-library"],
  [NAV_ITEMS.API, "api"],
  [NAV_ITEMS.WEBHOOKS, "webhooks"],
  [NAV_ITEMS.SETTINGS, "settings"],
];

export function getAdminNavigationItems(
  adminPath: string,
  activeNavItem: AdminNavItemId | null,
  onboardingResult: Pick<OnboardingResult, "requiredOk">,
): AdminNavigationItem[] {
  return NAVIGATION_PATHS.map(([id, path]) => ({
    active: id === activeNavItem,
    disabled: id !== NAV_ITEMS.ADMIN_HOME && !onboardingResult.requiredOk,
    id,
    name: NAV_ITEMS_DICT[id].name,
    url: adminUrl(path, adminPath),
  }));
}
