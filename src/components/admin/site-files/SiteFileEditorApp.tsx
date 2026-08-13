import {useEffect, useRef, useState} from "react";
import {ExternalLinkIcon, RefreshCwIcon, RotateCcwIcon, SaveIcon, Trash2Icon} from "lucide-react";

import {preventCloseWhenChanged} from "@/client/BrowserUtils";
import {showToast} from "@/client/ToastUtils";
import AdminCodeEditor from "@/components/admin/shared/AdminCodeEditor";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {ADMIN_URLS, PUBLIC_URLS} from "@/shared/StringUtils";
import {
  normalizeSiteFilenameInput,
  SITE_FILE_MAX_NAME_LENGTH,
  SITE_FILE_MEDIA_TYPES,
  type SiteFileMediaType,
  type SiteFileRecord,
} from "@/shared/SiteFiles";

interface Draft {
  content_type: SiteFileMediaType;
  draft_content: string;
  enabled: boolean;
  filename: string;
}

interface Preview {
  content_type: SiteFileMediaType;
  rendered_content: string;
  valid: true;
}

export function siteFileEditorLanguage(
  contentType: SiteFileMediaType,
): string | undefined {
  if (contentType === "text/plain") return undefined;
  if (contentType === "application/json" ||
      contentType === "application/manifest+json") return "json";
  if (contentType === "application/xml" ||
      contentType === "application/rss+xml") return "xml";
  if (contentType === "text/markdown") return "markdown";
  if (contentType === "text/yaml") return "yaml";
  if (contentType === "text/css") return "css";
  return "csv";
}

async function responseJson(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) throw new Error(data.error ?? "Site File operation failed.");
  return data;
}

export default function SiteFileEditorApp({file}: {file?: SiteFileRecord}) {
  const [record, setRecord] = useState(file);
  const [draft, setDraft] = useState<Draft>({
    content_type: file?.content_type ?? "text/plain",
    draft_content: file?.draft_content ?? "",
    enabled: file?.enabled ?? false,
    filename: file?.filename ?? "",
  });
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"source" | "preview">("source");
  const [preview, setPreview] = useState<Preview>();
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const changedRef = useRef(false);
  useEffect(() => preventCloseWhenChanged(() => changedRef.current), []);
  const markChanged = (value: boolean) => {
    changedRef.current = value;
    setChanged(value);
  };
  const update = (value: Partial<Draft>) => {
    setDraft((current) => ({...current, ...value}));
    markChanged(true);
    setPreview(undefined);
    setPreviewError("");
  };
  const applyRecord = (next: SiteFileRecord) => {
    setRecord(next);
    setDraft({
      content_type: next.content_type,
      draft_content: next.draft_content,
      enabled: next.enabled,
      filename: next.filename,
    });
    markChanged(false);
    setPreview(undefined);
    setPreviewError("");
  };
  const previewPayload = () => ({
    ...draft,
    ...(record ? {site_file_id: record.id} : {}),
  });
  const run = async (operation: () => Promise<SiteFileRecord>, success: string) => {
    setBusy(true);
    try {
      const next = await operation();
      applyRecord(next);
      showToast(success, "success");
      return next;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Site File operation failed.", "error");
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!draft.filename.trim()) {
      showToast("Enter a root filename, such as security.txt.", "error");
      return;
    }
    const next = await run(async () => {
      if (draft.enabled) {
        await responseJson(await fetch(
          ADMIN_URLS.ajaxPreviewSiteFile(),
          {
            body: JSON.stringify(previewPayload()),
            headers: {"content-type": "application/json"},
            method: "POST",
          },
        ));
      }
      let saved = await responseJson(await fetch(
        record ? ADMIN_URLS.ajaxSiteFile(record.id) : ADMIN_URLS.ajaxSiteFiles(),
        {body: JSON.stringify(draft), headers: {"content-type": "application/json"}, method: record ? "PUT" : "POST"},
      )) as SiteFileRecord;
      if (draft.enabled) {
        saved = await responseJson(await fetch(
          ADMIN_URLS.ajaxPublishSiteFile(saved.id),
          {method: "POST"},
        )) as SiteFileRecord;
      }
      return saved;
    }, record ? "File saved." : "File created.");
    if (!record && next) window.location.assign(ADMIN_URLS.editSiteFile(next.id));
    return next;
  };
  const refreshPreview = async () => {
    setPreviewBusy(true);
    setPreviewError("");
    try {
      setPreview(await responseJson(await fetch(
        ADMIN_URLS.ajaxPreviewSiteFile(),
        {
          body: JSON.stringify(previewPayload()),
          headers: {"content-type": "application/json"},
          method: "POST",
        },
      )) as Preview);
    } catch (error) {
      setPreview(undefined);
      setPreviewError(
        error instanceof Error ? error.message : "Could not render preview.",
      );
    } finally {
      setPreviewBusy(false);
    }
  };
  const selectPreview = () => {
    setActiveTab("preview");
    void refreshPreview();
  };
  const reset = async () => {
    if (
      !record ||
      !window.confirm(
        `Restore the default /${record.filename}? This removes your custom template and published version.`,
      )
    ) return;
    await run(async () => responseJson(await fetch(ADMIN_URLS.ajaxResetSiteFile(record.id), {method: "POST"})), "Default file restored.");
  };
  const remove = async () => {
    if (!record || !window.confirm(`Delete /${record.filename}?`)) return;
    setBusy(true);
    try {
      await responseJson(await fetch(ADMIN_URLS.ajaxSiteFile(record.id), {method: "DELETE"}));
      markChanged(false);
      window.location.assign(ADMIN_URLS.siteFiles());
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not delete Site File.", "error");
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-[14px] border bg-card p-5 shadow-xs">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div aria-label="Site File editor view" className="flex gap-1" role="tablist">
                <Button aria-selected={activeTab === "source"} onClick={() => setActiveTab("source")} role="tab" size="sm" type="button" variant={activeTab === "source" ? "default" : "outline"}>Source</Button>
                <Button aria-selected={activeTab === "preview"} onClick={selectPreview} role="tab" size="sm" type="button" variant={activeTab === "preview" ? "default" : "outline"}>Preview</Button>
              </div>
              {activeTab === "preview" && (
                <Button disabled={previewBusy} onClick={() => void refreshPreview()} size="sm" type="button" variant="outline"><RefreshCwIcon aria-hidden="true" /> Refresh</Button>
              )}
            </div>
            {activeTab === "source" ? (
              <div aria-labelledby="site-file-source-label" role="tabpanel">
                <Label id="site-file-source-label">
                  <a
                    className="text-primary underline-offset-4 hover:underline"
                    href="https://mustache.github.io/"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Mustache
                  </a>{" "}
                  template
                </Label>
                <div className="mt-2">
                  {siteFileEditorLanguage(draft.content_type) ? (
                    <AdminCodeEditor
                      ariaLabel="Site File Mustache template"
                      code={draft.draft_content}
                      language={siteFileEditorLanguage(draft.content_type)!}
                      minHeight="28rem"
                      onChange={(event) => update({draft_content: event.target.value})}
                      placeholder="Enter a Mustache template"
                    />
                  ) : (
                    <Textarea className="min-h-[28rem] font-mono text-sm" id="site-file-content" spellCheck={false} value={draft.draft_content} onChange={(event) => update({draft_content: event.target.value})} />
                  )}
                </div>
              </div>
            ) : (
              <div aria-live="polite" role="tabpanel">
                <Label>Rendered output</Label>
                <div className="mt-2">
                  {previewBusy ? (
                    <div className="flex min-h-[28rem] items-center justify-center rounded-[10px] border bg-muted/30 text-sm text-muted-foreground">Rendering preview…</div>
                  ) : previewError ? (
                    <div className="min-h-[10rem] rounded-[10px] border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{previewError}</div>
                  ) : preview && siteFileEditorLanguage(preview.content_type) ? (
                    <AdminCodeEditor ariaLabel="Rendered Site File preview" code={preview.rendered_content} language={siteFileEditorLanguage(preview.content_type)!} minHeight="28rem" readOnly />
                  ) : preview ? (
                    <Textarea aria-label="Rendered Site File preview" className="min-h-[28rem] bg-muted/60 font-mono text-sm" readOnly spellCheck={false} value={preview.rendered_content} />
                  ) : null}
                </div>
              </div>
            )}
            <details className="rounded-[10px] border bg-muted/20 p-3 text-sm">
              <summary className="cursor-pointer font-medium">Template variables</summary>
              <div className="mt-2 grid gap-2 text-muted-foreground">
                <p>
                  Use top-level fields from this site&apos;s{" "}
                  <a
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    href={PUBLIC_URLS.jsonFeed()}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    JSON Feed
                  </a>, such as <code>{"{{title}}"}</code>,{" "}
                  <code>{"{{description}}"}</code>, and{" "}
                  <code>{"{{home_page_url}}"}</code>.
                </p>
                <p>
                  <code>items</code> contains up to 100 newest Published items.
                  {" "}<code>pages</code> contains up to 100 most recently
                  updated Published Pages; the special 404 Page is excluded.
                </p>
                <p>Loop through <code>{"{{#items}}…{{/items}}"}</code> or <code>{"{{#pages}}…{{/pages}}"}</code>. Each entry includes <code>_loop.index</code>, <code>_loop.first</code>, and <code>_loop.last</code>.</p>
                <p>Helpers include <code>_site.origin</code>, <code>_site.json_feed_url</code>, <code>_site.rss_feed_url</code>, <code>_site.sitemap_url</code>, and <code>_site.generated_at</code>. When public API docs are available, <code>_site.api_llms_full_url</code> contains their agent-friendly URL. Inside an item, use <code>_site.web_url</code>, <code>_site.images</code>, and <code>_site.videos</code>.</p>
                <p>
                  <a
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    href="https://mustache.github.io/"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Mustache
                  </a>{" "}
                  escapes values by default. Use triple braces only when you
                  intentionally need unescaped output.
                </p>
              </div>
            </details>
          </div>
        </section>
        <aside className="grid content-start gap-4">
          <section className="rounded-[14px] border bg-card p-5 shadow-xs">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="site-file-name">Root filename</Label>
                <Input
                  aria-describedby={draft.filename
                    ? "site-file-name-help site-file-name-preview"
                    : "site-file-name-help"}
                  disabled={Boolean(record)}
                  id="site-file-name"
                  maxLength={SITE_FILE_MAX_NAME_LENGTH}
                  onChange={(event) => update({
                    filename: normalizeSiteFilenameInput(event.target.value),
                  })}
                  placeholder="e.g., security.txt"
                  required
                  value={draft.filename}
                />
                <p className="text-xs text-muted-foreground" id="site-file-name-help">
                  One top-level path only. Slashes are removed automatically.
                </p>
                {draft.filename && (
                  <p className="text-xs font-medium" id="site-file-name-preview">/{draft.filename}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site-file-type">Content type</Label>
                <select className="h-10 cursor-pointer rounded-md border bg-background px-3 text-sm" id="site-file-type" value={draft.content_type} onChange={(event) => update({content_type: event.target.value as SiteFileMediaType})}>
                  {SITE_FILE_MEDIA_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site-file-visibility">Visibility</Label>
                <select
                  className="h-10 cursor-pointer rounded-md border bg-background px-3 text-sm"
                  id="site-file-visibility"
                  onChange={(event) => update({enabled: event.target.value === "published"})}
                  value={draft.enabled ? "published" : "draft"}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Draft saves privately. Published saves and serves the rendered file.
                </p>
              </div>
            </div>
          </section>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !changed && Boolean(record)} onClick={() => void save()}><SaveIcon aria-hidden="true" /> {record ? "Save File" : "Create File"}</Button>
            {record?.enabled && (record.mode === "generated" || record.date_published) && <Button render={<a href={record.url} target="_blank" rel="noreferrer" />} variant="outline"><ExternalLinkIcon aria-hidden="true" /> View</Button>}
            {record && !record.system && <Button disabled={busy} onClick={() => void remove()} variant="destructive"><Trash2Icon aria-hidden="true" /> Delete</Button>}
          </div>
          {record?.mode === "override" && record.generator && (
            <section className="mt-2 rounded-[14px] border bg-card p-5 shadow-xs">
              <div className="grid gap-3">
                <h2 className="font-semibold">Default file</h2>
                <p className="text-sm text-muted-foreground">
                  Replace this customized template with microfeed&apos;s built-in
                  default. Your custom draft and published version will be
                  removed; its current visibility stays the same.
                </p>
                <div>
                  <Button disabled={busy} onClick={() => void reset()} variant="outline">
                    <RotateCcwIcon aria-hidden="true" /> Restore default file
                  </Button>
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
