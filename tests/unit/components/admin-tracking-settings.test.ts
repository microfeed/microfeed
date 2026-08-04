import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import TrackingSettingsApp from "@/components/admin/settings/TrackingSettingsApp";
import {SETTINGS_CATEGORIES} from "@/shared/Constants";

function props() {
  return {
    feed: {
      settings: {
        [SETTINGS_CATEGORIES.ANALYTICS]: {
          urls: ["https://op3.dev/e/"],
        },
      },
    },
    onSubmit: vi.fn(),
    setChanged: vi.fn(),
    submitForType: null,
    submitting: false,
  };
}

describe("tracking URL settings", () => {
  it("does not show an Update action before the textarea changes", () => {
    const output = renderToStaticMarkup(
      React.createElement(TrackingSettingsApp, props()),
    );

    expect(output).not.toContain('data-slot="card-action"');
    expect(output).not.toContain(">Update</button>");
  });

  it("shows the Update action at the bottom after the textarea changes", () => {
    const app = new TrackingSettingsApp(props());
    app.state = {
      ...app.state,
      trackingUrls: "https://op3.dev/e/\nhttps://pdst.fm/e/",
    };
    const output = renderToStaticMarkup(app.render());

    expect(output).not.toContain('data-slot="card-action"');
    expect(output).toContain('class="mt-5 flex justify-end"');
    expect(output).toContain(">Update</button>");
  });
});
