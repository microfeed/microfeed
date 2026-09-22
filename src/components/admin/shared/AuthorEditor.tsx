import {useId, useRef, useState} from "react";
import {Button} from "@/components/ui/button";
import {DialogClose, DialogFooter} from "@/components/ui/dialog";
import {Field, FieldError, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {identitySchema, type Identity} from "@/shared/Seo";
import AdminDialog from "./AdminDialog";
import AdminSelect from "./AdminSelect";

const TYPES = [
  {value: "", label: "Unspecified"},
  {value: "Person", label: "Person"},
  {value: "Organization", label: "Organization"},
];

interface Props {
  authors: Identity[];
  onChange: (authors: Identity[]) => void;
}

interface Draft {
  author: Identity;
  index?: number;
}

type Errors = Partial<Record<keyof Identity, string>>;

export default function AuthorEditor({authors, onChange}: Props) {
  const id = useId();
  const opener = useRef<HTMLButtonElement | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const profileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const open = (author: Identity, index: number | undefined, button: HTMLButtonElement) => {
    opener.current = button;
    setErrors({});
    setFormError("");
    setDraft({author: {...author}, index});
  };
  const update = (patch: Partial<Identity>) => {
    setDraft((current) => current ? {...current, author: {...current.author, ...patch}} : current);
    setErrors({});
  };
  const save = () => {
    if (!draft) return;
    const result = identitySchema.safeParse({...draft.author, url: draft.author.url?.trim() || undefined});
    if (!result.success) {
      const nextErrors: Errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof Identity;
        nextErrors[key] = key === "name" ? "Enter an author name between 1 and 300 characters."
          : key === "url" ? "Enter an absolute HTTP or HTTPS profile URL, or leave it blank."
          : "Choose a person, organization, or unspecified type.";
      }
      setErrors(nextErrors);
      (nextErrors.name ? nameInput : profileInput).current?.focus();
      return;
    }
    if (draft.index === undefined && authors.length >= 50) {
      setFormError("You can add up to 50 authors.");
      return;
    }
    const next = draft.index === undefined ? [...authors, result.data]
      : authors.map((author, index) => index === draft.index ? result.data : author);
    setDraft(null);
    onChange(next);
  };

  return <>
    {authors.map((author, index) => <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1 basis-64">
        <p className="break-words font-medium">{author.name || "Unnamed author"}</p>
        {author.type && <p className="text-sm text-muted-foreground">{author.type}</p>}
        {author.url && <p className="break-all text-sm text-muted-foreground">{author.url}</p>}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" aria-label={`Edit author ${index + 1}: ${author.name}`}
          onClick={(event) => open(author, index, event.currentTarget)}>Edit</Button>
        <Button type="button" variant="outline" aria-label={`Remove author ${index + 1}: ${author.name}`}
          onClick={() => onChange(authors.filter((_, n) => n !== index))}>Remove</Button>
      </div>
    </div>)}
    <Button type="button" variant="outline" disabled={authors.length >= 50}
      onClick={(event) => open({name: ""}, undefined, event.currentTarget)}>Add author</Button>
    <AdminDialog finalFocus={opener} open={draft !== null} title={draft?.index === undefined ? "Add author" : "Edit author"}
      onOpenChange={(isOpen) => { if (!isOpen) setDraft(null); }}>
      {draft && <form noValidate className="space-y-5" onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        save();
      }} onKeyDown={(event) => {
        if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
      }}>
        <p className="text-sm text-muted-foreground">Changes are applied only when you save this author.</p>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor={`${id}-name`}>Author name</FieldLabel>
          <Input id={`${id}-name`} ref={nameInput} autoFocus required maxLength={300}
            value={draft.author.name} aria-invalid={Boolean(errors.name)} aria-describedby={`${id}-name-error`}
            onChange={(event) => update({name: event.target.value})} />
          <FieldError id={`${id}-name-error`}>{errors.name}</FieldError>
        </Field>
        <AdminSelect label="Author type" ariaLabel="Author type" options={TYPES}
          value={TYPES.find((type) => type.value === (draft.author.type || ""))}
          onChange={(option) => update({type: option.value as Identity["type"] || undefined})} />
        {errors.type && <FieldError>{errors.type}</FieldError>}
        <Field data-invalid={Boolean(errors.url)}>
          <FieldLabel htmlFor={`${id}-url`}>Author profile URL</FieldLabel>
          <Input id={`${id}-url`} ref={profileInput} type="url" placeholder="https://example.com/about/"
            value={draft.author.url ?? ""} aria-invalid={Boolean(errors.url)} aria-describedby={`${id}-url-error`}
            onChange={(event) => update({url: event.target.value})} />
          <FieldError id={`${id}-url-error`}>{errors.url}</FieldError>
        </Field>
        {formError && <FieldError>{formError}</FieldError>}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="submit">Save author</Button>
        </DialogFooter>
      </form>}
    </AdminDialog>
  </>;
}
