import {useEffect, useState} from "react";
import {ExternalLinkIcon, LoaderCircleIcon, XIcon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type PreviewView = "feed" | "item" | "page" | "search" | "rss";
type PreviewViewport = "mobile" | "desktop";
type PreviewDataSource = "fixture" | "site";

const VIEW_LABELS: Record<PreviewView, string> = {
  feed: "Feed",
  item: "Item",
  page: "Page",
  search: "Search",
  rss: "RSS",
};

const VIEWPORT_LABELS: Record<PreviewViewport, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
};

interface Props {
  description?: string;
  hasPreviewFixture?: boolean;
  label: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  previewUrl: string;
  revision?: number;
  supportsPagesAndSearch?: boolean;
}

export default function ThemePreviewDialog({
  description,
  hasPreviewFixture = false,
  label,
  onOpenChange,
  open,
  previewUrl,
  revision = 0,
  supportsPagesAndSearch = false,
}: Props) {
  const [view, setView] = useState<PreviewView>("feed");
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const [dataSource, setDataSource] = useState<PreviewDataSource>(
    hasPreviewFixture ? "fixture" : "site",
  );
  const renderedUrl = `${previewUrl}?${new URLSearchParams({
    data: dataSource,
    view,
  })}`;
  const frameKey = `${revision}:${view}:${renderedUrl}`;
  const [loadedFrameKey, setLoadedFrameKey] = useState<string | null>(null);
  const loading = loadedFrameKey !== frameKey;

  useEffect(() => {
    if (!open) return;
    setDataSource(hasPreviewFixture ? "fixture" : "site");
    setLoadedFrameKey(null);
  }, [hasPreviewFixture, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setLoadedFrameKey(null);
    onOpenChange(nextOpen);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        className="inset-0 top-0 left-0 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 bg-background p-0 ring-0 sm:max-w-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Isolated preview</DialogTitle>
        <DialogDescription className="sr-only">
          Preview {label} without changing the active public theme.
        </DialogDescription>
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold">
              Isolated preview
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {label}{description ? ` · ${description}` : ""}
            </p>
            {view === "search" && supportsPagesAndSearch && (
              <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                Live search is unavailable in preview. Showing preview results instead.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {(["feed", "item", ...(supportsPagesAndSearch ? ["page", "search"] as const : []), "rss"] as PreviewView[]).map((candidate) => (
              <Button
                key={candidate}
                onClick={() => setView(candidate)}
                size="sm"
                variant={view === candidate ? "default" : "outline"}
              >
                {VIEW_LABELS[candidate]}
              </Button>
            ))}
            <span aria-hidden="true" className="mx-1 h-6 border-l" />
            {hasPreviewFixture && ([
              ["fixture", "Demo content"],
              ["site", "Current site"],
            ] as const).map(([candidate, candidateLabel]) => (
              <Button
                key={candidate}
                onClick={() => setDataSource(candidate)}
                size="sm"
                variant={dataSource === candidate ? "secondary" : "ghost"}
              >
                {candidateLabel}
              </Button>
            ))}
            {hasPreviewFixture && (
              <span aria-hidden="true" className="mx-1 h-6 border-l" />
            )}
            {(["mobile", "desktop"] as const).map((candidate) => (
              <Button
                key={candidate}
                onClick={() => setViewport(candidate)}
                size="sm"
                variant={viewport === candidate ? "secondary" : "ghost"}
              >
                {VIEWPORT_LABELS[candidate]}
              </Button>
            ))}
            <Button
              render={(
                <a
                  href={renderedUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                />
              )}
              size="sm"
              variant="outline"
            >
              <ExternalLinkIcon aria-hidden="true" />
              Open
            </Button>
            <DialogClose render={<Button size="sm" variant="outline" />}>
              <XIcon aria-hidden="true" />
              Close
            </DialogClose>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-muted/40 p-3">
          <div
            aria-busy={loading}
            className="relative h-full min-h-[40rem] overflow-hidden rounded-xl border bg-white shadow-sm transition-[width]"
            style={{width: viewport === "mobile" ? "min(390px, 100%)" : "100%"}}
          >
            {loading && (
              <div
                aria-live="polite"
                className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background text-sm text-muted-foreground"
                role="status"
              >
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="size-5 animate-spin text-primary"
                />
                <span>Theme is loading…</span>
              </div>
            )}
            <iframe
              className="h-full w-full border-0 bg-white"
              key={frameKey}
              onLoad={() => setLoadedFrameKey(frameKey)}
              sandbox="allow-scripts"
              src={renderedUrl}
              title={`${view} theme preview`}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
