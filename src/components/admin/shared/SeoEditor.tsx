import React, {useEffect, useId, useRef, useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import AdminSelect from "./AdminSelect";
import AdminImageUploaderApp from "./AdminImageUploaderApp";
import {htmlToPlainText, urlJoinWithRelative} from "@/shared/StringUtils";
import {automaticItemSlug, itemUrl, normalizeItemSlug} from "@/shared/ItemUrls";
import {showToast} from "@/client/ToastUtils";
import type {Identity} from "@/shared/Seo";

interface Props {
  value: Record<string, any>;
  channel?: Record<string, any>;
  itemId?: string;
  feed: any;
  publicBucketUrl: string;
  mediaStorage: any;
  error?: string;
  onChange: (patch: Record<string, any>, replacedImage?: string) => void;
  onApplySlug?: (slug: string) => Promise<boolean>;
}

const TYPES = [
  {value: "", label: "Unspecified"},
  {value: "Person", label: "Person"},
  {value: "Organization", label: "Organization"},
];

export default function SeoEditor({value, channel, itemId, feed, publicBucketUrl, mediaStorage, error, onChange, onApplySlug}: Props) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const [slug, setSlug] = useState<string | undefined>();
  const [profiles, setProfiles] = useState<string | undefined>();
  const [applying, setApplying] = useState(false);
  const [slugError, setSlugError] = useState("");
  const seo = value.seo ?? {};
  const isItem = Boolean(itemId);
  useEffect(() => { if (error && details.current) details.current.open = true; }, [error]);
  const setSeo = (key: string, next: any) => onChange({seo: {...seo, [key]: next || null}});
  const currentSlug = value.publicPath?.slice(3, -1) ?? automaticItemSlug(value.title || "");
  const savedUrl = isItem ? itemUrl({...value, id: itemId,
    publicPath: value.publicPath || `/i/${currentSlug}/`}, window.location.origin) : `${window.location.origin}/`;
  const title = seo.title || value.title || "Untitled";
  const description = seo.description || htmlToPlainText(value.description || "");
  const image = seo.social_image?.url || value.image || channel?.seo?.social_image?.url || channel?.image;
  const imageUrl = image ? urlJoinWithRelative(publicBucketUrl, image, window.location.origin) : undefined;
  const authors: Identity[] = value.authorIdentities ?? [];
  const inheritedAuthors: Identity[] = channel?.authorIdentities ?? [];
  const field = (label: string, key: string, input: React.ReactNode, hint?: React.ReactNode) => (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={`${id}-${key}`}>{label}</label>
      {input}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
  return <details ref={details} className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs"
    onInvalidCapture={() => { if (details.current) details.current.open = true; }}>
    <summary className="m-page-summary">SEO / GEO</summary>
    <div className="mt-6 grid gap-6">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-sm text-muted-foreground">Customize search and social previews and help search engines understand your content. Clear an override to restore its fallback.</p>
      {field("SEO title", "title", <Input id={`${id}-title`} value={seo.title ?? ""}
        placeholder={value.title || "Untitled"} onChange={(event) => setSeo("title", event.target.value)} />,
      `${Array.from(seo.title || value.title || "").length} characters. Around 60 is a useful guide; display length varies.`)}
      {field("SEO description", "description", <Textarea id={`${id}-description`} value={seo.description ?? ""}
        placeholder={htmlToPlainText(value.description || "")} onChange={(event) => setSeo("description", event.target.value)} />,
      `${Array.from(seo.description || htmlToPlainText(value.description || "")).length} characters. Around 160 is a useful guide, not a limit.`)}
      {isItem && <div className="space-y-3">
        {field("Item URL", "slug", <div className="flex flex-wrap gap-2">
          <span className="self-center text-muted-foreground">/i/</span>
          <Input id={`${id}-slug`} className="min-w-0 flex-1" value={slug ?? currentSlug}
            onChange={(event) => { setSlug(event.target.value); setSlugError(""); }}
            onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
          <Button type="button" variant="outline" disabled={applying || slug === undefined || !onApplySlug}
            onClick={async () => {
              try {
                const normalized = normalizeItemSlug(slug ?? currentSlug);
                setApplying(true);
                if (await onApplySlug?.(normalized)) { setSlug(undefined); setSlugError(""); }
              } catch (cause) { setSlugError(cause instanceof Error ? cause.message : String(cause)); }
              finally { setApplying(false); }
            }}>{applying ? "Applying…" : "Apply URL"}</Button>
        </div>, "Apply URL saves this address. Previous public links redirect automatically. Title edits keep published URLs unchanged.")}
        {slugError && <p role="alert" className="text-sm text-destructive">{slugError}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-all text-sm text-muted-foreground">{savedUrl}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => {
            void navigator.clipboard.writeText(savedUrl).then(() => showToast("Link copied.", "success"), () => showToast("Could not copy. Select the URL to copy it.", "error"));
          }}>Copy link</Button>
        </div>
        {field("Original-source canonical URL", "canonical", <Input id={`${id}-canonical`} type="url"
          value={seo.canonical_url ?? ""} placeholder={savedUrl} onChange={(event) => setSeo("canonical_url", event.target.value)} />,
        "Optional: identify the original article when republishing. The local item stays accessible; a different canonical URL removes it from the generated sitemap.")}
        {field("Item language", "language", <Input id={`${id}-language`} value={value.language ?? ""}
          placeholder={channel?.language || "en"} onChange={(event) => onChange({language: event.target.value || null})} />,
        `Inherited language: ${channel?.language || "en"}. Use a language code such as zh-Hans or ja.`)}
      </div>}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Social image</h3>
        <p className="text-sm text-muted-foreground">Crop to 1200 × 630. Only the crop is uploaded. Removing it restores the cover or inherited social image.</p>
        <AdminImageUploaderApp socialImage deferredRemoval mediaType={isItem ? "item-social" : "channel-social"}
          feed={feed} mediaStorage={mediaStorage} mediaStorageReady={mediaStorage?.ready !== false}
          publicBucketUrl={publicBucketUrl} currentImageUrl={seo.social_image?.url}
          imageSizeNotOkayFunc={(width: number, height: number) => width < 1200 || height < 630}
          imageSizeNotOkayMsgFunc={() => "This crop will be enlarged to 1200 × 630 and may look soft. A larger source will be sharper."}
          onImageUploaded={(url: string, mime_type: string, previous: string) => onChange({seo: {...seo,
            social_image: {url, mime_type, width: 1200, height: 630, alt: seo.social_image?.alt ?? ""},
          }}, previous)}
          onImageDeleted={() => onChange({seo: {...seo, social_image: null}}, seo.social_image?.url)} />
        {seo.social_image && field("Social image alt text", "alt", <Input id={`${id}-alt`} value={seo.social_image.alt ?? ""}
          onChange={(event) => setSeo("social_image", {...seo.social_image, alt: event.target.value})} />)}
      </div>
      {!isItem && <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Publisher identity</h3>
          <p className="text-sm text-muted-foreground">Publisher name: {value.publisher || "Set Publisher above"}</p>
          <AdminSelect ariaLabel="Publisher type" value={TYPES.find((type) => type.value === (value.publisherIdentity?.type || ""))}
            options={TYPES} onChange={(option: any) => onChange({publisherIdentity: {...value.publisherIdentity, type: option.value || undefined}})} />
        </div>
        {field("Publisher profile URL", "publisher-url", <Input id={`${id}-publisher-url`} type="url" value={value.publisherIdentity?.url ?? ""}
          onChange={(event) => onChange({publisherIdentity: {...value.publisherIdentity, url: event.target.value || null}})} />)}
        {field("Official profile links", "profiles", <Textarea id={`${id}-profiles`} value={profiles ?? (value.publisherIdentity?.same_as ?? []).join("\n")}
          onChange={(event) => { setProfiles(event.target.value); onChange({publisherIdentity: {...value.publisherIdentity, same_as: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean)}}); }} />, "One official profile URL per line.")}
      </div>}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{isItem ? "Item authors" : "Default authors"}</h3>
        <p className="text-sm text-muted-foreground">{isItem
          ? `Replaces default authors when configured. Inherited: ${inheritedAuthors.map((author) => author.name).join(", ") || "none"}.`
          : "Optional attribution for items. This does not change the podcast publisher."}</p>
        {authors.map((author, index) => <div key={index} className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
          {field("Author name", `author-${index}`, <Input id={`${id}-author-${index}`} value={author.name} required
            onChange={(event) => onChange({authorIdentities: authors.map((entry, n) => n === index ? {...entry, name: event.target.value} : entry)})} />)}
          <AdminSelect ariaLabel={`Author ${index + 1} type`} value={TYPES.find((type) => type.value === (author.type || ""))}
            options={TYPES} onChange={(option: any) => onChange({authorIdentities: authors.map((entry, n) => n === index ? {...entry, type: option.value || undefined} : entry)})} />
          {field("Author profile URL", `author-url-${index}`, <Input id={`${id}-author-url-${index}`} type="url" value={author.url ?? ""}
            onChange={(event) => onChange({authorIdentities: authors.map((entry, n) => n === index ? {...entry, url: event.target.value || null} : entry)})} />)}
          <Button type="button" variant="outline" onClick={() => onChange({authorIdentities: authors.filter((_, n) => n !== index)})}>Remove author</Button>
        </div>)}
        <Button type="button" variant="outline" disabled={authors.length >= 50} onClick={() => onChange({authorIdentities: [...authors, {name: ""}]})}>Add author</Button>
      </div>
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2 rounded-lg border p-4">
          <h3 className="text-sm font-medium">Approximate search preview</h3>
          <p className="truncate text-xs text-muted-foreground">{seo.canonical_url || savedUrl}</p>
          <p className="line-clamp-2 break-words text-xl">{title}</p>
          <p className="line-clamp-3 break-words text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="min-w-0 overflow-hidden rounded-lg border">
          {imageUrl && <img className="aspect-[1200/630] w-full object-cover" src={imageUrl} alt={seo.social_image?.alt || "Social preview"} />}
          <div className="space-y-2 p-4"><h3 className="text-sm font-medium">Approximate social preview</h3>
            <p className="line-clamp-2 break-words font-medium">{title}</p><p className="line-clamp-2 break-words text-sm text-muted-foreground">{description}</p></div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Platforms may display different previews. Existing custom theme metadata applies when no explicit override is set.</p>
    </div>
  </details>;
}
