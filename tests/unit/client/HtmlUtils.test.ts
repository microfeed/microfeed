import {describe, expect, it} from "vitest";

import {formatHtmlForEditing} from "@/client/HtmlUtils";

describe("formatHtmlForEditing", () => {
  it("places adjacent rich-text blocks on separate lines", () => {
    expect(formatHtmlForEditing("<p>First</p><p>Second<br>line</p>"))
      .toBe("<p>First</p>\n<p>Second<br>line</p>");
  });

  it("indents nested blocks while preserving inline markup", () => {
    const html = '<div><p>Hello <strong data-note=">">world</strong></p><ul><li>One</li><li>Two</li></ul></div>';

    expect(formatHtmlForEditing(html)).toBe([
      "<div>",
      '  <p>Hello <strong data-note=">">world</strong></p>',
      "  <ul>",
      "    <li>One</li>",
      "    <li>Two</li>",
      "  </ul>",
      "</div>",
    ].join("\n"));
  });

  it("is stable when formatting previously indented HTML", () => {
    const formatted = [
      "<div>",
      "  <p>First</p>",
      "  <p>Second</p>",
      "</div>",
    ].join("\n");

    expect(formatHtmlForEditing(formatted)).toBe(formatted);
  });

  it("preserves whitespace inside raw text elements", () => {
    const html = "<pre>line one\n  line two</pre><p>After</p>";

    expect(formatHtmlForEditing(html)).toBe(
      "<pre>line one\n  line two</pre>\n<p>After</p>",
    );
  });

  it("preserves meaningful inline text whitespace", () => {
    const html = '<p>Hello   <span style="white-space: pre-wrap">a  b</span> !</p>';

    expect(formatHtmlForEditing(html)).toBe(html);
  });

  it("leaves incomplete source editable", () => {
    expect(formatHtmlForEditing("<p>unfinished"))
      .toBe("<p>unfinished");
  });
});
