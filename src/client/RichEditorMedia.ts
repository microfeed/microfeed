export const RICH_EDITOR_MEDIA_STYLE_FORMAT = "mediaStyle";
export const RICH_EDITOR_MEDIA_TITLE_FORMAT = "mediaTitle";
export const RICH_EDITOR_LEGACY_VIDEO_FORMAT = "legacyVideo";

export type RichEditorMediaType = "image" | "video";

export function richEditorMediaEmbedFormat(
  mediaType: RichEditorMediaType,
  uploadedFile: boolean,
): RichEditorMediaType | typeof RICH_EDITOR_LEGACY_VIDEO_FORMAT {
  return mediaType === "video" && !uploadedFile
    ? RICH_EDITOR_LEGACY_VIDEO_FORMAT
    : mediaType;
}

export interface RichEditorMediaSettings {
  alt: string;
  height: string;
  style: string;
  title: string;
  width: string;
}

const TRANSIENT_MEDIA_CLASSES = new Set([
  "rich-editor-media-dragging",
  "rich-editor-media-drop-after",
  "rich-editor-media-drop-before",
  "rich-editor-media-selected",
]);
const OBSOLETE_NATIVE_VIDEO_CLASSES = new Set([
  "ql-native-video",
  "ql-video",
]);
const DEFAULT_VIDEO_ASPECT_RATIO = "16 / 9";
const FALLBACK_DIMENSION_PATTERN =
  /^(?:auto|min-content|max-content|fit-content|0|(?:\d+(?:\.\d+)?|\.\d+)(?:%|px|em|rem|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc))$/iu;

export function stripTransientRichEditorAttributes(html: string): string {
  const withoutObsoleteNativeVideoClasses = html.replace(
    /<video\b[^>]*>/giu,
    (videoTag) => videoTag.replace(
      /\sclass=("([^"]*)"|'([^']*)')/iu,
      (_match, quotedValue: string, doubleQuoted: string, singleQuoted: string) => {
        const quote = quotedValue[0];
        const classNames = (doubleQuoted ?? singleQuoted ?? "")
          .split(/\s+/u)
          .filter((className) => (
            className && !OBSOLETE_NATIVE_VIDEO_CLASSES.has(className)
          ));
        return classNames.length > 0
          ? ` class=${quote}${classNames.join(" ")}${quote}`
          : "";
      },
    ),
  );

  return withoutObsoleteNativeVideoClasses
    .replace(
      /\sdata-blot-formatter-id=(?:"[^"]*"|'[^']*')/giu,
      "",
    )
    .replace(/\sdraggable=(?:"true"|'true')/giu, "")
    .replace(
      /\sclass=("([^"]*)"|'([^']*)')/giu,
      (_match, quotedValue: string, doubleQuoted: string, singleQuoted: string) => {
        const quote = quotedValue[0];
        const classNames = (doubleQuoted ?? singleQuoted ?? "")
          .split(/\s+/u)
          .filter((className) => (
            className && !TRANSIENT_MEDIA_CLASSES.has(className)
          ));
        return classNames.length > 0
          ? ` class=${quote}${classNames.join(" ")}${quote}`
          : "";
      },
    );
}

export function isValidMediaDimension(
  value: string,
  property: "height" | "width",
): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }

  if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
    return CSS.supports(property, normalized);
  }

  return FALLBACK_DIMENSION_PATTERN.test(normalized);
}

function userStyle(element: HTMLElement): string {
  const style = element.ownerDocument.createElement("div").style;
  style.cssText = element.getAttribute("style") ?? "";
  style.removeProperty("width");
  style.removeProperty("height");
  style.removeProperty("--resize-width");
  return style.cssText;
}

export function readRichEditorMediaSettings(
  element: HTMLElement,
): RichEditorMediaSettings {
  return {
    alt: element.getAttribute("alt") ?? "",
    height: element.getAttribute("height") ?? element.style.height,
    style: userStyle(element),
    title: element.getAttribute("title") ?? "",
    width: element.getAttribute("width") ?? element.style.width,
  };
}

function setOptionalAttribute(
  element: HTMLElement,
  attribute: string,
  value: string,
) {
  const normalized = value.trim();
  if (normalized) {
    element.setAttribute(attribute, normalized);
  } else {
    element.removeAttribute(attribute);
  }
}

export function applyRichEditorMediaSettings(
  element: HTMLElement,
  mediaType: RichEditorMediaType,
  settings: RichEditorMediaSettings,
) {
  element.style.cssText = settings.style.trim();
  element.style.removeProperty("width");
  element.style.removeProperty("height");

  setOptionalAttribute(element, "width", settings.width);
  const height = settings.height.trim();
  const width = settings.width.trim();
  const usesAutomaticVideoHeight =
    mediaType === "video" && height.toLowerCase() === "auto";
  if (usesAutomaticVideoHeight) {
    element.removeAttribute("height");
  } else {
    setOptionalAttribute(element, "height", height);
  }

  if (mediaType === "video") {
    if (width) {
      element.style.width = width;
    }
    if (height) {
      element.style.height = height;
    }
    if (
      element.tagName === "IFRAME" &&
      usesAutomaticVideoHeight &&
      !element.style.getPropertyValue("aspect-ratio")
    ) {
      element.style.aspectRatio = DEFAULT_VIDEO_ASPECT_RATIO;
    }
  }

  if (width) {
    element.style.setProperty("--resize-width", width);
    element.dataset.relativeSize = String(width.endsWith("%"));
  } else {
    element.style.removeProperty("--resize-width");
    delete element.dataset.relativeSize;
  }

  if (mediaType === "image") {
    setOptionalAttribute(element, "alt", settings.alt);
  }
  setOptionalAttribute(element, "title", settings.title);

  if (!element.style.cssText) {
    element.removeAttribute("style");
  }
}

export function findRichEditorMediaElement(
  target: EventTarget | null,
  editorRoot: HTMLElement,
): HTMLElement | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const mediaElement = target.closest<HTMLElement>(
    "img, video, iframe.ql-video",
  );

  return mediaElement && editorRoot.contains(mediaElement)
    ? mediaElement
    : null;
}

export function richEditorMediaType(
  element: HTMLElement,
): RichEditorMediaType {
  return element.tagName === "IMG" ? "image" : "video";
}
