import {useState} from "react";
import {preventCloseWhenChanged} from "@/client/BrowserUtils";
import {showToast} from "@/client/ToastUtils";
import ThemeBundleEditor from "@/components/admin/code-editor/ThemeBundleEditor";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {ADMIN_URLS} from "@/shared/StringUtils";
import type {ThemeDraft, ThemeManifestV1} from "@/shared/themes/ThemeContract";
import {useEffect} from "react";

interface Props {draft: ThemeDraft}

async function responseJson(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) throw new Error(data.error ?? "Draft operation failed.");
  return data;
}

export default function ThemeDraftEditorApp({draft: initial}: Props) {
  const [draft, setDraft] = useState(initial);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewView, setPreviewView] = useState<"feed" | "item" | "rss">("feed");
  const [viewport, setViewport] = useState<"mobile" | "desktop">("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  useEffect(() => preventCloseWhenChanged(() => changed), [changed]);

  const updateManifest = (updates: Partial<ThemeManifestV1>) => {
    setDraft({...draft, manifest: {...draft.manifest, ...updates}, ...("name" in updates ? {name: updates.name!} : {}), ...("version" in updates ? {version: updates.version!} : {})});
    setChanged(true);
  };
  const save = async (): Promise<ThemeDraft> => {
    setBusy(true);
    try {
      const {draft: saved} = await responseJson(await fetch(ADMIN_URLS.ajaxThemeDraft(draft.id), {
        body: JSON.stringify({bundle: draft.bundle, manifest: draft.manifest}),
        headers: {"content-type": "application/json"},
        method: "PUT",
      }));
      setDraft(saved);
      setChanged(false);
      setPreviewKey((value) => value + 1);
      showToast("Draft saved.", "success");
      return saved;
    } finally {
      setBusy(false);
    }
  };
  const run = async (operation: () => Promise<void>) => {
    try { await operation(); } catch (error) { showToast(error instanceof Error ? error.message : "Draft operation failed.", "error"); }
  };
  const publish = () => run(async () => {
    if (changed) await save();
    setBusy(true);
    try {
      const {theme} = await responseJson(await fetch(ADMIN_URLS.ajaxThemeDraft(draft.id), {
        body: JSON.stringify({action: "publish"}),
        headers: {"content-type": "application/json"},
        method: "POST",
      }));
      showToast(`Published ${theme.packageId}@${theme.version} as inactive.`, "success");
      window.location.assign(ADMIN_URLS.themesSettings());
    } finally { setBusy(false); }
  });
  const discard = () => run(async () => {
    if (!window.confirm(`Discard draft ${draft.id}? This cannot be undone.`)) return;
    await responseJson(await fetch(ADMIN_URLS.ajaxThemeDraft(draft.id), {method: "DELETE"}));
    setChanged(false);
    window.location.assign(ADMIN_URLS.themesSettings());
  });

  return <div className="grid gap-5">
    <section className="rounded-[14px] border bg-card p-5 shadow-xs">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div><Label htmlFor="theme-name">Name</Label><Input id="theme-name" className="mt-1" value={draft.manifest.name} onChange={(event) => updateManifest({name: event.target.value})} /></div>
        <div><Label htmlFor="theme-version">Publish version</Label><Input id="theme-version" className="mt-1" value={draft.manifest.version} onChange={(event) => updateManifest({version: event.target.value})} /></div>
        <div><Label htmlFor="theme-author">Author</Label><Input id="theme-author" className="mt-1" value={draft.manifest.author} onChange={(event) => updateManifest({author: event.target.value})} /></div>
        <div><Label htmlFor="theme-license">License</Label><Input id="theme-license" className="mt-1" value={draft.manifest.license} onChange={(event) => updateManifest({license: event.target.value})} /></div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div><Label htmlFor="theme-package">Package ID</Label><Input id="theme-package" className="mt-1" readOnly value={draft.manifest.packageId} /></div>
        <div><Label htmlFor="theme-compatibility">microfeed compatibility</Label><Input id="theme-compatibility" className="mt-1" value={draft.manifest.microfeed} onChange={(event) => updateManifest({microfeed: event.target.value})} /></div>
      </div>
    </section>
    <section className="rounded-[14px] border bg-card p-5 shadow-xs"><ThemeBundleEditor bundle={draft.bundle} onChange={(bundle) => {setDraft({...draft, bundle}); setChanged(true);}} /></section>
    <section className="rounded-[14px] border bg-card p-5 shadow-xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Isolated preview</h2><p className="text-xs text-muted-foreground">Preview uses the last saved draft and current public site data.</p></div><div className="flex flex-wrap gap-2">{(["feed", "item", "rss"] as const).map((view) => <Button key={view} size="sm" variant={previewView === view ? "default" : "outline"} onClick={() => setPreviewView(view)}>{view}</Button>)}{(["mobile", "desktop"] as const).map((size) => <Button key={size} size="sm" variant={viewport === size ? "secondary" : "ghost"} onClick={() => setViewport(size)}>{size}</Button>)}</div></div>
      <div className="overflow-x-auto"><iframe key={previewKey} className="mx-auto h-[680px] rounded-xl border bg-white transition-[width]" style={{width: viewport === "mobile" ? 390 : "100%"}} sandbox="allow-scripts" src={`${ADMIN_URLS.ajaxThemeDraftPreview(draft.id)}?view=${previewView}`} title={`${previewView} draft preview`} /></div>
    </section>
    <div className="sticky bottom-4 flex flex-wrap justify-end gap-2 rounded-[14px] border bg-card/95 p-4 shadow-lg backdrop-blur"><Button disabled={busy} variant="destructive" onClick={discard}>Discard draft</Button><Button disabled={busy || !changed} variant="outline" onClick={() => run(async () => {await save();})}>{busy ? "Saving…" : "Save draft"}</Button><Button disabled={busy} onClick={publish}>{busy ? "Publishing…" : "Publish inactive version"}</Button></div>
  </div>;
}
