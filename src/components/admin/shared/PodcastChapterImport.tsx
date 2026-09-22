import {useEffect, useId, useRef, useState} from "react";
import {Button} from "@/components/ui/button";
import {DialogClose, DialogFooter} from "@/components/ui/dialog";
import {Field, FieldDescription, FieldError, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {readPodcastChapterFile, type ChapterImport} from "@/client/PodcastChapterImport";
import {formatChapterTime, PODCAST_LIMITS, type PodcastChapter} from "@/shared/Podcast";
import AdminDialog from "./AdminDialog";

interface Props {
  existingCount: number;
  onImport: (chapters: PodcastChapter[]) => void;
  validate: (chapters: PodcastChapter[]) => string | undefined;
}

export default function PodcastChapterImport({existingCount, onImport, validate}: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const readId = useRef(0);
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<ChapterImport | null>(null);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string>();
  useEffect(() => () => { readId.current++; }, []);
  const setDialogOpen = (next: boolean) => {
    readId.current++;
    setReading(false); setPreview(null); setFilename(""); setError(undefined); setOpen(next);
  };
  return <>
    <Button ref={trigger} type="button" variant="outline" onClick={() => setDialogOpen(true)}>Upload chapter JSON</Button>
    <AdminDialog open={open} onOpenChange={setDialogOpen} finalFocus={trigger} title="Upload chapter JSON">
      <form className="min-w-0 space-y-4" noValidate onSubmit={(event) => {
        event.preventDefault(); event.stopPropagation();
        if (reading || !preview) return;
        const message = validate(preview.chapters);
        if (message) { setError(message); return; }
        onImport(preview.chapters);
        setDialogOpen(false);
      }} onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }}>
        <p className="text-sm text-muted-foreground">Import start times, titles, images, and links together. You can edit each chapter afterward.</p>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor={`${id}-file`}>Chapter JSON file</FieldLabel>
          <Input ref={fileInput} id={`${id}-file`} type="file" accept=".json,application/json,application/json+chapters"
            aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const currentRead = ++readId.current;
              setPreview(null); setFilename(file.name); setError(undefined); setReading(true);
              try {
                const imported = await readPodcastChapterFile(file);
                if (currentRead !== readId.current) return;
                const message = validate(imported.chapters);
                if (message) throw new Error(message);
                setPreview(imported);
              } catch (cause) {
                if (currentRead !== readId.current) return;
                setError(cause instanceof Error ? cause.message : "Could not import this file.");
                fileInput.current?.focus();
              } finally { if (currentRead === readId.current) setReading(false); }
            }} />
          <FieldDescription id={`${id}-help`}>Up to {PODCAST_LIMITS.chapters} chapters and 1 MB. Use a chapters array, or an object with version “1.2.0” and chapters. Each entry needs a numeric startTime in seconds and a title; img and url are optional HTTPS links.</FieldDescription>
          <FieldError id={`${id}-error`}>{error}</FieldError>
        </Field>
        {reading && <p role="status" className="text-sm">Reading chapter file…</p>}
        {preview && <div className="min-w-0 space-y-3">
          <p role="status" className="break-words text-sm font-medium">{preview.chapters.length} chapters ready from {filename}</p>
          <ol aria-label="Chapter import preview" tabIndex={0}
            className="max-h-52 space-y-2 overflow-y-auto rounded-lg border p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {preview.chapters.map((chapter) => <li key={chapter.startTime} className="flex items-start gap-3">
              <span className="shrink-0 tabular-nums text-muted-foreground">{formatChapterTime(chapter.startTime)}</span>
              <span className="min-w-0 break-words">{chapter.title}</span>
            </li>)}
          </ol>
          {preview.omittedMetadata && <p className="text-sm text-muted-foreground">Only chapter entries are imported. Episode-level metadata in this file is not included.</p>}
          <p className="text-sm">{existingCount
            ? `This replaces all ${existingCount} existing ${existingCount === 1 ? "chapter" : "chapters"}.`
            : "This adds the chapters to this item."} The item will autosave after import.</p>
        </div>}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="submit" disabled={reading || !preview || Boolean(error)}>{existingCount ? "Replace chapters" : "Import chapters"}</Button>
        </DialogFooter>
      </form>
    </AdminDialog>
  </>;
}
