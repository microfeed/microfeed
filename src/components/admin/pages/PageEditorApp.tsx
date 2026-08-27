import {useCallback, useEffect, useRef, useState} from "react";
import {
  ExternalLinkIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";

import {preventCloseWhenChanged} from "@/client/BrowserUtils";
import {showToast} from "@/client/ToastUtils";
import {nativeWebMcpAvailable} from "@/client/webmcp/feature-detection";
import type {SavePageDraftInput} from "@/client/webmcp/schemas";
import {
  mergePageWebMcpDraft,
  pageWebMcpDraftEligible,
  type PageEditorDraft,
} from "@/client/webmcp/page-editor-state";
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
  pageNavigationEnabledForStatus,
  type PageRecord,
} from "@/shared/Pages";
import {WEBMCP_INTERACTION_HEADERS} from "@/shared/WebMcp";

type Draft = PageEditorDraft;

const EMPTY_PAGE: Draft = {
  content_html: "",
  meta_description: "",
  navigation_label: "",
  show_in_navigation: true,
  slug: "",
  status: "unpublished",
  title: "",
};

const PAGE_CREATED_TOAST_KEY = "microfeed.page-created";

type HelpTopic = "description" | "navigation" | "visibility";

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
    : topic === "visibility"
    ? {
        description: "Choose how people can find and open this Page.",
        title: "Page visibility",
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
        ) : topic === "visibility" ? (
          <div className="grid gap-4 text-sm leading-relaxed">
            <section className="grid gap-1">
              <h3 className="font-medium">Published</h3>
              <p className="text-muted-foreground">
                Anyone can open the Page. microfeed includes it in public
                search and generated discovery files such as sitemap.xml and
                llms.txt. It can also appear in website navigation when Show
                in navigation is on.
              </p>
            </section>
            <section className="grid gap-1 border-t pt-4">
              <h3 className="font-medium">Unlisted</h3>
              <p className="text-muted-foreground">
                Anyone with the direct URL can open the Page, but microfeed
                excludes it from website navigation, public search, and
                generated sitemap.xml and llms.txt files. Selecting Unlisted
                turns off Show in navigation.
              </p>
            </section>
            <section className="grid gap-1 border-t pt-4">
              <h3 className="font-medium">Draft</h3>
              <p className="text-muted-foreground">
                The Page is saved in the admin dashboard but is not available
                on the public website. Its navigation choice is kept for when
                you publish it.
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
                Unlisted Pages cannot appear in navigation. Selecting
                Unlisted turns off and disables Show in navigation.
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
  const initialDraft = page ?? EMPTY_PAGE;
  const [draft, setDraft] = useState<Draft>({
    ...initialDraft,
    show_in_navigation: pageNavigationEnabledForStatus(
      initialDraft.status,
      initialDraft.show_in_navigation,
    ),
  });
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);
  const [savedPage, setSavedPage] = useState<PageRecord | undefined>(page);
  const changedRef = useRef(false);
  const busyRef = useRef(false);
  const draftRef = useRef(draft);
  const isNotFoundPage = Boolean(page?.is_not_found_page);
  useEffect(() => preventCloseWhenChanged(() => changedRef.current), []);
  useEffect(() => {
    if (!page || window.sessionStorage.getItem(PAGE_CREATED_TOAST_KEY) !== page.id) {
      return;
    }
    window.sessionStorage.removeItem(PAGE_CREATED_TOAST_KEY);
    showToast("Page created.", "success");
  }, [page]);
  const markChanged = useCallback((value: boolean) => {
    changedRef.current = value;
    setChanged(value);
  }, []);
  const update = (value: Partial<Draft>) => {
    setDraft((current) => {
      const next = {...current, ...value};
      draftRef.current = next;
      return next;
    });
    markChanged(true);
  };

  const persistDraft = useCallback(async (
    nextDraft: Draft,
    options: {signal?: AbortSignal; webMcp?: boolean} = {},
  ): Promise<PageRecord> => {
    if (busyRef.current) {
      throw new Error("A Page save is already in progress.");
    }
    if (!nextDraft.title.trim()) {
      throw new Error("Give the Page a title.");
    }
    if (!isNotFoundPage && !nextDraft.slug.trim()) {
      throw new Error("Enter a URL path, such as about.");
    }
    if (
      !isNotFoundPage && nextDraft.show_in_navigation &&
      !nextDraft.navigation_label.trim()
    ) {
      throw new Error(
        "Enter a navigation label, or turn off Show in navigation.",
      );
    }
    if (
      !isNotFoundPage && !themeSupportsPages &&
      nextDraft.status !== "unpublished"
    ) {
      throw new Error(
        "Activate a format v2 theme before publishing this Page.",
      );
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const saved = await responseJson(await fetch(
        page ? ADMIN_URLS.ajaxPage(page.id) : ADMIN_URLS.ajaxPages(),
        {
          body: JSON.stringify(nextDraft),
          headers: {
            "content-type": "application/json",
            ...(options.webMcp ? WEBMCP_INTERACTION_HEADERS : {}),
          },
          method: page ? "PUT" : "POST",
          signal: options.signal,
        },
      )) as PageRecord;
      markChanged(false);
      draftRef.current = saved;
      setDraft(saved);
      setSavedPage(saved);
      return saved;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [isNotFoundPage, markChanged, page, themeSupportsPages]);

  const save = async () => {
    try {
      const saved = await persistDraft(draft);
      if (!page) {
        window.sessionStorage.setItem(PAGE_CREATED_TOAST_KEY, saved.id);
        window.location.assign(ADMIN_URLS.editPage(saved.id));
      } else {
        showToast("Page saved.", "success");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Page operation failed.", "error");
    }
  };

  useEffect(() => {
    const eligible = pageWebMcpDraftEligible({
      draftStatus: draft.status,
      isNotFoundPage,
      savedStatus: page ? savedPage?.status : undefined,
    });
    if (!eligible || !nativeWebMcpAvailable()) return;
    const controller = new AbortController();
    void import("@/client/webmcp/editor-tools").then(
      ({registerPageDraftTool}) => registerPageDraftTool(
        controller.signal,
        async (input: SavePageDraftInput, signal) => {
          const current = draftRef.current;
          if (
            current.status !== "unpublished" ||
            (page && savedPage?.status !== "unpublished")
          ) {
            throw new Error(
              "WebMCP can save only the visible unpublished Page.",
            );
          }
          const next = mergePageWebMcpDraft(current, input);
          draftRef.current = next;
          setDraft(next);
          markChanged(true);
          const saved = await persistDraft(next, {signal, webMcp: true});
          const editorUrl = new URL(
            ADMIN_URLS.editPage(saved.id),
            window.location.origin,
          ).toString();
          if (!page) {
            window.sessionStorage.setItem(PAGE_CREATED_TOAST_KEY, saved.id);
            setTimeout(() => window.location.assign(editorUrl), 0);
          } else {
            showToast("Page saved.", "success");
          }
          return {
            content_html: saved.content_html,
            editor_url: editorUrl,
            id: saved.id,
            meta_description: saved.meta_description ?? "",
            navigation_label: saved.navigation_label,
            show_in_navigation: saved.show_in_navigation,
            slug: saved.slug,
            status: "unpublished",
            title: saved.title,
          };
        },
      ),
    ).catch((error) => {
      if (!controller.signal.aborted) {
        controller.abort();
        console.warn(error);
      }
    });
    return () => controller.abort();
  }, [
    draft.status,
    isNotFoundPage,
    markChanged,
    page,
    persistDraft,
    savedPage?.status,
  ]);

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
                  <AdminHelpLabel
                    id="page-status-label"
                    onClick={() => setHelpTopic("visibility")}
                  >
                    Visibility
                  </AdminHelpLabel>
                  <select
                    aria-labelledby="page-status-label"
                    className="h-10 cursor-pointer rounded-md border bg-background px-3 text-sm"
                    id="page-status"
                    value={draft.status}
                    onChange={(event) => {
                      const status = event.target.value as Draft["status"];
                      update({
                        show_in_navigation: pageNavigationEnabledForStatus(
                          status,
                          draft.show_in_navigation,
                        ),
                        status,
                      });
                    }}
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
                  disabled={draft.status === "unlisted"}
                  id="page-navigation"
                  onCheckedChange={(checked) => update({show_in_navigation: checked})}
                />
              </div>
              {draft.status === "unlisted" && (
                <p className="text-xs text-muted-foreground">
                  Unlisted Pages never appear in website navigation.
                </p>
              )}
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
          {savedPage && savedPage.status !== "unpublished" && <Button render={<a href={savedPage.url} target="_blank" rel="noreferrer" />} variant="outline"><ExternalLinkIcon aria-hidden="true" /> View</Button>}
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
