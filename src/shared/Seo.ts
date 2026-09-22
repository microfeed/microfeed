import * as z from "zod";

export const DEFAULT_SEO_DESCRIPTION_LENGTH = 160;

/** Compact plain-text fallback shared by the editor and public metadata. */
export function defaultSeoDescription(text: string): string {
  const characters = Array.from(text.replace(/\s+/gu, " ").trim());
  if (characters.length <= DEFAULT_SEO_DESCRIPTION_LENGTH) return characters.join("");
  return `${characters.slice(0, DEFAULT_SEO_DESCRIPTION_LENGTH - 1).join("").trimEnd()}…`;
}

export const socialImageSchema = z.object({
  url: z.url().refine((value) => /^https?:\/\//iu.test(value), "Use an HTTP or HTTPS image URL."),
  width: z.literal(1200),
  height: z.literal(630),
  mime_type: z.enum(["image/jpeg", "image/png"]),
  alt: z.string().max(2000).nullable().optional(),
});

export const identitySchema = z.object({
  name: z.string().trim().min(1).max(300),
  type: z.enum(["Person", "Organization"]).nullable().optional(),
  url: z.url().refine((value) => /^https?:\/\//iu.test(value)).nullable().optional(),
});

export const publisherIdentitySchema = identitySchema.partial().extend({
  same_as: z.array(z.url().refine((value) => /^https?:\/\//iu.test(value))).max(20).nullable().optional(),
});

export const seoSchema = z.object({
  title: z.string().max(4096).nullable().optional(),
  description: z.string().max(10000).nullable().optional(),
  social_image: socialImageSchema.nullable().optional(),
});

export const authorIdentitiesSchema = z.array(identitySchema).max(50);
export const languageOverrideSchema = z.string().max(100).refine((value) => {
  if (!value) return true;
  try { return Intl.getCanonicalLocales(value).length === 1; } catch { return false; }
}, "Use a language code such as en, zh-Hans, or ja.");

export type Seo = z.infer<typeof seoSchema>;
export type Identity = z.infer<typeof identitySchema>;
export type PublisherIdentity = z.infer<typeof publisherIdentitySchema>;
export type SocialImage = z.infer<typeof socialImageSchema>;

export class ContentCustomizationError extends Error {
  constructor(message: string, public status: 400 | 409 = 400) { super(message); }
}

/** PATCH semantics: omitted properties survive; null and blank overrides inherit. */
export function mergeOverrides<T extends Record<string, unknown>>(
  current: T | null | undefined, patch: T | null,
): T | undefined {
  if (patch === null) return undefined;
  const result = {...current, ...patch};
  for (const key of Object.keys(result)) {
    if (result[key] === null || result[key] === "") delete result[key];
  }
  return Object.keys(result).length ? result : undefined;
}

export function jsonFeedAuthors(authors: Identity[] | null | undefined) {
  return authors?.length ? authors.map(({name, url}) => ({name, ...(url ? {url} : {})})) : undefined;
}

export function validateCustomization(value: Record<string, any>, isItem: boolean) {
  const schema = z.object({
    seo: seoSchema.nullable().optional(),
    authorIdentities: authorIdentitiesSchema.nullable().optional(),
    ...(isItem ? {language: languageOverrideSchema.nullable().optional()} : {
      publisherIdentity: publisherIdentitySchema.nullable().optional(),
    }),
  });
  const input = structuredClone({seo: value.seo, authorIdentities: value.authorIdentities,
    ...(isItem ? {language: value.language} : {publisherIdentity: value.publisherIdentity})});
  const image = input.seo?.social_image;
  if (image?.url && /^(?:\/?(?:production|preview|development)\/|\/media\/)/u.test(image.url)) {
    image.url = new URL(image.url, "https://media.invalid/").href;
  }
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0]!;
    throw new ContentCustomizationError(`${issue.path.join(".")}: ${issue.message}`);
  }
}

/** Feed links may predate URL validation. Only safe web URLs become canonicals. */
export function canonicalItemLink(link: unknown, localUrl: string): string | undefined {
  if (typeof link !== "string" || !/^(?:https?:\/\/|\/)/iu.test(link.trim())) return undefined;
  try {
    const url = new URL(link, localUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
    url.hash = "";
    return url.href;
  } catch { return undefined; }
}
