import {FileTextIcon, PlusIcon} from "lucide-react";

import {buttonVariants} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {ADMIN_URLS} from "@/shared/StringUtils";
import type {PageRecord} from "@/shared/Pages";

export default function PagesApp({
  pages,
  themeSupportsPages,
}: {
  pages: PageRecord[];
  themeSupportsPages: boolean;
}) {
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
      {pages.length === 0 ? (
        <section className="rounded-[14px] border bg-card p-8 text-center shadow-xs">
          <FileTextIcon aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground" />
          <h2 className="font-semibold">No Pages yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Create a Page without adding it to your feed.</p>
        </section>
      ) : (
        <div className="grid gap-3">
          {pages.map((page) => (
            <a
              className="rounded-[14px] border bg-card p-4 text-card-foreground shadow-xs transition hover:border-primary/40 hover:bg-accent/30"
              href={ADMIN_URLS.editPage(page.id)}
              key={page.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{page.title}</h2>
                  <p className="text-sm text-muted-foreground">/{page.slug}/</p>
                </div>
                <span className="rounded-full border px-2.5 py-1 text-xs capitalize">{page.status}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
