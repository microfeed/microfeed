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
    const previewIndex = draftEditor.indexOf("setPreviewOpen(true)");
    const installIndex = draftEditor.indexOf('{busy ? "Installing…" : "Install"}');
    expect(saveIndex).toBeGreaterThan(draftEditor.indexOf("onClick={discard}"));
    expect(previewIndex).toBeGreaterThan(saveIndex);
    expect(previewIndex).toBeLessThan(installIndex);
    expect(draftEditor).toContain('className="theme-preview-button"');
    expect(adminStyles).toContain("@keyframes theme-preview-border-flow");
    expect(adminStyles).toContain("conic-gradient(");
    expect(adminStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.theme-preview-button \{[\s\S]*?animation: none !important;/u,
    );
  });

  it("presents only current themes as compact installed versions", async () => {
    const [themes, installHelp, route] = await Promise.all([
      source("components/admin/themes/ThemesApp.tsx"),
      source("components/admin/themes/ThemeInstallHelpDialog.tsx"),
      source("pages/[adminPath]/settings/themes/index.astro"),
    ]);
    expect(themes).toContain("Installed themes");
    expect(themes).toContain("Version drafts");
    expect(themes).toContain(
      "Installed versions are immutable. Create a new version to make changes.",
    );
    expect(themes).toContain("Create new version");
    expect(themes).not.toContain("Customize");
    expect(themes).toContain('action: "customize"');
    expect(themes).not.toContain('originKind: "built-in"');
    expect(themes).toContain('originKind: "theme"');
    expect(themes).toContain("ajaxThemePreview(theme.id)");
    expect(themes).toContain("Installed at");
    expect(themes).toContain("<time");
    expect(themes).toContain("<details");
    expect(themes).not.toContain("Deleted versions");
    expect(themes).not.toContain("Theme state");
    expect(themes).not.toContain("Built-in default");
    expect(route).toContain("store.listSummaries(options)");
    expect(themes).toContain("Search name, package, version, author, or source");
    expect(themes).toContain("Newest installed");
    expect(themes).toContain("window.history.replaceState");
    expect(themes).toContain("How to install a theme");
    expect(themes).not.toContain(
      "yarn manage theme install &lt;github-url-or-directory&gt;",
    );
    expect(installHelp).toContain("Install a community theme");
    expect(installHelp).toContain("Create a new version in Admin");
    expect(installHelp).toContain("https://docs.microfeed.org/dashboard/themes/");
    expect(installHelp).toContain(
      "https://docs.microfeed.org/manage-cli/#yarn-manage-theme",
    );
    expect(themes).toContain("originThemeLabel(theme)");
    expect(themes).not.toContain("Origin theme: ${theme.originThemeId}");
    expect(themes).toContain("Export this version");
    expect(themes).toContain("for backup or continued development");
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
