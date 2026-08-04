import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";

import AdminSelect from "@/components/admin/shared/AdminSelect";
import {Combobox, ComboboxEmpty} from "@/components/ui/combobox";

const options = [
  {label: "Technology", value: "technology"},
  {label: "Science", value: "science"},
];

describe("AdminSelect", () => {
  it("renders a styled, searchable single-select control without generated CSS", () => {
    const output = renderToStaticMarkup(
      React.createElement(AdminSelect, {
        ariaLabel: "Category",
        onChange: vi.fn(),
        options,
        value: options[0]!,
      }),
    );

    expect(output).toContain('data-slot="combobox-input-group"');
    expect(output).toContain('data-slot="combobox-input"');
    expect(output).toContain('data-slot="combobox-trigger"');
    expect(output).toContain('aria-label="Category"');
    expect(output).toContain('data-slot="admin-select-input-container"');
    expect(output).toContain('data-slot="admin-select-value"');
    expect(output).toContain("ml-1");
    expect(output).toContain("rounded-[4px]");
    expect(output).toContain("border-black");
    expect(output).toContain("focus-within:border-[#2684ff]");
    expect(output).toContain("focus-within:ring-[#2684ff]");
    expect(output).toContain("Technology");
    expect(output).not.toContain("data-emotion");
  });

  it("preserves rich selected labels while filtering by their text value", () => {
    const richOption = {
      label: React.createElement(
        "div",
        null,
        React.createElement("span", null, "English (United States)"),
        React.createElement("span", null, "en-us"),
      ),
      textValue: "English (United States) en-us",
      value: "en-us",
    };
    const output = renderToStaticMarkup(
      React.createElement(AdminSelect, {
        ariaLabel: "Language",
        onChange: vi.fn(),
        options: [richOption],
        value: richOption,
      }),
    );

    expect(output).toContain("English (United States)");
    expect(output).toContain("en-us");
    expect(output).toContain('aria-label="Language"');
  });

  it("renders removable selections and a clear action for multiple values", () => {
    const output = renderToStaticMarkup(
      React.createElement(AdminSelect, {
        ariaLabel: "Categories",
        multiple: true,
        onChange: vi.fn(),
        options,
        value: [options[0]!],
      }),
    );

    expect(output).toContain('aria-label="Remove Technology"');
    expect(output).toContain('aria-label="Clear Categories"');
    expect(output).toContain('aria-label="Open Categories"');
    expect(output).toContain("rounded-[2px]");
    expect(output).toContain("bg-[#e6e6e6]");
  });

  it("only gives the empty state layout when no options match", () => {
    const emptyOutput = renderToStaticMarkup(
      React.createElement(
        Combobox,
        {items: []},
        React.createElement(ComboboxEmpty, null, "No options found."),
      ),
    );
    const populatedOutput = renderToStaticMarkup(
      React.createElement(
        Combobox,
        {items: options},
        React.createElement(ComboboxEmpty, null, "No options found."),
      ),
    );

    expect(emptyOutput).toContain("No options found.");
    expect(emptyOutput).toContain("hidden");
    expect(emptyOutput).toContain("group-data-empty/combobox-content:block");
    expect(populatedOutput).not.toContain("No options found.");
  });
});
