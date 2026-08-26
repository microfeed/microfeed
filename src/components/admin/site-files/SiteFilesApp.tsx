import {FileCode2Icon, PlusIcon} from "lucide-react";

import {useAdminCollection} from "@/client/useAdminCollection";
import {
  AdminCollectionError,
  AdminCollectionLoading,
} from "@/components/admin/shared/AdminCollectionState";
import {buttonVariants} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {ADMIN_URLS} from "@/shared/StringUtils";
import type {
  AdminSiteFileListResponse,
  AdminSiteFileSummary,
} from "@/shared/AdminCollections";

export function SiteFilesList({files}: {files: AdminSiteFileSummary[]}) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Root-level text files use Mustache templates and are published without a theme. You can customize built-in files or add your own.
        </p>
        <a className={cn(buttonVariants(), "!text-white hover:!text-white")} href={ADMIN_URLS.newSiteFile()}>
          <PlusIcon aria-hidden="true" /> Add Site File
        </a>
      </div>
      <div className="grid gap-3">
        {files.map((file) => (
          <a
            className="rounded-[14px] border bg-card p-4 text-card-foreground shadow-xs transition hover:border-primary/40 hover:bg-accent/30"
            href={ADMIN_URLS.editSiteFile(file.id)}
            key={file.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileCode2Icon aria-hidden="true" className="size-5 text-muted-foreground" />
                <div><h2 className="font-semibold">/{file.filename}</h2><p className="text-xs text-muted-foreground">{file.content_type}</p></div>
              </div>
              <div className="flex gap-2 text-xs">
                <span className={cn(
                  "rounded-full px-2.5 py-1 font-medium",
                  file.enabled
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground",
                )}>{file.enabled ? "Published" : "Draft"}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function SiteFilesApp() {
  const {data, error, loading, retry} =
    useAdminCollection<AdminSiteFileListResponse>(
      ADMIN_URLS.ajaxSiteFiles(),
      "Could not load Site Files.",
    );
  if (!data) {
    return error
      ? <AdminCollectionError message={error} retry={retry} />
      : <AdminCollectionLoading label="Loading Site Files" />;
  }
  return (
    <div>
      {error && (
        <div className="mb-4">
          <AdminCollectionError message={error} retry={retry} />
        </div>
      )}
      <div
        aria-busy={loading}
        className={cn("transition-opacity", loading && "opacity-60")}
      >
        <SiteFilesList files={data.items} />
      </div>
    </div>
  );
}
