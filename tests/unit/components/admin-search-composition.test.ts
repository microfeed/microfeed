import React from "react";
import {afterEach, describe, expect, it, vi} from "vitest";
import AdminSearch from "@/components/admin/AdminSearch";

// Exercise the component's event handlers/effects without adding a DOM test
// framework. Child controls are left as React elements, not source assertions.
const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effects: [] as Array<() => void>,
  cleanups: [] as Array<(() => void) | undefined>,
}));

function sameDependencies(previous: readonly unknown[], next: readonly unknown[]) {
  return previous.length === next.length && next.every((value, index) => Object.is(value, previous[index]));
}

vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return {
    ...react,
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
    useCallback(callback: unknown, dependencies: readonly unknown[]) {
      const index = hooks.cursor++;
      const previous = hooks.values[index] as {callback: unknown; dependencies: readonly unknown[]} | undefined;
      if (!previous || !sameDependencies(previous.dependencies, dependencies)) {
        hooks.values[index] = {callback, dependencies};
      }
      return (hooks.values[index] as {callback: unknown}).callback;
    },
    useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]) {
      const index = hooks.cursor++;
      const previous = hooks.values[index] as readonly unknown[] | undefined;
      if (previous && dependencies && sameDependencies(previous, dependencies)) return;
      hooks.values[index] = dependencies;
      hooks.effects.push(() => {
        hooks.cleanups[index]?.();
        hooks.cleanups[index] = effect() || undefined;
      });
    },
  };
});

function render() {
  hooks.effects = [];
  hooks.cursor = 0;
  const tree = AdminSearch({adminPath: "admin"});
  hooks.effects.forEach((effect) => effect());
  return tree;
}

function unmount() {
  hooks.cleanups.forEach((cleanup) => cleanup?.());
  hooks.cleanups = [];
}

interface InputHandlers {
  children?: React.ReactNode;
  "aria-label"?: string;
  "aria-activedescendant"?: string;
  role?: string;
  onChange?: (event: {target: {value: string}}) => void;
  onCompositionStart?: () => void;
  onCompositionEnd?: (event: {currentTarget: {value: string}}) => void;
  onKeyDown?: (event: {
    key: string; nativeEvent: {isComposing: boolean};
    preventDefault: () => void; stopPropagation: () => void;
  }) => void;
}

function inputProps(node: React.ReactNode): InputHandlers {
  if (React.isValidElement<InputHandlers>(node)) {
    if (node.props["aria-label"] === "Search item titles") return node.props;
    for (const child of React.Children.toArray(node.props.children)) {
      const found = inputProps(child);
      if (found.onChange) return found;
    }
  }
  return {};
}

afterEach(() => {
  unmount();
  hooks.values = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("admin search interactions", () => {
  it("cancels pending search and ignores selection keys until composition finishes", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue({ok: true, status: 200, json: async () => ({items: []})});
    const assign = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("window", {
      setTimeout, clearTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      location: {origin: "https://feed.example.com", assign},
    });
    const tree = render();
    tree.props.onOpenChange(true);
    let input = inputProps(render());
    await vi.advanceTimersByTimeAsync(0);
    fetch.mockClear();
    input.onChange!({target: {value: "中文"}});
    input = inputProps(render());
    input.onCompositionStart!();
    input = inputProps(render());
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).not.toHaveBeenCalled();
    const event = {key: "Enter", nativeEvent: {isComposing: false}, preventDefault: vi.fn(), stopPropagation: vi.fn()};
    input.onKeyDown!(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    input.onCompositionEnd!({currentTarget: {value: "日本語"}});
    inputProps(render());
    await vi.advanceTimersByTimeAsync(200);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]![0].searchParams.get("q")).toBe("日本語");
  });

  it("debounces queries, ignores stale responses, and selects results with the keyboard", async () => {
    vi.useFakeTimers();
    const pending = new Map<string, (response: unknown) => void>();
    const fetch = vi.fn((url: URL, _options: {signal: AbortSignal}) => {
      if (!url.searchParams.has("q")) return Promise.resolve({
        ok: true, status: 200, json: async () => ({items: []}),
      });
      return new Promise(resolve => { pending.set(url.searchParams.get("q")!, resolve); });
    });
    const assign = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("window", {
      setTimeout, clearTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      location: {origin: "https://feed.example.com", assign},
    });
    render().props.onOpenChange(true);
    let input = inputProps(render());
    await vi.advanceTimersByTimeAsync(0);
    fetch.mockClear();

    input.onChange!({target: {value: "cats"}});
    input = inputProps(render());
    await vi.advanceTimersByTimeAsync(199);
    expect(fetch).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledOnce();
    const firstSignal = fetch.mock.calls[0]![1].signal;
    input.onChange!({target: {value: "dogs"}});
    input = inputProps(render());
    expect(firstSignal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(200);

    const result = (id: string) => ({
      date_published: "2026-08-13T10:00:00Z", edit_url: `/admin/items/${id}/`,
      highlights: [], id, match_type: "exact", status: "published", title: id,
      updated_at: "2026-08-13T10:00:00Z",
    });
    pending.get("dogs")!({ok: true, status: 200, json: async () => ({items: [result("dog-1"), result("dog-2")]})});
    await vi.advanceTimersByTimeAsync(0);
    pending.get("cats")!({ok: true, status: 200, json: async () => ({items: [result("stale-cat")]})});
    await vi.advanceTimersByTimeAsync(0);
    input = inputProps(render());
    expect(input.role).toBe("combobox");
    expect(input["aria-activedescendant"]).toBe("admin-search-result-dog-1");

    const key = (value: string) => ({
      key: value, nativeEvent: {isComposing: false},
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    input.onKeyDown!(key("ArrowDown"));
    input = inputProps(render());
    expect(input["aria-activedescendant"]).toBe("admin-search-result-dog-2");
    input.onKeyDown!(key("Enter"));
    expect(assign).toHaveBeenCalledWith("/admin/items/dog-2/");
  });

  it("opens with the keyboard shortcut and cancels requests on dismissal", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("window", {
      setTimeout, clearTimeout, addEventListener, removeEventListener,
      location: {origin: "https://feed.example.com"},
    });
    render();
    const shortcut = addEventListener.mock.calls.find(([event]) => event === "keydown")![1];
    const event = {ctrlKey: true, metaKey: false, key: "k", preventDefault: vi.fn()};
    shortcut(event);
    const tree = render();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(tree.props.open).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    const signal = fetch.mock.calls[0]![1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    tree.props.onOpenChange(false);
    expect(render().props.open).toBe(false);
    expect(signal.aborted).toBe(true);
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("keydown", shortcut);
  });
});
