import {useEffect, useState} from "react";
import {ExternalLinkIcon, RotateCcwIcon, SaveIcon, SendIcon, Trash2Icon} from "lucide-react";

import {preventCloseWhenChanged} from "@/client/BrowserUtils";
import {showToast} from "@/client/ToastUtils";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {ADMIN_URLS} from "@/shared/StringUtils";
import {
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
    enabled: file?.enabled ?? true,
    filename: file?.filename ?? "",
  });
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => preventCloseWhenChanged(() => changed), [changed]);
  const update = (value: Partial<Draft>) => {
    setDraft((current) => ({...current, ...value}));
    setChanged(true);
  };
  const applyRecord = (next: SiteFileRecord) => {
    setRecord(next);
    setDraft({
      content_type: next.content_type,
      draft_content: next.draft_content,
      enabled: next.enabled,
      filename: next.filename,
    });
    setChanged(false);
  };
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
    const next = await run(async () => responseJson(await fetch(
      record ? ADMIN_URLS.ajaxSiteFile(record.id) : ADMIN_URLS.ajaxSiteFiles(),
      {body: JSON.stringify(draft), headers: {"content-type": "application/json"}, method: record ? "PUT" : "POST"},
    )), record ? "Draft saved." : "Site File created.");
    if (!record && next) window.location.assign(ADMIN_URLS.editSiteFile(next.id));
    return next;
  };
  const publish = async () => {
    if (!record) return;
    if (changed && !await save()) return;
    await run(async () => responseJson(await fetch(ADMIN_URLS.ajaxPublishSiteFile(record.id), {method: "POST"})), "Site File published.");
  };
  const reset = async () => {
    if (!record || !window.confirm("Return this file to the generated microfeed default?")) return;
    await run(async () => responseJson(await fetch(ADMIN_URLS.ajaxResetSiteFile(record.id), {method: "POST"})), "Generated default restored.");
  };
  const remove = async () => {
    if (!record || !window.confirm(`Delete /${record.filename}?`)) return;
    setBusy(true);
    try {
      await responseJson(await fetch(ADMIN_URLS.ajaxSiteFile(record.id), {method: "DELETE"}));
      window.location.assign(ADMIN_URLS.siteFiles());
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not delete Site File.", "error");
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-5">
      {record?.mode === "generated" && (
        <section className="rounded-[14px] border border-sky-300 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
          microfeed currently generates this file. Enter custom content and publish when you want to replace the generated default.
        </section>
      )}
      <section className="rounded-[14px] border bg-card p-5 shadow-xs">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="site-file-name">Root filename</Label>
            <Input id="site-file-name" disabled={Boolean(record)} placeholder="security.txt" value={draft.filename} onChange={(event) => update({filename: event.target.value})} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="site-file-type">Content type</Label>
            <select className="h-10 cursor-pointer rounded-md border bg-background px-3 text-sm" id="site-file-type" value={draft.content_type} onChange={(event) => update({content_type: event.target.value as SiteFileMediaType})}>
              {SITE_FILE_MEDIA_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div><Label htmlFor="site-file-enabled">Serve this file publicly</Label><p className="text-xs text-muted-foreground">Draft changes remain private until Publish.</p></div>
          <Switch id="site-file-enabled" checked={draft.enabled} onCheckedChange={(checked) => update({enabled: checked})} />
        </div>
        <div className="mt-5 grid gap-2">
          <Label htmlFor="site-file-content">Draft content</Label>
          <Textarea className="min-h-[28rem] font-mono text-sm" id="site-file-content" spellCheck={false} value={draft.draft_content} onChange={(event) => update({draft_content: event.target.value})} />
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !changed && Boolean(record)} onClick={() => void save()}><SaveIcon aria-hidden="true" /> {record ? "Save draft" : "Create Site File"}</Button>
        {record && <Button disabled={busy} onClick={() => void publish()}><SendIcon aria-hidden="true" /> Publish</Button>}
        {record?.mode === "override" && record.generator && <Button disabled={busy} onClick={() => void reset()} variant="outline"><RotateCcwIcon aria-hidden="true" /> Restore generated</Button>}
        {record?.date_published && record.enabled && <Button render={<a href={record.url} target="_blank" rel="noreferrer" />} variant="outline"><ExternalLinkIcon aria-hidden="true" /> View</Button>}
        {record && !record.system && <Button disabled={busy} onClick={() => void remove()} variant="destructive"><Trash2Icon aria-hidden="true" /> Delete</Button>}
      </div>
    </div>
  );
}
