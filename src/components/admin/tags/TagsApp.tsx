import {PlusIcon, TagsIcon} from "lucide-react";
import {useEffect, useRef, useState, type FormEvent} from "react";

import {tagAdminUrl, tagRequest, type TagList} from "@/client/tags";
import {AdminCollectionError, AdminCollectionLoading} from "@/components/admin/shared/AdminCollectionState";
import AdminDialog from "@/components/admin/shared/AdminDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Textarea} from "@/components/ui/textarea";
import {normalizeTagName, TAG_NAME_MAX_LENGTH, tagNameError, type TagRecord} from "@/shared/Tags";

export default function TagsApp() {
  const [list, setList] = useState<TagList>({items: []});
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TagRecord>();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [editorError, setEditorError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<TagRecord>();
  const editorTrigger = useRef<HTMLElement | null>(null);
  const nameError = name ? tagNameError(name) : undefined;

  async function load(cursor?: string) {
    setLoading(true);
    setListError("");
    try {
      const page = await tagRequest<TagList>(
        `${tagAdminUrl()}?limit=50${cursor ? `&next_cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      setList(current => ({...page, items: cursor ? [...current.items, ...page.items] : page.items}));
    } catch (cause) {
      setListError(cause instanceof Error ? cause.message : "Could not load tags.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function openEditor(trigger: HTMLElement, tag?: TagRecord) {
    editorTrigger.current = trigger;
    setEditing(tag);
    setName(tag?.name ?? "");
    setSlug(tag?.slug ?? "");
    setDescription(tag?.description ?? "");
    setEditorError("");
    setEditorOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const invalid = tagNameError(name);
    if (invalid) {
      setEditorError(invalid);
      return;
    }
    setBusy(true);
    setEditorError("");
    try {
      await tagRequest(tagAdminUrl(editing ? `by-id/${editing.id}` : ""), {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify({name, description, ...(slug.trim() ? {slug} : {})}),
      });
      await load();
      setEditorOpen(false);
    } catch (cause) {
      setEditorError(cause instanceof Error ? cause.message : "Could not save tag.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    setListError("");
    try {
      await tagRequest(tagAdminUrl(`by-id/${deleting.id}`), {method: "DELETE"});
      setDeleting(undefined);
      await load();
    } catch (cause) {
      setDeleting(undefined);
      setListError(cause instanceof Error ? cause.message : "Could not delete tag.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Tags are always public, including empty tags. Only published items
          appear in tag pages and feeds.
        </p>
        <Button disabled={busy} onClick={event => openEditor(event.currentTarget)}>
          <PlusIcon aria-hidden="true" /> Add tag
        </Button>
      </div>

      {listError && <AdminCollectionError message={listError} retry={() => void load()} />}

      {loading && !list.items.length ? (
        <AdminCollectionLoading label="Loading tags" />
      ) : list.items.length > 0 ? (
        <div aria-busy={loading} className="overflow-hidden rounded-[14px] border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table aria-label="Tags" className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Tag</th>
                  <th scope="col" className="px-5 py-3 font-medium">URL path</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Published items</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.items.map(tag => (
                  <tr key={tag.id}>
                    <th scope="row" className="max-w-sm px-5 py-4 font-normal">
                      <span className="font-medium break-words [overflow-wrap:anywhere]">{tag.name}</span>
                      {tag.description && <p className="mt-1 line-clamp-2 break-words text-muted-foreground [overflow-wrap:anywhere]">{tag.description}</p>}
                    </th>
                    <td className="max-w-xs px-5 py-4">
                      <a className="break-all text-muted-foreground underline-offset-4 hover:underline" href={tag.url}>/tags/{tag.slug}/</a>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">{tag.published_item_count}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button aria-label={`Edit ${tag.name}`} disabled={busy} onClick={event => openEditor(event.currentTarget, tag)} size="sm" variant="outline">Edit</Button>
                        <Button aria-label={`Delete ${tag.name}`} disabled={busy} onClick={() => setDeleting(tag)} size="sm" variant="outline">Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : !listError && (
        <section className="rounded-[14px] border bg-card p-8 text-center shadow-xs">
          <TagsIcon aria-hidden="true" className="mx-auto mb-3 size-8 text-muted-foreground" />
          <h2 className="font-semibold">No tags yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Add a tag to organize your published items.</p>
        </section>
      )}

      {list.next_cursor && <div><Button disabled={busy || loading} variant="outline" onClick={() => void load(list.next_cursor)}>{loading ? "Loading…" : "More tags"}</Button></div>}

      <AdminDialog closeDisabled={busy} finalFocus={editorTrigger} onOpenChange={setEditorOpen} open={editorOpen} title={editing ? "Edit tag" : "Add tag"}>
        <form className="grid gap-4" onSubmit={save}>
          <div className="grid gap-2">
            <Label htmlFor="tag-name">Name</Label>
            <Input
              aria-describedby={`tag-name-hint${nameError ? " tag-name-error" : ""}`}
              aria-invalid={Boolean(nameError)} disabled={busy} id="tag-name"
              onChange={event => setName(event.target.value)} required value={name}
            />
            <p className="text-sm text-muted-foreground" id="tag-name-hint">{Array.from(normalizeTagName(name)).length}/{TAG_NAME_MAX_LENGTH} characters</p>
            {nameError && <p className="text-sm text-destructive" id="tag-name-error" role="alert">{nameError}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tag-slug">URL slug</Label>
            <Input aria-describedby="tag-slug-hint" disabled={busy} id="tag-slug" onChange={event => setSlug(event.target.value)} placeholder="Generated from the name" value={slug} />
            <p className="text-sm text-muted-foreground" id="tag-slug-hint">Editing a name keeps the existing slug. Old public URLs redirect after a slug change.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tag-description">Description</Label>
            <Textarea disabled={busy} id="tag-description" onChange={event => setDescription(event.target.value)} value={description} />
          </div>
          {editorError && <p className="text-sm text-destructive" role="alert">{editorError}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button disabled={busy} onClick={() => setEditorOpen(false)} type="button" variant="outline">Cancel</Button>
            <Button disabled={busy || Boolean(nameError)} type="submit">{busy ? "Saving…" : editing ? "Save tag" : "Create tag"}</Button>
          </div>
        </form>
      </AdminDialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open, details) => {
        if (!open && busy) details.cancel();
        else if (!open) setDeleting(undefined);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the tag from all items. Items are preserved; the tag’s public pages and feeds will return Not Found.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void remove()}>Delete tag</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
