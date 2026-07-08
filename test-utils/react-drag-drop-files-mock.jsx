import React from "react";

export function FileUploader({
  handleChange,
  name,
  types,
  disabled,
  classes,
  children,
  multiple,
  required,
}) {
  return (
    <label className={classes}>
      <input
        aria-label={name}
        disabled={disabled}
        name={name}
        multiple={multiple}
        onChange={(event) => {
          const files = event.target.files;
          if (!files || files.length === 0 || typeof handleChange !== "function") {
            return;
          }
          handleChange(multiple ? files : files[0]);
        }}
        required={required}
        type="file"
        accept={types ? types.map((type) => `.${String(type).toLowerCase()}`).join(",") : undefined}
      />
      {children}
    </label>
  );
}

export default {FileUploader};
