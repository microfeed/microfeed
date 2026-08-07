import AdminDialog from "@/components/admin/shared/AdminDialog";
import {Button} from "@/components/ui/button";
import {DialogClose, DialogFooter} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import type {
  RichEditorMediaSettings,
  RichEditorMediaType,
} from "@/client/RichEditorMedia";

interface Props {
  errors: Partial<Record<"height" | "width", string>>;
  mediaType: RichEditorMediaType;
  onChange: (settings: RichEditorMediaSettings) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  open: boolean;
  settings: RichEditorMediaSettings;
}

export default function RichEditorMediaSettingsDialog({
  errors,
  mediaType,
  onChange,
  onOpenChange,
  onSave,
  open,
  settings,
}: Props) {
  const update = (
    field: keyof RichEditorMediaSettings,
    value: string,
  ) => onChange({...settings, [field]: value});

  return (
    <AdminDialog
      onOpenChange={onOpenChange}
      open={open}
      title={`Edit ${mediaType}`}
    >
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Control how this {mediaType} is displayed. Leave a value blank to use
          its natural size.
        </p>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(errors.width)}>
              <FieldLabel htmlFor="rich-editor-media-width">Width</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.width)}
                id="rich-editor-media-width"
                onChange={(event) => update("width", event.target.value)}
                placeholder="e.g., 100% or 640px"
                value={settings.width}
              />
              <FieldDescription>
                CSS sizes such as 100%, 640px, or auto.
              </FieldDescription>
              <FieldError>{errors.width}</FieldError>
            </Field>
            <Field data-invalid={Boolean(errors.height)}>
              <FieldLabel htmlFor="rich-editor-media-height">Height</FieldLabel>
              <Input
                aria-invalid={Boolean(errors.height)}
                id="rich-editor-media-height"
                onChange={(event) => update("height", event.target.value)}
                placeholder="e.g., auto or 360px"
                value={settings.height}
              />
              <FieldDescription>
                {mediaType === "video"
                  ? "Auto preserves an uploaded video's natural aspect ratio. Legacy embeds use a responsive 16:9 frame."
                  : "Use auto to preserve the image's aspect ratio."}
              </FieldDescription>
              <FieldError>{errors.height}</FieldError>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {mediaType === "image" && (
              <Field>
                <FieldLabel htmlFor="rich-editor-media-alt">Alt text</FieldLabel>
                <Input
                  id="rich-editor-media-alt"
                  onChange={(event) => update("alt", event.target.value)}
                  placeholder="Describe the image"
                  value={settings.alt}
                />
                <FieldDescription>
                  Helps people who use screen readers.
                </FieldDescription>
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="rich-editor-media-title">Title</FieldLabel>
              <Input
                id="rich-editor-media-title"
                onChange={(event) => update("title", event.target.value)}
                placeholder="Optional title"
                value={settings.title}
              />
              {mediaType === "video" && (
                <FieldDescription>
                  Describes the embedded video for screen readers.
                </FieldDescription>
              )}
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="rich-editor-media-style">
              Additional inline style
            </FieldLabel>
            <Textarea
              id="rich-editor-media-style"
              onChange={(event) => update("style", event.target.value)}
              placeholder={mediaType === "video"
                ? "e.g., aspect-ratio: 9 / 16; border-radius: 12px;"
                : "e.g., border-radius: 12px; object-fit: cover;"}
              rows={3}
              value={settings.style}
            />
            <FieldDescription>
              Optional CSS declarations. Set width and height in the fields
              above so the visual editor can keep its resize controls in sync.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={onSave} type="button">Apply</Button>
        </DialogFooter>
      </div>
    </AdminDialog>
  );
}
