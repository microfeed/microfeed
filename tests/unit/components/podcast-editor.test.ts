import React from "react";
import {afterEach, describe, expect, it, vi} from "vitest";
import PodcastEntryEditor from "@/components/admin/shared/PodcastEntryEditor";
import PodcastEditor from "@/components/admin/shared/PodcastEditor";
import PodcastChapterImport from "@/components/admin/shared/PodcastChapterImport";
import AdminDialog from "@/components/admin/shared/AdminDialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {podcastPersonSchema} from "@/shared/Podcast";
import {uploadPodcastFile} from "@/client/PodcastUploads";

const hooks = vi.hoisted(() => ({values: [] as any[], cursor: 0}));
vi.mock("@/client/PodcastUploads", () => ({uploadPodcastFile: vi.fn()}));
vi.mock("react", async (original) => ({...await original<typeof import("react")>(),
  useId: () => "podcast", useEffect: () => {},
  useState(initial: unknown) {
    const i = hooks.cursor++;
    if (!(i in hooks.values)) hooks.values[i] = initial;
    return [hooks.values[i], (next: any) => { hooks.values[i] = typeof next === "function" ? next(hooks.values[i]) : next; }];
  },
  useRef(initial: unknown) {
    const i = hooks.cursor++;
    if (!(i in hooks.values)) hooks.values[i] = {current: initial};
    return hooks.values[i];
  },
}));
function find(node: React.ReactNode, predicate: (element: React.ReactElement<any>) => boolean): React.ReactElement<any> | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<any>(child)) continue;
    if (predicate(child)) return child;
    const nested = find(child.props.children, predicate);
    if (nested) return nested;
  }
  return undefined;
}
const submit = () => ({preventDefault: vi.fn(), stopPropagation: vi.fn()});
function editor(overrides: Record<string, any> = {}) {
  let entries = overrides.entries ?? [];
  const onChange = vi.fn((next: any[]) => { entries = next; });
  const render = () => {
    hooks.cursor = 0;
    return PodcastEntryEditor({name: "person", entries, initial: {name: ""}, schema: podcastPersonSchema,
      fields: [{key: "name", label: "Name", required: true}, {key: "img", label: "Photo URL", upload: "image"}], max: 50,
      summary: (entry) => entry.name, publicBucketUrl: "/media/", mediaStorageReady: true,
      ...overrides, onChange,});
  };
  return {onChange, render,
    button: (name: string) => find(render(), (el) => el.type === Button && React.Children.toArray(el.props.children).join("") === name)!.props,
    input: (key: string) => find(render(), (el) => el.type === Input && el.props.id === `podcast-${key}`)!.props,
    upload: () => find(render(), (el) => el.type === Input && el.props.type === "file")!.props,
    dialog: () => find(render(), (el) => el.type === AdminDialog)!.props,
    form: () => find(render(), (el) => el.type === "form")!.props,
  };
}
afterEach(() => { hooks.values = []; hooks.cursor = 0; vi.clearAllMocks(); });

describe("podcast entry dialogs", () => {
  it("keeps drafts local, validates required fields, and applies only a complete entry", () => {
    const control = editor();
    control.button("Add person").onClick({currentTarget: {}});
    control.form().onSubmit(submit());
    expect(control.input("name")["aria-invalid"]).toBe(true);
    control.input("name").onChange({target: {value: "  Host  "}});
    control.input("img").onChange({target: {value: "http://example.com/photo.jpg"}});
    expect(control.onChange).not.toHaveBeenCalled();
    control.form().onSubmit(submit());
    expect(control.input("img")["aria-invalid"]).toBe(true);
    control.input("img").onChange({target: {value: "https://example.com/photo.jpg"}});
    const event = submit();
    control.form().onSubmit(event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(control.onChange).toHaveBeenCalledExactlyOnceWith([{name: "Host", img: "https://example.com/photo.jpg"}]);
    expect(control.dialog().open).toBe(false);
  });
  it("discards cancelled edits, removes entries, and honors maximum counts", () => {
    const original = [{name: "Original"}];
    const control = editor({entries: original, max: 1});
    expect(control.button("Add person").disabled).toBe(true);
    control.button("Edit").onClick({currentTarget: {}});
    control.input("name").onChange({target: {value: "Cancelled"}});
    control.dialog().onOpenChange(false);
    expect(original).toEqual([{name: "Original"}]);
    expect(control.onChange).not.toHaveBeenCalled();
    control.button("Remove").onClick();
    expect(control.onChange).toHaveBeenCalledWith([]);
  });
  it("blocks save and dismissal during upload and preserves the draft on failure", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(uploadPodcastFile).mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; }));
    const control = editor();
    control.button("Add person").onClick({currentTarget: {}});
    control.input("name").onChange({target: {value: "Host"}});
    const uploading = control.upload().onChange({target: {files: [new File(["image"], "photo.jpg")], value: "photo.jpg"}});
    expect(control.dialog().closeDisabled).toBe(true);
    control.dialog().onOpenChange(false);
    control.form().onSubmit(submit());
    expect(control.onChange).not.toHaveBeenCalled();
    reject(new Error("Upload failed"));
    await uploading;
    expect(control.dialog().open).toBe(true);
    expect(control.dialog().closeDisabled).toBe(false);
    expect(control.input("name").value).toBe("Host");
    expect(control.input("img")["aria-invalid"]).toBe(true);
  });
  it("applies sorting and rejects duplicate chapter times before autosave", () => {
    const parent = PodcastEditor({value: {chapters: [{startTime: 90, title: "Later"}]}, itemId: "episode", publicBucketUrl: "", mediaStorageReady: false, onChange: vi.fn()});
    const props = find(parent, (el) => el.type === PodcastEntryEditor && el.props.name === "chapter")!.props;
    hooks.values = []; hooks.cursor = 0;
    const control = editor(props);
    control.button("Add chapter").onClick({currentTarget: {}});
    control.input("startTime").onChange({target: {value: "01:30"}});
    control.input("title").onChange({target: {value: "Duplicate"}});
    control.form().onSubmit(submit());
    expect(control.onChange).not.toHaveBeenCalled();
    expect(control.dialog().open).toBe(true);
    control.input("startTime").onChange({target: {value: "00:00.5"}});
    control.form().onSubmit(submit());
    expect(control.onChange).toHaveBeenCalledWith([{startTime: 0.5, title: "Duplicate"}, {startTime: 90, title: "Later"}]);
  });
  it("requires both an identifier and URL for custom licenses", () => {
    const parent = PodcastEditor({publicBucketUrl: "", mediaStorageReady: false, onChange: vi.fn()});
    const props = find(parent, (el) => el.type === PodcastEntryEditor && el.props.name === "license")!.props;
    hooks.values = []; hooks.cursor = 0;
    const control = editor({...props, initial: {identifier: "custom"}, toDraft: (entry: any) => entry});
    control.button("Add license").onClick({currentTarget: {}});
    control.form().onSubmit(submit());
    expect(control.input("customIdentifier")["aria-invalid"]).toBe(true);
    control.input("customIdentifier").onChange({target: {value: "My terms"}});
    control.form().onSubmit(submit());
    expect(control.input("url")["aria-invalid"]).toBe(true);
    control.input("url").onChange({target: {value: "https://example.com/license"}});
    control.form().onSubmit(submit());
    expect(control.onChange).toHaveBeenCalledWith([{identifier: "My terms", url: "https://example.com/license"}]);
  });
});

function chapterImport(validate = vi.fn<(_: unknown[]) => string | undefined>(() => undefined)) {
  const onImport = vi.fn();
  const render = () => {
    hooks.cursor = 0;
    return PodcastChapterImport({existingCount: 2, onImport, validate});
  };
  return {onImport, validate,
    button: (name: string) => find(render(), (el) => el.type === Button && el.props.children === name)!.props,
    input: () => find(render(), (el) => el.type === Input)!.props,
    dialog: () => find(render(), (el) => el.type === AdminDialog)!.props,
    form: () => find(render(), (el) => el.type === "form")!.props,
  };
}
const chapterFile = (title = "Imported") => new File([JSON.stringify({version: "1.2.0", chapters: [{startTime: 0, title}]})], "chapters.json");
const selection = (file: File) => ({target: {files: [file], value: file.name}});

describe("chapter import dialog", () => {
  it("previews without autosaving and applies the complete replacement only on submit", async () => {
    const control = chapterImport();
    control.button("Upload chapter JSON").onClick();
    expect(control.button("Replace chapters").disabled).toBe(true);
    await control.input().onChange(selection(chapterFile()));
    expect(control.onImport).not.toHaveBeenCalled();
    expect(control.button("Replace chapters").disabled).toBe(false);
    const event = submit();
    control.form().onSubmit(event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(control.onImport).toHaveBeenCalledExactlyOnceWith([{startTime: 0, title: "Imported"}]);
    expect(control.dialog().open).toBe(false);
  });
  it("clears a previous preview on failure, preserves existing chapters, and revalidates at apply time", async () => {
    const control = chapterImport();
    control.button("Upload chapter JSON").onClick();
    await control.input().onChange(selection(chapterFile()));
    await control.input().onChange(selection(new File(["bad JSON"], "bad.json")));
    expect(control.input()["aria-invalid"]).toBe(true);
    expect(control.button("Replace chapters").disabled).toBe(true);
    control.form().onSubmit(submit());
    expect(control.onImport).not.toHaveBeenCalled();
    await control.input().onChange(selection(chapterFile()));
    control.validate.mockReturnValue("Podcast fields exceed the saved metadata limit.");
    control.form().onSubmit(submit());
    expect(control.onImport).not.toHaveBeenCalled();
    expect(control.input()["aria-invalid"]).toBe(true);
    control.dialog().onOpenChange(false);
    control.button("Upload chapter JSON").onClick();
    expect(control.button("Replace chapters").disabled).toBe(true);
    expect(control.input()["aria-invalid"]).toBe(false);
  });
  it("ignores stale file reads after cancellation or a newer selection", async () => {
    const control = chapterImport();
    const slowFile = chapterFile("Old");
    let resolve!: (text: string) => void;
    vi.spyOn(slowFile, "text").mockImplementation(() => new Promise((done) => { resolve = done; }));
    control.button("Upload chapter JSON").onClick();
    const pending = control.input().onChange(selection(slowFile));
    control.dialog().onOpenChange(false);
    control.button("Upload chapter JSON").onClick();
    await control.input().onChange(selection(chapterFile("New")));
    resolve(JSON.stringify([{startTime: 0, title: "Old"}]));
    await pending;
    control.form().onSubmit(submit());
    expect(control.onImport).toHaveBeenCalledExactlyOnceWith([{startTime: 0, title: "New"}]);
  });
});
