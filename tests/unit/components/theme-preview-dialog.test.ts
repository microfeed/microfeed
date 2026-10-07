import React from "react";
import {afterEach, describe, expect, it, vi} from "vitest";

import ThemePreviewDialog from "@/components/admin/themes/ThemePreviewDialog";
import {Button} from "@/components/ui/button";

// Inspect the component's iframe and exercise its handlers without mounting
// portal primitives. Worker tests cover preview responses and theme activation.
const state = vi.hoisted(() => ({cursor: 0, values: [] as unknown[]}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState(initial: unknown) {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = initial;
    return [state.values[index], (value: unknown) => { state.values[index] = value; }];
  },
  useEffect: () => {},
}));

afterEach(() => { state.values = []; });

function render(hasPreviewFixture = true) {
  state.cursor = 0;
  return ThemePreviewDialog({
    hasPreviewFixture,
    label: "Example theme",
    onOpenChange: vi.fn(),
    open: true,
    previewUrl: "/admin/preview/",
    supportsPagesAndSearch: true,
  });
}

function find(
  node: React.ReactNode,
  predicate: (element: React.ReactElement<any>) => boolean,
): React.ReactElement<any> {
  const element = findOptional(node, predicate);
  if (!element) throw new Error("Expected preview control was not rendered.");
  return element;
}

function findOptional(
  node: React.ReactNode,
  predicate: (element: React.ReactElement<any>) => boolean,
): React.ReactElement<any> | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<any>(child)) continue;
    if (predicate(child)) return child;
    const nested = findOptional(child.props.children, predicate);
    if (nested) return nested;
  }
  return undefined;
}

describe("theme preview dialog", () => {
  it.each([false, true])("isolates previews and chooses available fixture data (%s)", (hasFixture) => {
    const tree = render(hasFixture);
    const frame = find(tree, element => element.type === "iframe");
    expect(frame.props.sandbox).toBe("allow-scripts");
    const url = new URL(frame.props.src, "https://example.test");
    expect(url.pathname).toBe("/admin/preview/");
    expect(url.searchParams.get("view")).toBe("feed");
    expect(url.searchParams.get("data")).toBe(hasFixture ? "fixture" : "site");
  });

  it("reloads the frame when switching context and keeps loading feedback accessible", () => {
    let tree = render();
    const busy = (element: React.ReactElement<any>) => "aria-busy" in element.props;
    expect(find(tree, busy).props["aria-busy"]).toBe(true);
    expect(find(tree, element => element.props.role === "status").props["aria-live"])
      .toBe("polite");
    find(tree, element => element.type === "iframe").props.onLoad();
    tree = render();
    expect(find(tree, busy).props["aria-busy"]).toBe(false);

    for (const [label, view] of [["Tag archive", "tag"], ["Tags directory", "tags"], ["RSS", "rss"]]) {
      find(tree, element => element.type === Button && element.props.children === label).props.onClick();
      tree = render();
      const frame = find(tree, element => element.type === "iframe");
      const url = new URL(frame.props.src, "https://example.test");
      expect(url.searchParams.get("view")).toBe(view);
      expect(frame.props.sandbox).toBe("allow-scripts");
      expect(find(tree, busy).props["aria-busy"]).toBe(true);
      frame.props.onLoad();
      tree = render();
      expect(find(tree, busy).props["aria-busy"]).toBe(false);
    }

    find(tree, element => element.type === Button && element.props.children === "Current site").props.onClick();
    tree = render();
    const url = new URL(find(tree, element => element.type === "iframe").props.src, "https://example.test");
    expect(url.searchParams.get("data")).toBe("site");
    expect(find(tree, busy).props["aria-busy"]).toBe(true);
  });
});
