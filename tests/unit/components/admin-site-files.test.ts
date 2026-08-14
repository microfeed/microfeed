import {readFile} from "node:fs/promises";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";

import SiteFileEditorApp, {
  siteFileEditorLanguage,
} from "@/components/admin/site-files/SiteFileEditorApp";
import SiteFilesApp from "@/components/admin/site-files/SiteFilesApp";
import type {SiteFileRecord} from "@/shared/SiteFiles";

describe("Site File editor", () => {
  it("selects format-aware highlighting and leaves plain text unhighlighted", () => {
    expect(siteFileEditorLanguage("application/json")).toBe("json");
    expect(siteFileEditorLanguage("application/manifest+json")).toBe("json");
    expect(siteFileEditorLanguage("application/xml")).toBe("xml");
    expect(siteFileEditorLanguage("application/rss+xml")).toBe("xml");
    expect(siteFileEditorLanguage("text/markdown")).toBe("markdown");
    expect(siteFileEditorLanguage("text/yaml")).toBe("yaml");
    expect(siteFileEditorLanguage("text/css")).toBe("css");
    expect(siteFileEditorLanguage("text/csv")).toBe("csv");
    expect(siteFileEditorLanguage("text/plain")).toBeUndefined();
  });

  it("clears the synchronous dirty guard before opening a created Site File", async () => {
    const editor = await readFile(
      new URL(
        "../../../src/components/admin/site-files/SiteFileEditorApp.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(editor).toContain(
      "preventCloseWhenChanged(() => changedRef.current)",
    );
    expect(editor).toContain("changedRef.current = value");
    expect(editor.indexOf("markChanged(false)"))
      .toBeLessThan(editor.indexOf(
        "window.location.assign(ADMIN_URLS.editSiteFile(next.id))",
      ));
  });

  it("uses a two-column Draft/Published save workflow", () => {
    const createOutput = renderToStaticMarkup(
      React.createElement(SiteFileEditorApp),
    );
    const file: SiteFileRecord = {
      content_type: "text/plain",
      date_created: "2026-08-13T00:00:00.000Z",
      date_modified: "2026-08-13T00:00:00.000Z",
      draft_content: "Contact security@example.com",
      enabled: false,
      filename: "security.txt",
      id: "site-file-1",
      mode: "override",
      system: false,
      url: "https://example.com/security.txt",
    };
    const editOutput = renderToStaticMarkup(
      React.createElement(SiteFileEditorApp, {file}),
    );
    const defaultFileOutput = renderToStaticMarkup(
      React.createElement(SiteFileEditorApp, {
        file: {...file, generator: "robots", system: true},
      }),
    );

    expect(createOutput).toContain(
      "xl:grid-cols-[minmax(0,1fr)_22rem]",
    );
    expect(createOutput).toContain('placeholder="e.g., security.txt"');
    expect(createOutput).toContain(
      "One top-level path only. Slashes are removed automatically.",
    );
    expect(createOutput).toContain(">Draft</option>");
    expect(createOutput).toContain(">Published</option>");
    expect(createOutput).toContain("Create File</button>");
    expect(createOutput).not.toContain("Serve this file publicly");
    expect(createOutput).not.toContain(">Publish</button>");
    expect(editOutput).toContain(">/security.txt</p>");
    expect(editOutput).toContain("Save File</button>");
    expect(defaultFileOutput).toContain(">Default file</h2>");
    expect(defaultFileOutput).toContain("microfeed&#x27;s built-in");
    expect(defaultFileOutput).toContain("current visibility stays the same");
    expect(defaultFileOutput).toContain("Restore default file</button>");
    expect(defaultFileOutput).not.toContain("Restore generated");
    expect(defaultFileOutput.indexOf("Save File</button>"))
      .toBeLessThan(defaultFileOutput.indexOf(">Default file</h2>"));
    expect(defaultFileOutput).toContain(
      'class="mt-2 rounded-[14px] border bg-card p-5 shadow-xs"',
    );
  });

  it("links template guidance and explains the fixed collection limits", () => {
    const output = renderToStaticMarkup(
      React.createElement(SiteFileEditorApp),
    );

    expect(output).toContain('href="https://mustache.github.io/"');
    expect(output).toContain('href="/json/"');
    expect(output).toContain('rel="noopener noreferrer"');
    expect(output).toContain('target="_blank"');
    expect(output).toContain("up to 100 newest Published items");
    expect(output).toContain(
      "up to 100 most recently updated Published Pages",
    );
    expect(output).toContain("the special 404 Page is excluded");
    expect(output).toContain("_loop.index");
    expect(output).toContain("_loop.first");
    expect(output).toContain("_loop.last");
    expect(output).toContain("_site.api_llms_full_url");
  });

  it("shows plain-language Published and Draft status labels", () => {
    const baseFile: SiteFileRecord = {
      content_type: "text/plain",
      date_created: "2026-08-13T00:00:00.000Z",
      date_modified: "2026-08-13T00:00:00.000Z",
      draft_content: "",
      enabled: true,
      filename: "robots.txt",
      generator: "robots",
      id: "system-robots",
      mode: "generated",
      system: true,
      url: "https://example.com/robots.txt",
    };
    const output = renderToStaticMarkup(React.createElement(SiteFilesApp, {
      files: [
        baseFile,
        {
          ...baseFile,
          enabled: false,
          filename: "security.txt",
          generator: undefined,
          id: "security-file",
          mode: "override",
          system: false,
        },
      ],
    }));

    expect(output).toContain("bg-emerald-500/12");
    expect(output).toContain(">Published</span>");
    expect(output).toContain("bg-muted text-muted-foreground");
    expect(output).toContain(">Draft</span>");
    expect(output).not.toContain(">Generated</span>");
    expect(output).not.toContain(">Override</span>");
    expect(output).not.toContain(">Enabled</span>");
    expect(output).not.toContain(">Disabled</span>");
  });
});
