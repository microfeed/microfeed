import {afterEach, describe, expect, it, vi} from "vitest";

import {
  scrollToAdminSettingsHash,
  scrollToAdminSettingsSection,
} from "@/client/AdminSettingsScroll";

afterEach(() => {
  vi.unstubAllGlobals();
});

function installElements({scrollable}: {scrollable: boolean}) {
  const scrollTo = vi.fn();
  const scrollIntoView = vi.fn();
  const scrollRoot = {
    clientHeight: scrollable ? 500 : 1_000,
    getBoundingClientRect: () => ({top: 50}),
    scrollHeight: 1_000,
    scrollTo,
    scrollTop: 100,
  };
  const section = {
    getBoundingClientRect: () => ({height: 200, top: 350}),
    scrollIntoView,
  };
  vi.stubGlobal("document", {
    getElementById: vi.fn((id: string) => {
      if (id === "admin-page-content") return scrollRoot;
      if (id === "media-file-storage" || id === "custom-code") return section;
      return null;
    }),
  });
  return {scrollIntoView, scrollTo};
}

describe("admin settings hash scrolling", () => {
  it("scrolls the desktop admin content panel to the requested section", () => {
    const {scrollIntoView, scrollTo} = installElements({scrollable: true});

    expect(scrollToAdminSettingsHash("#media-file-storage")).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({behavior: "auto", top: 376});
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("uses document scrolling when the admin content panel is not scrollable", () => {
    const {scrollIntoView, scrollTo} = installElements({scrollable: false});

    expect(scrollToAdminSettingsSection("media-file-storage")).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("uses standard top alignment for Website appearance & code", () => {
    const {scrollIntoView, scrollTo} = installElements({scrollable: true});

    expect(scrollToAdminSettingsSection("custom-code")).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({behavior: "auto", top: 376});
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("ignores unknown settings hashes", () => {
    const {scrollIntoView, scrollTo} = installElements({scrollable: true});

    expect(scrollToAdminSettingsHash("#missing-section")).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
