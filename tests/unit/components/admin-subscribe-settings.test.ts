import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, describe, expect, it, vi} from "vitest";

import SubscribeSettingsApp, {
  reorderSubscribeMethods,
  subscribeMethodsBundle,
} from "@/components/admin/settings/SubscribeSettingsApp";
import {SETTINGS_CATEGORIES} from "@/shared/Constants";

const methods = [
  {
    editable: false,
    enabled: true,
    id: "rss",
    image: "/rss.png",
    name: "RSS",
    type: "rss",
  },
  {
    editable: true,
    enabled: true,
    id: "custom",
    image: "/custom.png",
    name: "Podcast app",
    type: "custom",
    url: "https://example.com/podcast",
  },
];

function props(onSubmit = vi.fn(async (
  _event: unknown,
  _type: unknown,
  _bundle: unknown,
) => true)) {
  return {
    feed: {
      settings: {
        [SETTINGS_CATEGORIES.SUBSCRIBE_METHODS]: {methods},
      },
    },
    onSubmit,
    setChanged: vi.fn(),
    submitForType: null,
    submitting: false,
  };
}

function installSynchronousSetState(app: SubscribeSettingsApp) {
  app.setState = ((update: any, callback?: () => void) => {
    const changedState = typeof update === "function"
      ? update(app.state, app.props)
      : update;
    app.state = {...app.state, ...changedState};
    callback?.();
  }) as typeof app.setState;
}

async function flushSaveQueue() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function savedBundle(
  onSubmit: ReturnType<typeof vi.fn<(event: unknown, type: unknown, bundle: any) => Promise<boolean>>>,
  index: number,
) {
  return onSubmit.mock.calls[index]![2];
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("subscribe method settings", () => {
  it("centers the add action and omits the section Update button", () => {
    const output = renderToStaticMarkup(
      React.createElement(SubscribeSettingsApp, props()),
    );

    expect(output).toContain('class="flex justify-center"');
    expect(output).toContain("Add new subscribe method");
    expect(output).toContain('aria-label="Drag to change the order of RSS"');
    expect(output).toContain("size-11 object-contain");
    expect(output).not.toContain('aria-label="Move RSS up"');
    expect(output).not.toContain('data-slot="card-action"');
    expect(output).not.toContain(">Update</button>");
  });

  it("shows immediate deletion copy with an Undo action", () => {
    const app = new SubscribeSettingsApp(props());
    app.state = {
      ...app.state,
      methodsDict: {
        methods: [methods[0], {...methods[1], deleted: true}],
      },
    };
    const output = renderToStaticMarkup(app.render());

    expect(output).toContain("Deleted.</span>");
    expect(output).toContain(">Undo</button>");
    expect(output).not.toContain("sync up and actually delete");
  });

  it("removes deleted methods and transient flags from the saved bundle", () => {
    expect(subscribeMethodsBundle({
      label: "Subscribe",
      methods: [methods[0], {...methods[1], deleted: true}],
    })).toEqual({
      label: "Subscribe",
      methods: [methods[0]],
    });
  });

  it("reorders methods before or after the row under the drag handle", () => {
    expect(reorderSubscribeMethods(methods, "rss", "custom", "after")
      .map(({id}) => id)).toEqual(["custom", "rss"]);
    expect(reorderSubscribeMethods(methods, "custom", "rss", "before")
      .map(({id}) => id)).toEqual(["custom", "rss"]);
    expect(reorderSubscribeMethods(methods, "rss", "rss", "after")).toBe(methods);
  });

  it("highlights the row and insertion edge under a dragged method", () => {
    const app = new SubscribeSettingsApp(props());
    app.state = {
      ...app.state,
      dragOverMethodId: "custom",
      dragOverPosition: "before",
      draggedMethodId: "rss",
    };
    const output = renderToStaticMarkup(app.render());

    expect(output).toContain("bg-brand-light/8 ring-1 ring-inset ring-brand-light/40");
    expect(output).toContain("before:top-0 before:h-0.5");
  });

  it("renders an elevated method preview that follows the pointer", () => {
    const app = new SubscribeSettingsApp(props());
    app.state = {
      ...app.state,
      dragPreview: {
        left: 120,
        offsetX: 20,
        offsetY: 16,
        top: 240,
        width: 640,
      },
      draggedMethodId: "rss",
    };
    const output = renderToStaticMarkup(app.render());

    expect(output).toContain("pointer-events-none fixed z-[100]");
    expect(output).toContain("shadow-2xl ring-2 ring-brand-light/20");
    expect(output).toContain("left:120px");
    expect(output).toContain("top:240px");
    expect(output).toContain("width:640px");
  });

  it("always clears the floating preview on a window-level pointer release", () => {
    const windowTarget = new EventTarget();
    vi.stubGlobal("window", windowTarget);
    const app = new SubscribeSettingsApp(props());
    installSynchronousSetState(app);
    app.beginDragging("rss", {
      clientX: 140,
      clientY: 260,
      currentTarget: {
        closest: () => ({
          getBoundingClientRect: () => ({
            height: 80,
            left: 100,
            top: 220,
            width: 640,
          }),
        }),
      },
      pointerId: 7,
    } as unknown as React.PointerEvent<HTMLButtonElement>);
    expect(app.state.dragPreview).not.toBeNull();

    windowTarget.dispatchEvent(Object.assign(new Event("pointerup"), {
      pointerId: 7,
    }));

    expect(app.state.dragPreview).toBeNull();
    expect(app.state.draggedMethodId).toBeNull();
  });

  it("immediately saves visibility, order, additions, deletion, and undo", async () => {
    const onSubmit = vi.fn(async (
      _event: unknown,
      _type: unknown,
      _bundle: unknown,
    ) => true);
    const app = new SubscribeSettingsApp(props(onSubmit));
    installSynchronousSetState(app);

    app.updateMethodByAttr("rss", "enabled", false);
    await flushSaveQueue();
    expect(savedBundle(onSubmit, 0).methods[0].enabled).toBe(false);

    app.moveCard({preventDefault: vi.fn()}, 0, 1);
    await flushSaveQueue();
    expect(savedBundle(onSubmit, 1).methods.map(({id}: any) => id)).toEqual([
      "custom",
      "rss",
    ]);

    app.addNewMethod({
      editable: true,
      enabled: true,
      id: "new",
      name: "New app",
      type: "custom",
      url: "https://example.com/new",
    });
    await flushSaveQueue();
    expect(savedBundle(onSubmit, 2).methods.at(-1).id).toBe("new");

    app.updateMethodByAttr("custom", "deleted", true);
    await flushSaveQueue();
    expect(savedBundle(onSubmit, 3).methods.map(({id}: any) => id)).toEqual([
      "rss",
      "new",
    ]);

    app.updateMethodByAttr("custom", "deleted", false);
    await flushSaveQueue();
    expect(savedBundle(onSubmit, 4).methods.map(({id}: any) => id)).toEqual([
      "custom",
      "rss",
      "new",
    ]);
  });

  it("automatically saves editable text after typing pauses", async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn(async (
      _event: unknown,
      _type: unknown,
      _bundle: unknown,
    ) => true);
    const app = new SubscribeSettingsApp(props(onSubmit));
    installSynchronousSetState(app);

    app.updateMethodByAttr("custom", "name", "Renamed app", false);
    expect(onSubmit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(600);
    await Promise.resolve();

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(savedBundle(onSubmit, 0).methods[1].name).toBe("Renamed app");
  });
});
