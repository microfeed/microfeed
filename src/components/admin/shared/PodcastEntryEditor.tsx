import {useId, useRef, useState, type ReactNode} from "react";
import type {z} from "zod";
import {Button} from "@/components/ui/button";
import {DialogClose, DialogFooter} from "@/components/ui/dialog";
import {Field, FieldDescription, FieldError, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {uploadPodcastFile} from "@/client/PodcastUploads";
import AdminDialog from "./AdminDialog";
import AdminSelect from "./AdminSelect";
import AdminLanguageSelect from "./AdminLanguageSelect";

export interface PodcastEntryField {
  key: string;
  label: string;
  type?: "url" | "text" | "language";
  placeholder?: string;
  hint?: string;
  options?: {value: string; label: string}[];
  upload?: "transcript" | "image";
  required?: boolean;
  showWhen?: (draft: Record<string, any>) => boolean;
}

interface Props<T extends Record<string, any>> {
  name: string;
  entries: T[];
  fields: PodcastEntryField[];
  schema: z.ZodType<T>;
  initial: T;
  max: number;
  summary: (entry: T) => ReactNode;
  onChange: (entries: T[]) => void;
  toDraft?: (entry: T) => Record<string, any>;
  fromDraft?: (entry: Record<string, any>) => Record<string, any>;
  validateList?: (entries: T[]) => string | undefined;
  prepareList?: (entries: T[]) => T[];
  publicBucketUrl: string;
  mediaStorageReady: boolean;
  inheritedLanguage?: string;
}

export default function PodcastEntryEditor<T extends Record<string, any>>({
  name, entries, fields, schema, initial, max, summary, onChange, toDraft, fromDraft,
  validateList, prepareList, publicBucketUrl, mediaStorageReady, inheritedLanguage,
}: Props<T>) {
  const id = useId();
  const opener = useRef<HTMLButtonElement | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<{entry: Record<string, any>; index?: number} | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string>();
  const [progress, setProgress] = useState(0);
  const open = (entry: T, index: number | undefined, button: HTMLButtonElement) => {
    opener.current = button;
    setErrors({});
    setDraft({entry: {...(toDraft ? toDraft(entry) : entry)}, index});
  };
  const update = (key: string, value: string) => {
    setDraft((previous) => previous && {...previous, entry: {...previous.entry, [key]: value}});
    setErrors({});
  };
  const save = () => {
    if (!draft || uploading) return;
    const missing = fields.find((field) => field.required && (!field.showWhen || field.showWhen(draft.entry)) &&
      !String(draft.entry[field.key] ?? "").trim());
    if (missing) {
      setErrors({[missing.key]: `${missing.label} is required.`});
      form.current?.querySelector<HTMLElement>(`[id="${id}-${missing.key}"]`)?.focus();
      return;
    }
    const candidate = Object.fromEntries(Object.entries(draft.entry).filter(([, value]) => value !== "" && value != null));
    const parsed = schema.safeParse(fromDraft ? fromDraft(candidate) : candidate);
    if (!parsed.success) {
      const nextErrors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]));
      setErrors(nextErrors);
      const field = fields.find((field) => nextErrors[field.key]);
      if (field) form.current?.querySelector<HTMLElement>(`[id="${id}-${field.key}"]`)?.focus();
      return;
    }
    let next = draft.index === undefined ? [...entries, parsed.data]
      : entries.map((entry, index) => index === draft.index ? parsed.data : entry);
    if (prepareList) next = prepareList(next);
    const error = next.length > max ? `You can add up to ${max} entries.` : validateList?.(next);
    if (error) { setErrors({form: error}); return; }
    onChange(next);
    setDraft(null);
  };
  return <div className="space-y-3">
    {entries.map((entry, index) => <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1 basis-64 break-words text-sm">{summary(entry)}</div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" aria-label={`Edit ${name} ${index + 1}`}
          onClick={(event) => open(entry, index, event.currentTarget)}>Edit</Button>
        <Button type="button" variant="outline" aria-label={`Remove ${name} ${index + 1}`}
          onClick={() => onChange(entries.filter((_, n) => n !== index))}>Remove</Button>
      </div>
    </div>)}
    <Button type="button" variant="outline" disabled={entries.length >= max}
      onClick={(event) => open(initial, undefined, event.currentTarget)}>Add {name}</Button>
    <AdminDialog open={draft !== null} finalFocus={opener} closeDisabled={Boolean(uploading)}
      onOpenChange={(isOpen) => { if (!isOpen && !uploading) setDraft(null); }}
      title={`${draft?.index === undefined ? "Add" : "Edit"} ${name}`}>
      {draft && <form ref={form} noValidate className="space-y-4" onSubmit={(event) => {
        event.preventDefault(); event.stopPropagation(); save();
      }} onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }}>
        <p className="text-sm text-muted-foreground">Changes apply when you save this {name}.</p>
        {fields.filter((field) => !field.showWhen || field.showWhen(draft.entry)).map((field) => <Field key={field.key} data-invalid={Boolean(errors[field.key])}>
          <FieldLabel htmlFor={`${id}-${field.key}`}>{field.label}{field.required ? " *" : ""}</FieldLabel>
          {field.options ? <AdminSelect compact id={`${id}-${field.key}`} ariaLabel={field.label}
            disabled={Boolean(uploading)} options={field.options}
            value={field.options.find(({value}) => value === draft.entry[field.key]) ??
              (draft.entry[field.key] ? {value: draft.entry[field.key], label: draft.entry[field.key]} : undefined)}
            onChange={(option) => update(field.key, option.value)} />
            : field.type === "language" ? <AdminLanguageSelect id={`${id}-${field.key}`} ariaLabel={field.label} value={draft.entry[field.key]}
              inheritedLanguage={inheritedLanguage} onChange={(value) => update(field.key, value)} />
              : <Input id={`${id}-${field.key}`} name={field.key} type={field.type || "text"}
                autoFocus={fields[0] === field} required={field.required} disabled={Boolean(uploading)}
                placeholder={field.placeholder} value={draft.entry[field.key] ?? ""}
                aria-invalid={Boolean(errors[field.key])} aria-describedby={`${id}-${field.key}-description ${id}-${field.key}-error`}
                onChange={(event) => update(field.key, event.target.value)} />}
          {field.hint && <FieldDescription id={`${id}-${field.key}-description`}>{field.hint}</FieldDescription>}
          {field.upload && <div className="space-y-2">
            <Input type="file" aria-label={`Upload ${field.label}`} disabled={Boolean(uploading) || !mediaStorageReady}
              className="cursor-pointer file:cursor-pointer" accept={field.upload === "transcript" ? ".vtt,.srt" : ".jpg,.jpeg,.png"}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file || uploading) return;
                setErrors({}); setProgress(0); setUploading(field.key);
                try {
                  const uploaded = await uploadPodcastFile(file, field.upload!, publicBucketUrl, setProgress);
                  setDraft((previous) => previous && {...previous, entry: {...previous.entry,
                    [field.key]: uploaded.url, ...(field.upload === "transcript" ? {type: uploaded.type} : {}),
                  }});
                } catch (cause) { setErrors({[field.key]: cause instanceof Error ? cause.message : "Upload failed."}); }
                finally { setUploading(undefined); }
              }} />
            <p className="text-xs text-muted-foreground">{mediaStorageReady
              ? `Or upload ${field.upload === "transcript" ? "VTT/SRT (up to 10 MB)" : "JPEG/PNG (up to 8 MB)"}. Uploaded files remain in media storage if you cancel.`
              : "Media storage is unavailable. You can still use an existing HTTPS URL."}</p>
          </div>}
          <FieldError id={`${id}-${field.key}-error`}>{errors[field.key]}</FieldError>
        </Field>)}
        {uploading && <p role="status" className="text-sm">Uploading… {Math.round(progress * 100)}%</p>}
        <FieldError>{errors.form}</FieldError>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={Boolean(uploading)} />}>Cancel</DialogClose>
          <Button type="submit" disabled={Boolean(uploading)}>Save {name}</Button>
        </DialogFooter>
      </form>}
    </AdminDialog>
  </div>;
}
