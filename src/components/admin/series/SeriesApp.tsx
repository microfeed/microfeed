import {useState} from "react";
import {PencilIcon, PlusIcon, Trash2Icon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import AdminDialog from "@/components/admin/shared/AdminDialog";
import {showToast} from "@/client/ToastUtils";
import {ADMIN_URLS} from "@/shared/StringUtils";
import {
  seriesSlugFromName,
  SERIES_KINDS,
  type SeriesKind,
  type SeriesRecord,
} from "@/shared/Series";

interface Props {
  series: SeriesRecord[];
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & {error?: string};
  if (!response.ok) {
    throw new Error(body.error ?? "The request failed.");
  }
  return body;
}

interface SeriesFormState {
  description: string;
  kind: SeriesKind;
  name: string;
  slug: string;
}

function emptyForm(kind: SeriesKind): SeriesFormState {
  return {description: "", kind, name: "", slug: ""};
}

const KIND_FILTERS: Array<{label: string; value: SeriesKind | "all"}> = [
  {label: "All", value: "all"},
  {label: "Posts", value: SERIES_KINDS.POST},
  {label: "Podcasts", value: SERIES_KINDS.PODCAST},
];

export default function SeriesApp({series: initialSeries}: Props) {
  const [series, setSeries] = useState(initialSeries);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SeriesRecord | null>(null);
  const [form, setForm] = useState<SeriesFormState>(emptyForm(SERIES_KINDS.POST));
  const [kindFilter, setKindFilter] = useState<SeriesKind | "all">("all");

  const openCreate = (kind: SeriesKind) => {
    setEditing(null);
    setForm(emptyForm(kind));
    setDialogOpen(true);
  };

  const openEdit = (entry: SeriesRecord) => {
    setEditing(entry);
    setForm({
      description: entry.description ?? "",
      kind: entry.kind,
      name: entry.name,
      slug: entry.slug,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      showToast("A series name is required.", "error");
      return;
    }
    setBusy(true);
    try {
      const body = {
        description: form.description.trim(),
        kind: form.kind,
        name,
        ...(form.slug.trim() ? {slug: form.slug.trim()} : {}),
      };
      if (editing) {
        const updated = await responseJson<SeriesRecord>(await fetch(
          ADMIN_URLS.ajaxSeries(editing.id),
          {
            body: JSON.stringify(body),
            headers: {"Content-Type": "application/json"},
            method: "PUT",
          },
        ));
        setSeries((current) => current.map((entry) =>
          entry.id === updated.id ? updated : entry
        ));
        showToast("Series updated.", "success");
      } else {
        const created = await responseJson<SeriesRecord>(await fetch(
          ADMIN_URLS.ajaxSeriesList(),
          {
            body: JSON.stringify(body),
            headers: {"Content-Type": "application/json"},
            method: "POST",
          },
        ));
        setSeries((current) => [...current, created]);
        showToast("Series created.", "success");
      }
      setDialogOpen(false);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "The request failed.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry: SeriesRecord) => {
    if (!window.confirm(
      `Delete the ${entry.kind} series \`${entry.name}\`? Items keep their ` +
        "content but lose this series.",
    )) {
      return;
    }
    setBusy(true);
    try {
      await responseJson(await fetch(
        ADMIN_URLS.ajaxSeries(entry.id),
        {method: "DELETE"},
      ));
      setSeries((current) => current.filter((item) => item.id !== entry.id));
      showToast("Series deleted.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "The request failed.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  const visible = kindFilter === "all"
    ? series
    : series.filter((entry) => entry.kind === kindFilter);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Series group posts or podcast episodes into a sequence. Posts and
          podcasts keep separate series.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[10px] border bg-card p-0.5">
            {KIND_FILTERS.map((filter) => (
              <button
                aria-pressed={kindFilter === filter.value}
                className={
                  kindFilter === filter.value
                    ? "rounded-lg bg-accent px-3 py-1.5 text-sm font-medium"
                    : "rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                }
                key={filter.value}
                onClick={() => setKindFilter(filter.value)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
          <Button
            disabled={busy}
            onClick={() => openCreate(SERIES_KINDS.POST)}
            type="button"
          >
            <PlusIcon aria-hidden="true" /> Add Post Series
          </Button>
          <Button
            disabled={busy}
            onClick={() => openCreate(SERIES_KINDS.PODCAST)}
            type="button"
            variant="outline"
          >
            <PlusIcon aria-hidden="true" /> Add Podcast Series
          </Button>
        </div>
      </div>
      <div className="grid gap-3">
        {visible.length === 0 ? (
          <p className="rounded-[14px] border bg-card p-5 text-sm text-muted-foreground shadow-xs">
            {kindFilter === "all"
              ? "No series yet. Add your first series to start grouping posts."
              : `No ${kindFilter} series yet. Add one to start grouping ${kindFilter === "podcast" ? "episodes" : "posts"}.`}
          </p>
        ) : visible.map((entry) => (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border bg-card p-4 text-card-foreground shadow-xs"
            key={entry.id}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{entry.name}</h2>
                <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground">
                  {entry.kind}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">/{entry.slug}</p>
              {entry.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.description}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() => openEdit(entry)}
                size="sm"
                type="button"
                variant="outline"
              >
                <PencilIcon aria-hidden="true" /> Rename
              </Button>
              <Button
                disabled={busy}
                onClick={() => void remove(entry)}
                size="sm"
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2Icon aria-hidden="true" /> Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
      <AdminDialog
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        title={editing ? "Edit series" : "Add series"}
      >
        <div className="grid gap-4 p-4">
          <div className="grid gap-2">
            <Label htmlFor="series-kind">Type</Label>
            <div className="flex gap-2">
              {([SERIES_KINDS.POST, SERIES_KINDS.PODCAST] as SeriesKind[]).map(
                (kind) => (
                  <button
                    aria-pressed={form.kind === kind}
                    className={
                      form.kind === kind
                        ? "rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium capitalize"
                        : "rounded-full border px-3 py-1.5 text-sm capitalize text-muted-foreground hover:text-foreground"
                    }
                    disabled={Boolean(editing)}
                    key={kind}
                    onClick={() => setForm((current) => ({...current, kind}))}
                    type="button"
                  >
                    {kind}
                  </button>
                ),
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Posts and podcasts keep separate series. The type cannot change
              after creation.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="series-name">Name</Label>
            <Input
              autoFocus
              id="series-name"
              onChange={(event) => {
                const name = event.target.value;
                setForm((current) => ({
                  ...current,
                  name,
                  ...(editing || current.slug ? {} : {
                    slug: seriesSlugFromName(name),
                  }),
                }));
              }}
              placeholder="e.g. Building in Public"
              value={form.name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="series-slug">Slug</Label>
            <Input
              id="series-slug"
              onChange={(event) => setForm((current) => ({
                ...current,
                slug: event.target.value,
              }))}
              placeholder="building-in-public"
              value={form.slug}
            />
            <p className="text-xs text-muted-foreground">
              Used in public URLs. Leave blank to derive it from the name.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="series-description">Description</Label>
            <Textarea
              id="series-description"
              onChange={(event) => setForm((current) => ({
                ...current,
                description: event.target.value,
              }))}
              placeholder="A short description of this series."
              rows={3}
              value={form.description}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              disabled={busy}
              onClick={() => setDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void save()} type="button">
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </AdminDialog>
    </div>
  );
}
