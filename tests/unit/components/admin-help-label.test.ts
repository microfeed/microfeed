import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {afterEach, describe, expect, it, vi} from "vitest";
import AdminHelpLabel, {type AdminHelpContent} from "@/components/admin/shared/AdminHelpLabel";
import AdminDialog from "@/components/admin/shared/AdminDialog";

const state = vi.hoisted(() => ({open: false, trigger: {current: null}}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: () => [state.open, (open: boolean) => { state.open = open; }],
  useRef: () => state.trigger,
}));

afterEach(() => { state.open = false; });

function render(help: AdminHelpContent) {
  const result = AdminHelpLabel({help});
  const children = React.Children.toArray(result.props.children) as React.ReactElement<any>[];
  return {button: children[0]!, dialog: children.find((element) => element.type === AdminDialog)!};
}

describe("admin field help", () => {
  it("opens without submitting the editor and restores focus to its trigger on dismissal", () => {
    const help = {linkName: "Field", text: "Explanation"};
    const initial = render(help);
    expect(initial.button.props.type).toBe("button");
    expect(initial.button.props["aria-haspopup"]).toBe("dialog");
    expect(initial.button.props["aria-expanded"]).toBe(false);
    expect(initial.dialog.props.open).toBe(false);
    initial.button.props.onClick();
    const opened = render(help);
    expect(opened.button.props["aria-expanded"]).toBe(true);
    expect(opened.dialog.props.open).toBe(true);
    expect(opened.dialog.props.finalFocus).toBe(state.trigger);
    opened.dialog.props.onOpenChange(false);
    expect(render(help).dialog.props.open).toBe(false);
  });

  it("renders HTML and JSON examples as literal code, never as executable markup", () => {
    const help = {
      linkName: "Field", text: "Explanation",
      html: '<script type="application/ld+json">\n{"name":"Example"}\n</script>',
      json: '{"title":"<img src=x onerror=alert(1)>"}',
    };
    const markup = renderToStaticMarkup(render(help).dialog.props.children);
    expect(markup).toContain('&lt;script type=&quot;application/ld+json&quot;&gt;\n');
    expect(markup).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(markup).not.toContain("<script");
    expect(markup).not.toContain("<img");
    expect(markup.match(/<code /gu)).toHaveLength(2);
    // HTML help does not inherit the legacy missing-RSS notice.
    expect(markup).not.toContain("<em>");
  });

  it("continues to support existing RSS and JSON explanations", () => {
    const markup = renderToStaticMarkup(render({
      linkName: "Title", text: "Explanation",
      rss: "<channel><title>Example</title></channel>",
      json: '{"title":"Example"}',
    }).dialog.props.children);
    expect(markup).toContain("&lt;channel&gt;&lt;title&gt;Example&lt;/title&gt;&lt;/channel&gt;");
    expect(markup.match(/<code /gu)).toHaveLength(2);
  });
});
