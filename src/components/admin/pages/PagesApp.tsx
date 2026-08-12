import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  FileTextIcon,
  GripVerticalIcon,
  PlusIcon,
} from "lucide-react";

import {showToast} from "@/client/ToastUtils";
import {Button, buttonVariants} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {ADMIN_URLS} from "@/shared/StringUtils";
import type {PageRecord} from "@/shared/Pages";

type DropPosition = "after" | "before";

export function reorderNavigationPageList(
  pages: PageRecord[],
  draggedPageId: string,
  targetPageId: string,
  position: DropPosition,
): PageRecord[] {
  if (draggedPageId === targetPageId) return pages;
  const draggedIndex = pages.findIndex(({id}) => id === draggedPageId);
  const targetIndex = pages.findIndex(({id}) => id === targetPageId);
  if (draggedIndex < 0 || targetIndex < 0) return pages;

  const reordered = [...pages];
  const [draggedPage] = reordered.splice(draggedIndex, 1);
  if (!draggedPage) return pages;
  const adjustedTargetIndex = reordered.findIndex(({id}) =>
    id === targetPageId
  );
  reordered.splice(
    position === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex,
    0,
    draggedPage,
  );
  return reordered.every(({id}, index) => id === pages[index]?.id)
    ? pages
    : reordered;
}

async function responseJson(response: Response): Promise<unknown> {
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    throw new Error(data.error ?? "Could not save the navigation order.");
  }
  return data;
}

function PageDetails({page}: {page: PageRecord}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold">{page.title}</h3>
          {page.is_not_found_page && (
            <span className="rounded-full border px-2 py-0.5 text-xs">
              Default 404
            </span>
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">/{page.slug}/</p>
      </div>
      <span className="shrink-0 rounded-full border px-2.5 py-1 text-xs capitalize">
        {page.status}
      </span>
    </>
  );
}

function NavigationPageRow({
  beginDragging,
  disabled,
  dragging,
  dropPosition,
  first,
  index,
  last,
  moveWithKeyboard,
  page,
}: {
  beginDragging: (
    pageId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  disabled: boolean;
  dragging: boolean;
  dropPosition: DropPosition | null;
  first: boolean;
  index: number;
  last: boolean;
  moveWithKeyboard: (pageId: string, direction: -1 | 1) => void;
  page: PageRecord;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 border-b px-3 py-3 transition last:border-b-0",
        dragging && "bg-muted/40 opacity-60",
        dropPosition &&
          "z-10 bg-brand-light/8 ring-1 ring-inset ring-brand-light/40",
        dropPosition === "before" &&
          "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:rounded-full before:bg-brand-light",
        dropPosition === "after" &&
          "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-light",
      )}
      data-page-navigation-id={page.id}
    >
      <Button
        aria-label={`Drag to change the navigation position of ${page.navigation_label}`}
        aria-roledescription="sortable item"
        className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" && !first) {
            event.preventDefault();
            moveWithKeyboard(page.id, -1);
          } else if (event.key === "ArrowDown" && !last) {
            event.preventDefault();
            moveWithKeyboard(page.id, 1);
          }
        }}
        onPointerDown={(event) => beginDragging(page.id, event)}
        size="icon-sm"
        title="Drag to change the order. Use Arrow Up or Arrow Down with the keyboard."
        type="button"
        variant="ghost"
      >
        <GripVerticalIcon aria-hidden="true" className="size-4" />
      </Button>
      <span className="w-7 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <a
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 text-card-foreground hover:text-primary"
        href={ADMIN_URLS.editPage(page.id)}
      >
        <PageDetails page={page} />
      </a>
    </div>
  );
}

function PageCard({page}: {page: PageRecord}) {
  return (
    <a
      className="flex items-center gap-3 rounded-[14px] border bg-card p-4 text-card-foreground shadow-xs transition hover:border-primary/40 hover:bg-accent/30"
      href={ADMIN_URLS.editPage(page.id)}
    >
      <PageDetails page={page} />
    </a>
  );
}

export default function PagesApp({
  pages,
  themeSupportsPages,
}: {
  pages: PageRecord[];
  themeSupportsPages: boolean;
}) {
  const initialNavigationPages = pages
    .filter((page) => page.show_in_navigation && !page.is_not_found_page)
    .sort((left, right) =>
      left.navigation_order - right.navigation_order ||
      left.title.localeCompare(right.title) ||
      left.id.localeCompare(right.id)
    );
  const otherPages = pages.filter((page) =>
    !page.show_in_navigation || page.is_not_found_page
  );
  const [navigationPages, setNavigationPages] = useState(
    initialNavigationPages,
  );
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    pageId: string;
    position: DropPosition;
  } | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const activePointerIdRef = useRef<number | null>(null);
  const dragChangedRef = useRef(false);
  const navigationPagesRef = useRef(navigationPages);
  const savedNavigationPagesRef = useRef(navigationPages);
  const savingOrderRef = useRef(false);

  const setOrderedPages = useCallback((orderedPages: PageRecord[]) => {
    navigationPagesRef.current = orderedPages;
    setNavigationPages(orderedPages);
  }, []);

  const persistOrder = useCallback(async (orderedPages: PageRecord[]) => {
    if (savingOrderRef.current) return;
    savingOrderRef.current = true;
    setSavingOrder(true);
    try {
      await responseJson(await fetch(ADMIN_URLS.ajaxPageOrder(), {
        body: JSON.stringify({page_ids: orderedPages.map(({id}) => id)}),
        headers: {"content-type": "application/json"},
        method: "PUT",
      }));
      savedNavigationPagesRef.current = orderedPages;
      showToast("Navigation order saved.", "success");
    } catch (error) {
      setOrderedPages(savedNavigationPagesRef.current);
      showToast(
        error instanceof Error
          ? error.message
          : "Could not save the navigation order.",
        "error",
      );
    } finally {
      savingOrderRef.current = false;
      setSavingOrder(false);
    }
  }, [setOrderedPages]);

  const finishDragging = useCallback(() => {
    activePointerIdRef.current = null;
    const changed = dragChangedRef.current;
    dragChangedRef.current = false;
    setDraggedPageId(null);
    setDropTarget(null);
    if (changed) void persistOrder(navigationPagesRef.current);
  }, [persistOrder]);

  useEffect(() => {
    if (!draggedPageId) return;
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activePointerIdRef.current) return;
      event.preventDefault();
      const targetRow = document.elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-page-navigation-id]");
      const targetPageId = targetRow?.dataset.pageNavigationId;
      if (!targetRow || !targetPageId || targetPageId === draggedPageId) {
        setDropTarget(null);
        return;
      }
      const bounds = targetRow.getBoundingClientRect();
      const position = event.clientY < bounds.top + bounds.height / 2
        ? "before"
        : "after";
      setDropTarget({pageId: targetPageId, position});
      setNavigationPages((currentPages) => {
        const reordered = reorderNavigationPageList(
          currentPages,
          draggedPageId,
          targetPageId,
          position,
        );
        if (reordered !== currentPages) {
          dragChangedRef.current = true;
          navigationPagesRef.current = reordered;
        }
        return reordered;
      });
    };
    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId === activePointerIdRef.current) finishDragging();
    };
    window.addEventListener("blur", finishDragging);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("pointermove", handlePointerMove, {passive: false});
    window.addEventListener("pointerup", handlePointerEnd);
    return () => {
      window.removeEventListener("blur", finishDragging);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
    };
  }, [draggedPageId, finishDragging]);

  const beginDragging = (
    pageId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0 || savingOrderRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerIdRef.current = event.pointerId;
    dragChangedRef.current = false;
    setDraggedPageId(pageId);
  };

  const moveWithKeyboard = (pageId: string, direction: -1 | 1) => {
    if (savingOrderRef.current) return;
    const currentPages = navigationPagesRef.current;
    const currentIndex = currentPages.findIndex(({id}) => id === pageId);
    const target = currentPages[currentIndex + direction];
    if (currentIndex < 0 || !target) return;
    const reordered = reorderNavigationPageList(
      currentPages,
      pageId,
      target.id,
      direction < 0 ? "before" : "after",
    );
    if (reordered === currentPages) return;
    setOrderedPages(reordered);
    void persistOrder(reordered);
  };

  return (
    <div className="grid gap-5">
      {!themeSupportsPages && (
        <section className="rounded-[14px] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Your current theme predates Pages. You can draft Pages now, then install
          and activate a format v2 theme before publishing them. <a className="underline" href={ADMIN_URLS.themesSettings()}>Manage themes</a>
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Pages are standalone website content such as About, Contact, or Resources.
        </p>
        <a className={cn(buttonVariants(), "!text-white hover:!text-white")} href={ADMIN_URLS.newPage()}>
          <PlusIcon aria-hidden="true" /> Add Page
        </a>
      </div>

      {pages.length > 0 && (
        <>
          <section className="overflow-hidden rounded-[14px] border bg-card shadow-xs">
            <div className="border-b p-5">
              <h2 className="font-semibold">Website navigation</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag Pages into the order their links should appear. Use the
                arrow keys on a drag handle for keyboard ordering.
              </p>
              <p aria-live="polite" className="mt-2 text-xs text-muted-foreground">
                {savingOrder ? "Saving navigation order…" : "Only Pages with Show in navigation enabled appear here."}
              </p>
            </div>
            {navigationPages.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">
                No Pages are enabled for website navigation.
              </p>
            ) : (
              <div>
                {navigationPages.map((page, index) => (
                  <NavigationPageRow
                    beginDragging={beginDragging}
                    disabled={savingOrder}
                    dragging={draggedPageId === page.id}
                    dropPosition={dropTarget?.pageId === page.id
                      ? dropTarget.position
                      : null}
                    first={index === 0}
                    index={index}
                    key={page.id}
                    last={index === navigationPages.length - 1}
                    moveWithKeyboard={moveWithKeyboard}
                    page={page}
                  />
                ))}
              </div>
            )}
          </section>

          {otherPages.length > 0 && (
            <section className="grid gap-3">
              <div>
                <h2 className="font-semibold">Other Pages</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pages hidden from navigation and the protected default 404 Page.
                </p>
              </div>
              {otherPages.map((page) => <PageCard key={page.id} page={page} />)}
            </section>
          )}
        </>
      )}

      {pages.length === 0 && (
        <section className="rounded-[14px] border bg-card p-8 text-center shadow-xs">
          <FileTextIcon aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground" />
          <h2 className="font-semibold">No Pages yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a Page without adding it to your feed.
          </p>
        </section>
      )}
    </div>
  );
}
