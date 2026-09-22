import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it, vi} from "vitest";
import AdminLanguageSelect from "@/components/admin/shared/AdminLanguageSelect";

describe("shared channel and item language selector", () => {
  it("offers the channel languages plus an explicit way to restore inheritance", () => {
    const onChange = vi.fn();
    const control = AdminLanguageSelect({value: "ja", inheritedLanguage: "en", onChange});
    const japanese = control.props.options.find((option: {value: string}) => option.value === "ja")!;
    control.props.onChange(japanese);
    expect(onChange).toHaveBeenLastCalledWith("ja");
    control.props.onChange(control.props.options.find((option: {value: string}) => option.value === "")!);
    expect(onChange).toHaveBeenLastCalledWith("");
    const channel = AdminLanguageSelect({value: "en", onChange});
    expect(channel.props.options.some((option: {value: string}) => option.value === "")).toBe(false);
    const markup = renderToStaticMarkup(React.createElement(AdminLanguageSelect, {
      inheritedLanguage: "en", label: "Item language", ariaLabel: "Item language", onChange,
    }));
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-label="Item language"');
    expect(markup).toContain("Inherit from channel");
    expect(markup).toContain("English");
  });

  it("displays saved script variants and matches existing codes without changing their case", () => {
    const onChange = vi.fn();
    const custom = AdminLanguageSelect({value: "zh-Hans", inheritedLanguage: "en", onChange});
    expect(custom.props.value?.value).toBe("zh-Hans");
    const existing = AdminLanguageSelect({value: "en-US", onChange});
    expect(existing.props.value?.value).toBe("en-us");
    expect(onChange).not.toHaveBeenCalled();
  });
});
