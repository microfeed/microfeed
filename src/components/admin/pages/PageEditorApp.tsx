import {useEffect, useState} from "react";
import {ExternalLinkIcon, SaveIcon, Trash2Icon} from "lucide-react";

import {preventCloseWhenChanged} from "@/client/BrowserUtils";
import {showToast} from "@/client/ToastUtils";
import AdminRichEditor from "@/components/admin/shared/AdminRichEditor";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {ADMIN_URLS} from "@/shared/StringUtils";
import type {PageRecord} from "@/shared/Pages";

type Draft = Pick<PageRecord,
  "content_html" | "meta_description" | "navigation_label" |
  "navigation_order" | "show_in_navigation" | "slug" | "status" | "title"
>;

const EMPTY_PAGE: Draft = {
  content_html: "",
  meta_description: "",
  navigation_label: "",
  navigation_order: 10,
  show_in_navigation: true,
  slug: "",
  status: "unpublished",
  title: "",
};

async function responseJson(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) throw new Error(data.error ?? "Page operation failed.");
  return data;
}

export default function PageEditorApp({
  page,
  themeSupportsPages,
}: {
  page?: PageRecord;
  themeSupportsPages: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(page ?? EMPTY_PAGE);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => preventCloseWhenChanged(() => changed), [changed]);
  const update = (value: Partial<Draft>) => {
    setDraft((current) => ({...current, ...value}));
    setChanged(true);
  };

  const save = async () => {
    if (!draft.title.trim()) {
      showToast("Give the Page a title.", "error");
      return;
    }
    if (!themeSupportsPages && draft.status !== "unpublished") {
      showToast("Activate a format v2 theme before publishing this Page.", "error");
      return;
    }
    setBusy(true);
    try {
      const saved = await responseJson(await fetch(
        page ? ADMIN_URLS.ajaxPage(page.id) : ADMIN_URLS.ajaxPages(),
        {
          body: JSON.stringify(draft),
          headers: {"content-type": "application/json"},
          method: page ? "PUT" : "POST",
        },
      )) as PageRecord;
      setChanged(false);
      showToast(page ? "Page saved." : "Page created.", "success");
      if (!page) window.location.assign(ADMIN_URLS.editPage(saved.id));
      else setDraft(saved);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Page operation failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!page || !window.confirm(`Delete “${page.title}”? Its old paths will remain reserved.`)) return;
    setBusy(true);
    try {
      await responseJson(await fetch(ADMIN_URLS.ajaxPage(page.id), {method: "DELETE"}));
      window.location.assign(ADMIN_URLS.pages());
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not delete Page.", "error");
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-[14px] border bg-card p-5 shadow-xs">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="page-title">Title</Label>
            <Input id="page-title" value={draft.title} onChange={(event) => update({title: event.target.value})} />
          </div>
          <AdminRichEditor
            label="Page content"
            value={draft.content_html}
            onChange={(value: string) => update({content_html: value})}
          />
          <div className="grid gap-2">
            <Label htmlFor="page-description">Search and social description</Label>
            <Textarea id="page-description" maxLength={320} value={draft.meta_description ?? ""} onChange={(event) => update({meta_description: event.target.value})} />
          </div>
        </div>
      </section>
      <aside className="grid content-start gap-4">
        <section className="rounded-[14px] border bg-card p-5 shadow-xs">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="page-status">Visibility</Label>
              <select
                className="h-10 cursor-pointer rounded-md border bg-background px-3 text-sm"
                id="page-status"
                value={draft.status}
                onChange={(event) => update({status: event.target.value as Draft["status"]})}
              >
                <option value="published" disabled={!themeSupportsPages}>Published</option>
                <option value="unlisted" disabled={!themeSupportsPages}>Unlisted</option>
                <option value="unpublished">Draft</option>
              </select>
              {!themeSupportsPages && <p className="text-xs text-muted-foreground">Publishing unlocks after a format v2 theme is active.</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="page-slug">URL path</Label>
              <Input id="page-slug" placeholder="about" value={draft.slug} onChange={(event) => update({slug: event.target.value})} />
              <p className="text-xs text-muted-foreground">/{draft.slug || "automatic-path"}/</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="page-navigation">Show in navigation</Label>
              <Switch id="page-navigation" checked={draft.show_in_navigation} onCheckedChange={(checked) => update({show_in_navigation: checked})} />
            </div>
            {draft.show_in_navigation && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="page-navigation-label">Navigation label</Label>
                  <Input id="page-navigation-label" placeholder={draft.title || "About"} value={draft.navigation_label} onChange={(event) => update({navigation_label: event.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="page-navigation-order">Navigation order</Label>
                  <Input id="page-navigation-order" type="number" value={draft.navigation_order} onChange={(event) => update({navigation_order: Number(event.target.value)})} />
                </div>
              </>
            )}
          </div>
        </section>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !changed && Boolean(page)} onClick={() => void save()}>
            <SaveIcon aria-hidden="true" /> {page ? "Save Page" : "Create Page"}
          </Button>
          {page?.status !== "unpublished" && <Button render={<a href={page?.url} target="_blank" rel="noreferrer" />} variant="outline"><ExternalLinkIcon aria-hidden="true" /> View</Button>}
          {page && <Button disabled={busy} onClick={() => void remove()} variant="destructive"><Trash2Icon aria-hidden="true" /> Delete</Button>}
        </div>
      </aside>
    </div>
  );
}
