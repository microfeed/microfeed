const RICH_EDITOR_TOOLBAR_LABELS = [
  [".ql-header", "Text style"],
  ["button.ql-bold", "Bold"],
  ["button.ql-italic", "Italic"],
  ["button.ql-underline", "Underline"],
  ["button.ql-blockquote", "Block quote"],
  ["button.ql-code", "Inline code"],
  ["button.ql-code-block", "Code block"],
  ['button.ql-list[value="ordered"]', "Numbered list"],
  ['button.ql-list[value="bullet"]', "Bulleted list"],
  ['button.ql-indent[value="-1"]', "Decrease indent"],
  ['button.ql-indent[value="+1"]', "Increase indent"],
  ["button.ql-link", "Insert link"],
  ["button.ql-image", "Insert image"],
  ["button.ql-video", "Insert video"],
  ["button.ql-clean", "Clear formatting"],
] as const;

export function labelRichEditorToolbar(container: HTMLElement): void {
  RICH_EDITOR_TOOLBAR_LABELS.forEach(([selector, label]) => {
    container.querySelectorAll<HTMLElement>(selector).forEach((control) => {
      control.setAttribute("aria-label", label);
      control.setAttribute("title", label);
    });
  });
}

export {RICH_EDITOR_TOOLBAR_LABELS};
