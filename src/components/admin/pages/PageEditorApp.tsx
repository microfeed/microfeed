import {useEffect, useRef, useState} from "react";
import {
  ExternalLinkIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";

import {preventCloseWhenChanged} from "@/client/BrowserUtils";
import {showToast} from "@/client/ToastUtils";
import AdminHelpLabel from "@/components/admin/shared/AdminHelpLabel";
import AdminRichEditor from "@/components/admin/shared/AdminRichEditor";
import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Switch} from "@/components/ui/switch";
import {Textarea} from "@/components/ui/textarea";
import {ADMIN_URLS, PUBLIC_URLS} from "@/shared/StringUtils";
import {
  normalizePageSlugInput,
  PAGE_META_DESCRIPTION_MAX_LENGTH,
  PAGE_SLUG_MAX_LENGTH,
  type PageRecord,
} from "@/shared/Pages";

type Draft = Pick<PageRecord,
  "content_html" | "meta_description" | "navigation_label" |
  "show_in_navigation" | "slug" | "status" | "title"
>;

const EMPTY_PAGE: Draft = {
  content_html: "",
  meta_description: "",
  navigation_label: "",
  show_in_navigation: true,
  slug: "",
  status: "unpublished",
  title: "",
};

type HelpTopic = "description" | "navigation";

function PageHelpDialog({
  onOpenChange,
  topic,
}: {
  onOpenChange: (open: boolean) => void;
  topic: HelpTopic | null;
}) {
  const content = topic === "description"
    ? {
        description: "How this optional summary is published.",
        title: "Search and social description",
      }
    : {
        description: "Choose whether your active theme can include this Page in website navigation.",
        title: "Page navigation",
      };
  return (
    <Dialog onOpenChange={onOpenChange} open={topic !== null}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription>{content.description}</DialogDescription>
        </DialogHeader>
        {topic === "description" ? (
          <div className="grid gap-4 text-sm leading-relaxed">
            <p>
              This is plain text only—HTML and Markdown are not rendered. You
              can enter up to {PAGE_META_DESCRIPTION_MAX_LENGTH} characters.
            </p>
            <section className="grid gap-2">
              <h3 className="font-medium">In public HTML</h3>
              <code className="block overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">
                {'<meta name="description" content="A short summary of this Page.">'}
              </code>
              <p className="text-muted-foreground">
                Search engines and social platforms may use this text for a
                result snippet or link preview. If it is empty, microfeed uses
                plain text extracted from the Page content.
              </p>
            </section>
          </div>
        ) : (
          <div className="grid gap-5 text-sm leading-relaxed">
            <section className="grid gap-2">
              <h3 className="font-medium">On the public website</h3>
              <p className="text-muted-foreground">
                A Published Page with navigation enabled is added to the
                <code className="mx-1 rounded bg-muted px-1 py-0.5">navigation_pages</code>
                data available to format v2 themes. The active theme decides
                where to display it; the default theme uses the site header.
              </p>
              <p className="text-muted-foreground">
                To change link order, return to the Pages screen and drag this
                Page within Website navigation.
              </p>
            </section>
            <section className="grid gap-2 border-t pt-4">
              <h3 className="font-medium">In RSS and JSON Feed</h3>
              <p className="text-muted-foreground">
                Page navigation is website-only. It does not add the Page or
                its navigation label to the public <a href={PUBLIC_URLS.rssFeed()} rel="noreferrer" target="_blank">RSS feed</a> or <a href={PUBLIC_URLS.jsonFeed()} rel="noreferrer" target="_blank">JSON Feed</a>.
              </p>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);
  const changedRef = useRef(false);
  const isNotFoundPage = Boolean(page?.is_not_found_page);
  useEffect(() => preventCloseWhenChanged(() => changedRef.current), []);
  const markChanged = (value: boolean) => {
    changedRef.current = value;
    setChanged(value);
  };
  const update = (value: Partial<Draft>) => {
    setDraft((current) => ({...current, ...value}));
    markChanged(true);
  };

  const save = async () => {
    if (!draft.title.trim()) {
      showToast("Give the Page a title.", "error");
      return;
    }
    if (!isNotFoundPage && !draft.slug.trim()) {
      showToast("Enter a URL path, such as about.", "error");
      return;
    }
    if (
      !isNotFoundPage && draft.show_in_navigation &&
      !draft.navigation_label.trim()
    ) {
      showToast(
        "Enter a navigation label, or turn off Show in navigation.",
        "error",
      );
      return;
    }
    if (
      !isNotFoundPage && !themeSupportsPages &&
      draft.status !== "unpublished"
    ) {
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
      markChanged(false);
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
    <>
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
            <AdminHelpLabel
              id="page-description-label"
              onClick={() => setHelpTopic("description")}
            >
              Search and social description
            </AdminHelpLabel>
            <Textarea
              aria-describedby="page-description-help page-description-count"
              aria-labelledby="page-description-label"
              id="page-description"
              maxLength={PAGE_META_DESCRIPTION_MAX_LENGTH}
              onChange={(event) => update({meta_description: event.target.value})}
              value={draft.meta_description ?? ""}
            />
            <div className="flex items-start justify-between gap-4 text-xs text-muted-foreground">
              <p id="page-description-help">Plain text for search results and link previews.</p>
              <p className="shrink-0 tabular-nums" id="page-description-count">
                {(draft.meta_description ?? "").length}/{PAGE_META_DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
          </div>
        </div>
      </section>
      <aside className="grid content-start gap-4">
        <section className="rounded-[14px] border bg-card p-5 shadow-xs">
          <div className="grid gap-4">
            {isNotFoundPage ? (
              <div className="grid gap-2 text-sm">
                <p className="font-medium">Default 404 Page</p>
                <p className="text-muted-foreground">
                  Preview it at <code>/404/</code>. Missing public website URLs
                  render this content with a 404 response. Its path, published
                  state, navigation exclusion, and delete protection are fixed.
                </p>
              </div>
            ) : (
              <>
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
                  <Label htmlFor="page-slug">
                    URL path <span aria-hidden="true" className="text-destructive">*</span>
                  </Label>
                  <Input
                    aria-describedby={draft.slug
                      ? "page-slug-help page-slug-preview"
                      : "page-slug-help"}
                    id="page-slug"
                    maxLength={PAGE_SLUG_MAX_LENGTH}
                    onChange={(event) => update({slug: normalizePageSlugInput(event.target.value)})}
                    placeholder="e.g., about"
                    required
                    value={draft.slug}
                  />
                  <p className="text-xs text-muted-foreground" id="page-slug-help">
                    One top-level path only. Slashes are removed automatically.
                  </p>
                  {draft.slug && (
                    <p className="text-xs font-medium" id="page-slug-preview">/{draft.slug}/</p>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
        {!isNotFoundPage && (
          <section className="rounded-[14px] border bg-card p-5 shadow-xs">
            <AdminHelpLabel
              className="mb-4 text-base font-semibold"
              onClick={() => setHelpTopic("navigation")}
            >
              Navigation
            </AdminHelpLabel>
            <div className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="page-navigation">Show in navigation</Label>
                <Switch
                  checked={draft.show_in_navigation}
                  id="page-navigation"
                  onCheckedChange={(checked) => update({show_in_navigation: checked})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="page-navigation-label">
                  Navigation label
                  {draft.show_in_navigation && (
                    <span aria-hidden="true" className="text-destructive"> *</span>
                  )}
                </Label>
                <Input
                  disabled={!draft.show_in_navigation}
                  id="page-navigation-label"
                  onChange={(event) => update({navigation_label: event.target.value})}
                  placeholder="e.g., About"
                  required={draft.show_in_navigation}
                  value={draft.navigation_label}
                />
                <p className="text-xs text-muted-foreground">Short text shown for this Page in the theme&apos;s navigation.</p>
              </div>
            </div>
          </section>
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !changed && Boolean(page)} onClick={() => void save()}>
            <SaveIcon aria-hidden="true" /> {page ? "Save Page" : "Create Page"}
          </Button>
          {page && page.status !== "unpublished" && <Button render={<a href={page.url} target="_blank" rel="noreferrer" />} variant="outline"><ExternalLinkIcon aria-hidden="true" /> View</Button>}
          {page && !isNotFoundPage && <Button disabled={busy} onClick={() => void remove()} variant="destructive"><Trash2Icon aria-hidden="true" /> Delete</Button>}
        </div>
      </aside>
      </div>
      <PageHelpDialog
        onOpenChange={(open) => {
          if (!open) setHelpTopic(null);
        }}
        topic={helpTopic}
      />
    </>
  );
}
