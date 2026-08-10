import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";

const source = (filename: string) => readFile(
  new URL(`../../../src/${filename}`, import.meta.url),
  "utf8",
);

describe("Admin versioned themes", () => {
  it("keeps draft and inactive previews sandboxed without same-origin access", async () => {
    const [themes, drafts] = await Promise.all([
      source("components/admin/themes/ThemesApp.tsx"),
      source("components/admin/themes/ThemeDraftEditorApp.tsx"),
    ]);
    for (const component of [themes, drafts]) {
      expect(component).toContain('sandbox="allow-scripts"');
      expect(component).not.toContain("allow-same-origin");
    }
  });

  it("keeps publication separate from activation", async () => {
    const draftEditor = await source(
      "components/admin/themes/ThemeDraftEditorApp.tsx",
    );
    expect(draftEditor).toContain('action: "publish"');
    expect(draftEditor).not.toContain('action: "activate"');
    expect(draftEditor).toContain("Publish inactive version");
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
