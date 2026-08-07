import React from "react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import Requests from "@/client/requests";
import MediaManager from "@/components/admin/items/EditItemApp/components/MediaManager";
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
import {ENCLOSURE_CATEGORIES} from "@/shared/Constants";

vi.mock("@/client/ToastUtils", () => ({showToast: vi.fn()}));

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

function createManager(onMediaFileUpdated = vi.fn()) {
  const manager = new MediaManager({
    feed: {settings: {webGlobalSettings: {publicBucketUrl: "/media/"}}},
    initMediaFile: {
      category: ENCLOSURE_CATEGORIES.AUDIO,
      contentType: null,
      durationSecond: 0,
      sizeByte: 0,
      url: "",
    },
    label: "Media",
    mediaStorageReady: true,
    onMediaFileUpdated,
  });
  useSynchronousState(manager);
  return manager;
}

describe("item media autosave timing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("window", {
      location: {hostname: "feed.example.com", search: ""},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("debounces category changes but flushes completed uploads immediately", () => {
    const onMediaFileUpdated = vi.fn();
    const manager = createManager(onMediaFileUpdated);
    const categoryControl = findElement(
      manager.render(),
      (element) => element.type === AdminRadioGroup &&
        element.props.name === "category",
    );

    categoryControl?.props.onValueChange(ENCLOSURE_CATEGORIES.VIDEO);
    expect(onMediaFileUpdated).toHaveBeenLastCalledWith({
      category: ENCLOSURE_CATEGORIES.VIDEO,
      contentType: null,
      durationSecond: 0,
      sizeByte: 0,
      url: "",
    });

    vi.spyOn(Requests, "upload").mockImplementation((...args: any[]) => {
      args[3]("media/video-upload.mp4");
    });
    manager.onFileUpload({
      name: "upload.mp4",
      size: 1024,
      type: "video/mp4",
    });

    expect(onMediaFileUpdated).toHaveBeenLastCalledWith({
      category: ENCLOSURE_CATEGORIES.VIDEO,
      contentType: "video/mp4",
      sizeByte: 1024,
      url: "media/video-upload.mp4",
    }, {immediate: true});
  });
});
