import {useState} from "react";
import {ImageIcon, Trash2Icon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {showToast} from "@/client/ToastUtils";
import {ADMIN_URLS, humanFileSize, resolvePublicBucketUrl, urlJoinWithRelative} from "@/shared/StringUtils";
import type {MediaLibraryRecord} from "@/shared/MediaLibrary";

interface Props {
  entries: MediaLibraryRecord[];
  publicBucketUrl?: string;
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & {error?: string};
  if (!response.ok) {
    throw new Error(body.error ?? "The request failed.");
  }
  return body;
}

function absoluteUrl(url: string, publicBucketUrl: string): string {
  return urlJoinWithRelative(publicBucketUrl, url) ?? url;
}

export default function MediaLibraryApp({entries: initialEntries, publicBucketUrl: initialPublicBucketUrl}: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [busy, setBusy] = useState(false);
  const publicBucketUrl = initialPublicBucketUrl ||
    resolvePublicBucketUrl("/media/", window.location.hostname);

  const remove = async (entry: MediaLibraryRecord) => {
    if (!window.confirm(
      `Delete \`${entry.filename}\` from the media library? This permanently ` +
        "removes the uploaded file. Posts that already use this image keep " +
        "their current copy but the file will stop loading.",
    )) {
      return;
    }
    setBusy(true);
    try {
      await responseJson(await fetch(
        ADMIN_URLS.ajaxMediaLibraryEntry(entry.id),
        {method: "DELETE"},
      ));
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      showToast("Media deleted.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "The request failed.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every image you upload lands here. Pick one from the library when
          adding a post cover or inline image so you never re-upload the same
          file.
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-[14px] border bg-card p-5 text-sm text-muted-foreground shadow-xs">
          No media yet. Upload an image from an item editor and it will appear
          here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map((entry) => (
            <div
              className="group overflow-hidden rounded-[14px] border bg-card text-card-foreground shadow-xs"
              key={entry.id}
            >
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                {entry.content_type?.startsWith("image/") ? (
                  <img
                    alt={entry.filename}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={absoluteUrl(entry.url, publicBucketUrl)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon aria-hidden="true" className="size-8" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium" title={entry.filename}>
                  {entry.filename}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.format?.toUpperCase() ?? entry.content_type ?? "file"}
                  {entry.size_bytes !== null
                    ? ` · ${humanFileSize(entry.size_bytes)}`
                    : ""}
                </p>
                <Button
                  className="mt-2 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={busy}
                  onClick={() => void remove(entry)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2Icon aria-hidden="true" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
