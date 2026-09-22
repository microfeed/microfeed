import {useEffect, useId, useRef} from "react";
import {Button} from "@/components/ui/button";
import {Separator} from "@/components/ui/separator";
import {
  PODCAST_LIMITS, PODCAST_LICENSES, PODCAST_ROLES, formatChapterTime, parseChapterTime,
  podcastChapterSchema, podcastChaptersSchema, podcastFundingSchema, podcastLicenseSchema,
  podcastPersonSchema, podcastTranscriptSchema, podcastChaptersPath, channelPodcastSchema, itemPodcastSchema,
  type Podcast,
} from "@/shared/Podcast";
import AdminHelpLabel from "./AdminHelpLabel";
import AdminSelect from "./AdminSelect";
import PodcastEntryEditor from "./PodcastEntryEditor";
import PodcastChapterImport from "./PodcastChapterImport";
import {getPodcastHelpContent} from "./PodcastHelpContent";

interface Props {
  value?: Podcast | null;
  channel?: Podcast | null;
  itemId?: string;
  language?: string;
  publicBucketUrl: string;
  mediaStorageReady: boolean;
  error?: string;
  onChange: (podcast: Podcast) => void;
}

const lockOptions = [
  {value: "", label: "Unspecified"}, {value: "yes", label: "Locked — reject imports"}, {value: "no", label: "Unlocked — allow imports"},
];

export default function PodcastEditor({value, channel, itemId, language, publicBucketUrl, mediaStorageReady, error, onChange}: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const isItem = Boolean(itemId);
  const help = getPodcastHelpContent(isItem);
  const podcast = value ?? {};
  useEffect(() => { if (error) { const details = root.current?.closest("details"); if (details) details.open = true; } }, [error]);
  const update = (key: keyof Podcast, next: unknown) => onChange({...podcast, [key]: next});
  const validateList = (key: keyof Podcast) => (entries: unknown[]) => {
    const result = (isItem ? itemPodcastSchema : channelPodcastSchema).safeParse({...podcast, [key]: entries});
    return result.success ? undefined : result.error.issues[0]?.message;
  };
  const assets = {publicBucketUrl, mediaStorageReady};
  const heading = (key: keyof typeof help, description: string) => <div className="space-y-1">
    <h3 id={`${id}-${key}`}><AdminHelpLabel className="mb-0 text-base font-semibold" help={help[key]} /></h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>;
  return <div ref={root} className="mt-7 space-y-6">
    <Separator />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {isItem && <>
      <section aria-labelledby={`${id}-transcripts`} className="space-y-3">
        {heading("transcripts", "Provide a transcript in VTT or SRT format. Upload a file or use an existing URL.")}
        <PodcastEntryEditor {...assets} name="transcript" entries={podcast.transcripts ?? []}
          initial={{url: "", type: "text/vtt"}} schema={podcastTranscriptSchema}
          max={PODCAST_LIMITS.transcripts} inheritedLanguage={language} validateList={validateList("transcripts")}
          summary={(entry) => <><p className="font-medium">{entry.type === "text/vtt" ? "VTT" : "SRT"}{entry.language ? ` · ${entry.language}` : ""}</p><p className="break-all text-muted-foreground">{entry.url}</p></>}
          onChange={(entries) => update("transcripts", entries)} fields={[
            {key: "url", label: "Transcript URL", type: "url", upload: "transcript", required: true, placeholder: "https://example.com/episode.vtt"},
            {key: "type", label: "Transcript format", required: true, options: [{value: "text/vtt", label: "WebVTT (.vtt)"}, {value: "application/x-subrip", label: "SubRip (.srt)"}]},
            {key: "language", label: "Transcript language", type: "language"},
          ]} />
      </section>
      <Separator />
      <section aria-labelledby={`${id}-chapters`} className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {heading("chapters", "Add chapters individually or upload a JSON file. Chapters are saved in time order.")}
          <PodcastChapterImport existingCount={podcast.chapters?.length ?? 0} validate={validateList("chapters")}
            onImport={(chapters) => update("chapters", chapters)} />
        </div>
        <PodcastEntryEditor {...assets} name="chapter" entries={podcast.chapters ?? []} initial={{startTime: 0, title: ""}}
          schema={podcastChapterSchema} max={PODCAST_LIMITS.chapters}
          toDraft={(entry) => ({...entry, startTime: formatChapterTime(entry.startTime)})}
          fromDraft={(entry) => ({...entry, startTime: parseChapterTime(String(entry.startTime ?? ""))})}
          prepareList={(entries) => [...entries].sort((a, b) => a.startTime - b.startTime)}
          validateList={(entries) => {
            const result = podcastChaptersSchema.safeParse(entries);
            return result.success ? validateList("chapters")(entries) : result.error.issues[0]?.message;
          }} onChange={(entries) => update("chapters", entries)}
          summary={(entry) => <><p className="font-medium">{formatChapterTime(entry.startTime)} · {entry.title}</p>{entry.url && <p className="break-all text-muted-foreground">{entry.url}</p>}</>}
          fields={[
            {key: "startTime", label: "Start time", required: true, placeholder: "00:00:00", hint: "Use HH:MM:SS, MM:SS, or seconds. Fractional seconds are supported."},
            {key: "title", label: "Chapter title", required: true},
            {key: "img", label: "Chapter image URL", type: "url", upload: "image"},
            {key: "url", label: "Chapter link", type: "url"},
          ]} />
        {Boolean(podcast.chapters?.length) && <p className="break-all text-xs text-muted-foreground">
          Chapter file after saving and publishing: {podcastChaptersPath(itemId!)}
        </p>}
      </section>
      <Separator />
    </>}
    <section aria-labelledby={`${id}-people`} className="space-y-3">
      {heading("people", isItem ? "This list replaces channel participants. Include the hosts as well as guests; clear it to inherit."
        : "Credit the regular hosts and contributors. Episodes can specify their own participants.")}
      {isItem && !podcast.people?.length && Boolean(channel?.people?.length) && <div className="space-y-2">
        <p className="break-words text-sm text-muted-foreground">Inherited: {channel!.people!.map((person) => person.name).join(", ")}</p>
        <Button type="button" variant="outline" onClick={() => update("people", channel!.people!.map((person) => ({...person})))}>Customize channel participants</Button>
      </div>}
      <PodcastEntryEditor {...assets} name="person" entries={podcast.people ?? []} initial={{name: "", role: "host"}}
        schema={podcastPersonSchema} max={PODCAST_LIMITS.people} validateList={validateList("people")}
        fromDraft={(entry) => ({...entry, group: PODCAST_ROLES.find(({value}) => value === entry.role)?.group ?? entry.group})}
        summary={(entry) => <><p className="font-medium">{entry.name}</p><p className="text-muted-foreground">{PODCAST_ROLES.find(({value}) => value === entry.role)?.label || entry.role || "Host"}</p>{entry.href && <p className="break-all text-muted-foreground">{entry.href}</p>}</>}
        onChange={(entries) => update("people", entries)} fields={[
          {key: "name", label: "Name", required: true},
          {key: "role", label: "Role", options: [...PODCAST_ROLES]},
          {key: "href", label: "Profile URL", type: "url"},
          {key: "img", label: "Photo URL", type: "url", upload: "image"},
        ]} />
    </section>
    {!isItem && <>
      <Separator />
      <section aria-labelledby={`${id}-funding`} className="space-y-3">
        {heading("funding", "Add donation or membership links for listeners.")}
        <PodcastEntryEditor {...assets} name="support link" entries={podcast.funding ?? []} initial={{label: "", url: ""}}
          schema={podcastFundingSchema} max={PODCAST_LIMITS.funding} validateList={validateList("funding")}
          summary={(entry) => <><p className="font-medium">{entry.label}</p><p className="break-all text-muted-foreground">{entry.url}</p></>}
          onChange={(entries) => update("funding", entries)} fields={[
            {key: "label", label: "Link label", required: true, placeholder: "Support the show"},
            {key: "url", label: "Support URL", type: "url", required: true},
          ]} />
      </section>
    </>}
    <Separator />
    <section aria-labelledby={`${id}-license`} className="space-y-3">
      {heading("license", isItem ? `Default: ${channel?.license?.identifier || "No channel license set"}. Add an episode license to override it.`
        : "Declare the license for your audio or video content.")}
      <PodcastEntryEditor {...assets} name="license" entries={podcast.license ? [podcast.license] : []}
        initial={{identifier: "arr"}} schema={podcastLicenseSchema} max={1}
        toDraft={(entry) => PODCAST_LICENSES.some(({value}) => value === entry.identifier.toLowerCase())
          ? {...entry, identifier: entry.identifier.toLowerCase()} : {...entry, customIdentifier: entry.identifier, identifier: "custom"}}
        fromDraft={({customIdentifier, ...entry}) => ({...entry, identifier: entry.identifier === "custom" ? customIdentifier : entry.identifier})}
        summary={(entry) => <><p className="font-medium">{PODCAST_LICENSES.find(({value}) => value === entry.identifier.toLowerCase())?.label || entry.identifier}</p>{entry.url && <p className="break-all text-muted-foreground">{entry.url}</p>}</>}
        onChange={(entries) => update("license", entries[0] ?? null)} fields={[
          {key: "identifier", label: "License", required: true, options: [...PODCAST_LICENSES, {value: "custom", label: "Custom license"}]},
          {key: "customIdentifier", label: "Custom license identifier", required: true, showWhen: (entry) => entry.identifier === "custom"},
          {key: "url", label: "License URL", type: "url", hint: "Required for a custom license. Link to the full license terms."},
        ]} />
    </section>
    {!isItem && <>
      <Separator />
      <section aria-labelledby={`${id}-locked`} className="space-y-3">
        {heading("locked", "An advisory signal to hosting platforms. This does not restrict listener access.")}
        <div className="max-w-sm"><AdminSelect compact ariaLabel="Feed import lock" options={lockOptions}
          value={lockOptions.find(({value}) => value === (podcast.locked == null ? "" : podcast.locked ? "yes" : "no"))}
          onChange={({value}) => update("locked", value ? value === "yes" : null)} /></div>
      </section>
    </>}
  </div>;
}
