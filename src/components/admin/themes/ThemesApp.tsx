import {useEffect, useState} from "react";
import {CircleHelpIcon, CopyIcon, SearchIcon} from "lucide-react";

import {showToast} from "@/client/ToastUtils";
import ThemeInstallHelpDialog from "@/components/admin/themes/ThemeInstallHelpDialog";
import ThemePreviewDialog from "@/components/admin/themes/ThemePreviewDialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {ADMIN_URLS} from "@/shared/StringUtils";
import type {
  ThemeListResponse,
  ThemeListSort,
  ThemeState,
  ThemeVersionSummary,
} from "@/shared/themes/ThemeContract";

interface Props {
  initialListing: ThemeListResponse;
  initialQuery: string;
  initialSort: ThemeListSort;
  instanceName: string;
}

interface Preview {label: string; url: string}

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
  return <p className="mt-1 text-xs text-muted-foreground">Installed at{" "}<time dateTime={valid ? date.toISOString() : value}>{valid ? new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short"}).format(date) : value}</time></p>;
}

function originThemeLabel(theme: ThemeVersionSummary): string {
  if (!theme.originThemeId) return "—";
  if (theme.originThemeName && theme.originThemeVersion) {
    return `${theme.originThemeName} · ${theme.originThemeVersion}`;
  }
  return "Source version is no longer available";
}

export default function ThemesApp({
  initialListing,
  initialQuery,
  initialSort,
  instanceName,
}: Props) {
  const [listing, setListing] = useState(initialListing);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<ThemeListSort>(initialSort);
  const [page, setPage] = useState(initialListing.pagination.page);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      const parameters = new URLSearchParams();
      if (query.trim()) parameters.set("q", query.trim());
      if (sort !== "status") parameters.set("sort", sort);
      if (page !== 1) parameters.set("page", String(page));
      setLoading(true);
      try {
        const next = await requestJson(`${ADMIN_URLS.ajaxThemes()}?${parameters}`,
          {signal: controller.signal}) as ThemeListResponse;
        setListing(next);
        window.history.replaceState(null, "", `${window.location.pathname}${parameters.size ? `?${parameters}` : ""}`);
      } catch (error) {
        if (!controller.signal.aborted) showToast(error instanceof Error ? error.message : "Could not load themes.", "error");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {controller.abort(); window.clearTimeout(timeout);};
  }, [page, query, sort]);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    try { await operation(); }
    catch (error) {
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
    return run(async () => {
      await requestJson(ADMIN_URLS.ajaxThemes(), {
        body: JSON.stringify({action: "activate", themeId: theme.id}),
        method: "POST",
      });
      window.location.reload();
    });
  };
  const deleteTheme = (theme: ThemeVersionSummary) => run(async () => {
    if (!window.confirm(`Delete theme ${theme.id}?\n\n${theme.packageId}@${theme.version}`)) {
      setBusy(false);
      return;
    }
    await requestJson(ADMIN_URLS.ajaxTheme(theme.id), {method: "DELETE"});
    window.location.reload();
  });
  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    showToast("Command copied.", "success");
  };

  return <div className="grid gap-5">
    {listing.drafts.length > 0 && <section className="rounded-[14px] border bg-card p-5 shadow-xs">
      <div className="flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">Version drafts</h2><p className="mt-1 text-sm text-muted-foreground">{listing.drafts.length} of {listing.limits.drafts} draft slots used.</p></div></div>
      <div className="mt-4 grid gap-3">{listing.drafts.map((draft) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" key={draft.id}><div><div className="font-medium">{draft.name}</div><code className="text-xs text-muted-foreground">{draft.packageId}@{draft.version}</code></div><Button render={<a href={ADMIN_URLS.themeDraft(draft.id)} />} variant="outline">Edit draft</Button></div>)}</div>
    </section>}

    <section className="rounded-[14px] border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Installed themes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Installed versions are immutable. Create a new version to make changes.
          </p>
        </div>
        <Button onClick={() => setInstallHelpOpen(true)} variant="outline">
          <CircleHelpIcon aria-hidden="true" />
          How to install a theme
        </Button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
        <label className="relative"><span className="sr-only">Search installed themes</span><SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" maxLength={100} onChange={(event) => {setQuery(event.target.value); setPage(1);}} placeholder="Search name, package, version, author, or source" type="search" value={query}/></label>
        <label><span className="sr-only">Sort installed themes</span><select className="h-10 w-full cursor-pointer rounded-[10px] border border-input bg-background px-3 text-sm" onChange={(event) => {setSort(event.target.value as ThemeListSort); setPage(1);}} value={sort}><option value="status">Status</option><option value="installed-desc">Newest installed</option><option value="installed-asc">Oldest installed</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option></select></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><p>{loading ? "Updating…" : `${listing.pagination.total} result${listing.pagination.total === 1 ? "" : "s"}`} · up to {listing.limits.installed} installed versions</p>{listing.pagination.totalPages > 0 && <p>Page {listing.pagination.page} of {listing.pagination.totalPages}</p>}</div>

      <div className="mt-4 grid gap-3">
        {listing.themes.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center"><h3 className="font-medium">No installed themes found</h3><p className="mt-1 text-sm text-muted-foreground">Try a different search, or open the installation guide above.</p></div>}
        {listing.themes.map((theme) => {
          const canUpdate = (theme.sourceKind === "bundled" && theme.sourcePath === "default")
            || Boolean(theme.sourceUrl || theme.sourcePath);
          const command = canUpdate
            ? `yarn manage theme update ${theme.id} --instance ${instanceName}`
            : `yarn manage theme export ${theme.id} --instance ${instanceName} --output ~/microfeed-themes/exported-theme`;
          return <article className="rounded-xl border p-4" key={theme.id}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-medium">{theme.name}</h3><Status theme={theme} state={listing.state}/></div><code className="text-xs text-muted-foreground">{theme.packageId}@{theme.version}</code><InstalledAt value={theme.createdAt}/></div><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => createVersion(theme.id)} variant="outline">Create new version</Button><Button onClick={() => setPreview({label: `${theme.name} ${theme.version}`, url: ADMIN_URLS.ajaxThemePreview(theme.id)})} variant="outline">Preview</Button><Button disabled={busy || listing.state.activeThemeId === theme.id} onClick={() => activate(theme)}>Activate</Button><Button disabled={busy || listing.state.activeThemeId === theme.id} onClick={() => deleteTheme(theme)} variant="destructive">Delete</Button></div></div>
            <details className="mt-3 border-t pt-3 text-xs">
              <summary className="cursor-pointer font-medium text-muted-foreground">Details</summary>
              <dl className="mt-3 grid gap-1 text-muted-foreground md:grid-cols-2">
                <div><dt className="inline font-medium text-foreground">Author: </dt><dd className="inline">{theme.manifest.author}</dd></div>
                <div><dt className="inline font-medium text-foreground">License: </dt><dd className="inline">{theme.manifest.license}</dd></div>
                <div><dt className="inline font-medium text-foreground">Compatibility: </dt><dd className="inline">{theme.manifest.microfeed}</dd></div>
                <div><dt className="inline font-medium text-foreground">Assets: </dt><dd className="inline">{theme.assetCount}</dd></div>
                <div><dt className="inline font-medium text-foreground">Source: </dt><dd className="inline break-all">{theme.sourceUrl ?? theme.sourcePath ?? theme.sourceKind}</dd></div>
                <div><dt className="inline font-medium text-foreground">Commit: </dt><dd className="inline break-all">{theme.sourceCommit ?? "—"}</dd></div>
                <div><dt className="inline font-medium text-foreground">Origin theme: </dt><dd className="inline">{originThemeLabel(theme)}</dd></div>
                <div className="md:col-span-2"><dt className="inline font-medium text-foreground">Checksum: </dt><dd className="inline break-all">{theme.checksumSha256}</dd></div>
              </dl>
              <div className="mt-4 rounded-lg border bg-muted/50 p-3">
                <p className="mb-2 text-muted-foreground">
                  <strong className="text-foreground">{canUpdate ? "Update this version" : "Export this version"}:</strong>{" "}
                  {canUpdate
                    ? "Check its original source and install a newer SemVer as another inactive version."
                    : "Write the installed six-file package and inherited assets to a standalone directory for backup or continued development. Exporting does not change the live site."}
                </p>
                <div className="flex items-center gap-2 rounded-lg bg-muted p-2">
                  <code className="min-w-0 flex-1 overflow-x-auto">{command}</code>
                  <Button aria-label="Copy command" onClick={() => copy(command)} size="icon-sm" variant="ghost"><CopyIcon/></Button>
                </div>
              </div>
            </details>
          </article>;
        })}
      </div>
      {listing.pagination.totalPages > 1 && <nav aria-label="Theme pages" className="mt-5 flex justify-between gap-3"><Button disabled={loading || listing.pagination.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} variant="outline">Previous</Button><Button disabled={loading || listing.pagination.page >= listing.pagination.totalPages} onClick={() => setPage((value) => value + 1)} variant="outline">Next</Button></nav>}
    </section>

    <ThemeInstallHelpDialog
      instanceName={instanceName}
      onOpenChange={setInstallHelpOpen}
      open={installHelpOpen}
    />

    {preview && <ThemePreviewDialog
      label={preview.label}
      onOpenChange={(open) => {if (!open) setPreview(null);}}
      open
      previewUrl={preview.url}
    />}
  </div>;
}
