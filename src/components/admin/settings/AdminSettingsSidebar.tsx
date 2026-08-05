import {useEffect, useMemo, useState} from "react";
import {
  ActivityIcon,
  ArrowLeftIcon,
  Code2Icon,
  HardDriveIcon,
  ImageIcon,
  ListFilterIcon,
  RssIcon,
  SearchIcon,
  ShieldCheckIcon,
} from "lucide-react";

import {Input} from "@/components/ui/input";
import {
  ADMIN_SETTINGS_SECTIONS,
  filterAdminSettingsSections,
  type AdminSettingsSection,
} from "@/shared/AdminSettingsNavigation";
import {scrollToAdminSettingsSection} from "@/client/AdminSettingsScroll";
import AdminAboutDialog from "../AdminAboutDialog";
import type {AdminSettingsSidebarData} from "../admin-shell-types";

interface Props {
  data: AdminSettingsSidebarData;
  onNavigate?: () => void;
}

const sectionIcons: Record<AdminSettingsSection["icon"], typeof ActivityIcon> = {
  activity: ActivityIcon,
  code: Code2Icon,
  image: ImageIcon,
  list: ListFilterIcon,
  rss: RssIcon,
  shield: ShieldCheckIcon,
  storage: HardDriveIcon,
};

function sectionFromLocation(): AdminSettingsSection["id"] {
  if (typeof window === "undefined") {
    return ADMIN_SETTINGS_SECTIONS[0].id;
  }
  const matchingSection = ADMIN_SETTINGS_SECTIONS.find(
    ({id}) => id === window.location.hash.slice(1),
  );
  return matchingSection?.id ?? ADMIN_SETTINGS_SECTIONS[0].id;
}

export default function AdminSettingsSidebar({data, onNavigate}: Props) {
  const [activeSection, setActiveSection] = useState<AdminSettingsSection["id"]>(
    ADMIN_SETTINGS_SECTIONS[0].id,
  );
  const [query, setQuery] = useState("");
  const visibleSections = useMemo(
    () => filterAdminSettingsSections(query),
    [query],
  );

  useEffect(() => {
    if (data.activeSection) {
      setActiveSection(data.activeSection);
      return;
    }

    setActiveSection(sectionFromLocation());

    const scrollRoot = document.getElementById("admin-page-content");
    if (!scrollRoot) {
      return;
    }

    let animationFrame = 0;
    const updateActiveSection = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        if (
          scrollRoot.scrollHeight - scrollRoot.clientHeight - scrollRoot.scrollTop <= 4
        ) {
          setActiveSection(
            ADMIN_SETTINGS_SECTIONS[ADMIN_SETTINGS_SECTIONS.length - 1]!.id,
          );
          return;
        }
        const rootTop = scrollRoot.getBoundingClientRect().top;
        const threshold = rootTop + 56;
        let nextActive: AdminSettingsSection["id"] =
          ADMIN_SETTINGS_SECTIONS[0].id;
        for (const section of ADMIN_SETTINGS_SECTIONS) {
          const element = document.getElementById(section.id);
          const sectionThreshold = section.id === "custom-code"
            ? rootTop + scrollRoot.clientHeight / 2
            : threshold;
          if (
            element &&
            element.getBoundingClientRect().top <= sectionThreshold
          ) {
            nextActive = section.id;
          }
        }
        setActiveSection(nextActive);
      });
    };

    updateActiveSection();
    scrollRoot.addEventListener("scroll", updateActiveSection, {passive: true});
    window.addEventListener("resize", updateActiveSection);
    return () => {
      cancelAnimationFrame(animationFrame);
      scrollRoot.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [data.activeSection]);

  const openSection = (section: AdminSettingsSection) => {
    const sectionUrl = `${data.sectionsUrl}#${section.id}`;
    if (!scrollToAdminSettingsSection(section.id, {behavior: "smooth"})) {
      onNavigate?.();
      window.location.assign(sectionUrl);
      return;
    }
    window.history.replaceState(null, "", sectionUrl);
    setActiveSection(section.id);
    onNavigate?.();
  };

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

      <label className="relative mb-5 block">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <span className="sr-only">Search settings</span>
        <Input
          className="h-11 bg-background pl-10"
          placeholder="Search settings..."
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && visibleSections[0]) {
              event.preventDefault();
              openSection(visibleSections[0]);
            }
          }}
        />
      </label>

      <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Settings sections">
        {visibleSections.length ? (
          <ul className="grid gap-1">
            {visibleSections.map((section) => {
              const Icon = sectionIcons[section.icon];
              const active = section.id === (data.activeSection ?? activeSection);
              const sectionUrl = `${data.sectionsUrl}#${section.id}`;
              return (
                <li key={section.id}>
                  <a
                    aria-current={active ? "location" : undefined}
                    className={[
                      "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-base font-medium outline-none transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-light"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    ].join(" ")}
                    href={sectionUrl}
                    onClick={(event) => {
                      if (document.getElementById(section.id)) {
                        event.preventDefault();
                        openSection(section);
                      } else {
                        onNavigate?.();
                      }
                    }}
                  >
                    <Icon aria-hidden="true" className="size-[18px]" />
                    {section.name}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            No settings sections found.
          </p>
        )}
      </nav>

      <div className="-mx-3 -mb-3 mt-3 border-t border-sidebar-border p-3">
        <AdminAboutDialog deployment={data.deployment} />
      </div>
    </div>
  );
}
