import {PlusIcon} from "lucide-react";
import {useEffect, useId, useRef, useState} from "react";

import {tagAdminUrl, tagRequest, type TagList} from "@/client/tags";
import {Button} from "@/components/ui/button";
import {
  Combobox, ComboboxChip, ComboboxChipRemove, ComboboxChips,
  ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxInputGroup,
  ComboboxItem, ComboboxList, ComboboxTrigger, ComboboxValue,
} from "@/components/ui/combobox";
import {Label} from "@/components/ui/label";
import {adminUrl, browserAdminPath} from "@/shared/AdminPath";
import {
  normalizeTagName, normalizedTagKey, TAG_NAME_MAX_LENGTH, tagNameError,
  type TagRecord,
} from "@/shared/Tags";

interface TagOption {
  id: string;
  name: string;
  create?: boolean;
}

interface Props {
  value: string[];
  selectedTags?: Pick<TagRecord, "id" | "name">[];
  onChange: (ids: string[]) => void;
}

export default function TagPicker({value, selectedTags = [], onChange}: Props) {
  const id = useId();
  const anchor = useRef<HTMLDivElement>(null);
  const loadController = useRef<AbortController | null>(null);
  const createController = useRef<AbortController | null>(null);
  const currentValue = useRef(value);
  const currentOnChange = useRef(onChange);
  currentValue.current = value;
  currentOnChange.current = onChange;
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setLoaded(false);
    setLoadError("");
    try {
      const items: TagOption[] = [];
      let cursor: string | undefined;
      do {
        const page = await tagRequest<TagList>(
          `${tagAdminUrl()}?limit=100${cursor ? `&next_cursor=${encodeURIComponent(cursor)}` : ""}`,
          {signal: controller.signal},
        );
        if (controller.signal.aborted) return;
        items.push(...page.items.map(tag => ({id: tag.id, name: tag.name})));
        cursor = page.next_cursor;
      } while (cursor);
      setTags(items);
      setLoaded(true);
    } catch (cause) {
      if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "Could not load tags.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => {
      loadController.current?.abort();
      createController.current?.abort();
    };
  }, []);

  const knownTags = new Map([...tags, ...selectedTags].map(tag => [tag.id, tag]));
  const selected: TagOption[] = [...new Set(value)].map(tagId => knownTags.get(tagId) ?? {
    id: tagId, name: loaded ? "Unavailable tag" : "Loading tag…",
  });
  const name = normalizeTagName(query);
  const queryKey = normalizedTagKey(query);
  const nameError = query ? tagNameError(query) : undefined;
  const options: TagOption[] = [...knownTags.values()]
    .filter(tag => normalizedTagKey(tag.name).includes(queryKey));
  const canCreate = loaded && Boolean(name) && !nameError &&
    ![...knownTags.values()].some(tag => normalizedTagKey(tag.name) === queryKey);
  if (canCreate) options.push({id: `create:${queryKey}`, name, create: true});

  async function createTag(option: TagOption) {
    if (createController.current || !loaded || tagNameError(option.name)) return;
    const controller = new AbortController();
    createController.current = controller;
    setCreating(true);
    setCreateError("");
    try {
      const tag = await tagRequest<TagRecord>(tagAdminUrl(), {
        method: "POST", body: JSON.stringify({name: option.name}), signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setTags(current => [...current.filter(existing => existing.id !== tag.id), {id: tag.id, name: tag.name}]);
      currentOnChange.current([...new Set([...currentValue.current, tag.id])]);
      setQuery("");
    } catch (cause) {
      if (!controller.signal.aborted) setCreateError(cause instanceof Error ? cause.message : "Could not create tag.");
    } finally {
      if (!controller.signal.aborted) {
        createController.current = null;
        setCreating(false);
      }
    }
  }

  const error = nameError ?? createError ?? "";
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>Tags</Label>
        <a className="text-xs text-muted-foreground underline underline-offset-4" href={adminUrl("tags", browserAdminPath())} target="_blank" rel="noopener noreferrer">Manage tags<span className="sr-only"> (opens in a new tab)</span></a>
      </div>
      <Combobox<TagOption, true>
        autoHighlight filter={null} items={options} multiple open={open}
        inputValue={query} value={selected} readOnly={creating}
        itemToStringLabel={option => option.name}
        itemToStringValue={option => option.id}
        isItemEqualToValue={(option, chosen) => option.id === chosen.id}
        onInputValueChange={(text, details) => {
          if (details.reason === "input-change") {setQuery(text); setCreateError("");}
        }}
        onOpenChange={(nextOpen, details) => {
          if (details.reason === "item-press") {details.cancel(); return;}
          setOpen(nextOpen);
        }}
        onValueChange={chosen => {
          const newTag = chosen.find(option => option.create);
          if (newTag) {void createTag(newTag); return;}
          onChange([...new Set(chosen.map(option => option.id))]);
          setQuery(""); setCreateError("");
        }}
      >
        <ComboboxInputGroup ref={anchor} className="min-h-10 rounded-[10px] bg-background shadow-xs">
          <ComboboxChips aria-label="Selected tags" className="min-h-9 gap-1">
            <ComboboxValue>
              {(chosen: TagOption[]) => <>
                {chosen.map(option => <ComboboxChip key={option.id} aria-label={option.name} aria-description="Press Backspace or Delete to remove" className="h-auto min-h-6 max-w-full gap-1 rounded-md text-sm font-normal whitespace-normal">
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">{option.name}</span>
                  <ComboboxChipRemove aria-label={`Remove ${option.name}`} className="shrink-0" disabled={creating} type="button" />
                </ComboboxChip>)}
                <ComboboxInput
                  id={id} aria-label="Search or create tags" aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
                  aria-description={chosen.length ? "From the start of the input, press Left Arrow to focus selected tags" : undefined}
                  aria-invalid={Boolean(error)} placeholder={chosen.length ? "Add tags…" : "Search or create tags…"}
                  readOnly={creating} className="h-8 px-1 py-1"
                />
              </>}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxTrigger aria-label="Show tag options" disabled={creating} type="button" />
        </ComboboxInputGroup>
        <ComboboxContent anchor={anchor} aria-label="Tag options" className="rounded-[10px] border">
          <div className="flex justify-between gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
            <span>{creating ? "Creating tag…" : loading ? "Loading tags…" : "Select tags or create one"}</span>
            {name && <span className="shrink-0">{Array.from(name).length}/{TAG_NAME_MAX_LENGTH}</span>}
          </div>
          <ComboboxEmpty className="px-3 py-3 text-left">{loading ? "Loading tags…" : loadError ? "Could not load tags." : "No matching tags."}</ComboboxEmpty>
          <ComboboxList>
            {(option: TagOption) => <ComboboxItem key={option.id} value={option} disabled={creating} className="min-h-9 px-3">
              {option.create ? <><PlusIcon aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 break-words [overflow-wrap:anywhere]">Create “{option.name}”</span></> : <span className="min-w-0 rounded-sm bg-muted px-1.5 py-0.5 break-words [overflow-wrap:anywhere]">{option.name}</span>}
            </ComboboxItem>}
          </ComboboxList>
          {canCreate && <p className="border-t px-3 py-2 text-xs text-muted-foreground">New tags are public immediately, even on a draft item.</p>}
        </ComboboxContent>
      </Combobox>
      <p className="text-xs text-muted-foreground" id={`${id}-hint`}>Only published items appear in tag pages and feeds.</p>
      {creating && <p className="text-xs text-muted-foreground" role="status">Creating tag…</p>}
      {error && <p className="text-sm text-destructive" id={`${id}-error`} role="alert">{error}</p>}
      {loadError && <div className="flex items-center gap-2 text-sm" role="alert"><span className="text-destructive">{loadError}</span><Button disabled={loading || creating} onClick={() => void load()} size="sm" type="button" variant="outline">Retry</Button></div>}
      {createError && <Button disabled={loading || creating} onClick={() => void load()} size="sm" type="button" variant="ghost" className="w-fit">Refresh tags</Button>}
    </div>
  );
}
