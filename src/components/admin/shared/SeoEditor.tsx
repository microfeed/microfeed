import React, {useEffect, useId, useRef, useState} from "react";
import {EllipsisVerticalIcon, Globe2Icon} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Field, FieldDescription, FieldLabel} from "@/components/ui/field";
import {Input} from "@/components/ui/input";
import {Separator} from "@/components/ui/separator";
import {Textarea} from "@/components/ui/textarea";
import AuthorEditor from "./AuthorEditor";
import AdminLanguageSelect from "./AdminLanguageSelect";
import AdminSelect from "./AdminSelect";
import AdminImageUploaderApp from "./AdminImageUploaderApp";
import AdminHelpLabel from "./AdminHelpLabel";
import {getSeoHelpContent, type SeoHelpField} from "./SeoHelpContent";
import {htmlToPlainText, urlJoinWithRelative} from "@/shared/StringUtils";
import {automaticItemSlug, itemUrl, normalizeItemSlug} from "@/shared/ItemUrls";
import {showToast} from "@/client/ToastUtils";
import {scrollExpandedAdminSectionIntoView} from "@/client/AdminSectionScroll";
import {canonicalItemLink, defaultSeoDescription} from "@/shared/Seo";
import {resolveEffectiveFavicon} from "@/shared/Favicon";
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
  const [failedFaviconUrl, setFailedFaviconUrl] = useState<string>();
  const seo = value.seo ?? {};
  const isItem = Boolean(itemId);
  const help = getSeoHelpContent(isItem);
  useEffect(() => { if (error && details.current) details.current.open = true; }, [error]);
  const setSeo = (key: string, next: any) => onChange({seo: {...seo, [key]: next || null}});
  const currentSlug = value.publicPath?.slice(3, -1) ?? automaticItemSlug(value.title || "");
  const savedUrl = isItem ? itemUrl({...value, id: itemId,
    publicPath: value.publicPath || `/i/${currentSlug}/`}, window.location.origin) : `${window.location.origin}/`;
  const title = seo.title || value.title || "Untitled";
  const fallbackDescription = defaultSeoDescription(htmlToPlainText(value.description || ""));
  const description = seo.description || fallbackDescription;
  const previewUrl = (isItem && canonicalItemLink(value.link, savedUrl)) || savedUrl;
  const previewDomain = new URL(previewUrl).hostname.replace(/^www\./iu, "");
  const site = isItem ? channel ?? feed.channel : value;
  const siteName = site?.title || window.location.hostname;
  const favicon = resolveEffectiveFavicon(feed.settings?.webGlobalSettings?.favicon, site?.image);
  const faviconUrl = favicon?.url ? urlJoinWithRelative(publicBucketUrl, favicon.url, window.location.origin) : undefined;
  const image = seo.social_image?.url || value.image || channel?.seo?.social_image?.url || channel?.image;
  const imageUrl = image ? urlJoinWithRelative(publicBucketUrl, image, window.location.origin) : undefined;
  const imageSource = seo.social_image?.url ? "Using a custom social image."
    : value.image ? (isItem ? "Default: Using this item's cover image." : "Default: Using the channel image.")
    : channel?.seo?.social_image?.url ? "Using the channel's social image."
    : channel?.image ? "Default: Using the channel image."
    : "No image set. The social preview will use text only.";
  const authors: Identity[] = value.authorIdentities ?? [];
  const inheritedAuthors: Identity[] = channel?.authorIdentities ?? [];
  const field = (key: SeoHelpField, input: React.ReactNode, hint?: React.ReactNode) => (
    <Field className="min-w-0">
      <FieldLabel className="sr-only" htmlFor={`${id}-${key}`}>{help[key].linkName}</FieldLabel>
      <AdminHelpLabel className="mb-0" help={help[key]} />
      {input}
      {hint && <FieldDescription id={`${id}-${key}-hint`} className="text-xs">{hint}</FieldDescription>}
    </Field>
  );
  return <details ref={details} className="rounded-[14px] border bg-card p-5 text-card-foreground shadow-xs"
    onToggle={scrollExpandedAdminSectionIntoView}
    onInvalidCapture={() => { if (details.current) details.current.open = true; }}>
    <summary className="m-page-summary">SEO / GEO</summary>
    <div className="@container/seo mt-5 space-y-7">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-sm text-muted-foreground">Manage how this content appears in search and when shared.</p>
      <section aria-labelledby={`${id}-search-heading`} className="space-y-5">
        <div className="space-y-1">
          <h3 id={`${id}-search-heading`} className="text-base font-semibold">Search appearance</h3>
          <p className="text-sm text-muted-foreground">Leave overrides blank to use the title and description.</p>
        </div>
        <div className="grid min-w-0 items-start gap-6 @[52rem]/seo:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-5">
            {field("title", <Input id={`${id}-title`} value={seo.title ?? ""}
              aria-describedby={`${id}-title-hint`}
              placeholder={value.title || "Untitled"} onChange={(event) => setSeo("title", event.target.value)} />,
            `${Array.from(seo.title || value.title || "").length} characters · Around 60 recommended`)}
            {field("description", <Textarea id={`${id}-description`} rows={3} value={seo.description ?? ""}
              aria-describedby={`${id}-description-hint`}
              placeholder={fallbackDescription} onChange={(event) => setSeo("description", event.target.value)} />,
            `${Array.from(description).length} characters · Around 160 recommended`)}
            {isItem && <div className="space-y-5">
              <div className="space-y-3">
                {field("slug", <div className="flex flex-wrap gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="text-sm text-muted-foreground">/i/</span>
                    <Input id={`${id}-slug`} className="min-w-0 flex-1" value={slug ?? currentSlug}
                      aria-describedby={`${id}-slug-hint`}
                      onChange={(event) => { setSlug(event.target.value); setSlugError(""); }}
                      onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
                  </div>
                  <Button type="button" variant="outline" disabled={applying || slug === undefined || !onApplySlug}
                    onClick={async () => {
                      try {
                        const normalized = normalizeItemSlug(slug ?? currentSlug);
                        setApplying(true);
                        if (await onApplySlug?.(normalized)) { setSlug(undefined); setSlugError(""); }
                      } catch (cause) { setSlugError(cause instanceof Error ? cause.message : String(cause)); }
                      finally { setApplying(false); }
                    }}>{applying ? "Applying…" : "Apply URL"}</Button>
                </div>, "Apply to save this address. Previous links redirect; title edits keep the saved URL.")}
                {slugError && <p role="alert" className="text-sm text-destructive">{slugError}</p>}
                <div className="flex flex-wrap items-start gap-2">
                  <span className="min-w-0 flex-1 break-all text-xs leading-5 text-muted-foreground">{savedUrl}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    void navigator.clipboard.writeText(savedUrl).then(() => showToast("Link copied.", "success"), () => showToast("Could not copy. Select the URL to copy it.", "error"));
                  }}>Copy link</Button>
                </div>
              </div>
              <AdminLanguageSelect labelComponent={<AdminHelpLabel help={help.language} />} ariaLabel="Item language" value={value.language}
                inheritedLanguage={channel?.language || "en"} onChange={(language) => onChange({language: language || null})} />
            </div>}
          </div>
          <figure className="min-w-0 w-full max-w-80 space-y-2">
            <figcaption className="text-sm font-medium text-muted-foreground">Search preview</figcaption>
            <div className="space-y-2 rounded-lg border border-[#dadce0] bg-white p-4 font-[Arial,sans-serif] text-[#202124] dark:border-[#3c4043] dark:bg-[#202124] dark:text-[#dadce0]">
              <div className="mb-3 flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#dadce0] bg-[#f1f3f4] dark:border-[#5f6368] dark:bg-[#303134]">
                  {faviconUrl && faviconUrl !== failedFaviconUrl
                    ? <img src={faviconUrl} alt="" className="size-[18px] rounded-full object-contain"
                      onError={() => setFailedFaviconUrl(faviconUrl)} />
                    : <Globe2Icon className="size-[18px] text-[#5f6368] dark:text-[#bdc1c6]" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm leading-[18px]">{siteName}</p>
                  <p className="truncate text-xs leading-4" title={previewUrl}>{previewUrl.replace(/\/$/u, "")}</p>
                </div>
                <EllipsisVerticalIcon aria-hidden="true" className="size-4 shrink-0 text-[#70757a] dark:text-[#9aa0a6]" />
              </div>
              <p className="line-clamp-2 break-words text-[22px] leading-7 font-normal text-[#1a0dab] dark:text-[#8ab4f8]">{title}</p>
              <p className="line-clamp-3 break-words text-sm leading-5 text-[#4d5156] dark:text-[#bdc1c6]">{description}</p>
            </div>
          </figure>
        </div>
      </section>
      <Separator />
      <section aria-labelledby={`${id}-social-heading`} className="space-y-5">
        <div className="space-y-1">
          <h3 id={`${id}-social-heading`} className="text-base font-semibold">Social sharing</h3>
          <p className="text-sm text-muted-foreground">Choose the image shown when this {isItem ? "item" : "channel"} is shared.</p>
        </div>
        <div className="grid min-w-0 items-start gap-6 @[52rem]/seo:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-5">
            <div className="space-y-2">
              <h4><AdminHelpLabel className="mb-0" help={help.image} /></h4>
              <AdminImageUploaderApp socialImage deferredRemoval mediaType={isItem ? "item-social" : "channel-social"}
                feed={feed} mediaStorage={mediaStorage} mediaStorageReady={mediaStorage?.ready !== false}
                publicBucketUrl={publicBucketUrl} currentImageUrl={seo.social_image?.url}
                imageSizeNotOkayFunc={(width: number, height: number) => width < 1200 || height < 630}
                imageSizeNotOkayMsgFunc={() => "This crop will be enlarged to 1200 × 630 and may look soft. A larger source will be sharper."}
                onImageUploaded={(url: string, mime_type: string, previous: string) => onChange({seo: {...seo,
                  social_image: {url, mime_type, width: 1200, height: 630, alt: seo.social_image?.alt ?? ""},
                }}, previous)}
                onImageDeleted={() => onChange({seo: {...seo, social_image: null}}, seo.social_image?.url)} />
              <p className="text-xs text-muted-foreground">Upload an image to crop to 1200 × 630.</p>
              <p className="text-xs text-muted-foreground">{imageSource}</p>
            </div>
            {seo.social_image && field("alt", <Input id={`${id}-alt`} value={seo.social_image.alt ?? ""}
              onChange={(event) => setSeo("social_image", {...seo.social_image, alt: event.target.value})} />)}
          </div>
          <figure className="min-w-0 w-full max-w-80 space-y-2">
            <figcaption className="text-sm font-medium text-muted-foreground">Social preview</figcaption>
            <div className="overflow-hidden rounded-lg border border-[#dadde1] bg-[#f0f2f5] font-[Arial,sans-serif] text-[#050505] dark:border-[#3e4042] dark:bg-[#3a3b3c] dark:text-[#e4e6eb]">
              {imageUrl && <img className="aspect-[1200/630] w-full object-cover" src={imageUrl} alt={seo.social_image?.alt || "Social preview"} />}
              <div className="space-y-1 border-t border-black/5 px-3 py-3 dark:border-white/5">
                <p className="truncate text-xs leading-4 text-[#65676b] uppercase dark:text-[#b0b3b8]" title={previewUrl}>{previewDomain}</p>
                <p className="line-clamp-2 break-words text-base leading-5 font-semibold">{title}</p>
              </div>
            </div>
          </figure>
        </div>
      </section>
      <Separator />
      <section aria-labelledby={`${id}-identity-heading`} className="space-y-5">
        <div className="space-y-1">
          <h3 id={`${id}-identity-heading`} className="text-base font-semibold">Identity and authors</h3>
          {!isItem && <p className="text-sm text-muted-foreground">Publisher: {value.publisher || "Set Publisher above"}</p>}
        </div>
        {!isItem && <div className="space-y-5">
          <div className="grid items-start gap-5 @[40rem]/seo:grid-cols-2">
            {field("publisher-type", <AdminSelect compact id={`${id}-publisher-type`} ariaLabel="Publisher type" value={TYPES.find((type) => type.value === (value.publisherIdentity?.type || ""))}
              options={TYPES} onChange={(option) => onChange({publisherIdentity: {...value.publisherIdentity, type: option.value || undefined}})} />)}
            {field("publisher-url", <Input id={`${id}-publisher-url`} type="url" value={value.publisherIdentity?.url ?? ""}
              onChange={(event) => onChange({publisherIdentity: {...value.publisherIdentity, url: event.target.value || null}})} />)}
          </div>
          {field("profiles", <Textarea id={`${id}-profiles`} rows={3} placeholder="https://..."
            aria-describedby={`${id}-profiles-hint`} value={profiles ?? (value.publisherIdentity?.same_as ?? []).join("\n")}
            onChange={(event) => { setProfiles(event.target.value); onChange({publisherIdentity: {...value.publisherIdentity, same_as: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean)}}); }} />, "One official profile URL per line.")}
        </div>}
        <div className="space-y-3">
          <div className="space-y-1">
            <h4><AdminHelpLabel className="mb-0" help={help.authors} /></h4>
            <p className="text-sm text-muted-foreground">{isItem
              ? `Replaces default authors when configured. Inherited: ${inheritedAuthors.map((author) => author.name).join(", ") || "none"}.`
              : "Optional attribution for items. This does not change the podcast publisher."}</p>
          </div>
          <AuthorEditor authors={authors} onChange={(authorIdentities) => onChange({authorIdentities})} />
        </div>
      </section>
      <p className="text-xs text-muted-foreground">Previews are approximate. Platforms may display them differently.</p>
    </div>
  </details>;
}
