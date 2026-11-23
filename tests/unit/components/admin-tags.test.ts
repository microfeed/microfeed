import React from "react";
import {afterEach, describe, expect, it, vi} from "vitest";

import {tagRequest} from "@/client/tags";
import TagsApp from "@/components/admin/tags/TagsApp";
import {AdminCollectionError} from "@/components/admin/shared/AdminCollectionState";
import AdminDialog from "@/components/admin/shared/AdminDialog";
import {Button} from "@/components/ui/button";
import {TAG_NAME_LENGTH_ERROR, type TagRecord} from "@/shared/Tags";

const hooks = vi.hoisted(() => ({cursor: 0, values: [] as unknown[], effects: [] as (() => void)[]}));
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
  useEffect(effect: () => void) {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) {
      hooks.values[index] = true;
      hooks.effects.push(effect);
    }
  },
}));
vi.mock("@/client/tags", () => ({
  tagAdminUrl: (suffix = "") => `/admin/ajax/tags/${suffix ? `${suffix}/` : ""}`,
  tagRequest: vi.fn(),
}));

const tag: TagRecord = {
  id: "immutable-id", name: "News", slug: "custom-news", description: "Site updates",
  date_created: "2026-01-01", date_modified: "2026-01-01", published_item_count: 3,
  url: "https://example.com/tags/custom-news/",
  rss_url: "https://example.com/tags/custom-news/rss/",
  json_url: "https://example.com/tags/custom-news/json/",
};

afterEach(() => {
  hooks.values = [];
  hooks.effects = [];
  vi.resetAllMocks();
});

function render() {
  hooks.cursor = 0;
  return TagsApp();
}

function findOptional(node: React.ReactNode, predicate: (node: React.ReactElement<any>) => boolean): React.ReactElement<any> | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<any>(child)) continue;
    if (predicate(child)) return child;
    const nested = findOptional(child.props.children, predicate);
    if (nested) return nested;
  }
  return undefined;
}

function find(node: React.ReactNode, predicate: (node: React.ReactElement<any>) => boolean) {
  const result = findOptional(node, predicate);
  if (!result) throw new Error("Expected tag control was not rendered.");
  return result;
}

const dialog = (tree: React.ReactNode) => find(tree, element => element.type === AdminDialog);
const field = (tree: React.ReactNode, id: string) => find(tree, element => element.props.id === id);
const submit = (tree: React.ReactNode) => find(tree, element => element.type === "form").props.onSubmit({preventDefault: vi.fn()});
const trigger = {} as HTMLButtonElement;

async function mount() {
  render();
  hooks.effects.splice(0).forEach(effect => effect());
  await Promise.resolve();
  return render();
}

describe("tag dashboard editing", () => {
  it("opens Add and Edit in the same modal, discards cancelled drafts, and saves by immutable ID", async () => {
    vi.mocked(tagRequest).mockResolvedValue({items: [tag]});
    let tree = await mount();
    expect(find(tree, element => element.type === "table").props["aria-label"]).toBe("Tags");
    expect(dialog(tree).props.open).toBe(false);
    find(tree, element => element.type === Button && !element.props["aria-label"] && element.props.onClick && !element.props.type)
      .props.onClick({currentTarget: trigger});
    tree = render();
    expect(dialog(tree).props).toMatchObject({open: true, title: "Add tag", finalFocus: {current: trigger}});
    field(tree, "tag-name").props.onChange({target: {value: "Unsaved"}});
    find(tree, element => element.type === Button && element.props.children === "Cancel").props.onClick();
    tree = render();
    expect(dialog(tree).props.open).toBe(false);
    find(tree, element => element.props["aria-label"] === "Edit News").props.onClick({currentTarget: trigger});
    tree = render();
    expect(dialog(tree).props).toMatchObject({open: true, title: "Edit tag"});
    expect(field(tree, "tag-name").props.value).toBe("News");
    expect(field(tree, "tag-description").props.value).toBe("Site updates");
    field(tree, "tag-name").props.onChange({target: {value: "Renamed"}});
    vi.mocked(tagRequest).mockResolvedValueOnce(tag).mockResolvedValueOnce({items: [{...tag, name: "Renamed"}]});
    await submit(render());
    expect(tagRequest).toHaveBeenCalledWith("/admin/ajax/tags/by-id/immutable-id/", {
      method: "PUT", body: JSON.stringify({name: "Renamed", description: "Site updates", slug: "custom-news"}),
    });
    expect(dialog(render()).props.open).toBe(false);
  });

  it("keeps invalid and failed create drafts intact and prevents concurrent saves", async () => {
    vi.mocked(tagRequest).mockResolvedValue({items: []});
    let tree = await mount();
    find(tree, element => element.type === Button).props.onClick({currentTarget: trigger});
    tree = render();
    const tooLong = "🌱".repeat(51);
    field(tree, "tag-name").props.onChange({target: {value: tooLong}});
    tree = render();
    expect(field(tree, "tag-name").props.value).toBe(tooLong);
    expect(field(tree, "tag-name").props["aria-invalid"]).toBe(true);
    expect(find(tree, element => element.props.id === "tag-name-error").props.children).toBe(TAG_NAME_LENGTH_ERROR);
    expect(find(tree, element => element.type === Button && element.props.type === "submit").props.disabled).toBe(true);
    field(tree, "tag-name").props.onChange({target: {value: "e\u0301".repeat(50)}});
    tree = render();
    expect(field(tree, "tag-name").props["aria-invalid"]).toBe(false);
    let rejectSave!: (error: Error) => void;
    vi.mocked(tagRequest).mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject; }));
    const pending = submit(tree);
    tree = render();
    expect(dialog(tree).props.closeDisabled).toBe(true);
    expect(field(tree, "tag-name").props.disabled).toBe(true);
    await submit(tree);
    expect(tagRequest).toHaveBeenCalledTimes(2);
    rejectSave(new Error("A tag with that name already exists."));
    await pending;
    tree = render();
    expect(dialog(tree).props.open).toBe(true);
    expect(field(tree, "tag-name").props.value).toBe("e\u0301".repeat(50));
    expect(find(tree, element => element.props.role === "alert").props.children).toBe("A tag with that name already exists.");
    vi.mocked(tagRequest).mockResolvedValueOnce(tag).mockResolvedValueOnce({items: [tag]});
    await submit(tree);
    expect(tagRequest).toHaveBeenCalledWith("/admin/ajax/tags/", {
      method: "POST", body: JSON.stringify({name: "e\u0301".repeat(50), description: ""}),
    });
    expect(dialog(render()).props.open).toBe(false);
  });

  it("offers retry on load failure without claiming tags are empty, then appends pagination", async () => {
    vi.mocked(tagRequest).mockRejectedValueOnce(new Error("Could not load tags."));
    let tree = await mount();
    expect(findOptional(tree, element => element.type === "h2" && element.props.children === "No tags yet")).toBeUndefined();
    vi.mocked(tagRequest).mockResolvedValueOnce({items: [tag], next_cursor: "next/50"});
    find(tree, element => element.type === AdminCollectionError).props.retry();
    await Promise.resolve();
    tree = render();
    vi.mocked(tagRequest).mockResolvedValueOnce({items: [{...tag, id: "second", name: "Second"}]});
    find(tree, element => element.type === Button && element.props.children === "More tags").props.onClick();
    await Promise.resolve();
    tree = render();
    expect(tagRequest).toHaveBeenLastCalledWith("/admin/ajax/tags/?limit=50&next_cursor=next%2F50");
    expect(find(tree, element => element.type === "tbody").props.children).toHaveLength(2);
  });
});
