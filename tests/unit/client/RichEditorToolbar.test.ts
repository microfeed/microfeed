import {describe, expect, it} from "vitest";

import {
  labelRichEditorToolbar,
  RICH_EDITOR_TOOLBAR_LABELS,
} from "@/client/RichEditorToolbar";

describe("labelRichEditorToolbar", () => {
  it("adds accessible hover labels to every configured toolbar control", () => {
    const controls = new Map<string, {
      attributes: Map<string, string>;
      setAttribute(name: string, value: string): void;
    }>(
      RICH_EDITOR_TOOLBAR_LABELS.map(([selector]) => [
        selector,
        {
          attributes: new Map<string, string>(),
          setAttribute(name: string, value: string) {
            this.attributes.set(name, value);
          },
        },
      ]),
    );
    const container = {
      querySelectorAll(selector: string) {
        const control = controls.get(selector);
        return control ? [control] : [];
      },
    } as unknown as HTMLElement;

    labelRichEditorToolbar(container);

    RICH_EDITOR_TOOLBAR_LABELS.forEach(([selector, label]) => {
      expect(controls.get(selector)?.attributes.get("aria-label")).toBe(label);
      expect(controls.get(selector)?.attributes.get("title")).toBe(label);
    });
  });

  it("keeps the clear-formatting control explicitly labeled", () => {
    expect(RICH_EDITOR_TOOLBAR_LABELS).toContainEqual([
      "button.ql-clean",
      "Clear formatting",
    ]);
  });
});
