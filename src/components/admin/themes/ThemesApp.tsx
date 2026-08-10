import {useState} from "react";
import {CopyIcon, ExternalLinkIcon} from "lucide-react";

import {showToast} from "@/client/ToastUtils";
import {Button} from "@/components/ui/button";
import {ADMIN_URLS} from "@/shared/StringUtils";
import type {
  StoredThemeVersion,
  ThemeDraft,
  ThemeState,
} from "@/shared/themes/ThemeContract";

interface Props {
  drafts: ThemeDraft[];
  instanceName: string;
  state: ThemeState;
  themes: StoredThemeVersion[];
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

function Status({theme, state}: {state: ThemeState; theme: StoredThemeVersion}) {
  if (theme.deletedAt) return <span className="rounded-full bg-muted px-2 py-1 text-xs">Deleted</span>;
  if (state.activeThemeId === theme.id) {
    return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Active</span>;
  }
  if (state.previousThemeId === theme.id) {
    return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">Previous</span>;
  }
  return <span className="rounded-full bg-muted px-2 py-1 text-xs">Inactive</span>;
}

export default function ThemesApp({drafts, instanceName, state, themes}: Props) {
  const [preview, setPreview] = useState<{id: string; view: "feed" | "item" | "rss"} | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    try {
      await operation();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Theme operation failed.", "error");
      setBusy(false);
    }
  };
  const customize = (originKind: "built-in" | "theme", themeId?: string) => run(async () => {
    const {draft} = await requestJson(ADMIN_URLS.ajaxThemes(), {
      body: JSON.stringify({action: "customize", originKind, themeId}),
      method: "POST",
    });
    window.location.assign(ADMIN_URLS.themeDraft(draft.id));
  });
  const changeState = (action: "activate" | "deactivate" | "rollback", theme?: StoredThemeVersion) => run(async () => {
    if (action === "activate" && theme) {
      const details = [
        `Activate ${theme.packageId}@${theme.version}?`,
        `Origin: ${theme.sourceUrl ?? theme.sourceKind}`,
        theme.originThemeId ? `Origin theme: ${theme.originThemeId}` : null,
        theme.sourceCommit ? `Commit: ${theme.sourceCommit}` : null,
        `Checksum: ${theme.checksumSha256}`,
      ].filter(Boolean).join("\n");
      if (!window.confirm(details)) {
        setBusy(false);
        return;
      }
    }
    await requestJson(ADMIN_URLS.ajaxThemes(), {
      body: JSON.stringify({action, themeId: theme?.id}),
      method: "POST",
    });
    window.location.reload();
  });
  const deleteTheme = (theme: StoredThemeVersion) => run(async () => {
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

  const visibleThemes = themes.filter((theme) => !theme.deletedAt);
  const deletedThemes = themes.filter((theme) => theme.deletedAt);
  return (
    <div className="grid gap-5">
      <section className="rounded-[14px] border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Theme state</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Publishing creates an inactive immutable version. Activation is a separate, confirmed action.
            </p>
          </div>
          <div className="flex gap-2">
            <Button disabled={busy || !state.activeThemeId} variant="outline" onClick={() => changeState("deactivate")}>Deactivate</Button>
            <Button disabled={busy || !state.previousThemeId} variant="outline" onClick={() => changeState("rollback")}>Rollback</Button>
          </div>
        </div>
      </section>

      <section className="rounded-[14px] border bg-card p-5 shadow-xs">
        <h2 className="text-lg font-semibold">Built-in default</h2>
        <div className="mt-4 grid gap-3">
          <div className="rounded-xl border p-4">
            <h3 className="font-medium">microfeed default</h3>
            <p className="mt-1 text-xs text-muted-foreground">Built into this microfeed release.</p>
            <Button className="mt-4" disabled={busy} variant="outline" onClick={() => customize("built-in")}>Customize</Button>
          </div>
        </div>
      </section>

      {drafts.length > 0 && (
        <section className="rounded-[14px] border bg-card p-5 shadow-xs">
          <h2 className="text-lg font-semibold">Drafts</h2>
          <div className="mt-4 grid gap-3">
            {drafts.map((draft) => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4" key={draft.id}>
                <div><div className="font-medium">{draft.name}</div><code className="text-xs text-muted-foreground">{draft.packageId}@{draft.version}</code></div>
                <Button render={<a href={ADMIN_URLS.themeDraft(draft.id)} />} variant="outline">Edit draft</Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[14px] border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Installed versions</h2><p className="mt-1 text-sm text-muted-foreground">Installed versions never change in place.</p></div>
          <code className="rounded-lg bg-muted px-3 py-2 text-xs">yarn manage theme install &lt;github-url-or-directory&gt; --instance {instanceName}</code>
        </div>
        <div className="mt-4 grid gap-4">
          {visibleThemes.length === 0 && <p className="text-sm text-muted-foreground">No D1 theme versions are installed yet.</p>}
          {visibleThemes.map((theme) => {
            const command = theme.sourceUrl || theme.sourcePath
              ? `yarn manage theme update ${theme.id} --instance ${instanceName}`
              : `yarn manage theme export ${theme.id} --instance ${instanceName} --output ./theme`;
            return (
              <article className="rounded-xl border p-4" key={theme.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2"><h3 className="font-medium">{theme.name}</h3><Status theme={theme} state={state} /></div><code className="text-xs text-muted-foreground">{theme.packageId}@{theme.version}</code></div>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={busy} variant="outline" onClick={() => customize("theme", theme.id)}>Customize</Button>
                    <Button variant="outline" onClick={() => setPreview({id: theme.id, view: "feed"})}>Preview</Button>
                    <Button disabled={busy || state.activeThemeId === theme.id} onClick={() => changeState("activate", theme)}>Activate</Button>
                    <Button disabled={busy || state.activeThemeId === theme.id} variant="destructive" onClick={() => deleteTheme(theme)}>Delete</Button>
                  </div>
                </div>
                <dl className="mt-3 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                  <div><dt className="inline font-medium text-foreground">Author: </dt><dd className="inline">{theme.manifest.author}</dd></div>
                  <div><dt className="inline font-medium text-foreground">License: </dt><dd className="inline">{theme.manifest.license}</dd></div>
                  <div><dt className="inline font-medium text-foreground">Compatibility: </dt><dd className="inline">{theme.manifest.microfeed}</dd></div>
                  <div><dt className="inline font-medium text-foreground">Source: </dt><dd className="inline break-all">{theme.sourceUrl ?? theme.sourcePath ?? theme.sourceKind}</dd></div>
                  <div><dt className="inline font-medium text-foreground">Commit: </dt><dd className="inline break-all">{theme.sourceCommit ?? "—"}</dd></div>
                  <div><dt className="inline font-medium text-foreground">Origin theme: </dt><dd className="inline break-all">{theme.originThemeId ?? "—"}</dd></div>
                  <div className="md:col-span-2"><dt className="inline font-medium text-foreground">Checksum: </dt><dd className="inline break-all">{theme.checksumSha256}</dd></div>
                </dl>
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted p-2 text-xs"><code className="min-w-0 flex-1 overflow-x-auto">{command}</code><Button aria-label="Copy command" size="icon-sm" variant="ghost" onClick={() => copy(command)}><CopyIcon /></Button></div>
              </article>
            );
          })}
        </div>
      </section>

      {preview && (
        <section className="rounded-[14px] border bg-card p-5 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Isolated preview</h2><div className="flex gap-2">{(["feed", "item", "rss"] as const).map((view) => <Button key={view} size="sm" variant={preview.view === view ? "default" : "outline"} onClick={() => setPreview({...preview, view})}>{view}</Button>)}<Button size="sm" variant="ghost" render={<a href={`${ADMIN_URLS.ajaxThemePreview(preview.id)}?view=${preview.view}`} target="_blank" />}><ExternalLinkIcon />Open</Button></div></div>
          <iframe className="h-[680px] w-full rounded-xl border bg-white" sandbox="allow-scripts" src={`${ADMIN_URLS.ajaxThemePreview(preview.id)}?view=${preview.view}`} title={`${preview.view} theme preview`} />
        </section>
      )}

      {deletedThemes.length > 0 && <details className="rounded-[14px] border bg-card p-5 shadow-xs"><summary className="cursor-pointer font-medium">Deleted versions ({deletedThemes.length})</summary><ul className="mt-3 grid gap-2 text-sm">{deletedThemes.map((theme) => <li key={theme.id}><code>{theme.packageId}@{theme.version}</code> · {theme.id}</li>)}</ul></details>}
    </div>
  );
}
