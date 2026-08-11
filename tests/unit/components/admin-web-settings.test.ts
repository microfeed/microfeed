import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {beforeEach, describe, expect, it, vi} from "vitest";

import Requests from "@/client/requests";
import CustomCodeSettingsApp from "@/components/admin/settings/CustomCodeSettingsApp";
import FaviconSettingsApp, {
  FAVICON_SUBMIT_KEY,
} from "@/components/admin/settings/FaviconSettingsApp";
import ItemsSettingsApp, {
  ITEMS_ORDERING_SUBMIT_KEY,
  ITEMS_PER_PAGE_SUBMIT_KEY,
} from "@/components/admin/settings/ItemsSettingsApp";
import MediaFileStorageSettingsApp, {
  MEDIA_FILE_STORAGE_SUBMIT_KEY,
} from "@/components/admin/settings/MediaFileStorageSettingsApp";
import SettingsApp from "@/components/admin/settings/SettingsApp";
import AdminImageUploaderApp from "@/components/admin/shared/AdminImageUploaderApp";
import {SETTINGS_CATEGORIES} from "@/shared/Constants";
import {ITEM_SORTS} from "@/shared/ItemPagination";

vi.mock("@/client/ToastUtils", () => ({showToast: vi.fn()}));

const webSettings = {
  favicon: {
    contentType: "image/png",
    url: "/assets/default/favicon.png",
  },
  itemsOrder: "desc",
  itemsPerPage: 20,
  itemsSort: "published_at",
  publicBucketUrl: "/media/",
};

function feed() {
  return {
    channel: {image: "images/channel.png"},
    settings: {
      [SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS]: {...webSettings},
    },
  };
}

function props(overrides: Record<string, unknown> = {}) {
  return {
    feed: feed(),
    mediaStorageReady: true,
    onSettingsChanged: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(true),
    setChanged: vi.fn(),
    submitForType: null,
    submitting: false,
    ...overrides,
  };
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

describe("split web settings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("window", {location: {hostname: "feed.example.com"}});
  });

  it("shows the media storage Update action only after the URL changes", () => {
    const app = new MediaFileStorageSettingsApp(props());
    expect(renderToStaticMarkup(app.render())).not.toContain(">Update</button>");

    app.state = {...app.state, publicBucketUrl: "https://media.example.com/"};
    const output = renderToStaticMarkup(app.render());
    expect(output).toContain('class="mt-5 flex justify-end"');
    expect(output).toContain(">Update</button>");
  });

  it("puts Website appearance & code first and explains its primary actions", () => {
    const app = new SettingsApp({
      feedContent: feed(),
      onboardingResult: {allOk: true, requiredOk: true, result: {}},
    });
    const page = app.render();
    const grid = React.Children.only(page.props.children) as React.ReactElement<any>;
    const sectionIds = React.Children.toArray(grid.props.children)
      .filter((child): child is React.ReactElement<any> =>
        React.isValidElement<any>(child) && child.type === "section"
      )
      .map((section) => section.props.id);

    expect(sectionIds[0]).toBe("custom-code");

    const output = renderToStaticMarkup(React.createElement(CustomCodeSettingsApp, {
      feed: feed(),
      submitForType: null,
      submitting: false,
    }));
    expect(output).toContain("Website appearance &amp; code");
    expect(output).toContain("Edit shared HTML code across web pages");
    expect(output).toContain("Manage versioned themes");
    expect(output).toContain("Google Analytics and Meta Pixel");
    expect(output).toContain(
      "Install, edit, preview, activate, and roll back different versions of themes.",
    );
    expect(output).not.toContain(">Themes</div>");
  });

  it("places sorting above items per page and autosaves radio changes", async () => {
    const settingsProps = props();
    const app = new ItemsSettingsApp(settingsProps);
    useSynchronousState(app);
    const output = renderToStaticMarkup(app.render());

    expect(output.indexOf("Sort by")).toBeLessThan(output.indexOf("Order"));
    expect(output.indexOf("Order")).toBeLessThan(output.indexOf("Items per page"));
    expect(output).not.toContain(">Update</button>");

    await app.updateOrdering({itemsSort: ITEM_SORTS.CREATED_AT});
    expect(settingsProps.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({preventDefault: expect.any(Function)}),
      SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
      expect.objectContaining({itemsSort: ITEM_SORTS.CREATED_AT}),
      [],
      ITEMS_ORDERING_SUBMIT_KEY,
    );
  });

  it("shows the items-per-page Update action only after its value changes", () => {
    const app = new ItemsSettingsApp(props());
    app.state = {...app.state, itemsPerPage: 30};

    const output = renderToStaticMarkup(app.render());
    expect(output).toContain('class="mt-6 flex items-end gap-2"');
    expect(output).toContain('class="w-40 flex-none sm:w-48"');
    expect(output).toContain(">Update</button>");
  });

  it("persists favicon uploads immediately and keeps deletion metadata immediate", async () => {
    const settingsProps = props();
    const app = new FaviconSettingsApp(settingsProps);
    useSynchronousState(app);

    await app.saveUploadedFavicon(
      "production/images/favicon.png",
      "image/png",
      "production/images/old-favicon.png",
    );
    expect(settingsProps.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({preventDefault: expect.any(Function)}),
      SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
      {favicon: {
        contentType: "image/png",
        url: "production/images/favicon.png",
      }},
      ["production/images/old-favicon.png"],
      FAVICON_SUBMIT_KEY,
    );

    const uploader = findElement(
      app.render(),
      (element) => element.type === AdminImageUploaderApp,
    );
    await uploader?.props.onImageDeleted();
    expect(settingsProps.onSettingsChanged).toHaveBeenCalledWith(
      SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
      {favicon: undefined},
    );
  });

  it("merges partial web-setting saves with the latest local bundle", async () => {
    const axiosPost = vi.spyOn(Requests, "axiosPost").mockResolvedValue({} as any);
    const app = new SettingsApp({
      feedContent: feed(),
      onboardingResult: {allOk: true, requiredOk: true, result: {}},
    });
    useSynchronousState(app);
    app.state = {
      ...app.state,
      changedSections: [
        MEDIA_FILE_STORAGE_SUBMIT_KEY,
        ITEMS_PER_PAGE_SUBMIT_KEY,
      ],
    };

    await app.onSubmit(
      {preventDefault() {}},
      SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
      {itemsPerPage: 30},
      [],
      ITEMS_PER_PAGE_SUBMIT_KEY,
    );

    expect(axiosPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        settings: {
          [SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS]: {
            ...webSettings,
            itemsPerPage: 30,
          },
        },
      }),
    );
    expect(app.state.changedSections).toEqual([
      MEDIA_FILE_STORAGE_SUBMIT_KEY,
    ]);
  });
});
