import {useEffect, useState, type ReactNode} from "react";
import {CircleHelpIcon, CopyIcon, SearchIcon} from "lucide-react";

import {showToast} from "@/client/ToastUtils";
import ThemeInstallHelpDialog from "@/components/admin/themes/ThemeInstallHelpDialog";
import ThemePreviewDialog from "@/components/admin/themes/ThemePreviewDialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {ADMIN_URLS} from "@/shared/StringUtils";
import {
  MICROFEED_MANAGE_COMMAND,
  managementCommand,
} from "@/shared/ManagementCli";
import type {
  BuiltInThemeGroup,
  ThemeAdminTab,
  ThemeListResponse,
  ThemeListSort,
  ThemeState,
  ThemeVersionSummary,
} from "@/shared/themes/ThemeContract";

interface Props {
  initialListing: ThemeListResponse;
  initialQuery: string;
  initialSort: ThemeListSort;
  initialTab: ThemeAdminTab;
  instanceName: string;
}

interface Preview {
  description?: string;
  hasPreviewFixture: boolean;
  label: string;
  supportsPagesAndSearch: boolean;
  url: string;
}

async function requestJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: {"content-type": "application/json", ...init?.headers},
  });
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) throw new Error(body.error ?? "Theme operation failed.");
  return body;
}

function Status({theme, state}: {state: ThemeState; theme: ThemeVersionSummary}) {
  if (state.activeThemeId === theme.id) {
    return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Active</span>;
  }
  if (state.previousThemeId === theme.id) {
    return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">Previous</span>;
  }
  return <span className="rounded-full bg-muted px-2 py-1 text-xs">Inactive</span>;
}

function InstalledAt({value}: {value: string}) {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/u.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  const valid = !Number.isNaN(date.getTime());
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Installed at{" "}
      <time dateTime={valid ? date.toISOString() : value}>
        {valid
          ? new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(date)
          : value}
      </time>
    </p>
  );
}

function originThemeLabel(theme: ThemeVersionSummary): string {
  if (!theme.originThemeId) return "—";
  if (theme.originThemeName && theme.originThemeVersion) {
    return `${theme.originThemeName} · ${theme.originThemeVersion}`;
  }
  return "Source version is no longer available";
}

interface VersionCardProps {
  builtIn?: boolean;
  builtInSource?: string | null;
  busy: boolean;
  children?: ReactNode;
  copy: (value: string) => Promise<void>;
  currentVersion?: string | null;
  instanceName: string;
  onActivate: (theme: ThemeVersionSummary) => void;
  onCreateVersion: (themeId: string) => void;
  onDelete: (theme: ThemeVersionSummary) => void;
  onPreview: (theme: ThemeVersionSummary) => void;
  state: ThemeState;
  theme: ThemeVersionSummary;
}

function VersionCard({
  builtIn = false,
  builtInSource,
  busy,
  children,
  copy,
  currentVersion,
  instanceName,
  onActivate,
  onCreateVersion,
  onDelete,
  onPreview,
  state,
  theme,
}: VersionCardProps) {
  const canUpdate = builtIn || Boolean(theme.sourceUrl || theme.sourcePath);
  const updateCommand = builtIn && builtInSource
    ? managementCommand(`theme install ${builtInSource} --instance ${instanceName}`)
    : managementCommand(`theme update ${theme.id} --instance ${instanceName}`);
  const exportCommand = managementCommand(
    `theme export ${theme.id} --instance ${instanceName} ` +
      `--output ~/microfeed-themes/${theme.packageId}-${theme.version} --git`,
  );
  return (
    <article className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{theme.name}</h3>
            {builtIn && (
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                Built-in
              </span>
            )}
            {currentVersion === theme.version && (
              <span className="rounded-full bg-violet-100 px-2 py-1 text-xs text-violet-800">
                Current release
              </span>
            )}
            {builtIn && theme.manifest.previewFixture && (
              <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs text-cyan-800">
                Demo content
              </span>
            )}
            <Status state={state} theme={theme} />
          </div>
          <code className="text-xs text-muted-foreground">
            {theme.packageId}@{theme.version}
          </code>
          <InstalledAt value={theme.createdAt} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => onCreateVersion(theme.id)} variant="outline">
            Create new version
          </Button>
          <Button onClick={() => onPreview(theme)} variant="outline">Preview</Button>
          <Button
            disabled={busy || state.activeThemeId === theme.id}
            onClick={() => onActivate(theme)}
          >
            Activate
          </Button>
          {!builtIn && (
            <Button
              disabled={busy || state.activeThemeId === theme.id}
              onClick={() => onDelete(theme)}
              variant="destructive"
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {theme.manifest.description && (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {theme.manifest.description}
        </p>
      )}

      {builtIn && (
        <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
          This Built-in theme is maintained by the current microfeed release and
          synchronized during deployment. Create a Custom version to change it.
        </p>
      )}

      <details className="mt-3 border-t pt-3 text-xs">
        <summary className="cursor-pointer font-medium text-muted-foreground">Details</summary>
        <dl className="mt-3 grid gap-1 text-muted-foreground md:grid-cols-2">
          <div><dt className="inline font-medium text-foreground">Author: </dt><dd className="inline">{theme.manifest.author}</dd></div>
          <div><dt className="inline font-medium text-foreground">License: </dt><dd className="inline">{theme.manifest.license}</dd></div>
          <div><dt className="inline font-medium text-foreground">Compatibility: </dt><dd className="inline">{theme.manifest.microfeed}</dd></div>
          <div><dt className="inline font-medium text-foreground">Assets: </dt><dd className="inline">{theme.assetCount}</dd></div>
          <div><dt className="inline font-medium text-foreground">Demo content: </dt><dd className="inline">{theme.manifest.previewFixture ? "Included" : "Not provided"}</dd></div>
          <div><dt className="inline font-medium text-foreground">Source: </dt><dd className="inline break-all">{theme.sourceUrl ?? theme.sourcePath ?? theme.sourceKind}</dd></div>
          <div><dt className="inline font-medium text-foreground">Commit: </dt><dd className="inline break-all">{theme.sourceCommit ?? "—"}</dd></div>
          <div><dt className="inline font-medium text-foreground">Origin theme: </dt><dd className="inline">{originThemeLabel(theme)}</dd></div>
          <div className="md:col-span-2"><dt className="inline font-medium text-foreground">Checksum: </dt><dd className="inline break-all">{theme.checksumSha256}</dd></div>
        </dl>
        <div className="mt-4 grid gap-3">
          {canUpdate && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="mb-2 text-muted-foreground">
                <strong className="text-foreground">Update this theme:</strong>{" "}
                {builtIn
                  ? "Install the current Built-in release as an inactive version. Preview it before activating."
                  : "Check its original source and install a newer SemVer as another inactive version."}
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
                <code className="min-w-0 flex-1 overflow-x-auto">{updateCommand}</code>
                <Button aria-label="Copy update command" onClick={() => copy(updateCommand)} size="icon-sm" variant="ghost">
                  <CopyIcon />
                </Button>
              </div>
            </div>
          )}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="mb-2 text-muted-foreground">
              <strong className="text-foreground">Export this version:</strong>{" "}
              Write the installed package and inherited assets to a standalone
              directory for backup or continued development. Exporting does not
              change the live site.
            </p>
            <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
              <code className="min-w-0 flex-1 overflow-x-auto">{exportCommand}</code>
              <Button aria-label="Copy export command" onClick={() => copy(exportCommand)} size="icon-sm" variant="ghost">
                <CopyIcon />
              </Button>
            </div>
          </div>
        </div>
      </details>
      {children}
    </article>
  );
}

function currentBuiltInVersion(group: BuiltInThemeGroup): ThemeVersionSummary {
  return group.versions.find(({version}) => version === group.currentVersion) ??
    group.versions[0]!;
}

export default function ThemesApp({
  initialListing,
  initialQuery,
  initialSort,
  initialTab,
  instanceName,
}: Props) {
  const [listing, setListing] = useState(initialListing);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<ThemeListSort>(initialSort);
  const [page, setPage] = useState(initialListing.pagination.page);
  const [tab, setTab] = useState<ThemeAdminTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    const parameters = new URLSearchParams({tab});
    if (tab === "custom") {
      if (query.trim()) parameters.set("q", query.trim());
      if (sort !== "status") parameters.set("sort", sort);
      if (page !== 1) parameters.set("page", String(page));
    }
    window.history.replaceState(null, "", `${window.location.pathname}?${parameters}`);
    if (tab === "built-in") {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const next = await requestJson(
          `${ADMIN_URLS.ajaxThemes()}?${parameters}`,
          {signal: controller.signal},
        ) as ThemeListResponse;
        setListing(next);
      } catch (error) {
        if (!controller.signal.aborted) {
          showToast(error instanceof Error ? error.message : "Could not load themes.", "error");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [page, query, sort, tab]);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Theme operation failed.", "error");
      setBusy(false);
    }
  };
  const createVersion = (themeId: string) => run(async () => {
    const {draft} = await requestJson(ADMIN_URLS.ajaxThemes(), {
      body: JSON.stringify({action: "customize", originKind: "theme", themeId}),
      method: "POST",
    });
    window.location.assign(ADMIN_URLS.themeDraft(draft.id));
  });
  const activate = (theme: ThemeVersionSummary) => {
    const details = [
      `Activate ${theme.packageId}@${theme.version}?`,
      `Origin: ${theme.sourceUrl ?? theme.sourceKind}`,
      theme.originThemeId ? `Origin theme: ${originThemeLabel(theme)}` : null,
      theme.sourceCommit ? `Commit: ${theme.sourceCommit}` : null,
      `Checksum: ${theme.checksumSha256}`,
    ].filter(Boolean).join("\n");
    if (!window.confirm(details)) return;
    run(async () => {
      await requestJson(ADMIN_URLS.ajaxThemes(), {
        body: JSON.stringify({action: "activate", themeId: theme.id}),
        method: "POST",
      });
      window.location.reload();
    });
  };
  const deleteTheme = (theme: ThemeVersionSummary) => {
    if (!window.confirm(`Delete theme ${theme.id}?\n\n${theme.packageId}@${theme.version}`)) return;
    run(async () => {
      await requestJson(ADMIN_URLS.ajaxTheme(theme.id), {method: "DELETE"});
      window.location.reload();
    });
  };
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    showToast("Command copied.", "success");
  };
  const previewTheme = (theme: ThemeVersionSummary) => setPreview({
    description: theme.manifest.description,
    hasPreviewFixture: Boolean(theme.manifest.previewFixture),
    label: `${theme.name} ${theme.version}`,
    supportsPagesAndSearch: theme.manifest.formatVersion === 2,
    url: ADMIN_URLS.ajaxThemePreview(theme.id),
  });
  const openTab = (next: ThemeAdminTab) => {
    setPage(1);
    setTab(next);
  };
  const tabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    current: ThemeAdminTab,
  ) => {
    let next: ThemeAdminTab | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      next = current === "built-in" ? "custom" : "built-in";
    } else if (event.key === "Home") {
      next = "built-in";
    } else if (event.key === "End") {
      next = "custom";
    }
    if (!next) return;
    event.preventDefault();
    openTab(next);
    document.getElementById(`${next}-theme-tab`)?.focus();
  };

  const cardProps = {
    busy,
    copy,
    instanceName,
    onActivate: activate,
    onCreateVersion: createVersion,
    onDelete: deleteTheme,
    onPreview: previewTheme,
    state: listing.state,
  };

  return (
    <div className="grid gap-5">
      <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        Run copied management commands from any folder. If this computer has
        not saved the site yet, first give a local coding agent{" "}
        <code>{MICROFEED_MANAGE_COMMAND}</code> and ask it to connect to the
        existing Worker.
      </p>
      <section className="rounded-[14px] border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Themes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Preview a managed Built-in design or create and install immutable
              Custom versions.
            </p>
          </div>
          <Button onClick={() => setInstallHelpOpen(true)} variant="outline">
            <CircleHelpIcon aria-hidden="true" />
            How to install a theme
          </Button>
        </div>

        <div aria-label="Theme type" className="mt-5 flex gap-2 border-b" role="tablist">
          <Button
            aria-controls="built-in-theme-panel"
            aria-selected={tab === "built-in"}
            className="rounded-b-none"
            id="built-in-theme-tab"
            onKeyDown={(event) => tabKeyDown(event, "built-in")}
            onClick={() => openTab("built-in")}
            role="tab"
            tabIndex={tab === "built-in" ? 0 : -1}
            variant={tab === "built-in" ? "default" : "ghost"}
          >
            Built-in themes ({listing.counts.builtInThemes} {listing.counts.builtInThemes === 1 ? "theme" : "themes"} ·{" "}
            {listing.counts.builtInVersions} {listing.counts.builtInVersions === 1 ? "version" : "versions"})
          </Button>
          <Button
            aria-controls="custom-theme-panel"
            aria-selected={tab === "custom"}
            className="rounded-b-none"
            id="custom-theme-tab"
            onKeyDown={(event) => tabKeyDown(event, "custom")}
            onClick={() => openTab("custom")}
            role="tab"
            tabIndex={tab === "custom" ? 0 : -1}
            variant={tab === "custom" ? "default" : "ghost"}
          >
            Custom themes ({listing.counts.customVersions} {listing.counts.customVersions === 1 ? "version" : "versions"})
          </Button>
        </div>

        {tab === "built-in" && (
          <div aria-labelledby="built-in-theme-tab" className="mt-5 grid gap-3" id="built-in-theme-panel" role="tabpanel">
            <p className="text-sm text-muted-foreground">
              Built-in themes are synchronized from the current microfeed release.
              Updates are installed inactive and never change the public site
              until you activate them.
            </p>
            {listing.builtInGroups.length === 0 && (
              <div className="rounded-xl border border-dashed p-10 text-center">
                <h3 className="font-medium">No Built-in themes installed</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Run a deployment to synchronize the Built-in catalog.
                </p>
              </div>
            )}
            {listing.builtInGroups.map((group) => {
              const current = currentBuiltInVersion(group);
              const history = group.versions.filter(({id}) => id !== current.id);
              return (
                <VersionCard {...cardProps} builtIn builtInSource={group.source} currentVersion={group.currentVersion} key={group.packageId} theme={current}>
                  {history.length > 0 && (
                    <details className="mt-4 border-t pt-3">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                        Version history ({history.length})
                      </summary>
                      <div className="mt-3 grid gap-3">
                        {history.map((theme) => (
                          <VersionCard {...cardProps} builtIn builtInSource={group.source} currentVersion={group.currentVersion} key={theme.id} theme={theme} />
                        ))}
                      </div>
                    </details>
                  )}
                </VersionCard>
              );
            })}
          </div>
        )}

        {tab === "custom" && (
          <div aria-labelledby="custom-theme-tab" className="mt-5 grid gap-5" id="custom-theme-panel" role="tabpanel">
            {listing.drafts.length > 0 && (
              <section className="rounded-xl border p-4">
                <div>
                  <h3 className="font-semibold">Version drafts</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {listing.drafts.length} of {listing.limits.drafts} draft slots used.
                  </p>
                </div>
                <div className="mt-4 grid gap-3">
                  {listing.drafts.map((draft) => (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" key={draft.id}>
                      <div>
                        <div className="font-medium">{draft.name}</div>
                        <code className="text-xs text-muted-foreground">{draft.packageId}@{draft.version}</code>
                      </div>
                      <Button render={<a href={ADMIN_URLS.themeDraft(draft.id)} />} variant="outline">Edit draft</Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div>
                <h3 className="font-semibold">Installed Custom versions</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {listing.counts.customVersions} of {listing.limits.customInstalled}{" "}
                  Custom theme versions used. Built-in themes do not use this quota.
                </p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
                <label className="relative">
                  <span className="sr-only">Search Custom themes</span>
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    maxLength={100}
                    onChange={(event) => {setQuery(event.target.value); setPage(1);}}
                    placeholder="Search name, package, version, author, or source"
                    type="search"
                    value={query}
                  />
                </label>
                <label>
                  <span className="sr-only">Sort Custom themes</span>
                  <select
                    className="h-10 w-full cursor-pointer rounded-[10px] border border-input bg-background px-3 text-sm"
                    onChange={(event) => {setSort(event.target.value as ThemeListSort); setPage(1);}}
                    value={sort}
                  >
                    <option value="status">Status</option>
                    <option value="installed-desc">Newest installed</option>
                    <option value="installed-asc">Oldest installed</option>
                    <option value="name-asc">Name A–Z</option>
                    <option value="name-desc">Name Z–A</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <p>{loading ? "Updating…" : `${listing.pagination.total} result${listing.pagination.total === 1 ? "" : "s"}`}</p>
                {listing.pagination.totalPages > 0 && <p>Page {listing.pagination.page} of {listing.pagination.totalPages}</p>}
              </div>
              <div className="mt-4 grid gap-3">
                {listing.customThemes.length === 0 && (
                  <div className="rounded-xl border border-dashed p-10 text-center">
                    <h3 className="font-medium">No Custom themes found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create a version from a Built-in theme or install a trusted theme package.
                    </p>
                  </div>
                )}
                {listing.customThemes.map((theme) => <VersionCard {...cardProps} key={theme.id} theme={theme} />)}
              </div>
              {listing.pagination.totalPages > 1 && (
                <nav aria-label="Custom theme pages" className="mt-5 flex justify-between gap-3">
                  <Button disabled={loading || listing.pagination.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} variant="outline">Previous</Button>
                  <Button disabled={loading || listing.pagination.page >= listing.pagination.totalPages} onClick={() => setPage((value) => value + 1)} variant="outline">Next</Button>
                </nav>
              )}
            </section>
          </div>
        )}
      </section>

      <ThemeInstallHelpDialog instanceName={instanceName} onOpenChange={setInstallHelpOpen} open={installHelpOpen} />

      {preview && (
        <ThemePreviewDialog
          description={preview.description}
          hasPreviewFixture={preview.hasPreviewFixture}
          label={preview.label}
          onOpenChange={(open) => {if (!open) setPreview(null);}}
          open
          previewUrl={preview.url}
          supportsPagesAndSearch={preview.supportsPagesAndSearch}
        />
      )}
    </div>
  );
}
