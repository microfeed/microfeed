import {useEffect, useMemo, useState} from "react";
import {
  ArrowLeftIcon,
  BlocksIcon,
  KeyRoundIcon,
  MonitorSmartphoneIcon,
  SearchIcon,
  UserRoundIcon,
} from "lucide-react";

import {scrollToAdminSettingsSection} from "@/client/AdminSettingsScroll";
import {Input} from "@/components/ui/input";
import {
  ADMIN_ACCOUNT_SECTIONS,
  filterAdminAccountSections,
  type AdminAccountSection,
} from "@/shared/AdminAccountNavigation";
import AdminAboutDialog from "../AdminAboutDialog";
import type {AdminAccountSidebarData} from "../admin-shell-types";

interface Props {
  data: AdminAccountSidebarData;
  onNavigate?: () => void;
}

const icons: Record<AdminAccountSection["icon"], typeof BlocksIcon> = {
  apps: BlocksIcon,
  identity: UserRoundIcon,
  passkey: KeyRoundIcon,
  sessions: MonitorSmartphoneIcon,
};

function locationSection(): AdminAccountSection["id"] {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return ADMIN_ACCOUNT_SECTIONS.find(({id}) => id === hash)?.id ??
    ADMIN_ACCOUNT_SECTIONS[0].id;
}

export default function AdminAccountSidebar({data, onNavigate}: Props) {
  const [active, setActive] = useState<AdminAccountSection["id"]>(
    locationSection,
  );
  const [query, setQuery] = useState("");
  const visible = useMemo(() => filterAdminAccountSections(query), [query]);

  useEffect(() => {
    const root = document.getElementById("admin-page-content");
    if (!root) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (root.scrollHeight - root.clientHeight - root.scrollTop <= 4) {
          setActive(ADMIN_ACCOUNT_SECTIONS.at(-1)!.id);
          return;
        }
        const threshold = root.getBoundingClientRect().top + 56;
        let next: AdminAccountSection["id"] = ADMIN_ACCOUNT_SECTIONS[0].id;
        for (const section of ADMIN_ACCOUNT_SECTIONS) {
          const element = document.getElementById(section.id);
          if (element && element.getBoundingClientRect().top <= threshold) {
            next = section.id;
          }
        }
        setActive(next);
      });
    };
    update();
    root.addEventListener("scroll", update, {passive: true});
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const open = (section: AdminAccountSection) => {
    const url = `${data.sectionsUrl}#${section.id}`;
    if (!scrollToAdminSettingsSection(section.id, {behavior: "smooth"})) {
      window.location.assign(url);
    } else {
      window.history.replaceState(null, "", url);
      setActive(section.id);
    }
    onNavigate?.();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar p-3 text-sidebar-foreground">
      <a className="mb-5 inline-flex h-11 items-center gap-2 self-start rounded-xl px-3 text-base font-medium outline-none transition hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/40" href={data.backUrl} onClick={onNavigate}>
        <ArrowLeftIcon aria-hidden="true" className="size-5" /> Home
      </a>
      <label className="relative mb-5 block">
        <SearchIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <span className="sr-only">Search account settings</span>
        <Input className="h-11 bg-background pl-10" onChange={(event) => setQuery(event.target.value)} placeholder="Search account settings..." type="search" value={query} />
      </label>
      <nav aria-label="Account settings sections" className="min-h-0 flex-1 overflow-y-auto">
        {visible.length ? (
          <ul className="grid gap-1">
            {visible.map((section) => {
              const Icon = icons[section.icon];
              const selected = active === section.id;
              return (
                <li key={section.id}>
                  <a aria-current={selected ? "location" : undefined} className={["relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-base font-medium outline-none transition-colors", selected ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-light" : "hover:bg-sidebar-accent"].join(" ")} href={`${data.sectionsUrl}#${section.id}`} onClick={(event) => { event.preventDefault(); open(section); }}>
                    <Icon aria-hidden="true" className="size-[18px]" /> {section.name}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : <p className="px-3 py-2 text-sm text-muted-foreground">No account sections found.</p>}
      </nav>
      <div className="-mx-3 -mb-3 mt-3 border-t border-sidebar-border p-3">
        <AdminAboutDialog deployment={data.deployment} />
      </div>
    </div>
  );
}
