import {stripTransientRichEditorAttributes} from "./RichEditorMedia";

function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function semanticCodeBlockHtml(lines: readonly string[]): string {
  return `<pre><code>${escapeHtmlText(lines.join("\n"))}</code></pre>`;
}

export function shouldReplaceRichEditorHtml(
  nextValue: string,
  currentValue: string,
  lastEmittedValue: string | null,
): boolean {
  if (lastEmittedValue !== null && nextValue === lastEmittedValue) {
    return false;
  }
  if (!nextValue && currentValue === "<p><br></p>") {
    return false;
  }
  return nextValue !== currentValue;
}

export function serializeRichEditorHtml(editorRoot: HTMLElement): string {
  const clone = editorRoot.cloneNode(true) as HTMLElement;

  clone.querySelectorAll<HTMLElement>(".ql-code-block-container")
    .forEach((container) => {
      const lines = Array.from(container.children)
        .filter((child) => child.classList.contains("ql-code-block"))
        .map((line) => line.textContent ?? "");
      const template = clone.ownerDocument.createElement("template");
      template.innerHTML = semanticCodeBlockHtml(lines);
      const semanticCodeBlock = template.content.firstElementChild;
      if (semanticCodeBlock) {
        container.replaceWith(semanticCodeBlock);
      }
    });

  return stripTransientRichEditorAttributes(clone.innerHTML);
}
