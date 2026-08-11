import {useState} from "react";
import {ExternalLinkIcon, XIcon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type PreviewView = "feed" | "item" | "rss";
type PreviewViewport = "mobile" | "desktop";

const VIEW_LABELS: Record<PreviewView, string> = {
  feed: "Feed",
  item: "Item",
  rss: "RSS",
};

const VIEWPORT_LABELS: Record<PreviewViewport, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
};

interface Props {
  description?: string;
  label: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  previewUrl: string;
  revision?: number;
}

export default function ThemePreviewDialog({
  description,
  label,
  onOpenChange,
  open,
  previewUrl,
  revision = 0,
}: Props) {
  const [view, setView] = useState<PreviewView>("feed");
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const renderedUrl = `${previewUrl}?view=${view}`;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
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
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {(["feed", "item", "rss"] as const).map((candidate) => (
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
          <iframe
            className="h-full min-h-[40rem] rounded-xl border bg-white shadow-sm transition-[width]"
            key={`${revision}:${view}`}
            sandbox="allow-scripts"
            src={renderedUrl}
            style={{width: viewport === "mobile" ? "min(390px, 100%)" : "100%"}}
            title={`${view} theme preview`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
