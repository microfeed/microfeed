import {useEffect, useState} from "react";

import {preventCloseWhenChanged} from "@/client/BrowserUtils";
import {showToast} from "@/client/ToastUtils";
import ThemeBundleEditor, {
  type ThemeEditorLinks,
} from "@/components/admin/code-editor/ThemeBundleEditor";
import AdminDialog from "@/components/admin/shared/AdminDialog";
import AdminHelpLabel from "@/components/admin/shared/AdminHelpLabel";
import ThemePreviewDialog from "@/components/admin/themes/ThemePreviewDialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {ADMIN_URLS} from "@/shared/StringUtils";
import type {ThemeDraft, ThemeManifestV1} from "@/shared/themes/ThemeContract";

interface Props {
  draft: ThemeDraft;
  themeEditorLinks: ThemeEditorLinks;
}

type ThemeFieldKey = "author" | "license" | "microfeed" | "name" | "packageId" | "version";

const THEME_FIELD_HELP: Record<ThemeFieldKey, {description: string; label: string}> = {
  author: {
    description: "Credits the person or organization responsible for this version. Keep upstream attribution when appropriate, or name the owner of a locally derived design.",
    label: "Author",
  },
  license: {
    description: "States the terms under which this theme may be used, modified, and shared. Prefer a standard SPDX identifier such as AGPL-3.0 or MIT.",
    label: "License",
  },
  microfeed: {
    description: "An npm-style semantic-version range describing compatible microfeed releases. Installation and activation reject a version that is incompatible with the running site.",
    label: "microfeed compatibility",
  },
  name: {
    description: "The human-readable theme name shown in Admin. It is required and may be changed independently of the stable package ID.",
    label: "Name",
  },
  packageId: {
    description: "The stable machine-readable identity shared by versions in the same lineage. It is read-only in an Admin-derived draft so installing the draft creates a new version instead of a different package.",
    label: "Package ID",
  },
  version: {
    description: "The required semantic version in MAJOR.MINOR.PATCH form. A package ID and version identify one immutable installation, so choose a version that has not already been installed.",
    label: "Version",
  },
};

function ThemeFieldLabel({
  field,
  onExplain,
  required = false,
}: {
  field: ThemeFieldKey;
  onExplain: (field: ThemeFieldKey) => void;
  required?: boolean;
}) {
  const {label} = THEME_FIELD_HELP[field];
  return (
    <AdminHelpLabel
      id={`theme-${field}-label`}
      onClick={() => onExplain(field)}
      required={required}
    >
      {label}
    </AdminHelpLabel>
  );
}

async function responseJson(response: Response): Promise<any> {
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) throw new Error(data.error ?? "Draft operation failed.");
  return data;
}

export default function ThemeDraftEditorApp({
  draft: initial,
  themeEditorLinks,
}: Props) {
  const [draft, setDraft] = useState(initial);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [helpField, setHelpField] = useState<ThemeFieldKey | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  useEffect(() => preventCloseWhenChanged(() => changed), [changed]);

  const updateManifest = (updates: Partial<Record<ThemeFieldKey, string>>) => {
    setDraft({...draft, manifest: {...draft.manifest, ...updates} as ThemeManifestV1, ...("name" in updates ? {name: updates.name!} : {}), ...("version" in updates ? {version: updates.version!} : {})});
    setChanged(true);
  };
  const validateRequiredMetadata = () => {
    if (!draft.manifest.name.trim()) throw new Error("Theme name is required.");
    if (!draft.manifest.version.trim()) throw new Error("Theme version is required.");
  };
  const save = async ({notify = true}: {notify?: boolean} = {}): Promise<ThemeDraft> => {
    validateRequiredMetadata();
    setBusy(true);
    try {
      const {draft: saved} = await responseJson(await fetch(ADMIN_URLS.ajaxThemeDraft(draft.id), {
        body: JSON.stringify({bundle: draft.bundle, manifest: draft.manifest}),
        headers: {"content-type": "application/json"},
        method: "PUT",
      }));
      setDraft(saved);
      setChanged(false);
      setPreviewKey((value) => value + 1);
      if (notify) showToast("Draft saved.", "success");
      return saved;
    } finally {
      setBusy(false);
    }
  };
  const run = async (operation: () => Promise<void>) => {
    try { await operation(); } catch (error) { showToast(error instanceof Error ? error.message : "Draft operation failed.", "error"); }
  };
  const preview = () => run(async () => {
    if (changed) await save({notify: false});
    setPreviewOpen(true);
  });
  const install = () => run(async () => {
    validateRequiredMetadata();
    if (changed) await save();
    setBusy(true);
    try {
      const {theme} = await responseJson(await fetch(ADMIN_URLS.ajaxThemeDraft(draft.id), {
        body: JSON.stringify({action: "publish"}),
        headers: {"content-type": "application/json"},
        method: "POST",
      }));
      showToast(`Installed ${theme.packageId}@${theme.version} as inactive.`, "success");
      window.location.assign(ADMIN_URLS.themesSettings());
    } finally { setBusy(false); }
  });
  const discard = () => run(async () => {
    if (!window.confirm(
      `Discard draft "${draft.name}" (${draft.version})? This cannot be undone.`,
    )) return;
    await responseJson(await fetch(ADMIN_URLS.ajaxThemeDraft(draft.id), {method: "DELETE"}));
    setChanged(false);
    window.location.assign(ADMIN_URLS.themesSettings());
  });

  return <div className="grid min-w-0 gap-5">
    <section className="rounded-[14px] border bg-card p-5 shadow-xs">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <ThemeFieldLabel field="name" onExplain={setHelpField} required />
          <Input aria-labelledby="theme-name-label" id="theme-name" required value={draft.manifest.name} onChange={(event) => updateManifest({name: event.target.value})} />
        </div>
        <div>
          <ThemeFieldLabel field="version" onExplain={setHelpField} required />
          <Input aria-labelledby="theme-version-label" id="theme-version" required value={draft.manifest.version} onChange={(event) => updateManifest({version: event.target.value})} />
        </div>
      </div>
      <details className="mt-5 border-t pt-4">
        <summary className="cursor-pointer text-sm font-medium">Theme details</summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Attribution, package identity, and compatibility metadata travel with the installed version.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <ThemeFieldLabel field="author" onExplain={setHelpField} />
            <Input aria-labelledby="theme-author-label" id="theme-author" value={draft.manifest.author} onChange={(event) => updateManifest({author: event.target.value})} />
          </div>
          <div>
            <ThemeFieldLabel field="license" onExplain={setHelpField} />
            <Input aria-labelledby="theme-license-label" id="theme-license" value={draft.manifest.license} onChange={(event) => updateManifest({license: event.target.value})} />
          </div>
          <div>
            <ThemeFieldLabel field="packageId" onExplain={setHelpField} />
            <Input aria-labelledby="theme-packageId-label" id="theme-package" readOnly value={draft.manifest.packageId} />
          </div>
          <div>
            <ThemeFieldLabel field="microfeed" onExplain={setHelpField} />
            <Input aria-labelledby="theme-microfeed-label" id="theme-compatibility" value={draft.manifest.microfeed} onChange={(event) => updateManifest({microfeed: event.target.value})} />
          </div>
        </div>
      </details>
    </section>
    <section className="min-w-0 rounded-[14px] border bg-card p-5 shadow-xs"><ThemeBundleEditor bundle={draft.bundle} links={themeEditorLinks} onChange={(bundle) => {setDraft({...draft, bundle}); setChanged(true);}} /></section>
    <div className="sticky bottom-4 mx-4 flex flex-wrap items-center justify-between gap-2 rounded-[14px] border bg-card/95 p-4 shadow-lg backdrop-blur">
      <Button disabled={busy} variant="destructive" onClick={discard}>
        Discard draft
      </Button>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          disabled={busy || !changed}
          variant="outline"
          onClick={() => run(async () => {await save();})}
        >
          {busy ? "Saving…" : "Save draft"}
        </Button>
        <Button
          className="theme-preview-button"
          disabled={busy}
          onClick={preview}
          variant="outline"
        >
          Preview
        </Button>
        <Button disabled={busy} onClick={install}>
          {busy ? "Installing…" : "Install"}
        </Button>
      </div>
    </div>
    <ThemePreviewDialog
      description="Uses the saved draft and current public site data"
      label={`${draft.name} ${draft.version}`}
      onOpenChange={setPreviewOpen}
      open={previewOpen}
      previewUrl={ADMIN_URLS.ajaxThemeDraftPreview(draft.id)}
      revision={previewKey}
      supportsPagesAndSearch={draft.manifest.formatVersion === 2}
    />
    <AdminDialog
      onOpenChange={(open) => {if (!open) setHelpField(null);}}
      open={helpField !== null}
      title={helpField ? THEME_FIELD_HELP[helpField].label : "Theme field"}
    >
      {helpField && <div className="grid gap-4 py-2 text-sm leading-relaxed text-muted-foreground">
        <p>{THEME_FIELD_HELP[helpField].description}</p>
        {helpField === "microfeed" && <p>For example, <code className="rounded bg-muted px-1 py-0.5">^1.0.0</code> accepts compatible 1.x releases.</p>}
        <a className="font-medium text-primary hover:underline" href="https://docs.microfeed.org/dashboard/themes/" rel="noopener noreferrer" target="_blank">Read the theme guide</a>
      </div>}
    </AdminDialog>
  </div>;
}
