import {CHAPTERS_CONTENT_TYPE, podcastChaptersUrl, type Podcast} from "@/shared/Podcast";

/** Nodes for fast-xml-builder; it handles escaping all text and attributes. */
export function podcastRssNodes(podcast: Podcast | null | undefined, itemId?: string, origin?: string) {
  if (!podcast) return {};
  const nodes: Record<string, unknown> = {};
  if (podcast.people?.length) nodes["podcast:person"] = podcast.people.map(({name, role, group, img, href}) => ({
    "#text": name,
    ...(role ? {"@_role": role} : {}),
    ...(group ? {"@_group": group} : {}),
    ...(img ? {"@_img": img} : {}),
    ...(href ? {"@_href": href} : {}),
  }));
  if (podcast.license) nodes["podcast:license"] = {
    "#text": podcast.license.identifier,
    ...(podcast.license.url ? {"@_url": podcast.license.url} : {}),
  };
  if (itemId) {
    if (podcast.transcripts?.length) nodes["podcast:transcript"] = podcast.transcripts.map(({url, type, language}) => ({
      "@_url": url, "@_type": type, ...(language ? {"@_language": language} : {}),
    }));
    if (podcast.chapters?.length && origin) nodes["podcast:chapters"] = {
      "@_url": podcastChaptersUrl(itemId, origin), "@_type": CHAPTERS_CONTENT_TYPE,
    };
  } else {
    if (podcast.funding?.length) nodes["podcast:funding"] = podcast.funding.map(({label, url}) => ({"#text": label, "@_url": url}));
    if (typeof podcast.locked === "boolean") nodes["podcast:locked"] = podcast.locked ? "yes" : "no";
  }
  return nodes;
}
