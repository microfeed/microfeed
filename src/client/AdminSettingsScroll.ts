import {ADMIN_SETTINGS_SECTIONS} from "@/shared/AdminSettingsNavigation";

interface ScrollToAdminSettingsSectionOptions {
  behavior?: ScrollBehavior;
  offset?: number;
}

export function scrollToAdminSettingsSection(
  sectionId: string,
  {
    behavior = "auto",
    offset = 24,
  }: ScrollToAdminSettingsSectionOptions = {},
): boolean {
  if (!ADMIN_SETTINGS_SECTIONS.some(({id}) => id === sectionId)) {
    return false;
  }

  const element = document.getElementById(sectionId);
  const scrollRoot = document.getElementById("admin-page-content");
  if (!element || !scrollRoot) {
    return false;
  }

  if (scrollRoot.scrollHeight <= scrollRoot.clientHeight) {
    element.scrollIntoView({behavior, block: "start"});
    return true;
  }

  const top = scrollRoot.scrollTop +
    element.getBoundingClientRect().top -
    scrollRoot.getBoundingClientRect().top -
    offset;
  scrollRoot.scrollTo({behavior, top});
  return true;
}

export function scrollToAdminSettingsHash(
  hash = window.location.hash,
  options?: ScrollToAdminSettingsSectionOptions,
): boolean {
  if (!hash.startsWith("#")) {
    return false;
  }

  return scrollToAdminSettingsSection(
    decodeURIComponent(hash.slice(1)),
    options,
  );
}
