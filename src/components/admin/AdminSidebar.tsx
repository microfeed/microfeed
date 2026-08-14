import {
  Code2Icon,
  Globe2Icon,
  HomeIcon,
  ListIcon,
  FileTextIcon,
  FileCode2Icon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  TagsIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {buttonVariants} from "@/components/ui/button";
import {cn} from "@/lib/utils";
import {NAV_ITEMS} from "@/shared/Constants";
import type {AdminNavItemId} from "@/shared/AdminNavigation";
import AdminAboutDialog from "./AdminAboutDialog";
import AdminPublicAccess from "./shared/AdminPublicAccess";
import type {AdminSidebarData} from "./admin-shell-types";

interface Props {
  data: AdminSidebarData;
  onNavigate?: () => void;
}

const navigationIcons: Record<AdminNavItemId, typeof HomeIcon> = {
  [NAV_ITEMS.ADMIN_HOME]: HomeIcon,
  [NAV_ITEMS.EDIT_CHANNEL]: PencilIcon,
  [NAV_ITEMS.ALL_ITEMS]: ListIcon,
  [NAV_ITEMS.PAGES]: FileTextIcon,
  [NAV_ITEMS.SITE_FILES]: FileCode2Icon,
  [NAV_ITEMS.CATEGORIES]: TagsIcon,
  [NAV_ITEMS.API]: Code2Icon,
  [NAV_ITEMS.SETTINGS]: SettingsIcon,
};

export default function AdminSidebar({data, onNavigate}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-3">
        <Dialog>
          <DialogTrigger
            render={
              <button
                aria-label={`Open public access links for ${data.channel.title}`}
                className="group flex min-h-16 w-full items-center gap-3 rounded-[var(--radius-card)] border border-sidebar-border bg-sidebar px-3 py-2.5 text-left shadow-xs outline-none transition hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/40"
                type="button"
              />
            }
          >
            {data.channel.imageUrl ? (
              <img
                alt=""
                aria-hidden="true"
                className="size-10 shrink-0 rounded-[10px] border border-sidebar-border object-cover"
                src={data.channel.imageUrl}
              />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-light/15 font-bold text-brand-dark ring-1 ring-brand-light/25 dark:text-brand-light">
                {data.channel.title.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="line-clamp-2 min-w-0 flex-1 text-sm leading-5 font-semibold">
              {data.channel.title}
            </span>
            <Globe2Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-3xl">
            <DialogTitle className="sr-only">
              Public access for {data.channel.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Copy or open this channel's public web, RSS, and JSON feed addresses.
            </DialogDescription>
            <AdminPublicAccess
              className="border-0 shadow-none"
              links={data.publicLinks}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="px-3 pb-2">
        {data.newItem.disabled ? (
          <span
            aria-disabled="true"
            className={cn(
              buttonVariants({size: "lg"}),
              "w-full cursor-not-allowed !text-white opacity-45",
            )}
          >
            <PlusIcon aria-hidden="true" />
            Add new item
          </span>
        ) : (
          <a
            className={cn(
              buttonVariants({size: "lg"}),
              "w-full !text-white hover:!text-white",
            )}
            data-astro-prefetch="hover"
            href={data.newItem.url}
            onClick={onNavigate}
          >
            <PlusIcon aria-hidden="true" />
            Add new item
          </a>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Admin navigation">
        <ul className="grid gap-1">
          {data.items.map((item) => {
            const Icon = navigationIcons[item.id];
            const classes = [
              "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-base font-medium outline-none transition-colors",
              item.active
                ? "bg-brand-light/12 text-brand-dark before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-light dark:text-brand-light"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              item.disabled ? "cursor-not-allowed opacity-45" : "",
            ].filter(Boolean).join(" ");

            return (
              <li key={item.id}>
                {item.disabled ? (
                  <span aria-disabled="true" className={classes}>
                    <Icon aria-hidden="true" className="size-[18px]" />
                    {item.name}
                  </span>
                ) : (
                  <a
                    aria-current={item.active ? "page" : undefined}
                    className={classes}
                    data-astro-prefetch="hover"
                    href={item.url}
                    onClick={onNavigate}
                  >
                    <Icon aria-hidden="true" className="size-[18px]" />
                    {item.name}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <AdminAboutDialog deployment={data.deployment} />
      </div>
    </div>
  );
}
