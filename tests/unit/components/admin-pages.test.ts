import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";

import {reorderNavigationPageList} from "@/components/admin/pages/PagesApp";
import {
  pageNavigationEnabledForStatus,
  type PageRecord,
} from "@/shared/Pages";

const routeSource = (path: string) => readFile(
  new URL(`../../../src/pages/[adminPath]/pages/${path}/index.astro`, import.meta.url),
  "utf8",
);

describe("admin Page editor routes", () => {
  it("keeps the Quill-based editor out of server rendering", async () => {
    const [newRoute, existingRoute] = await Promise.all([
      routeSource("new"),
      routeSource("[pageId]"),
    ]);

    expect(newRoute).toContain('<PageEditorApp client:only="react"');
    expect(existingRoute).toContain('<PageEditorApp client:only="react"');
    expect(newRoute).not.toContain("<PageEditorApp client:load");
    expect(existingRoute).not.toContain("<PageEditorApp client:load");
  });

  it("delegates one-segment public paths away from the admin home", async () => {
    const adminIndex = await readFile(
      new URL("../../../src/pages/[adminPath]/index.astro", import.meta.url),
      "utf8",
    );

    expect(adminIndex).toContain("loadPublicPageRoute");
    expect(adminIndex).toContain('routeAdminPath === normalizeAdminPath(');
    expect(adminIndex).not.toContain(
      'import AdminShell from "../../layouts/AdminShell.astro"',
    );
    expect(adminIndex).toContain(
      '(await import("../../layouts/AdminShell.astro")).default',
    );
    expect(adminIndex).toContain("<PublicLayout {...publicPage.layout} />");
    expect(adminIndex).toContain("Astro.response.status = publicPage.status");
  });

  it("keeps admin styles out of nested public Page routes", async () => {
    const route = await readFile(
      new URL("../../../src/pages/[...path].astro", import.meta.url),
      "utf8",
    );

    expect(route).not.toContain(
      'import AdminShell from "@/layouts/AdminShell.astro"',
    );
    expect(route).toContain(
      '(await import("@/layouts/AdminShell.astro")).default',
    );
    expect(route).toContain("<PublicLayout {...publicPage.layout} />");
  });

  it("loads the admin canvas stylesheet only inside admin documents", async () => {
    const [adminShell, loginShell] = await Promise.all([
      readFile(
        new URL("../../../src/layouts/AdminShell.astro", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../../../src/layouts/AdminLoginShell.astro", import.meta.url),
        "utf8",
      ),
    ]);

    for (const shell of [adminShell, loginShell]) {
      expect(shell).not.toContain('import "@/styles/admin.css"');
      expect(shell).toContain('"@/styles/admin-stylesheet"');
      expect(shell).toContain(
        '<link rel="stylesheet" href={adminStylesheetUrl} />',
      );
    }
  });

  it("locks the default 404 Page controls in the editor", async () => {
    const editor = await readFile(
      new URL(
        "../../../src/components/admin/pages/PageEditorApp.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(editor).toContain("page?.is_not_found_page");
    expect(editor).toContain("Default 404 Page");
    expect(editor).toContain("page && !isNotFoundPage");
  });

  it("clears the synchronous dirty guard before opening a created Page", async () => {
    const editor = await readFile(
      new URL(
        "../../../src/components/admin/pages/PageEditorApp.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(editor).toContain("preventCloseWhenChanged(() => changedRef.current)");
    expect(editor).toContain("changedRef.current = value");
    expect(editor.indexOf("markChanged(false)"))
      .toBeLessThan(editor.indexOf("window.location.assign(ADMIN_URLS.editPage(saved.id))"));
    expect(editor.indexOf(
      "window.sessionStorage.setItem(PAGE_CREATED_TOAST_KEY, saved.id)",
    )).toBeLessThan(editor.indexOf(
      "window.location.assign(ADMIN_URLS.editPage(saved.id))",
    ));
  });

  it("shows a one-time success toast after opening a created Page", async () => {
    const editor = await readFile(
      new URL(
        "../../../src/components/admin/pages/PageEditorApp.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(editor).toContain(
      "window.sessionStorage.getItem(PAGE_CREATED_TOAST_KEY) !== page.id",
    );
    expect(editor).toContain(
      "window.sessionStorage.removeItem(PAGE_CREATED_TOAST_KEY)",
    );
    expect(editor).toContain('showToast("Page created.", "success")');
  });

  it("explains and disables Page navigation details when it is off", async () => {
    const editor = await readFile(
      new URL(
        "../../../src/components/admin/pages/PageEditorApp.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(editor).toContain("Search and social description");
    expect(editor).toContain("AdminHelpLabel");
    expect(editor).toContain("Plain text for search results and link previews.");
    expect(editor).toContain('placeholder="e.g., about"');
    expect(editor).toContain("One top-level path only. Slashes are removed automatically");
    expect(editor).not.toContain("leave blank to use the title");
    expect(editor).not.toContain("slugifyPageTitle");
    expect(editor).toContain('placeholder="e.g., About"');
    expect(editor).toContain("Enter a URL path, such as about.");
    expect(editor).toContain("Enter a navigation label, or turn off Show in navigation.");
    expect(editor).toContain("Page navigation is website-only");
    expect(editor).toContain("Choose how people can find and open this Page.");
    expect(editor).toContain("turns off and disables Show in navigation.");
    expect(editor).toContain("return to the Pages screen and drag");
    expect(editor).not.toContain("Navigation order");
    expect(editor).not.toContain("navigation_order");
    expect(editor).toContain("disabled={!draft.show_in_navigation}");
    expect(editor).toContain('disabled={draft.status === "unlisted"}');
  });

  it("always turns navigation off for Unlisted Pages", () => {
    expect(pageNavigationEnabledForStatus("published", true)).toBe(true);
    expect(pageNavigationEnabledForStatus("unpublished", true)).toBe(true);
    expect(pageNavigationEnabledForStatus("unlisted", true)).toBe(false);
    expect(pageNavigationEnabledForStatus("unlisted", false)).toBe(false);
    expect(pageNavigationEnabledForStatus(4, true)).toBe(false);
  });

  it("reorders website navigation before or after the hovered Page", () => {
    const pages = ["about", "contact", "press"].map((id) => ({
      id,
    })) as PageRecord[];

    expect(reorderNavigationPageList(pages, "press", "about", "before")
      .map(({id}) => id)).toEqual(["press", "about", "contact"]);
    expect(reorderNavigationPageList(pages, "about", "press", "after")
      .map(({id}) => id)).toEqual(["contact", "press", "about"]);
  });

  it("puts drag ordering on the Pages list instead of the Page editor", async () => {
    const list = await readFile(
      new URL(
        "../../../src/components/admin/pages/PagesApp.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(list).toContain("Website navigation");
    expect(list).toContain("GripVerticalIcon");
    expect(list).toContain("ajaxPageOrder");
    expect(list).toContain('event.key === "ArrowUp"');
    expect(list).toContain('event.key === "ArrowDown"');
  });

  it("uses the editable Page for the explicit /404/ preview", async () => {
    const route = await readFile(
      new URL("../../../src/pages/404.astro", import.meta.url),
      "utf8",
    );

    expect(route).toContain(
      'loadPublicPageRoute(env, Astro.request, "404")',
    );
    expect(route).toContain("Astro.response.status = 404");
    expect(route).toContain("<PublicLayout {...publicPage.layout} />");
  });
});
