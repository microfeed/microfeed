import {
  ChevronDownIcon,
  ExternalLinkIcon,
  FileJsonIcon,
  Globe2Icon,
  HomeIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  RadioIcon,
  SettingsIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {NAV_ITEMS} from "@/shared/Constants";
import type {AdminNavItemId} from "@/shared/AdminNavigation";
import AdminAboutDialog from "./AdminAboutDialog";
import type {AdminSidebarData} from "./admin-shell-types";

interface Props {
  data: AdminSidebarData;
  onNavigate?: () => void;
}

export function adminSidebarPublicItems(data: AdminSidebarData) {
  return [
    {icon: Globe2Icon, label: "Public website", url: data.publicLinks.website},
    {icon: RadioIcon, label: "Public RSS", url: data.publicLinks.rss},
    {icon: FileJsonIcon, label: "Public JSON", url: data.publicLinks.json},
  ];
}

const navigationIcons: Record<AdminNavItemId, typeof HomeIcon> = {
  [NAV_ITEMS.ADMIN_HOME]: HomeIcon,
  [NAV_ITEMS.EDIT_CHANNEL]: PencilIcon,
  [NAV_ITEMS.NEW_ITEM]: PlusIcon,
  [NAV_ITEMS.ALL_ITEMS]: ListIcon,
  [NAV_ITEMS.SETTINGS]: SettingsIcon,
};

export default function AdminSidebar({data, onNavigate}: Props) {
  const publicItems = adminSidebarPublicItems(data);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
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
            <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-data-popup-open:rotate-180" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {publicItems.map(({icon: Icon, label, url}) => (
              <DropdownMenuItem
                key={label}
                render={
                  <a href={url} rel="noopener noreferrer" target="_blank" />
                }
              >
                <Icon aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <ExternalLinkIcon aria-hidden="true" className="text-muted-foreground" />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Admin navigation">
        <ul className="grid gap-1">
          {data.items.map((item) => {
            const Icon = navigationIcons[item.id];
            const classes = [
              "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium outline-none transition-colors",
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
