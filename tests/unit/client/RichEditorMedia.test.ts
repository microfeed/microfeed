import {describe, expect, it} from "vitest";

import {
  applyRichEditorMediaEmbedDefaults,
  applyRichEditorMediaSettings,
  isValidMediaDimension,
  richEditorMediaEmbedFormat,
  shouldStartRichEditorMediaDrag,
  stripTransientRichEditorAttributes,
} from "@/client/RichEditorMedia";

function fakeMediaElement(tagName = "IFRAME") {
  const attributes = new Map<string, string>();
  const declarations = new Map<string, string>();
  const style = {
    get aspectRatio() {
      return declarations.get("aspect-ratio") ?? "";
    },
    set aspectRatio(value: string) {
      declarations.set("aspect-ratio", value);
    },
    get cssText() {
      return Array.from(declarations)
        .map(([property, value]) => `${property}: ${value};`)
        .join(" ");
    },
    set cssText(value: string) {
      declarations.clear();
      for (const declaration of value.split(";")) {
        const separator = declaration.indexOf(":");
        if (separator > 0) {
          declarations.set(
            declaration.slice(0, separator).trim(),
            declaration.slice(separator + 1).trim(),
          );
        }
      }
    },
    get height() {
      return declarations.get("height") ?? "";
    },
    set height(value: string) {
      declarations.set("height", value);
    },
    get width() {
      return declarations.get("width") ?? "";
    },
    set width(value: string) {
      declarations.set("width", value);
    },
    getPropertyValue(property: string) {
      return declarations.get(property) ?? "";
    },
    removeProperty(property: string) {
      const previous = declarations.get(property) ?? "";
      declarations.delete(property);
      return previous;
    },
    setProperty(property: string, value: string) {
      declarations.set(property, value);
    },
  };
  return {
    attributes,
    declarations,
    element: {
      dataset: {} as DOMStringMap,
      tagName,
      getAttribute: (name: string) => attributes.get(name) ?? null,
      removeAttribute: (name: string) => attributes.delete(name),
      setAttribute: (name: string, value: string) => {
        attributes.set(name, value);
      },
      style,
    } as unknown as HTMLElement,
  };
}

describe("rich editor media helpers", () => {
  it("removes formatter-only attributes from iframe and image HTML", () => {
    const html = [
      '<iframe class="ql-video rich-editor-media-selected" draggable="true"',
      ' data-blot-formatter-id="video-1"',
      ' src="https://media.example.com/video.mp4"></iframe>',
      "<p>Keep editing this source.</p>",
      "<img class='rich-editor-media-dragging' draggable='false'",
      " data-blot-formatter-id='image-1'",
      ' src="/image.png">',
      '<video class="ql-native-video ql-video custom-video"',
      ' src="/video.mp4"></video>',
    ].join("");

    expect(stripTransientRichEditorAttributes(html)).toBe([
      '<iframe class="ql-video"',
      ' src="https://media.example.com/video.mp4"></iframe>',
      "<p>Keep editing this source.</p>",
      '<img src="/image.png">',
      '<video class="custom-video" src="/video.mp4"></video>',
    ].join(""));
  });

  it("does not change ordinary data attributes or media styles", () => {
    const html = [
      '<iframe class="ql-video" data-relative-size="true"',
      ' style="--resize-width: 100%; border-radius: 12px"',
      ' width="100%"></iframe>',
    ].join("");

    expect(stripTransientRichEditorAttributes(html)).toBe(html);
  });

  it("uses native media formats for new URL and file inserts", () => {
    expect(richEditorMediaEmbedFormat("image")).toBe("image");
    expect(richEditorMediaEmbedFormat("video")).toBe("video");
  });

  it("starts pointer dragging only after intentional movement", () => {
    expect(shouldStartRichEditorMediaDrag(10, 10, 13, 14)).toBe(false);
    expect(shouldStartRichEditorMediaDrag(10, 10, 16, 10)).toBe(true);
  });

  it("applies responsive defaults to new image embeds", () => {
    const {attributes, declarations, element} = fakeMediaElement("IMG");

    applyRichEditorMediaEmbedDefaults(element, "image");

    expect(attributes.get("width")).toBe("100%");
    expect(attributes.has("height")).toBe(false);
    expect(declarations.get("max-width")).toBe("600px");
    expect(declarations.get("--resize-width")).toBe("100%");
    expect(element.dataset.relativeSize).toBe("true");
  });

  it("applies responsive defaults to new video embeds", () => {
    const {attributes, declarations, element} = fakeMediaElement("VIDEO");

    applyRichEditorMediaEmbedDefaults(element, "video");

    expect(attributes.get("width")).toBe("100%");
    expect(attributes.has("height")).toBe(false);
    expect(declarations.get("max-width")).toBe("600px");
    expect(declarations.get("width")).toBe("100%");
    expect(declarations.get("height")).toBe("auto");
    expect(declarations.get("--resize-width")).toBe("100%");
    expect(element.dataset.relativeSize).toBe("true");
  });

  it("accepts practical CSS media dimensions and rejects invalid values", () => {
    for (const value of ["", "auto", "0", "100%", "640px", "42.5rem"]) {
      expect(isValidMediaDimension(value, "width"), value).toBe(true);
    }
    for (const value of ["wide", "100", "-12px", "100 pixels"]) {
      expect(isValidMediaDimension(value, "height"), value).toBe(false);
    }
  });

  it("uses a responsive aspect ratio for automatic video height", () => {
    const {attributes, declarations, element} = fakeMediaElement();

    applyRichEditorMediaSettings(element, "video", {
      alt: "",
      height: "auto",
      style: "border-radius: 12px;",
      title: "Walkthrough",
      width: "100%",
    });

    expect(attributes.get("width")).toBe("100%");
    expect(attributes.has("height")).toBe(false);
    expect(attributes.get("title")).toBe("Walkthrough");
    expect(declarations.get("width")).toBe("100%");
    expect(declarations.get("height")).toBe("auto");
    expect(declarations.get("aspect-ratio")).toBe("16 / 9");
    expect(declarations.get("--resize-width")).toBe("100%");
    expect(element.dataset.relativeSize).toBe("true");
  });

  it("preserves an explicit video aspect ratio", () => {
    const {declarations, element} = fakeMediaElement();

    applyRichEditorMediaSettings(element, "video", {
      alt: "",
      height: "auto",
      style: "aspect-ratio: 9 / 16;",
      title: "",
      width: "100%",
    });

    expect(declarations.get("aspect-ratio")).toBe("9 / 16");
  });

  it("lets native video preserve its intrinsic aspect ratio", () => {
    const {declarations, element} = fakeMediaElement("VIDEO");

    applyRichEditorMediaSettings(element, "video", {
      alt: "",
      height: "auto",
      style: "",
      title: "",
      width: "100%",
    });

    expect(declarations.get("width")).toBe("100%");
    expect(declarations.get("height")).toBe("auto");
    expect(declarations.has("aspect-ratio")).toBe(false);
  });
});
