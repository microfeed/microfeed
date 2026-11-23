import React from "react";
import {afterEach, describe, expect, it, vi} from "vitest";

import {tagRequest} from "@/client/tags";
import TagPicker from "@/components/admin/tags/TagPicker";
import {Button} from "@/components/ui/button";
import {Combobox, ComboboxChipRemove, ComboboxValue} from "@/components/ui/combobox";
import {TAG_NAME_LENGTH_ERROR, type TagRecord} from "@/shared/Tags";

const hooks = vi.hoisted(() => ({
  cursor: 0, values: [] as unknown[], effects: [] as (() => void | (() => void))[], cleanups: [] as (() => void)[],
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState(initial: unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => {
      hooks.values[index] = typeof value === "function" ? value(hooks.values[index]) : value;
    }];
  },
  useRef(initial: unknown) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = {current: initial};
    return hooks.values[index];
  },
  useId: () => "tag-selector",
  useEffect(effect: () => void | (() => void)) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) {hooks.values[index] = true; hooks.effects.push(effect);}
  },
}));
vi.mock("@/client/tags", () => ({
  tagAdminUrl: () => "/admin/ajax/tags/",
  tagRequest: vi.fn(),
}));

interface Option {id: string; name: string; create?: boolean;}
const saved: TagRecord = {
  id: "saved-id", name: "Café", slug: "café", description: "",
  date_created: "2026-01-01", date_modified: "2026-01-01", published_item_count: 0,
  url: "/tags/café/", rss_url: "/tags/café/rss/", json_url: "/tags/café/json/",
};

function find(node: React.ReactNode, predicate: (node: React.ReactElement<any>) => boolean): React.ReactElement<any> {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<any>(child)) continue;
    if (predicate(child)) return child;
    try {return find(child.props.children, predicate);} catch { /* Check the next sibling. */ }
  }
  throw new Error("Expected tag selector control was not rendered.");
}

function selector(initial: string[] = [], selectedTags: Option[] = []) {
  let value = initial;
  const onChange = vi.fn((next: string[]) => {value = next;});
  const render = () => {
    hooks.cursor = 0;
    return TagPicker({value, selectedTags, onChange});
  };
  const root = () => find(render(), element => element.type === Combobox).props;
  const input = (text: string) => root().onInputValueChange(text, {reason: "input-change"});
  return {
    render, root, input, onChange,
    setValue: (next: string[]) => {value = next; render();},
    async mount() {
      render();
      hooks.effects.splice(0).forEach(effect => {
        const cleanup = effect();
        if (cleanup) hooks.cleanups.push(cleanup);
      });
      await flush();
    },
  };
}

async function flush() { for (let index = 0; index < 4; index++) await Promise.resolve(); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}

afterEach(() => {
  hooks.cleanups.splice(0).forEach(cleanup => cleanup());
  hooks.values = [];
  hooks.effects = [];
  vi.resetAllMocks();
});

describe("item tag selector", () => {
  it("preserves selected names while loading every page and matches normalized names without offering duplicates", async () => {
    const lastPage = deferred<{items: TagRecord[]}>();
    vi.mocked(tagRequest).mockResolvedValueOnce({items: [saved], next_cursor: "next/100"})
      .mockReturnValueOnce(lastPage.promise);
    const picker = selector(["remote-id"], [{id: "remote-id", name: "Remote"}]);
    await picker.mount();
    expect(picker.root().value).toEqual([{id: "remote-id", name: "Remote"}]);
    picker.input("Brand new");
    expect(picker.root().items.some((option: Option) => option.create)).toBe(false);
    expect(tagRequest).toHaveBeenLastCalledWith(
      "/admin/ajax/tags/?limit=100&next_cursor=next%2F100", {signal: expect.any(AbortSignal)},
    );
    lastPage.resolve({items: [{...saved, id: "last-page", name: "Brand new"}]});
    await flush();
    expect(picker.root().items).toEqual([{id: "last-page", name: "Brand new"}]);
    picker.input(" CAFE\u0301 ");
    expect(picker.root().items).toEqual([{id: "saved-id", name: "Café"}]);
    picker.root().onValueChange([...picker.root().value, {id: saved.id, name: saved.name}]);
    expect(picker.onChange).toHaveBeenLastCalledWith(["remote-id", "saved-id"]);
    const chosen = find(picker.render(), element => element.type === ComboboxValue).props.children(picker.root().value);
    expect(find(chosen, element => element.type === ComboboxChipRemove && element.props["aria-label"] === "Remove Café").props.type).toBe("button");
    picker.root().onValueChange([{id: "remote-id", name: "Remote"}]);
    expect(picker.onChange).toHaveBeenLastCalledWith(["remote-id"]);
    expect(tagRequest).toHaveBeenCalledTimes(2);
  });

  it("creates only on an explicit choice and selects the persisted ID without overwriting newer item assignments", async () => {
    vi.mocked(tagRequest).mockResolvedValueOnce({items: [saved]});
    const picker = selector([saved.id], [saved]);
    await picker.mount();
    picker.input(" New topic ");
    const choice = picker.root().items.find((option: Option) => option.create);
    expect(choice.name).toBe("New topic");
    expect(tagRequest).toHaveBeenCalledTimes(1);
    const create = deferred<TagRecord>();
    vi.mocked(tagRequest).mockReturnValueOnce(create.promise);
    picker.root().onValueChange([...picker.root().value, choice]);
    picker.root().onValueChange([...picker.root().value, choice]);
    expect(tagRequest).toHaveBeenCalledTimes(2);
    expect(tagRequest).toHaveBeenLastCalledWith("/admin/ajax/tags/", {
      method: "POST", body: JSON.stringify({name: "New topic"}), signal: expect.any(AbortSignal),
    });
    expect(picker.root().readOnly).toBe(true);
    expect(picker.onChange).not.toHaveBeenCalled();
    picker.setValue([saved.id, "newer-assignment"]);
    create.resolve({...saved, id: "persisted-id", name: "New topic"});
    await flush();
    expect(picker.onChange).toHaveBeenLastCalledWith([saved.id, "newer-assignment", "persisted-id"]);
    expect(picker.root().value.find((option: Option) => option.id === "persisted-id").name).toBe("New topic");
    expect(picker.root().inputValue).toBe("");
  });

  it("preserves overlong Unicode input and failed create drafts without changing item membership", async () => {
    vi.mocked(tagRequest).mockResolvedValueOnce({items: []});
    const picker = selector();
    await picker.mount();
    const overlong = "🌱".repeat(51);
    picker.input(overlong);
    expect(picker.root().inputValue).toBe(overlong);
    expect(picker.root().items).toEqual([]);
    expect(find(picker.render(), element => element.props.role === "alert").props.children).toBe(TAG_NAME_LENGTH_ERROR);
    const valid = "e\u0301".repeat(50);
    picker.input(valid);
    const choice = picker.root().items.find((option: Option) => option.create);
    expect(choice.name).toBe("é".repeat(50));
    vi.mocked(tagRequest).mockRejectedValueOnce(new Error("A tag with this name already exists."));
    picker.root().onValueChange([choice]);
    await flush();
    picker.root().onOpenChange(false, {reason: "escape-key", cancel: vi.fn()});
    expect(picker.root().inputValue).toBe(valid);
    expect(find(picker.render(), element => element.props.role === "alert").props.children).toBe("A tag with this name already exists.");
    expect(picker.onChange).not.toHaveBeenCalled();
  });

  it("gates creation on a complete load, retries failures, and ignores results after leaving the editor", async () => {
    vi.mocked(tagRequest).mockRejectedValueOnce(new Error("Sign in again to manage tags."));
    const picker = selector();
    await picker.mount();
    picker.input("New topic");
    expect(picker.root().items.some((option: Option) => option.create)).toBe(false);
    vi.mocked(tagRequest).mockResolvedValueOnce({items: []});
    find(picker.render(), element => element.type === Button && element.props.children === "Retry").props.onClick();
    await flush();
    const create = deferred<TagRecord>();
    vi.mocked(tagRequest).mockReturnValueOnce(create.promise);
    const choice = picker.root().items.find((option: Option) => option.create);
    picker.root().onValueChange([choice]);
    const signal = vi.mocked(tagRequest).mock.calls.at(-1)![1]!.signal!;
    hooks.cleanups.splice(0).forEach(cleanup => cleanup());
    expect(signal.aborted).toBe(true);
    create.resolve({...saved, id: "created-after-navigation"});
    await flush();
    expect(picker.onChange).not.toHaveBeenCalled();
  });
});
