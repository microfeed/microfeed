import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import AdminCopyableUrl from "@/components/admin/shared/AdminCopyableUrl";
import AdminCodeEditor, {
  isCaretOnLastLine,
} from "@/components/admin/shared/AdminCodeEditor";
import AdminDialog from "@/components/admin/shared/AdminDialog";
import AdminImagePreviewDialog from "@/components/admin/shared/AdminImagePreviewDialog";
import AdminPublicAccess, {
  publicAccessItems,
} from "@/components/admin/shared/AdminPublicAccess";
import AdminRadioGroup from "@/components/admin/shared/AdminRadioGroup";
import AdminSwitch from "@/components/admin/shared/AdminSwitch";
import {Input} from "@/components/ui/input";

describe("admin UI controls", () => {
  it("only auto-scrolls a code editor when its caret is on the final line", () => {
    const value = "first line\nsecond line\nlast line";

    expect(isCaretOnLastLine(value, value.length, value.length)).toBe(true);
    expect(isCaretOnLastLine(value, 24, 24)).toBe(true);
    expect(isCaretOnLastLine(value, 5, 5)).toBe(false);
    expect(isCaretOnLastLine(value, 5, value.length)).toBe(false);
  });

  it("supports a read-only highlighted code preview", () => {
    const output = renderToStaticMarkup(
      React.createElement(AdminCodeEditor, {
        code: "{\"ok\":true}",
        language: "json",
        readOnly: true,
      }),
    );

    expect(output).toContain("readonly=\"\"");
    expect(output).toContain('aria-label="Code editor"');
  });

  it("orders and labels the public access feeds", () => {
    const links = {
      json: "https://feed.example.com/json/",
      rss: "https://feed.example.com/rss/",
      website: "https://feed.example.com/",
    };
    const items = publicAccessItems(links);

    expect(items.map(({label, url}) => ({label, url}))).toEqual([
      {label: "web feed", url: "https://feed.example.com/"},
      {label: "rss feed", url: "https://feed.example.com/rss/"},
      {label: "json feed", url: "https://feed.example.com/json/"},
    ]);

    const output = renderToStaticMarkup(
      React.createElement(AdminPublicAccess, {links}),
    );
    expect(output).toContain('aria-label="web feed address controls"');
    expect(output).toContain('aria-label="rss feed address controls"');
    expect(output).toContain('aria-label="json feed address controls"');
  });

  it("renders a disabled URL input with copy and open controls", () => {
    const output = renderToStaticMarkup(
      React.createElement(AdminCopyableUrl, {
        label: "web feed",
        url: "https://feed.example.com/",
      }),
    );

    expect(output).toContain('aria-label="web feed address"');
    expect(output).toContain('disabled=""');
    expect(output).toContain('value="https://feed.example.com/"');
    expect(output).toContain('aria-label="Copy web feed address"');
    expect(output).toContain('aria-label="Open web feed in a new tab"');
    expect(output).toContain('href="https://feed.example.com/"');
    expect(output).toContain('target="_blank"');
  });

  it("forwards refs through the shared input primitive", () => {
    expect((Input as unknown as {$$typeof: symbol}).$$typeof).toBe(
      Symbol.for("react.forward_ref"),
    );
  });

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

  it("renders the reusable full-screen image preview controls", () => {
    const onOpenChange = vi.fn();
    const dialog = AdminImagePreviewDialog({
      imageUrl: "https://media.example.com/production/images/item.png",
      onOpenChange,
      open: true,
    });
    const content = dialog.props.children as React.ReactElement<any>;
    const children = React.Children.toArray(
      content.props.children,
    ) as React.ReactElement<any>[];
    const controls = children[2]!;
    const [openLink, closeButton] = React.Children.toArray(
      controls.props.children,
    ) as React.ReactElement<any>[];
    const image = children[3]!;

    expect(dialog.props.open).toBe(true);
    expect(content.props.showCloseButton).toBe(false);
    expect(openLink!.props.href).toBe(
      "https://media.example.com/production/images/item.png",
    );
    expect(openLink!.props.target).toBe("_blank");
    expect(closeButton!.props.children).toContain("Close");
    expect(image.props.src).toBe("https://media.example.com/production/images/item.png");
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
        alignment: "start",
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
    expect(output).toContain('<button');
    expect(output).toContain('type="button"');
    expect(output).toContain('data-slot="radio-option"');
    expect(output).not.toContain("<label");
    expect(output).toMatch(/aria-labelledby="[^"]+-label"/u);
    expect(output).toMatch(/aria-describedby="[^"]+-description"/u);
    expect(output).toContain('data-checked=""');
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
    expect(guidedOutput).not.toContain('disabled=""');
    expect(disabledOutput).toContain('disabled=""');
  });
});
