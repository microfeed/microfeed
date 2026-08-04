import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import AdminDialog from "@/components/admin/shared/AdminDialog";
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
import AdminSwitch from "@/components/admin/shared/AdminSwitch";

describe("admin UI controls", () => {
  it("renders a controlled dialog with a visible title and standard dismissal", () => {
    const onOpenChange = vi.fn();
    const dialog = AdminDialog({
      children: "Dialog content",
      onOpenChange,
      open: true,
      title: "Crop image",
    });
    const content = dialog.props.children as React.ReactElement<any>;
    const header = React.Children.toArray(content.props.children)[0] as React.ReactElement<any>;
    const title = header.props.children as React.ReactElement<any>;
    const eventDetails = {cancel: vi.fn()};

    expect(dialog.props.open).toBe(true);
    expect(content.props.showCloseButton).toBe(true);
    expect(title.props.children).toBe("Crop image");
    dialog.props.onOpenChange(false, eventDetails);
    expect(eventDetails.cancel).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hides the close control while all dismissal paths are disabled", () => {
    const onOpenChange = vi.fn();
    const dialog = AdminDialog({
      children: "Uploading",
      closeDisabled: true,
      onOpenChange,
      open: true,
      title: "Uploading image",
    });
    const content = dialog.props.children as React.ReactElement<any>;
    const eventDetails = {cancel: vi.fn()};

    expect(content.props.showCloseButton).toBe(false);
    dialog.props.onOpenChange(false, eventDetails);
    expect(eventDetails.cancel).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("associates a checked switch with its visible label", () => {
    const output = renderToStaticMarkup(
      React.createElement(AdminSwitch, {
        checked: true,
        label: "API Enabled",
        onCheckedChange: vi.fn(),
      }),
    );

    expect(output).toContain('data-slot="switch"');
    expect(output).toContain('role="switch"');
    expect(output).toContain('aria-checked="true"');
    expect(output).toContain("API Enabled");
    expect(output).toMatch(/<label[^>]+for="[^"]+"/u);
  });

  it("renders controlled card options with descriptions", () => {
    const output = renderToStaticMarkup(
      React.createElement(AdminRadioGroup, {
        ariaLabel: "Access policy",
        name: "access-policy",
        onValueChange: vi.fn(),
        options: [
          {
            description: "Everyone can access the site.",
            label: "Public",
            value: "public",
          },
          {
            description: "Public pages return 404.",
            label: "Offline",
            value: "offline",
          },
        ],
        value: "public",
        variant: "cards",
      }),
    );

    expect(output).toContain('data-slot="radio-group"');
    expect(output).toContain('aria-label="Access policy"');
    expect(output).toContain('data-checked=""');
    expect(output).toContain("border-black");
    expect(output).toContain("data-checked:border-brand-light");
    expect(output).toContain("data-checked:bg-brand-light");
    expect(output).toContain("focus-visible:ring-2");
    expect(output).toContain("focus-visible:ring-offset-2");
    expect(output).toContain("mt-1");
    expect(output).toContain("size-1.5");
    expect(output).toContain("Everyone can access the site.");
    expect(output).toContain("Public pages return 404.");
  });

  it("distinguishes guided unavailable options from native disabled options", () => {
    const guidedOutput = renderToStaticMarkup(
      React.createElement(AdminRadioGroup, {
        name: "guided-media",
        onValueChange: vi.fn(),
        options: [{
          disabled: true,
          label: "Upload audio",
          onDisabledClick: vi.fn(),
          value: "audio",
        }],
        value: "external",
      }),
    );
    const disabledOutput = renderToStaticMarkup(
      React.createElement(AdminRadioGroup, {
        name: "disabled-media",
        onValueChange: vi.fn(),
        options: [{
          disabled: true,
          label: "Upload video",
          value: "video",
        }],
        value: "external",
      }),
    );

    expect(guidedOutput).toContain('aria-disabled="true"');
    expect(guidedOutput).toContain("items-start");
    expect(guidedOutput).not.toContain('disabled=""');
    expect(disabledOutput).toContain('disabled=""');
  });
});
