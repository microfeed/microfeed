import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {FileTextIcon, SearchIcon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {adminUrl} from "@/shared/AdminPath";
import {cn} from "@/lib/utils";

interface HighlightSegment {
  matched: boolean;
  text: string;
}

interface AdminSearchResult {
  edit_url: string;
  highlights: HighlightSegment[];
  id: string;
  match_type: "exact" | "fuzzy";
  status: "published" | "unlisted" | "unpublished";
  title: string;
  updated_at: string;
}

interface Props {
  adminPath: string;
}

function ResultTitle({result}: {result: AdminSearchResult}) {
  const segments = result.highlights.length > 0
    ? result.highlights
    : [{matched: false, text: result.title || "Untitled"}];
  return segments.map((segment, index) => segment.matched
    ? <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground" key={index}>{segment.text}</mark>
    : <span key={index}>{segment.text}</span>
  );
}

export default function AdminSearch({adminPath}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (searchQuery: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setMessage(null);
    try {
      const url = new URL(adminUrl("ajax/search", adminPath), window.location.origin);
      if (searchQuery) url.searchParams.set("q", searchQuery);
      const response = await fetch(url, {
        headers: {accept: "application/json"},
        signal: controller.signal,
      });
      if (response.status === 401) {
        setResults([]);
        setMessage("Your admin session expired. Sign in again, then reopen search.");
        return;
      }
      const data = await response.json().catch(() => null) as {
        error?: string;
        items?: AdminSearchResult[];
      } | null;
      if (!response.ok) {
        throw new Error(data?.error || "Search is temporarily unavailable.");
      }
      setResults(data?.items ?? []);
      setActiveIndex(0);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setResults([]);
      setMessage(error instanceof Error
        ? error.message
        : "Search is temporarily unavailable.");
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }, [adminPath]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) {
      requestRef.current?.abort();
      requestRef.current = null;
      return;
    }
    const trimmed = query.trim();
    requestRef.current?.abort();
    requestRef.current = null;
    if (trimmed.length === 1) {
      setLoading(false);
      setResults([]);
      setMessage("Type at least two characters to search.");
      return;
    }
    const delay = trimmed.length >= 2 ? 200 : 0;
    const timeout = window.setTimeout(() => void load(trimmed), delay);
    return () => window.clearTimeout(timeout);
  }, [load, open, query]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const selectResult = (index: number) => {
    const result = results[index];
    if (result) window.location.assign(result.edit_url);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setQuery("");
        setMessage(null);
        setResults([]);
      }
    }}>
      <Button
        aria-label="Search items"
        className="rounded-full sm:w-auto sm:rounded-lg sm:border sm:border-border sm:px-3"
        onClick={() => setOpen(true)}
        size="icon"
        variant="ghost"
      >
        <SearchIcon aria-hidden="true" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">⌘K</kbd>
      </Button>
      <DialogContent
        className="top-[18vh] block max-w-xl translate-y-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search items</DialogTitle>
          <DialogDescription>
            Search item titles or open one of the most recently updated items.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b px-4">
          <SearchIcon aria-hidden="true" className="size-5 text-muted-foreground" />
          <Input
            aria-activedescendant={results[activeIndex]
              ? `admin-search-result-${results[activeIndex].id}`
              : undefined}
            aria-autocomplete="list"
            aria-controls="admin-search-results"
            aria-expanded={results.length > 0}
            aria-label="Search item titles"
            className="h-14 border-0 px-0 text-base shadow-none focus-visible:ring-0"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                selectResult(activeIndex);
              }
            }}
            placeholder="Search item titles…"
            ref={inputRef}
            role="combobox"
            value={query}
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <div className="max-h-[min(55vh,28rem)] overflow-y-auto p-2">
          <p className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">
            {query.trim().length >= 2 ? "Search results" : "Recently updated"}
          </p>
          {loading && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground" role="status">
              Searching…
            </div>
          )}
          {!loading && message && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground" role="status">
              {message}
            </div>
          )}
          {!loading && !message && results.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground" role="status">
              {query.trim().length >= 2 ? "No matching items." : "No items yet."}
            </div>
          )}
          {!loading && results.length > 0 && (
            <div id="admin-search-results" role="listbox">
              {results.map((result, index) => (
                <a
                  aria-selected={index === activeIndex}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm !text-foreground outline-none",
                    index === activeIndex && "bg-muted",
                  )}
                  href={result.edit_url}
                  id={`admin-search-result-${result.id}`}
                  key={result.id}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <FileTextIcon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium"><ResultTitle result={result} /></span>
                    <span className="block text-xs capitalize text-muted-foreground">
                      {result.status}{result.match_type === "fuzzy" ? " · Similar title" : ""}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-muted-foreground">↵</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
