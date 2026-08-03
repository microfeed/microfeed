import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useId,
  useRef,
} from "react";

interface AdminFileUploaderProps {
  children: ReactNode;
  classes?: string;
  disabled?: boolean;
  handleChange: (file: File) => void;
  name: string;
  onDisabledClick?: () => void;
  types?: string[];
}

function acceptsFile(file: File, types: string[]): boolean {
  if (types.length === 0) {
    return true;
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  return Boolean(
    extension &&
    types.some((type) => type.replace(/^\./u, "").toLowerCase() === extension),
  );
}

export default function AdminFileUploader({
  children,
  classes = "",
  disabled = false,
  handleChange,
  name,
  onDisabledClick,
  types = [],
}: AdminFileUploaderProps) {
  const generatedId = useId().replaceAll(":", "");
  const inputId = `${name}-${generatedId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const accept = types
    .map((type) => `.${type.replace(/^\./u, "").toLowerCase()}`)
    .join(",");

  const selectFile = (file: File | undefined) => {
    if (!disabled && file && acceptsFile(file, types)) {
      handleChange(file);
    }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.currentTarget.files?.[0]);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    selectFile(event.dataTransfer.files?.[0]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (disabled) {
        onDisabledClick?.();
      } else {
        inputRef.current?.click();
      }
    }
  };

  const onClick = (event: MouseEvent<HTMLLabelElement>) => {
    if (disabled) {
      event.preventDefault();
      onDisabledClick?.();
    }
  };

  return (
    <label
      aria-disabled={disabled}
      className={`${classes}${disabled ? " is-disabled" : ""}`}
      htmlFor={inputId}
      onClick={onClick}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={disabled && !onDisabledClick ? -1 : 0}
    >
      <input
        accept={accept || undefined}
        disabled={disabled}
        id={inputId}
        name={name}
        onChange={onInputChange}
        onClick={(event) => {
          event.currentTarget.value = "";
        }}
        ref={inputRef}
        type="file"
      />
      {children}
    </label>
  );
}
