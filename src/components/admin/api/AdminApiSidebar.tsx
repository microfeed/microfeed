import {
  ArrowLeftIcon,
  BlocksIcon,
  Code2Icon,
  KeyRoundIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import {
  ADMIN_API_PAGES,
  type AdminApiPage,
} from "@/shared/AdminApiNavigation";
import AdminAboutDialog from "../AdminAboutDialog";
import type {AdminApiSidebarData} from "../admin-shell-types";

interface Props {
  data: AdminApiSidebarData;
  onNavigate?: () => void;
}

const pageIcons: Record<AdminApiPage["icon"], typeof BlocksIcon> = {
  explorer: Code2Icon,
  key: KeyRoundIcon,
  oauth: ShieldCheckIcon,
  overview: BlocksIcon,
  settings: SlidersHorizontalIcon,
};

export default function AdminApiSidebar({data, onNavigate}: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar p-3 text-sidebar-foreground">
      <a
        aria-label="Go to Home"
        className="mb-5 inline-flex h-11 items-center gap-2 self-start rounded-xl px-3 text-base font-medium text-sidebar-foreground outline-none transition hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/40"
        href={data.backUrl}
        onClick={onNavigate}
      >
        <ArrowLeftIcon aria-hidden="true" className="size-5" />
        <span>Home</span>
      </a>

      <nav className="min-h-0 flex-1" aria-label="API pages">
        <ul className="grid gap-1">
          {ADMIN_API_PAGES.map((page) => {
            const Icon = pageIcons[page.icon];
            const active = page.id === data.activePage;
            return (
              <li key={page.id}>
                <a
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-base font-medium outline-none transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-light"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  ].join(" ")}
                  href={data.pageUrls[page.id]}
                  onClick={onNavigate}
                >
                  <Icon aria-hidden="true" className="size-[18px]" />
                  {page.name}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="-mx-3 -mb-3 mt-3 border-t border-sidebar-border p-3">
        <AdminAboutDialog deployment={data.deployment} />
      </div>
    </div>
  );
}
