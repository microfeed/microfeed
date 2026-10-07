import {useEffect, useState} from "react";
import {Checkbox} from "@/components/ui/checkbox";
import {Button} from "@/components/ui/button";
import {tagAdminUrl, tagRequest, type TagList} from "@/client/tags";
import {adminUrl, browserAdminPath} from "@/shared/AdminPath";

export default function TagPicker({value, onChange}: {value: string[]; onChange: (ids: string[]) => void}) {
  const [list, setList] = useState<TagList>({items: []}); const [error, setError] = useState("");
  async function load(cursor?: string) {
    try {const page = await tagRequest<TagList>(`${tagAdminUrl()}?limit=50${cursor ? `&next_cursor=${encodeURIComponent(cursor)}` : ""}`);
      setList(current => ({...page, items: cursor ? [...current.items, ...page.items] : page.items})); setError("");
    } catch (cause) {setError(cause instanceof Error ? cause.message : "Could not load tags.");}
  }
  useEffect(() => {void load();}, []);
  return <fieldset className="space-y-3 rounded-xl border p-4"><legend className="px-1 font-semibold">Tags</legend>
    <p className="text-sm text-muted-foreground">Choose existing public tags. Draft and unlisted items never appear in tag feeds.</p>
    {list.items.map(tag => <label key={tag.id} className="flex cursor-pointer items-center gap-2"><Checkbox checked={value.includes(tag.id)} onCheckedChange={checked => onChange(checked ? [...new Set([...value, tag.id])] : value.filter(id => id !== tag.id))} /><span className="min-w-0 [overflow-wrap:anywhere]">{tag.name}</span></label>)}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {list.next_cursor && <Button type="button" variant="outline" onClick={() => void load(list.next_cursor)}>More tags</Button>}
    <a className="text-sm underline" href={adminUrl("tags", browserAdminPath())}>Manage tags</a>
  </fieldset>;
}
