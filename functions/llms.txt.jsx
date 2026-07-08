import ItemRepo from "../edge-src/models/ItemRepo";
import FeedDb from "../edge-src/models/FeedDb";
import {serializeItemForFeed} from "../edge-src/models/FeedItemSerializer";
import {itemPublicUrl} from "../edge-src/web/itemPublicUrl";
import {pageDescription} from "../edge-src/web/seo/buildSeo";
import {STATUSES, SETTINGS_CATEGORIES} from "../common-src/Constants";

// PRD_SEO_GEO.md Phase 3 (§5): auto-generated llms.txt - a machine-readable
// site summary for AI/GEO crawlers, built from the SAME per-page meta
// description logic as the SEO layer (pageDescription, from buildSeo.js) so
// this never drifts from what's actually rendered in <meta name="description">.
// This file must stay generated, not hand-maintained (PRD_SEO_GEO.md 0/§5).

// Content-type -> section heading + listing-root path, in display order.
const SECTIONS = [
  {contentType: "blog_article", heading: "Blog"},
  {contentType: "podcast_episode", heading: "Podcast"},
  {contentType: "photo", heading: "Photos"},
  {contentType: "gallery", heading: "Galleries"},
  {contentType: "landing_page", heading: "Pages"},
];

function isIndexable(item) {
  return item.noindex !== true && item.status === "published";
}

async function fetchIndexableItems(itemRepo, contentType, publicBucketUrl) {
  const response = await itemRepo.list({
    queryKwargs: {
      content_type: contentType,
      status: STATUSES.PUBLISHED,
    },
    orderBy: ["pub_date desc", "id"],
  });

  return response.results
    .map((row) => serializeItemForFeed(row, {publicBucketUrl}))
    .filter(isIndexable);
}

function itemLine(item, contentType, origin) {
  const title = item.title || item.caption || item.slug;
  const description = pageDescription({
    seoDescription: item.seoDescription,
    excerpt: item.excerpt,
    caption: item.caption,
    contentHtml: item.content_html,
    fallback: "",
  });
  const url = `${origin}${itemPublicUrl(contentType, item.slug)}/`;
  return description ? `- [${title}](${url}): ${description}` : `- [${title}](${url})`;
}

export async function onRequestGet({env, request}) {
  const itemRepo = new ItemRepo(env.FEED_DB);
  const feedDb = new FeedDb(env, request);
  const content = await feedDb.getContent();
  const webGlobalSettings = (content.settings && content.settings.webGlobalSettings) || {};
  const publicBucketUrl = webGlobalSettings.publicBucketUrl || "";
  const seoSettings = (content.settings && content.settings[SETTINGS_CATEGORIES.SEO]) || {};
  const channel = content.channel || {};

  const {origin} = new URL(request.url);
  const siteName = seoSettings.siteName || channel.title || "";
  const siteDescription = pageDescription({fallback: channel.description || ""});

  const lines = [`# ${siteName}`, "", siteDescription, "", `Site: ${origin}/`];

  for (const {contentType, heading} of SECTIONS) {
    const items = await fetchIndexableItems(itemRepo, contentType, publicBucketUrl);
    if (items.length === 0) {
      continue;
    }
    lines.push("", `## ${heading}`, "");
    items.forEach((item) => {
      lines.push(itemLine(item, contentType, origin));
    });
  }

  const body = `${lines.join("\n")}\n`;

  return new Response(body, {
    headers: {"content-type": "text/plain; charset=utf-8"},
  });
}
