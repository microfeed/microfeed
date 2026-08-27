import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Requests from "@/client/requests";
import {showToast} from "@/client/ToastUtils";
import EditChannelApp from "@/components/admin/channel/EditChannelApp";
import EditItemApp from "@/components/admin/items/EditItemApp";
import AdminSaveAction from "@/components/admin/shared/AdminSaveAction";
import AdminDatetimePicker from "@/components/admin/shared/AdminDatetimePicker";
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
import {Button} from "@/components/ui/button";
import {STATUSES} from "@/shared/Constants";
import {WEBMCP_INTERACTION_HEADERS} from "@/shared/WebMcp";

vi.mock("@/client/ToastUtils", () => ({showToast: vi.fn()}));
vi.mock("astro:transitions/client", () => ({navigate: vi.fn()}));
vi.mock("@/components/admin/shared/AdminImageUploaderApp", () => ({
  default: () => null,
}));
vi.mock("@/components/admin/shared/AdminRichEditor", () => ({
  default: () => null,
}));
vi.mock("@/components/admin/items/EditItemApp/components/MediaManager", () => ({
  default: () => null,
}));

const mountedComponents: React.Component[] = [];
let documentListeners: Map<string, EventListener>;
let windowListeners: Map<string, EventListener>;

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {promise, resolve};
}

function useSynchronousState(component: React.Component<any, any>) {
  component.setState = ((update: unknown, callback?: () => void) => {
    const nextState = typeof update === "function"
      ? update(component.state, component.props)
      : update;
    component.state = {...component.state, ...nextState};
    callback?.();
  }) as typeof component.setState;
}

function findElement(
  value: React.ReactNode,
  predicate: (element: React.ReactElement<any>) => boolean,
): React.ReactElement<any> | undefined {
  for (const child of React.Children.toArray(value)) {
    if (!React.isValidElement<any>(child)) continue;
    if (predicate(child)) return child;
    const nested = findElement(child.props.children, predicate);
    if (nested) return nested;
  }
  return undefined;
}

function feed(item?: Record<string, unknown>) {
  return {
    channel: {
      id: "channel0001",
      is_primary: true,
      language: "en-us",
      status: STATUSES.PUBLISHED,
      title: "Example channel",
    },
    ...(item ? {item} : {}),
    items: [],
    settings: {
      webGlobalSettings: {publicBucketUrl: "/media/"},
    },
  };
}

function props(item?: Record<string, unknown>) {
  return {
    feedContent: feed(item),
    onboardingResult: {allOk: true, requiredOk: true, result: {}},
  } as any;
}

function mount<T extends React.Component<any, any>>(component: T): T {
  useSynchronousState(component);
  component.componentDidMount?.();
  mountedComponents.push(component);
  return component;
}

function itemStatusControl(app: EditItemApp) {
  return findElement(
    app.render(),
    (element) => element.type === AdminRadioGroup &&
      element.props.name === "item-status",
  );
}

function itemPublishButton(app: EditItemApp) {
  return findElement(
    app.render(),
    (element) => element.type === Button && element.props.children === "Publish",
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(showToast).mockClear();
  windowListeners = new Map<string, EventListener>();
  documentListeners = new Map<string, EventListener>();
  vi.stubGlobal("window", {
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      windowListeners.set(name, listener);
    }),
    history: {replaceState: vi.fn(), state: null},
    location: {
      assign: vi.fn(),
      hostname: "feed.example.com",
      origin: "https://feed.example.com",
      search: "",
    },
    removeEventListener: vi.fn((name: string) => {
      windowListeners.delete(name);
    }),
  });
  vi.stubGlobal("document", {
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      documentListeners.set(name, listener);
    }),
    querySelector: vi.fn(() => ({content: "admin"})),
    removeEventListener: vi.fn((name: string) => {
      documentListeners.delete(name);
    }),
  });
  vi.spyOn(Requests, "axiosPost").mockResolvedValue({} as any);
});

afterEach(() => {
  for (const component of mountedComponents.splice(0)) {
    component.componentWillUnmount?.();
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("admin editor autosave", () => {
  it("registers an Item save tool only for drafts and awaits persistence", async () => {
    const registerTool = vi.fn(async (
      _tool: any,
      _options: {signal: AbortSignal},
    ) => undefined);
    vi.mocked(document.querySelector).mockImplementation((selector: string) =>
      selector.includes("microfeed-webmcp-enabled")
        ? {content: "true"} as HTMLMetaElement
        : {content: "admin"} as HTMLMetaElement
    );
    Reflect.set(document, "modelContext", {registerTool});
    const app = mount(new EditItemApp(props()));
    await vi.waitFor(() => expect(registerTool).toHaveBeenCalledOnce());
    const [tool, registration] = registerTool.mock.calls[0]!;
    expect(tool.name).toBe("microfeed_save_item_draft");

    app.onUpdateItemMeta({link: "https://example.com/human-change"});
    const pending = deferred<any>();
    vi.mocked(Requests.axiosPost).mockReturnValueOnce(pending.promise);
    let settled = false;
    const execution = tool.execute(
      {content_html: "<p>Agent body</p>", title: "Agent title"},
    ).then((value: unknown) => {
      settled = true;
      return value;
    });
    await vi.waitFor(() => expect(Requests.axiosPost).toHaveBeenCalledOnce());
    expect(settled).toBe(false);
    expect(vi.mocked(Requests.axiosPost)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        item: expect.objectContaining({
          description: "<p>Agent body</p>",
          link: "https://example.com/human-change",
          status: STATUSES.UNPUBLISHED,
          title: "Agent title",
        }),
      }),
      expect.objectContaining({
        headers: WEBMCP_INTERACTION_HEADERS,
        signal: expect.any(AbortSignal),
      }),
    );
    pending.resolve({});
    await expect(execution).resolves.toMatchObject({
      content_html: "<p>Agent body</p>",
      status: "unpublished",
      title: "Agent title",
    });

    const previousState = {
      ...app.state,
      item: {...app.state.item, status: STATUSES.UNPUBLISHED},
    };
    (app.state as any).item = {
      ...app.state.item,
      status: STATUSES.PUBLISHED,
    };
    app.componentDidUpdate(app.props, previousState);
    expect(registration.signal.aborted).toBe(true);

    registerTool.mockClear();
    mount(new EditItemApp({
      ...props({
        id: "published-webmcp",
        status: STATUSES.PUBLISHED,
        title: "Published",
      }),
      itemId: "published-webmcp",
    }));
    await Promise.resolve();
    expect(registerTool).not.toHaveBeenCalled();
  });

  it("reports autosave state and exposes a retry action after failure", () => {
    const clean = renderToStaticMarkup(
      React.createElement(AdminSaveAction, {
        dirty: false,
        phase: "saved",
      }),
    );
    expect(clean).toContain('aria-live="polite"');
    expect(clean).toContain("All changes saved");
    expect(clean).toContain("Save now");
    expect(clean).toContain('disabled=""');

    const failed = renderToStaticMarkup(
      React.createElement(AdminSaveAction, {
        dirty: true,
        phase: "error",
      }),
    );
    expect(failed).toContain("Your changes are still on this page");
    expect(failed).toContain("Retry save");
    expect(failed).not.toContain('disabled=""');

    const channel = renderToStaticMarkup(
      React.createElement(AdminSaveAction, {
        buttonLabel: "Save changes",
        dirty: true,
        idleMessage: "Make changes, then select Save changes.",
        phase: "pending",
      }),
    );
    expect(channel).toContain("Unsaved changes");
    expect(channel).toContain("Save changes");
  });

  it("creates one unpublished draft after the first genuine item edit", async () => {
    const app = mount(new EditItemApp(props()));
    const axiosPost = vi.mocked(Requests.axiosPost);
    const itemId = app.state.itemId;

    expect(app.state.item).toMatchObject({
      guid: itemId,
      pubDateIsDraftDefault: true,
      status: STATUSES.UNPUBLISHED,
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(axiosPost).not.toHaveBeenCalled();

    app.onUpdateItemMeta({title: "Draft title"});
    expect(app.state.autosaveState).toEqual({dirty: true, phase: "pending"});
    await vi.advanceTimersByTimeAsync(4999);
    expect(axiosPost).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(axiosPost).toHaveBeenCalledOnce();
    expect(axiosPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        item: expect.objectContaining({
          id: itemId,
          pubDateIsDraftDefault: true,
          status: STATUSES.UNPUBLISHED,
          title: "Draft title",
        }),
      }),
    );
    expect(app.state.action).toBe("edit");
    expect(app.state.autosaveState).toEqual({dirty: false, phase: "saved"});
    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      `/admin/items/${itemId}/`,
    );
    expect(showToast).toHaveBeenLastCalledWith("Item added.", "success");

    app.onUpdateItemMeta({description: "More details"});
    await vi.advanceTimersByTimeAsync(5000);
    expect(axiosPost).toHaveBeenCalledTimes(2);
    expect(axiosPost.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      item: expect.objectContaining({id: itemId}),
    }));
    expect(window.history.replaceState).toHaveBeenCalledOnce();
    expect(showToast).toHaveBeenLastCalledWith("Item saved.", "success");
    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it("publishes immediately and refreshes only a draft-default date", async () => {
    vi.setSystemTime(new Date("2026-08-07T20:00:00.000Z"));
    const app = mount(new EditItemApp(props()));
    const statusControl = itemStatusControl(app);
    const publishedAt = Date.now();

    statusControl?.props.onValueChange(String(STATUSES.PUBLISHED));
    await vi.waitFor(() => expect(Requests.axiosPost).toHaveBeenCalledOnce());

    expect(app.state.item).toMatchObject({
      pubDateIsDraftDefault: false,
      pubDateMs: publishedAt,
      status: STATUSES.PUBLISHED,
    });
    expect(vi.mocked(Requests.axiosPost).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        item: expect.objectContaining({
          pubDateIsDraftDefault: false,
          pubDateMs: publishedAt,
          status: STATUSES.PUBLISHED,
        }),
      }),
    );
    await vi.waitFor(() => {
      expect(showToast).toHaveBeenLastCalledWith("Item added.", "success");
    });
  });

  it("publishes the current create or edit form from the save card", async () => {
    vi.setSystemTime(new Date("2026-08-08T12:00:00.000Z"));
    const create = mount(new EditItemApp(props()));
    const createButton = itemPublishButton(create);

    expect(createButton).toBeDefined();
    expect(createButton?.props["aria-describedby"]).toBe(
      "publish-item-description",
    );
    expect(renderToStaticMarkup(create.render())).toContain(
      "Save and change status to published",
    );

    const publishedAt = Date.now();
    createButton?.props.onClick();
    await vi.waitFor(() => expect(Requests.axiosPost).toHaveBeenCalledOnce());
    expect(vi.mocked(Requests.axiosPost).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        item: expect.objectContaining({
          pubDateIsDraftDefault: false,
          pubDateMs: publishedAt,
          status: STATUSES.PUBLISHED,
        }),
      }),
    );
    expect(itemPublishButton(create)).toBeUndefined();
    await vi.waitFor(() => {
      expect(create.state.autosaveState).toEqual({dirty: false, phase: "saved"});
    });
    expect(showToast).toHaveBeenLastCalledWith("Item published", "success");

    vi.mocked(Requests.axiosPost).mockClear();
    vi.mocked(showToast).mockClear();
    const edit = mount(new EditItemApp({
      ...props({
        id: "unlisteditem2",
        pubDateMs: Date.parse("2026-07-01T10:00:00.000Z"),
        status: STATUSES.UNLISTED,
        title: "Unlisted item",
      }),
      itemId: "unlisteditem2",
    }));
    expect(itemPublishButton(edit)).toBeDefined();
    itemPublishButton(edit)?.props.onClick();
    await vi.waitFor(() => expect(Requests.axiosPost).toHaveBeenCalledOnce());
    expect(vi.mocked(Requests.axiosPost).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        item: expect.objectContaining({
          pubDateMs: Date.parse("2026-07-01T10:00:00.000Z"),
          status: STATUSES.PUBLISHED,
        }),
      }),
    );
    expect(itemPublishButton(edit)).toBeUndefined();
    await vi.waitFor(() => {
      expect(edit.state.autosaveState).toEqual({dirty: false, phase: "saved"});
    });
    expect(showToast).toHaveBeenLastCalledWith("Item published", "success");

    const published = mount(new EditItemApp({
      ...props({
        id: "publisheditem1",
        pubDateMs: Date.parse("2026-07-02T10:00:00.000Z"),
        status: STATUSES.PUBLISHED,
        title: "Published item",
      }),
      itemId: "publisheditem1",
    }));
    expect(itemPublishButton(published)).toBeUndefined();
  });

  it("preserves manually selected and legacy publication dates", async () => {
    const customDate = Date.parse("2026-09-01T18:30");
    const draft = mount(new EditItemApp(props()));
    const dateControl = findElement(
      draft.render(),
      (element) => element.type === AdminDatetimePicker,
    );
    dateControl?.props.onChange({target: {value: "2026-09-01T18:30"}});
    await vi.advanceTimersByTimeAsync(4999);
    expect(Requests.axiosPost).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(Requests.axiosPost).toHaveBeenCalledOnce();

    itemStatusControl(draft)?.props.onValueChange(String(STATUSES.PUBLISHED));
    await vi.waitFor(() => expect(Requests.axiosPost).toHaveBeenCalledTimes(2));
    expect(draft.state.item.pubDateMs).toBe(customDate);
    expect(draft.state.item.pubDateIsDraftDefault).toBe(false);

    vi.mocked(Requests.axiosPost).mockClear();
    const legacy = mount(new EditItemApp({
      ...props({
        guid: "legacyitem1",
        id: "legacyitem1",
        pubDateMs: customDate,
        status: STATUSES.UNPUBLISHED,
        title: "Legacy draft",
      }),
      itemId: "legacyitem1",
    }));
    itemStatusControl(legacy)?.props.onValueChange(String(STATUSES.PUBLISHED));
    await vi.waitFor(() => expect(Requests.axiosPost).toHaveBeenCalledOnce());
    expect(legacy.state.item.pubDateMs).toBe(customDate);
    expect(legacy.state.item.pubDateIsDraftDefault).toBeUndefined();
  });

  it("preserves a loaded item status while autosaving edits", async () => {
    const app = mount(new EditItemApp({
      ...props({
        guid: "unlisteditem1",
        id: "unlisteditem1",
        pubDateMs: Date.parse("2026-08-01T10:00:00.000Z"),
        status: STATUSES.UNLISTED,
        title: "Loaded item",
      }),
      itemId: "unlisteditem1",
    }));

    expect(app.state.item.status).toBe(STATUSES.UNLISTED);
    app.onUpdateItemMeta({title: "Edited item"});
    await vi.advanceTimersByTimeAsync(5000);

    expect(Requests.axiosPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        item: expect.objectContaining({
          id: "unlisteditem1",
          status: STATUSES.UNLISTED,
          title: "Edited item",
        }),
      }),
    );
  });

  it("debounces ordinary item radio changes for five seconds", async () => {
    const app = mount(new EditItemApp(props()));
    const explicitControl = findElement(
      app.render(),
      (element) => element.type === AdminRadioGroup &&
        element.props.name === "lh-explicit",
    );

    explicitControl?.props.onValueChange("yes");
    await vi.advanceTimersByTimeAsync(4999);
    expect(Requests.axiosPost).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(Requests.axiosPost).toHaveBeenCalledOnce();
    expect(vi.mocked(Requests.axiosPost).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        item: expect.objectContaining({"itunes:explicit": true}),
      }),
    );
  });

  it("keeps failed image cleanup and navigation protection until retry succeeds", async () => {
    const failure = Object.assign(new Error("offline"), {response: undefined});
    const axiosPost = vi.mocked(Requests.axiosPost)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({} as any);
    const app = mount(new EditItemApp(props()));

    app.setState({
      item: {...app.state.item, image: "images/new.png"},
      replacedImageUrls: ["images/old.png"],
    }, () => (app as any).autosave.markChanged({immediate: true}));
    await vi.waitFor(() => {
      expect(app.state.autosaveState).toEqual({dirty: true, phase: "error"});
    });
    expect(app.state.replacedImageUrls).toEqual(["images/old.png"]);

    const blockedNavigation = new Event("astro:before-preparation", {
      cancelable: true,
    });
    documentListeners.get("astro:before-preparation")?.(blockedNavigation);
    expect(blockedNavigation.defaultPrevented).toBe(true);

    await expect((app as any).autosave.flush()).resolves.toBe(true);
    expect(axiosPost).toHaveBeenCalledTimes(2);
    expect(axiosPost.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      deleteImageUrls: ["images/old.png"],
      item: expect.objectContaining({image: "images/new.png"}),
    }));
    expect(app.state.replacedImageUrls).toEqual([]);

    const allowedNavigation = new Event("astro:before-preparation", {
      cancelable: true,
    });
    documentListeners.get("astro:before-preparation")?.(allowedNavigation);
    expect(allowedNavigation.defaultPrevented).toBe(false);
  });

  it("saves channel fields only on submit and keeps later image cleanup queued", async () => {
    const firstSave = deferred();
    const axiosPost = vi.mocked(Requests.axiosPost)
      .mockImplementationOnce(() => firstSave.promise as any)
      .mockResolvedValueOnce({} as any);
    const app = mount(new EditChannelApp(props()));

    app.setState({
      channel: {...app.state.channel, image: "images/first.png"},
      replacedImageUrls: ["images/old.png"],
    }, () => (app as any).autosave.markChanged());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(axiosPost).not.toHaveBeenCalled();
    expect(app.state.autosaveState).toEqual({dirty: true, phase: "pending"});

    app.onSubmit({preventDefault: vi.fn()});
    await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledOnce());

    app.setState({
      channel: {...app.state.channel, image: "images/second.png"},
      replacedImageUrls: ["images/old.png", "images/first.png"],
    }, () => (app as any).autosave.markChanged());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(axiosPost).toHaveBeenCalledOnce();

    firstSave.resolve();
    await vi.waitFor(() => {
      expect(app.state.autosaveState).toEqual({dirty: true, phase: "pending"});
    });
    expect(axiosPost).toHaveBeenCalledOnce();

    expect(axiosPost.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      deleteImageUrls: ["images/old.png"],
    }));
    expect(app.state.replacedImageUrls).toEqual(["images/first.png"]);

    app.onSubmit({preventDefault: vi.fn()});
    await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));
    expect(axiosPost.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      deleteImageUrls: ["images/first.png"],
      channel: expect.objectContaining({image: "images/second.png"}),
    }));
    expect(app.state.replacedImageUrls).toEqual([]);

    axiosPost.mockClear();
    app.onUpdateChannelMeta("title", "Manually saved title");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(axiosPost).not.toHaveBeenCalled();
    app.onSubmit({preventDefault: vi.fn()});
    await vi.waitFor(() => expect(axiosPost).toHaveBeenCalledOnce());
    expect(axiosPost).toHaveBeenCalledOnce();
    expect(axiosPost.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      channel: expect.objectContaining({title: "Manually saved title"}),
    }));
    await vi.waitFor(() => {
      expect(showToast).toHaveBeenLastCalledWith("Channel saved.", "success");
      expect(showToast).toHaveBeenCalledTimes(3);
    });
  });

  it("retains failed channel changes, cleanup, and navigation protection for retry", async () => {
    const failure = Object.assign(new Error("offline"), {response: undefined});
    const axiosPost = vi.mocked(Requests.axiosPost)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({} as any);
    const app = mount(new EditChannelApp(props()));

    app.setState({
      channel: {...app.state.channel, image: "images/new.png"},
      replacedImageUrls: ["images/old.png"],
    }, () => (app as any).autosave.markChanged());
    app.onSubmit({preventDefault: vi.fn()});
    await vi.waitFor(() => {
      expect(app.state.autosaveState).toEqual({dirty: true, phase: "error"});
    });
    expect(app.state.replacedImageUrls).toEqual(["images/old.png"]);

    const blockedNavigation = new Event("astro:before-preparation", {
      cancelable: true,
    });
    documentListeners.get("astro:before-preparation")?.(blockedNavigation);
    expect(blockedNavigation.defaultPrevented).toBe(true);

    app.onSubmit({preventDefault: vi.fn()});
    await vi.waitFor(() => {
      expect(app.state.autosaveState).toEqual({dirty: false, phase: "saved"});
    });
    expect(axiosPost).toHaveBeenCalledTimes(2);
    expect(axiosPost.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      deleteImageUrls: ["images/old.png"],
      channel: expect.objectContaining({image: "images/new.png"}),
    }));
    expect(app.state.replacedImageUrls).toEqual([]);
  });
});
