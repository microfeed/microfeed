import {FileCode2Icon, PlusIcon} from "lucide-react";

import {buttonVariants} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {ADMIN_URLS} from "@/shared/StringUtils";
import type {SiteFileRecord} from "@/shared/SiteFiles";

export default function SiteFilesApp({files}: {files: SiteFileRecord[]}) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Root-level text files use Mustache templates and are published without a theme. Defaults stay generated until you override them.
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
                <span className="rounded-full border px-2.5 py-1 capitalize">{file.mode}</span>
                <span className="rounded-full border px-2.5 py-1">{file.enabled ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
