import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";

const source = (filename: string) => readFile(
  new URL(`../../../src/${filename}`, import.meta.url),
  "utf8",
);

describe("Admin versioned themes", () => {
  it("keeps draft and inactive previews sandboxed without same-origin access", async () => {
    const [themes, drafts, preview] = await Promise.all([
      source("components/admin/themes/ThemesApp.tsx"),
      source("components/admin/themes/ThemeDraftEditorApp.tsx"),
      source("components/admin/themes/ThemePreviewDialog.tsx"),
    ]);
    expect(themes).toContain("ThemePreviewDialog");
    expect(drafts).toContain("ThemePreviewDialog");
    expect(preview).toContain('sandbox="allow-scripts"');
    expect(preview).not.toContain("allow-same-origin");
    expect(preview).toContain("h-dvh w-dvw");
    expect(preview).toContain("Theme is loading…");
    expect(preview).toContain('aria-live="polite"');
    expect(preview).toContain('role="status"');
    expect(preview).toContain("LoaderCircleIcon");
    expect(preview).toContain("onLoad={() => setLoadedFrameKey(frameKey)}");
    expect(preview).toContain("const loading = loadedFrameKey !== frameKey");
    expect(preview).toContain('data: dataSource');
    expect(preview).toContain('"Demo content"');
    expect(preview).toContain('"Current site"');
    expect(preview).toContain('hasPreviewFixture ? "fixture" : "site"');
    expect(preview).toContain(
      "Live search is unavailable in preview. Showing preview results instead.",
    );
  });

  it("keeps installation separate from activation", async () => {
    const [draftEditor, adminStyles] = await Promise.all([
      source("components/admin/themes/ThemeDraftEditorApp.tsx"),
      source("styles/admin.css"),
    ]);
    expect(draftEditor).toContain('action: "publish"');
    expect(draftEditor).not.toContain('action: "activate"');
    expect(draftEditor).toContain('"Install"');
    expect(draftEditor).not.toContain("Publish inactive version");
    const saveIndex = draftEditor.indexOf('{busy ? "Saving…" : "Save draft"}');
    const previewIndex = draftEditor.indexOf("onClick={preview}");
    const installIndex = draftEditor.indexOf('{busy ? "Installing…" : "Install"}');
    expect(saveIndex).toBeGreaterThan(draftEditor.indexOf("onClick={discard}"));
    expect(previewIndex).toBeGreaterThan(saveIndex);
    expect(previewIndex).toBeLessThan(installIndex);
    expect(draftEditor).toContain('className="theme-preview-button"');
    expect(draftEditor).toContain("if (changed) await save({notify: false});");
    expect(draftEditor).toContain(
      "hasPreviewFixture={Boolean(draft.manifest.previewFixture)}",
    );
    expect(draftEditor).toContain(
      'Discard draft "${draft.name}" (${draft.version})?',
    );
    expect(draftEditor).not.toContain("Discard draft ${draft.id}");
    expect(draftEditor).toContain(
      'className="sticky bottom-4 mx-4 flex',
    );
    expect(adminStyles).toContain("@keyframes theme-preview-border-flow");
    expect(adminStyles).toContain("conic-gradient(");
    expect(adminStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.theme-preview-button \{[\s\S]*?animation: none !important;/u,
    );
  });

  it("offers v2 search destinations without exposing raw manifest editing", async () => {
    const draftEditor = await source(
      "components/admin/themes/ThemeDraftEditorApp.tsx",
    );
    expect(draftEditor).toContain("draft.manifest.formatVersion === 2");
    expect(draftEditor).toContain("DEFAULT_THEME_SEARCH_ITEM_DESTINATION");
    expect(draftEditor).toContain("searchItemDestination");
    expect(draftEditor).toContain('value: "web"');
    expect(draftEditor).toContain('value: "url"');
    expect(draftEditor).toContain('value: "attachment"');
    expect(draftEditor).toContain('label: "Media attachment"');
    expect(draftEditor).not.toContain('label: "Main attachment"');
    expect(draftEditor).toContain("AdminRadioGroup");
    expect(draftEditor).not.toContain("JSON.stringify(draft.manifest");
    const detailsStart = draftEditor.indexOf('<details className="mt-5');
    const detailsEnd = draftEditor.indexOf("</details>", detailsStart);
    const searchLinks = draftEditor.indexOf("Search result links");
    expect(searchLinks).toBeGreaterThan(detailsStart);
    expect(searchLinks).toBeLessThan(detailsEnd);
  });

  it("separates Built-in groups from quota-scoped Custom versions", async () => {
    const [themes, installHelp, route] = await Promise.all([
      source("components/admin/themes/ThemesApp.tsx"),
      source("components/admin/themes/ThemeInstallHelpDialog.tsx"),
      source("pages/[adminPath]/settings/themes/index.astro"),
    ]);
    expect(themes).toContain("Built-in themes (");
    expect(themes).toContain("Custom themes (");
    expect(themes).toContain('role="tablist"');
    expect(themes).toContain('role="tabpanel"');
    expect(themes).toContain("new URLSearchParams({tab})");
    expect(themes).toContain('if (tab === "custom")');
    expect(themes).toContain("setPage(1)");
    expect(themes).toContain('event.key === "ArrowLeft"');
    expect(themes).toContain("tabIndex={tab ===");
    expect(themes).toContain("builtInGroups.map");
    expect(themes).toContain("Version history");
    expect(themes).toContain("Current release");
    expect(themes).toContain("Demo content");
    expect(themes).toContain("Built-in themes are synchronized");
    expect(themes).toContain("Custom theme versions used");
    expect(themes).toContain("Built-in themes do not use this quota");
    expect(themes).toContain("Version drafts");
    expect(themes).toContain("Create new version");
    expect(themes).not.toContain("Customize");
    expect(themes).toContain('action: "customize"');
    expect(themes).not.toContain('originKind: "built-in"');
    expect(themes).toContain('originKind: "theme"');
    expect(themes).toContain("ajaxThemePreview(theme.id)");
    expect(themes).toContain("theme.manifest.description");
    expect(themes).toContain(
      "hasPreviewFixture: Boolean(theme.manifest.previewFixture)",
    );
    expect(themes).toContain("Installed at");
    expect(themes).toContain("<time");
    expect(themes).toContain("<details");
    expect(themes).not.toContain("Deleted versions");
    expect(themes).not.toContain("Theme state");
    expect(themes).toContain("Built-in");
    expect(route).toContain("store.listSummaries(options, requestedTab)");
    expect(route).toContain("parseThemeAdminTab(searchParams)");
    expect(route).toContain("initialTab = listing.scope");
    expect(themes).toContain("Search name, package, version, author, or source");
    expect(themes).toContain("Newest installed");
    expect(themes).toContain("window.history.replaceState");
    expect(themes).toContain("How to install a theme");
    expect(themes).not.toContain(
      "yarn manage theme install &lt;github-url-or-directory&gt;",
    );
    expect(installHelp).toContain("Install a community theme");
    expect(installHelp).toContain("Install a Built-in theme");
    expect(installHelp).toContain("bundled:default");
    expect(installHelp).toContain("Create a new version in Admin");
    expect(installHelp).toContain("https://docs.microfeed.org/dashboard/themes/");
    expect(installHelp).toContain(
      "https://docs.microfeed.org/manage-cli/#yarn-manage-theme",
    );
    expect(themes).toContain("originThemeLabel(theme)");
    expect(themes).not.toContain("Origin theme: ${theme.originThemeId}");
    expect(themes).toContain("!builtIn && (");
    expect(themes).toContain("Update this theme");
    expect(themes).toContain("theme install ${builtInSource}");
    expect(themes).toContain("Copy update command");
    expect(themes).toContain("Export this version");
    expect(themes).toContain("Copy export command");
    expect(themes).toContain("for backup or continued development");
    expect(themes).toContain(
      ".microfeed/themes/${theme.packageId}-${theme.version} --git",
    );
  });

  it("keeps required draft identity prominent and explains optional metadata", async () => {
    const draftEditor = await source(
      "components/admin/themes/ThemeDraftEditorApp.tsx",
    );
    expect(draftEditor).toContain('<ThemeFieldLabel field="name"');
    expect(draftEditor).toContain('<ThemeFieldLabel field="version"');
    expect(draftEditor).toContain("Theme name is required.");
    expect(draftEditor).toContain("Theme version is required.");
    expect(draftEditor).toContain('<details className="mt-5');
    expect(draftEditor).toContain("Theme details");
    expect(draftEditor).toContain("THEME_FIELD_HELP");
    expect(draftEditor).toContain('<ThemeFieldLabel field="description"');
    expect(draftEditor).toContain("THEME_DESCRIPTION_MAX_LENGTH");
    expect(draftEditor).toContain('id="theme-description-count"');
    expect(draftEditor).toContain("Read the theme guide");
  });

  it("describes the code accepted by HTML and RSS theme editors", async () => {
    const [codeEditor, themeEditor] = await Promise.all([
      source("components/admin/shared/AdminCodeEditor/index.tsx"),
      source("components/admin/code-editor/ThemeBundleEditor.tsx"),
    ]);
    expect(codeEditor).toContain(
      "Please enter code here, including html, javascript, and css",
    );
    expect(themeEditor).toContain(
      "Please enter code here, including xsl and css",
    );
  });

  it("explains every theme file and links its live template context", async () => {
    const [themeEditor, draftEditor, draftRoute] = await Promise.all([
      source("components/admin/code-editor/ThemeBundleEditor.tsx"),
      source("components/admin/themes/ThemeDraftEditorApp.tsx"),
      source("pages/[adminPath]/settings/themes/drafts/[draftId]/index.astro"),
    ]);
    expect(themeEditor).toContain('href="https://mustache.github.io/"');
    expect(themeEditor).toContain("href={links.jsonFeedUrl}");
    expect(themeEditor).not.toContain("Use <code>items.0</code>");
    expect(themeEditor).not.toContain(
      "the <code>item</code> alias remains available",
    );
    for (const key of [
      "rssStylesheet",
      "webBodyEnd",
      "webBodyStart",
      "webFeed",
      "webHeader",
      "webItem",
      "webPage",
      "webSearch",
    ]) {
      expect(themeEditor).toContain(`${key}: {`);
    }
    expect(themeEditor).toContain("individual public item pages");
    expect(themeEditor).toContain("standalone Pages");
    expect(themeEditor).toContain("dedicated public search-results page");
    expect(themeEditor).toContain("every public HTML page");
    expect(themeEditor).toContain("public RSS feed");
    expect(themeEditor).toContain(
      "md:grid-cols-[12rem_minmax(0,1fr)]",
    );
    expect(themeEditor).toContain("flex-nowrap");
    expect(themeEditor).toContain("md:flex-col");
    expect(themeEditor).toContain("md:w-full md:justify-start");
    expect(themeEditor).toContain('aria-label="Theme files"');
    const menuOrder = [
      '"webFeed",',
      '"webItem",',
      '"webPage",',
      '"webSearch",',
      '"webHeader",',
      '"webBodyStart",',
      '"webBodyEnd",',
      '"rssStylesheet",',
    ].map((key) => themeEditor.indexOf(key));
    expect(menuOrder.every((position) => position >= 0)).toBe(true);
    expect(menuOrder).toEqual([...menuOrder].sort((a, b) => a - b));
    expect(draftEditor).toContain("links={themeEditorLinks}");
    expect(draftEditor).toContain(
      '<section className="min-w-0 rounded-[14px]',
    );
    expect(draftRoute).toContain("publicFeed.feed_url");
    expect(draftRoute).toContain("webItemUrl");
    expect(draftRoute).toContain("webPageUrl");
    expect(draftRoute).toContain("webSearchUrl");
    expect(draftRoute).toContain("activeThemeSupportsPages");
  });

  it("treats migrated legacy code as an ordinary installed version", async () => {
    const [themes, customCode, editor, editorRoute] = await Promise.all([
      source("components/admin/themes/ThemesApp.tsx"),
      source("components/admin/settings/CustomCodeSettingsApp/index.tsx"),
      source("components/admin/code-editor/CustomCodeEditorApp/index.tsx"),
      source("pages/[adminPath]/settings/code-editor/index.astro"),
    ]);
    expect(themes).not.toContain("Current legacy theme");
    expect(themes).not.toContain('customize("legacy")');
    expect(customCode).not.toContain("Open legacy theme editor");
    expect(editor).not.toContain("CodeEditorRouteSelect");
    expect(editor).not.toContain("CODE_TYPES.THEMES");
    expect(editor).toContain("...previousCustomCode");
    expect(editorRoute).toContain('adminUrl("settings/themes"');
  });
});
