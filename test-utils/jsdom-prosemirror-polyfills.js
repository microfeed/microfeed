// ProseMirror (TipTap) queries layout/coordinate APIs that jsdom does not
// implement. Isolated they no-op fine, but under full-suite parallel execution
// the missing/undefined results make editor tests non-deterministic. These
// guarded polyfills make them stable. No-op in the node test environment
// (Range/document are jsdom-only), so the backend suite is unaffected.
if (typeof window !== "undefined" && typeof Range !== "undefined") {
  const zeroRect = () => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON() {
      return {};
    },
  });

  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = zeroRect;
  }
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => ({
      item: () => null,
      length: 0,
      [Symbol.iterator]: Array.prototype[Symbol.iterator],
    });
  }
  if (typeof document !== "undefined" && !document.elementFromPoint) {
    document.elementFromPoint = () => null;
  }
  if (typeof window.getSelection !== "function") {
    window.getSelection = () => ({
      rangeCount: 0,
      addRange: () => {},
      removeAllRanges: () => {},
      getRangeAt: () => null,
    });
  }
}
