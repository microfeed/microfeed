import React, { useState } from "react";
import Requests from "../../../common/requests";
import { randomHex, urlJoinWithRelative } from "../../../../common-src/StringUtils";
import { ENCLOSURE_CATEGORIES, ENCLOSURE_CATEGORIES_DICT } from "../../../../common-src/Constants";

// The internally-stored media url is host-less (it already includes the
// project/env prefix). External urls are absolute already; everything else is
// joined onto the public bucket url so the preview link actually resolves.
function absoluteMediaUrl(mediaFile, publicBucketUrl) {
  if (!mediaFile || !mediaFile.url) {
    return "";
  }
  if (mediaFile.category === ENCLOSURE_CATEGORIES.EXTERNAL_URL) {
    return mediaFile.url;
  }
  return urlJoinWithRelative(publicBucketUrl || "", mediaFile.url);
}

function fieldLabel(fieldDef) {
  return fieldDef.label || fieldDef.key;
}

function RequiredLabel({ fieldDef }) {
  return (
    <span>
      {fieldLabel(fieldDef)}
      {fieldDef.required && <span className="text-red-500 ml-0.5">*</span>}
    </span>
  );
}

function FieldError({ error }) {
  if (!error) {
    return null;
  }
  return <div className="text-xs text-red-500 mt-1">{error.message}</div>;
}

function extensionOf(filename) {
  const idx = filename.lastIndexOf(".");
  if (idx === -1) {
    return "";
  }
  return filename.slice(idx + 1).toLowerCase();
}

function categoryFromExtension(ext) {
  const found = Object.keys(ENCLOSURE_CATEGORIES_DICT).find((category) => {
    return ENCLOSURE_CATEGORIES_DICT[category].fileTypes.includes(ext);
  });
  return found || null;
}

function humanFileSize(size) {
  if (!size && size !== 0) {
    return "";
  }
  const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
  return `${(size / Math.pow(1024, i)).toFixed(2) * 1} ${["B", "kB", "MB", "GB", "TB"][i]}`;
}

export default function MediaUploadWidget({ fieldDef, value, onChange, error, publicBucketUrl }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [showExternalUrlInput, setShowExternalUrlInput] = useState(false);
  const [externalUrlDraft, setExternalUrlDraft] = useState("");

  function handleFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      return;
    }

    const ext = extensionOf(file.name);
    const category = categoryFromExtension(ext) || ENCLOSURE_CATEGORIES.DOCUMENT;
    const cdnFilename = `media/${randomHex(32)}${ext ? `.${ext}` : ""}`;

    setUploading(true);
    setProgress(0);
    setUploadError(null);

    Requests.upload(
      file,
      cdnFilename,
      (fraction) => {
        setProgress(fraction);
      },
      (mediaUrl) => {
        setUploading(false);
        onChange({
          category,
          url: mediaUrl,
          mime_type: file.type || "",
          size_in_bytes: file.size,
        });
      },
      () => {
        setUploading(false);
        setUploadError("Failed to upload. Please try again.");
      },
      () => {
        setUploading(false);
        setUploadError("Failed to upload. Please try again.");
      }
    );

    e.target.value = "";
  }

  function handleUseExternalUrl() {
    const url = externalUrlDraft.trim();
    if (!url) {
      return;
    }
    onChange({
      category: ENCLOSURE_CATEGORIES.EXTERNAL_URL,
      url,
    });
    setShowExternalUrlInput(false);
    setExternalUrlDraft("");
  }

  return (
    <div>
      <div className="lh-page-subtitle">
        <RequiredLabel fieldDef={fieldDef} />
      </div>

      {value && value.url && (
        <div className="mt-2 flex items-center gap-3 text-sm">
          <div className="flex flex-col">
            <span className="font-medium">{value.category}</span>
            <a
              className="text-xs text-brand-dark underline break-all"
              href={absoluteMediaUrl(value, publicBucketUrl)}
              target="_blank"
              rel="noreferrer"
            >
              {absoluteMediaUrl(value, publicBucketUrl)}
            </a>
            {value.size_in_bytes ? (
              <span className="text-xs text-gray-400">{humanFileSize(value.size_in_bytes)}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="text-xs text-red-500 underline"
            onClick={() => onChange(undefined)}
          >
            Remove
          </button>
        </div>
      )}

      <div className="mt-2 flex items-center gap-3">
        <input type="file" onChange={handleFileSelected} disabled={uploading} />
        <button
          type="button"
          className="text-xs text-brand-dark underline"
          onClick={() => setShowExternalUrlInput((prev) => !prev)}
        >
          External URL
        </button>
      </div>

      {showExternalUrlInput && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            placeholder="https://..."
            value={externalUrlDraft}
            onChange={(e) => setExternalUrlDraft(e.target.value)}
            className="w-full rounded-md border border-gray-300 text-sm px-3 py-2"
          />
          <button
            type="button"
            className="lh-btn lh-btn-brand-dark text-xs whitespace-nowrap"
            onClick={handleUseExternalUrl}
          >
            Use url
          </button>
        </div>
      )}

      {uploading && (
        <div className="text-xs text-gray-500 mt-1">
          Uploading... {(progress * 100).toFixed(0)}%
        </div>
      )}
      {uploadError && <div className="text-xs text-red-500 mt-1">{uploadError}</div>}

      <FieldError error={error} />
    </div>
  );
}
