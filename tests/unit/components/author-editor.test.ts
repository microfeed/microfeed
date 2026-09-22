import React from "react";
import {afterEach, describe, expect, it, vi} from "vitest";
import AuthorEditor from "@/components/admin/shared/AuthorEditor";
import AdminDialog from "@/components/admin/shared/AdminDialog";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import AutosaveCoordinator from "@/client/AutosaveCoordinator";
import type {Identity} from "@/shared/Seo";

// Exercise local draft state and real autosave timing without a DOM test runtime.
const hooks = vi.hoisted(() => ({values: [] as unknown[], cursor: 0}));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {...react,
    useId: () => "author",
    useState(initial: unknown) {
      const index = hooks.cursor++;
      if (!(index in hooks.values)) hooks.values[index] = initial;
      return [hooks.values[index], (next: unknown) => {
        hooks.values[index] = typeof next === "function" ? next(hooks.values[index]) : next;
      }];
    },
    useRef(initial: unknown) {
      const index = hooks.cursor++;
      if (!(index in hooks.values)) hooks.values[index] = {current: initial};
      return hooks.values[index];
    },
  };
});

function find(node: React.ReactNode, predicate: (element: React.ReactElement<any>) => boolean): React.ReactElement<any> | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<any>(child)) continue;
    if (predicate(child)) return child;
    const nested = find(child.props.children, predicate);
    if (nested) return nested;
  }
  return undefined;
}

function editor(initial: Identity[] = []) {
  let authors = initial;
  const onChange = vi.fn((next: Identity[]) => { authors = next; });
  const render = () => {
    hooks.cursor = 0;
    return AuthorEditor({authors, onChange});
  };
  return {
    render, onChange,
    authors: () => authors,
    button(label: string) {
      return find(render(), (element) => element.type === Button && element.props.children === label)!.props;
    },
    input(field: string) {
      return find(render(), (element) => element.type === Input && element.props.id === `author-${field}`)!.props;
    },
    dialog: () => find(render(), (element) => element.type === AdminDialog)!.props,
    form: () => find(render(), (element) => element.type === "form")!.props,
  };
}

const submit = () => ({preventDefault: vi.fn(), stopPropagation: vi.fn()});

afterEach(() => {
  hooks.values = [];
  hooks.cursor = 0;
  vi.useRealTimers();
});

describe("author modal", () => {
  it("keeps partial authors out of autosave and commits one complete author on save", async () => {
    vi.useFakeTimers();
    const control = editor([{name: "Existing"}]);
    const save = vi.fn().mockResolvedValue(undefined);
    const autosave = new AutosaveCoordinator({getSnapshot: control.authors, onStateChange: vi.fn(), save});
    const apply = control.onChange.getMockImplementation()!;
    control.onChange.mockImplementation((next) => {
      apply(next);
      autosave.markChanged();
    });
    control.button("Add author").onClick({currentTarget: {}});
    control.input("name").onChange({target: {value: "  New writer  "}});
    control.input("url").onChange({target: {value: "https://example.com/profile/"}});
    await vi.advanceTimersByTimeAsync(30_000);
    expect(control.onChange).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    const event = submit();
    control.form().onSubmit(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(control.dialog().open).toBe(false);
    expect(control.onChange).toHaveBeenCalledExactlyOnceWith([{name: "Existing"}, {name: "New writer", url: "https://example.com/profile/"}]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(save).toHaveBeenCalledExactlyOnceWith([{name: "Existing"}, {name: "New writer", url: "https://example.com/profile/"}]);
    autosave.dispose();
  });

  it("validates before closing and discards cancelled drafts", () => {
    const control = editor();
    control.button("Add author").onClick({currentTarget: {}});
    control.form().onSubmit(submit());
    expect(control.dialog().open).toBe(true);
    expect(control.input("name")["aria-invalid"]).toBe(true);
    control.input("name").onChange({target: {value: "Writer"}});
    control.input("url").onChange({target: {value: "not a URL"}});
    control.form().onSubmit(submit());
    expect(control.input("url")["aria-invalid"]).toBe(true);
    expect(control.onChange).not.toHaveBeenCalled();
    // Cancel, Escape, outside click, and the close button use this same handler.
    control.dialog().onOpenChange(false);
    expect(control.dialog().open).toBe(false);
    control.button("Add author").onClick({currentTarget: {}});
    expect(control.input("name").value).toBe("");
    expect(control.input("url").value).toBe("");
    expect(control.onChange).not.toHaveBeenCalled();
  });

  it("edits a copy, preserves cancelled changes, and applies a valid edit only on save", () => {
    const original: Identity[] = [{name: "Original", url: "https://example.com/"}];
    const control = editor(original);
    control.button("Edit").onClick({currentTarget: {}});
    control.input("name").onChange({target: {value: "Discarded"}});
    control.dialog().onOpenChange(false);
    expect(original[0]!.name).toBe("Original");
    expect(control.onChange).not.toHaveBeenCalled();
    control.button("Edit").onClick({currentTarget: {}});
    control.input("name").onChange({target: {value: "Updated"}});
    control.input("url").onChange({target: {value: ""}});
    control.form().onSubmit(submit());
    expect(control.onChange).toHaveBeenCalledExactlyOnceWith([{name: "Updated", url: undefined}]);
  });

  it("prevents Enter during composition from submitting the modal or outer editor", () => {
    const control = editor();
    control.button("Add author").onClick({currentTarget: {}});
    const event = {key: "Enter", nativeEvent: {isComposing: true}, preventDefault: vi.fn()};
    control.form().onKeyDown(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(control.onChange).not.toHaveBeenCalled();
  });
});
