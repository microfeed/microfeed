import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import AccessSettingsApp from "@/components/admin/settings/AccessSettingsApp";
import {SETTINGS_CATEGORIES} from "@/shared/Constants";

function props(onSubmit = vi.fn(async (
  _event: unknown,
  _type: unknown,
  _bundle: unknown,
) => true)) {
  return {
    feed: {
      settings: {
        [SETTINGS_CATEGORIES.ACCESS]: {currentPolicy: "public"},
      },
    },
    onSubmit,
    setChanged: vi.fn(),
    submitForType: null,
    submitting: false,
  };
}

function installSynchronousSetState(app: AccessSettingsApp) {
  app.setState = ((update: any, callback?: () => void) => {
    const changedState = typeof update === "function"
      ? update(app.state, app.props)
      : update;
    app.state = {...app.state, ...changedState};
    callback?.();
  }) as typeof app.setState;
}

describe("access control settings", () => {
  it("shows Public, Headless, and Offline without a manual Update action", () => {
    const output = renderToStaticMarkup(
      React.createElement(AccessSettingsApp, props()),
    );

    expect(output).toContain("Access control");
    expect(output.indexOf("Public")).toBeLessThan(output.indexOf("Headless"));
    expect(output.indexOf("Headless")).toBeLessThan(output.indexOf("Offline"));
    expect(output).toContain("Keep RSS, JSON Feed, APIs, and media available");
    expect(output).not.toContain('data-slot="card-action"');
    expect(output).not.toContain(">Update</button>");
  });

  it("immediately saves a newly selected policy", async () => {
    const onSubmit = vi.fn(async (
      _event: unknown,
      _type: unknown,
      _bundle: unknown,
    ) => true);
    const settingsProps = props(onSubmit);
    const app = new AccessSettingsApp(settingsProps);
    installSynchronousSetState(app);

    app.onUpdateAccess("headless");
    await Promise.resolve();

    expect(app.state.access.currentPolicy).toBe("headless");
    expect(settingsProps.setChanged).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({preventDefault: expect.any(Function)}),
      SETTINGS_CATEGORIES.ACCESS,
      {currentPolicy: "headless"},
    );
  });

  it("disables policy changes while a save is in progress", () => {
    const output = renderToStaticMarkup(
      React.createElement(AccessSettingsApp, {
        ...props(),
        submitting: true,
      }),
    );

    expect(output).toContain("disabled");
  });
});
