import {describe, expect, test} from "vitest";
import {
  semanticCodeBlockHtml,
  shouldReplaceRichEditorHtml,
} from "@/client/RichEditorHtml";

describe("semanticCodeBlockHtml", () => {
  test("wraps multiple lines in semantic pre and code elements", () => {
    expect(semanticCodeBlockHtml([
      "const answer = 42;",
      "console.log(answer);",
    ])).toBe(
      "<pre><code>const answer = 42;\nconsole.log(answer);</code></pre>",
    );
  });

  test("escapes code without collapsing blank lines", () => {
    expect(semanticCodeBlockHtml([
      "if (value < 10 && value > 0) {",
      "",
      "}",
    ])).toBe(
      "<pre><code>if (value &lt; 10 &amp;&amp; value &gt; 0) {\n\n}</code></pre>",
    );
  });
});

describe("shouldReplaceRichEditorHtml", () => {
  test("does not paste locally emitted HTML back into the editor", () => {
    expect(shouldReplaceRichEditorHtml(
      "<p>new line</p>",
      "<p>new line</p>",
      "<p>new line</p>",
    )).toBe(false);
  });

  test("replaces editor content after a genuine external change", () => {
    expect(shouldReplaceRichEditorHtml(
      "<p>external edit</p>",
      "<p>current value</p>",
      null,
    )).toBe(true);
  });

  test("treats Quill's empty paragraph as an empty value", () => {
    expect(shouldReplaceRichEditorHtml("", "<p><br></p>", null)).toBe(false);
  });
});
