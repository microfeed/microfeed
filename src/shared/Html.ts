/** Escape plain text for an HTML text node or quoted attribute. */
export function escapeHtml(htmlStr: string): string {
  return htmlStr.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
