/**
 * Converts a plain-text email body to safe HTML.
 * - Escapes HTML special characters to prevent XSS.
 * - Wraps http/https URLs in <a> tags so they are clickable.
 * - Converts newlines to <br> for correct line-break rendering.
 */
export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const linked = escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return linked.replace(/\n/g, "<br>\n");
}
