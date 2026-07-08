import React from "react";
import AdminImageUploaderApp from "../../../components/AdminImageUploaderApp";

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

export default function ImageUploadWidget({ fieldDef, value, onChange, error, publicBucketUrl }) {
  const feed = {
    settings: {
      webGlobalSettings: {
        publicBucketUrl: publicBucketUrl || "",
      },
    },
  };

  return (
    <div>
      <div className="lh-page-subtitle">
        <RequiredLabel fieldDef={fieldDef} />
      </div>

      <AdminImageUploaderApp
        feed={feed}
        mediaType={fieldDef.key || "image"}
        currentImageUrl={value}
        imageSizeNotOkayFunc={() => false}
        onImageUploaded={(cdnUrl) => onChange(cdnUrl)}
      />

      {value && (
        <div className="mt-2">
          <button
            type="button"
            className="text-xs text-red-500 underline"
            onClick={() => onChange(undefined)}
          >
            Remove
          </button>
        </div>
      )}

      <FieldError error={error} />
    </div>
  );
}
