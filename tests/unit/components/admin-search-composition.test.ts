import React from "react";
import {afterEach, describe, expect, it, vi} from "vitest";
import AdminSearch from "@/components/admin/AdminSearch";

// Exercise the component's event handlers/effects without adding a DOM test
// framework. Child controls are left as React elements, not source assertions.
const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
  effects: [] as Array<() => void | (() => void)>,
  cleanups: [] as Array<() => void>,
}));

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
    useCallback(callback: unknown) { return callback; },
    useEffect(effect: () => void | (() => void)) { hooks.effects.push(effect); },
  };
});

function render() {
  hooks.cleanups.forEach((cleanup) => cleanup());
  hooks.cleanups = [];
  hooks.effects = [];
  hooks.cursor = 0;
  const tree = AdminSearch({adminPath: "admin"});
  hooks.effects.forEach((effect) => {
    const cleanup = effect();
    if (cleanup) hooks.cleanups.push(cleanup);
  });
  return tree;
}

interface InputHandlers {
  children?: React.ReactNode;
  "aria-label"?: string;
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
  hooks.cleanups.forEach((cleanup) => cleanup());
  hooks.values = [];
  hooks.cleanups = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("admin search composition", () => {
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
});
