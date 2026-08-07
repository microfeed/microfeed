import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import path from "node:path";

import {CliError} from "./errors.js";
import {
  apiOrigin,
  apiRequest,
  type ApiResponse,
  type GlobalOptions,
} from "./http.js";

type UploadCategory = "audio" | "document" | "image" | "video";

export interface UploadedAttachment {
  category: UploadCategory;
  mime_type: string;
  size_in_bytes: number;
  url: string;
}

interface MediaType {
  category: UploadCategory;
  contentType: string;
}

const MEDIA_TYPES: Readonly<Record<string, MediaType>> = {
  ".avif": {category: "image", contentType: "image/avif"},
  ".cr2": {category: "image", contentType: "image/x-canon-cr2"},
  ".doc": {category: "document", contentType: "application/msword"},
  ".docx": {
    category: "document",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  ".flac": {category: "audio", contentType: "audio/flac"},
  ".gif": {category: "image", contentType: "image/gif"},
  ".heic": {category: "image", contentType: "image/heic"},
  ".jpeg": {category: "image", contentType: "image/jpeg"},
  ".jpg": {category: "image", contentType: "image/jpeg"},
  ".m4b": {category: "audio", contentType: "audio/mp4"},
  ".mp3": {category: "audio", contentType: "audio/mpeg"},
  ".mp4": {category: "video", contentType: "video/mp4"},
  ".pdf": {category: "document", contentType: "application/pdf"},
  ".png": {category: "image", contentType: "image/png"},
  ".ppt": {category: "document", contentType: "application/vnd.ms-powerpoint"},
  ".pptx": {
    category: "document",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  ".txt": {category: "document", contentType: "text/plain"},
  ".webp": {category: "image", contentType: "image/webp"},
  ".xlsx": {
    category: "document",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

const ITEM_IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);

function errorDetail(response: ApiResponse): string {
  if (
    response.body &&
    typeof response.body === "object" &&
    "error" in response.body &&
    typeof response.body.error === "string"
  ) {
    return `: ${response.body.error}`;
  }
  return "";
}

function preparedUpload(response: ApiResponse, label: string): {
  mediaUrl: URL;
  presignedUrl: URL;
} {
  if (!response.ok || response.status !== 201) {
    throw new CliError(
      `Unable to prepare the ${label} upload (${response.status})${errorDetail(response)}.`,
    );
  }
  if (!response.body || typeof response.body !== "object") {
    throw new CliError(`The instance returned an invalid ${label}-upload response.`);
  }
  const mediaUrl = "media_url" in response.body
    ? response.body.media_url
    : undefined;
  const presignedUrl = "presigned_url" in response.body
    ? response.body.presigned_url
    : undefined;
  if (typeof mediaUrl !== "string" || typeof presignedUrl !== "string") {
    throw new CliError(`The instance returned an invalid ${label}-upload response.`);
  }
  try {
    return {
      mediaUrl: new URL(mediaUrl),
      presignedUrl: new URL(presignedUrl),
    };
  } catch {
    throw new CliError(`The instance returned an invalid ${label}-upload URL.`);
  }
}

async function fileMetadata(filename: string, label: string): Promise<{
  fileSize: number;
  mediaType: MediaType;
  modifiedAt: number;
}> {
  const extension = path.extname(filename).toLowerCase();
  const mediaType = MEDIA_TYPES[extension];
  if (!mediaType) {
    throw new CliError(
      label === "item image"
        ? "--image-file supports .avif, .gif, .jpeg, .jpg, .png, and .webp files."
        : "--attachment-file supports common audio, video, document, and image files. Run `yarn microfeed item update --help` for the complete list.",
    );
  }
  if (label === "item image" && !ITEM_IMAGE_EXTENSIONS.has(extension)) {
    throw new CliError(
      "--image-file supports .avif, .gif, .jpeg, .jpg, .png, and .webp files.",
    );
  }

  try {
    const metadata = await stat(filename);
    if (!metadata.isFile()) throw new Error("not a regular file");
    return {
      fileSize: metadata.size,
      mediaType,
      modifiedAt: metadata.mtimeMs,
    };
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new CliError(`Unable to read ${label} file ${filename}${detail}`);
  }
}

async function uploadMediaFile(
  filename: string,
  itemId: string | undefined,
  label: string,
  options: GlobalOptions,
): Promise<{
  category: UploadCategory;
  contentType: string;
  mediaUrl: string;
  size: number;
}> {
  const {fileSize, mediaType, modifiedAt} = await fileMetadata(filename, label);
  const origin = await apiOrigin(options);
  const prepared = preparedUpload(await apiRequest(
    "POST",
    "/api/v1/media_files/presigned_urls/",
    options,
    {
      body: JSON.stringify({
        category: mediaType.category,
        full_local_file_path: path.basename(filename),
        ...(itemId ? {item_id: itemId} : {}),
        size: fileSize,
        type: mediaType.contentType,
      }),
    },
  ), label);
  if (prepared.presignedUrl.origin !== origin) {
    throw new CliError(
      `The instance returned a ${label}-upload URL for a different site; no file bytes were sent.`,
    );
  }
  if (!prepared.presignedUrl.pathname.startsWith("/media-upload/")) {
    throw new CliError(
      `The instance returned an unexpected ${label}-upload path; no file bytes were sent.`,
    );
  }
  if (!["http:", "https:"].includes(prepared.mediaUrl.protocol)) {
    throw new CliError(`The instance returned an unsupported permanent ${label} URL.`);
  }

  const bytes = createReadStream(filename);
  let upload: Response;
  try {
    upload = await fetch(prepared.presignedUrl, {
      body: bytes as unknown as BodyInit,
      duplex: "half",
      headers: {
        "content-length": String(fileSize),
        "content-type": mediaType.contentType,
      },
      method: "PUT",
      redirect: "manual",
    } as RequestInit & {duplex: "half"});
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new CliError(`The ${label} upload failed${detail}`);
  } finally {
    bytes.destroy();
  }
  if (upload.status >= 300 && upload.status < 400) {
    throw new CliError(
      `The ${label} upload returned a redirect; no file bytes were forwarded.`,
    );
  }
  if (!upload.ok) {
    throw new CliError(`The ${label} upload failed (${upload.status}).`);
  }
  try {
    const current = await stat(filename);
    if (current.size !== fileSize || current.mtimeMs !== modifiedAt) {
      throw new Error("changed");
    }
  } catch {
    throw new CliError(
      `The ${label} file changed while it was being uploaded. Run the command again.`,
    );
  }
  return {
    category: mediaType.category,
    contentType: mediaType.contentType,
    mediaUrl: prepared.mediaUrl.toString(),
    size: fileSize,
  };
}

export async function uploadImageFile(
  filename: string,
  itemId: string | undefined,
  options: GlobalOptions,
): Promise<string> {
  return (await uploadMediaFile(filename, itemId, "item image", options)).mediaUrl;
}

export async function uploadAttachmentFile(
  filename: string,
  itemId: string,
  options: GlobalOptions,
): Promise<UploadedAttachment> {
  const uploaded = await uploadMediaFile(
    filename,
    itemId,
    "media attachment",
    options,
  );
  return {
    category: uploaded.category,
    mime_type: uploaded.contentType,
    size_in_bytes: uploaded.size,
    url: uploaded.mediaUrl,
  };
}
