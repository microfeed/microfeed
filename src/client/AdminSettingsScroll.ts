import {ADMIN_SETTINGS_SECTIONS} from "@/shared/AdminSettingsNavigation";

interface ScrollToAdminSettingsSectionOptions {
  behavior?: ScrollBehavior;
  offset?: number;
}

function settingsSectionOffset(
  sectionId: string,
  elementHeight: number,
  scrollRootHeight: number,
  defaultOffset: number,
): number {
  if (sectionId !== "custom-code") {
    return defaultOffset;
  }
  return Math.max(defaultOffset, (scrollRootHeight - elementHeight) / 2);
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
    element.scrollIntoView({
      behavior,
      block: sectionId === "custom-code" ? "center" : "start",
    });
    return true;
  }

  const elementBounds = element.getBoundingClientRect();
  const effectiveOffset = settingsSectionOffset(
    sectionId,
    elementBounds.height,
    scrollRoot.clientHeight,
    offset,
  );
  const top = scrollRoot.scrollTop +
    elementBounds.top -
    scrollRoot.getBoundingClientRect().top -
    effectiveOffset;
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
