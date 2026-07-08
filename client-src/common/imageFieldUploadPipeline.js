const IMAGE_FIELD_MAX_DIMENSION = 1024;

const IMAGE_FIELD_ALLOWED_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "avif",
  "heic",
  "heif",
  "apng",
  "cr2",
  "bmp",
  "ico",
  "tiff",
];

function extensionOf(value) {
  const base = String(value || "").split("/").pop() || "";
  const idx = base.lastIndexOf(".");
  return idx >= 0 ? base.slice(idx + 1).toLowerCase() : "";
}

function mimeExt(contentType = "") {
  const type = String(contentType).toLowerCase();
  if (type === "image/svg+xml") {
    return "svg";
  }
  if (type.startsWith("image/")) {
    return type.slice("image/".length).split(";")[0];
  }
  return "";
}

function isSvgClassification(ext, type) {
  return ext === "svg" || type === "image/svg+xml" || type.startsWith("image/svg");
}

function isAnimatedClassification(ext, type) {
  return ext === "gif" || ext === "webp" || ext === "apng"
    || type === "image/gif" || type === "image/webp" || type === "image/apng";
}

export function classifyImageFieldFile(file = {}) {
  const type = String(file.type || "").toLowerCase();
  const ext = extensionOf(file.name) || mimeExt(type);

  if (isSvgClassification(ext, type)) {
    return {
      kind: "svg",
      outputExtension: "svg",
      outputContentType: "image/svg+xml",
    };
  }

  if (isAnimatedClassification(ext, type)) {
    return {
      kind: "animated",
      outputExtension: ext || "gif",
      outputContentType: type || `image/${ext || "gif"}`,
    };
  }

  return {
    kind: "raster",
    outputExtension: "avif",
    outputContentType: "image/avif",
  };
}

export function getNormalizedSquareOutputSize(width, height, maxDimension = IMAGE_FIELD_MAX_DIMENSION) {
  const safeWidth = Number(width) || 0;
  const safeHeight = Number(height) || 0;
  if (safeWidth <= 0 || safeHeight <= 0) {
    return 0;
  }
  return Math.min(maxDimension, safeWidth, safeHeight);
}

export function getImageFieldAcceptedFileTypes() {
  return IMAGE_FIELD_ALLOWED_EXTENSIONS.map((ext) => ext.toUpperCase());
}

export function isImageFieldCompatibleStoredMedia(media = {}) {
  const url = media.url || media.original_filename || "";
  const contentType = String(media.content_type || media.contentType || "").toLowerCase();
  const ext = extensionOf(url) || mimeExt(contentType);
  if (isSvgClassification(ext, contentType)) {
    return true;
  }
  if (isAnimatedClassification(ext, contentType)) {
    return true;
  }
  return ext === "avif" || contentType === "image/avif";
}

export async function readImageDimensions(file) {
  if (!file || typeof URL === "undefined" || typeof Image === "undefined") {
    return {width: null, height: null};
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        resolve({
          width: image.naturalWidth || image.width || null,
          height: image.naturalHeight || image.height || null,
        });
      };
      image.onerror = () => resolve({width: null, height: null});
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default {
  classifyImageFieldFile,
  getNormalizedSquareOutputSize,
  getImageFieldAcceptedFileTypes,
  isImageFieldCompatibleStoredMedia,
  readImageDimensions,
};
