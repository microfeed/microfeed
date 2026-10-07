import {useEffect, useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {Label} from "@/components/ui/label";
import {AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle} from "@/components/ui/alert-dialog";
import {tagAdminUrl, tagRequest, type TagList} from "@/client/tags";
import {normalizeTagName, tagNameError, type TagRecord} from "@/shared/Tags";

export default function TagsApp() {
  const [list, setList] = useState<TagList>({items: []});
  const [editing, setEditing] = useState<TagRecord>();
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [description, setDescription] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<TagRecord>();
  const nameError = name ? tagNameError(name) : undefined;
  async function load(cursor?: string) {
    try { const page = await tagRequest<TagList>(`${tagAdminUrl()}?limit=50${cursor ? `&next_cursor=${encodeURIComponent(cursor)}` : ""}`);
      setList(current => ({...page, items: cursor ? [...current.items, ...page.items] : page.items}));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load tags."); }
  }
  useEffect(() => { void load(); }, []);
  function edit(tag?: TagRecord) {setEditing(tag); setName(tag?.name ?? ""); setSlug(tag?.slug ?? ""); setDescription(tag?.description ?? ""); setError("");}
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const invalid = tagNameError(name); if (invalid) {setError(invalid); return;}
    setBusy(true); setError("");
    try { await tagRequest(tagAdminUrl(editing ? `by-id/${editing.id}` : ""), {method: editing ? "PUT" : "POST",
      body: JSON.stringify({name, description, ...(slug.trim() ? {slug} : {})})}); edit(); await load();
    } catch (cause) {setError(cause instanceof Error ? cause.message : "Could not save tag.");}
    finally {setBusy(false);}
  }
  async function remove() {
    if (!deleting) return; setBusy(true);
    try {await tagRequest(tagAdminUrl(`by-id/${deleting.id}`), {method: "DELETE"}); if (editing?.id === deleting.id) edit(); setDeleting(undefined); await load();}
    catch (cause) {setError(cause instanceof Error ? cause.message : "Could not delete tag.");}
    finally {setBusy(false);}
  }
  return <div className="space-y-6">
    <p className="text-muted-foreground">Tags are always public, including empty tags. Only published items appear in tag pages and feeds.</p>
    <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{editing ? "Edit tag" : "Create tag"}</h2>
      <div className="space-y-2"><Label htmlFor="tag-name">Name</Label>
        <Input id="tag-name" value={name} onChange={event => setName(event.target.value)} aria-invalid={Boolean(nameError)} aria-describedby="tag-name-hint tag-name-error" required />
        <p id="tag-name-hint" className="text-sm text-muted-foreground">{Array.from(normalizeTagName(name)).length}/50 characters</p>
        <p id="tag-name-error" role="alert" className="text-sm text-destructive">{nameError}</p></div>
      <div className="space-y-2"><Label htmlFor="tag-slug">URL slug</Label><Input id="tag-slug" value={slug} onChange={event => setSlug(event.target.value)} placeholder="Generated from the name" /><p className="text-sm text-muted-foreground">Editing a name keeps the existing slug. Old public URLs redirect after a slug change.</p></div>
      <div className="space-y-2"><Label htmlFor="tag-description">Description</Label><Textarea id="tag-description" value={description} onChange={event => setDescription(event.target.value)} /></div>
      <div className="flex gap-2"><Button type="submit" disabled={busy || Boolean(nameError)}>{busy ? "Saving…" : editing ? "Save tag" : "Create tag"}</Button>{editing && <Button type="button" variant="outline" disabled={busy} onClick={() => edit()}>Cancel</Button>}</div>
    </form>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <ul className="divide-y rounded-xl border bg-card">{list.items.map(tag => <li key={tag.id} className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1"><a className="font-medium break-words" href={tag.url}>{tag.name}</a><p className="text-sm text-muted-foreground">{tag.published_item_count} published items · /tags/{tag.slug}/</p></div>
      <Button variant="outline" disabled={busy} onClick={() => edit(tag)}>Edit</Button><Button variant="outline" disabled={busy} onClick={() => setDeleting(tag)}>Delete</Button></li>)}</ul>
    {!list.items.length && <p>No tags yet.</p>}
    {list.next_cursor && <Button variant="outline" onClick={() => void load(list.next_cursor)}>More tags</Button>}
    <AlertDialog open={Boolean(deleting)} onOpenChange={open => {if (!open) setDeleting(undefined);}}><AlertDialogContent><AlertDialogHeader>
      <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle><AlertDialogDescription>This removes the tag from all items. Items are preserved; the tag’s public pages and feeds will return Not Found.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => void remove()}>Delete tag</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </div>;
}
