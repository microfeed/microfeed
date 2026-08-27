export function nativeWebMcpAvailable(
  currentDocument: Document = document,
): boolean {
  if (currentDocument.querySelector<HTMLMetaElement>(
    'meta[name="microfeed-webmcp-enabled"]',
  )?.content !== "true") {
    return false;
  }
  const value = Reflect.get(currentDocument, "modelContext") as unknown;
  return Boolean(
    value && typeof value === "object" &&
      typeof Reflect.get(value, "registerTool") === "function",
  );
}
