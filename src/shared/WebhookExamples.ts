import {ITEM_STATUSES_DICT} from "./Constants";
import {
  WEBHOOK_EVENT_TYPES,
  type WebhookEventInput,
  type WebhookEventType,
  type WebhookSubjectType,
  webhookSubjectType,
} from "./Webhooks";

export type WebhookExampleSourceKind =
  | "channel"
  | "item"
  | "page"
  | "page_navigation"
  | "site_file"
  | "theme"
  | "webhook";

export interface WebhookEventDefinition {
  description: string;
  group: string;
  name: string;
  sourceKind: WebhookExampleSourceKind;
  type: WebhookEventType;
}

const descriptions: Record<WebhookEventType, Omit<WebhookEventDefinition, "type">> = {
  "channel.updated": {
    description: "The primary channel's public metadata changed.",
    group: "Channel",
    name: "Channel updated",
    sourceKind: "channel",
  },
  "item.created": {
    description: "An item was created. A visibility event may follow.",
    group: "Items",
    name: "Item created",
    sourceKind: "item",
  },
  "item.updated": {
    description: "One or more material item fields changed.",
    group: "Items",
    name: "Item updated",
    sourceKind: "item",
  },
  "item.published": {
    description: "An item became publicly listed.",
    group: "Items",
    name: "Item published",
    sourceKind: "item",
  },
  "item.unlisted": {
    description: "An item became public only at its direct URL.",
    group: "Items",
    name: "Item unlisted",
    sourceKind: "item",
  },
  "item.unpublished": {
    description: "An item became a private draft.",
    group: "Items",
    name: "Item unpublished",
    sourceKind: "item",
  },
  "item.deleted": {
    description: "An item was deleted; the object is its last available snapshot.",
    group: "Items",
    name: "Item deleted",
    sourceKind: "item",
  },
  "page.created": {
    description: "A Page was created. A visibility event may follow.",
    group: "Pages",
    name: "Page created",
    sourceKind: "page",
  },
  "page.updated": {
    description: "One or more material Page fields changed.",
    group: "Pages",
    name: "Page updated",
    sourceKind: "page",
  },
  "page.published": {
    description: "A Page became publicly listed.",
    group: "Pages",
    name: "Page published",
    sourceKind: "page",
  },
  "page.unlisted": {
    description: "A Page became public only at its direct URL.",
    group: "Pages",
    name: "Page unlisted",
    sourceKind: "page",
  },
  "page.unpublished": {
    description: "A Page became a private draft.",
    group: "Pages",
    name: "Page unpublished",
    sourceKind: "page",
  },
  "page.deleted": {
    description: "A Page was deleted; the object is its last available snapshot.",
    group: "Pages",
    name: "Page deleted",
    sourceKind: "page",
  },
  "page.navigation_updated": {
    description: "The ordered list of Pages shown in website navigation changed.",
    group: "Pages",
    name: "Page navigation updated",
    sourceKind: "page_navigation",
  },
  "site_file.created": {
    description: "A root-level Site File was created.",
    group: "Site files",
    name: "Site File created",
    sourceKind: "site_file",
  },
  "site_file.updated": {
    description: "A Site File's configuration or draft template changed.",
    group: "Site files",
    name: "Site File updated",
    sourceKind: "site_file",
  },
  "site_file.published": {
    description: "A Site File's draft template was published.",
    group: "Site files",
    name: "Site File published",
    sourceKind: "site_file",
  },
  "site_file.reset": {
    description: "A built-in Site File was restored to its generated default.",
    group: "Site files",
    name: "Site File reset",
    sourceKind: "site_file",
  },
  "site_file.deleted": {
    description: "A custom Site File was deleted; the object is its last snapshot.",
    group: "Site files",
    name: "Site File deleted",
    sourceKind: "site_file",
  },
  "theme.activated": {
    description: "An installed theme version became active.",
    group: "Themes",
    name: "Theme activated",
    sourceKind: "theme",
  },
  "theme.deactivated": {
    description: "An installed theme version stopped being active.",
    group: "Themes",
    name: "Theme deactivated",
    sourceKind: "theme",
  },
  "webhook.test": {
    description: "A connection test requested by an administrator.",
    group: "Testing",
    name: "Webhook connection test",
    sourceKind: "webhook",
  },
};

export const WEBHOOK_EVENT_DEFINITIONS: readonly WebhookEventDefinition[] =
  WEBHOOK_EVENT_TYPES.map((type) => ({type, ...descriptions[type]}));

function statusName(value: unknown): string | undefined {
  if (typeof value === "number") {
    return (ITEM_STATUSES_DICT as Readonly<Record<number, {name: string}>>)[value]
      ?.name;
  }
  return typeof value === "string" ? value : undefined;
}

function definedEntries(
  entries: Array<[string, unknown]>,
): Record<string, unknown> {
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

export function webhookChannelSnapshot(
  channel: Record<string, unknown>,
): Record<string, unknown> {
  const microfeed = channel._microfeed as Record<string, unknown> | undefined;
  return definedEntries([
    ["_microfeed", typeof microfeed?.copyright === "string"
      ? {copyright: microfeed.copyright}
      : undefined],
    ["authors", channel.authors],
    ["description", channel.description],
    ["expired", channel.expired],
    ["homepage_url", channel.homepage_url ?? channel.home_page_url],
    ["icon", channel.icon],
    ["id", "primary"],
    ["language", channel.language],
    ["title", channel.title],
  ]);
}

export function webhookItemSnapshot(
  item: Record<string, unknown>,
): Record<string, unknown> {
  const mediaFile = item.mediaFile as Record<string, unknown> | undefined;
  const attachments = item.attachments ?? (mediaFile?.url
    ? [{
        ...(mediaFile.category ? {category: mediaFile.category} : {}),
        ...(mediaFile.contentType ? {mime_type: mediaFile.contentType} : {}),
        ...(mediaFile.durationSecond !== undefined
          ? {duration_in_seconds: mediaFile.durationSecond}
          : {}),
        ...(mediaFile.sizeByte !== undefined
          ? {size_in_bytes: mediaFile.sizeByte}
          : {}),
        url: mediaFile.url,
      }]
    : undefined);
  return definedEntries([
    ["attachments", attachments],
    ["content_html", item.content_html ?? item.description],
    ["content_text", item.content_text ?? item.contentText],
    ["date_modified", item.date_modified],
    ["date_published", item.date_published ?? (item.pubDateMs
      ? new Date(Number(item.pubDateMs)).toISOString()
      : undefined)],
    ["id", String(item.id ?? "")],
    ["image", item.image],
    ["status", statusName(item.status)],
    ["title", item.title],
    ["url", item.url ?? item.link],
  ]);
}

export function webhookPageSnapshot(
  page: Record<string, unknown>,
): Record<string, unknown> {
  return definedEntries([
    ["content_html", page.content_html],
    ["content_text", page.content_text],
    ["date_created", page.date_created],
    ["date_modified", page.date_modified],
    ["date_published", page.date_published],
    ["id", String(page.id ?? "")],
    ["is_not_found_page", page.is_not_found_page],
    ["meta_description", page.meta_description],
    ["navigation_label", page.navigation_label],
    ["navigation_order", page.navigation_order],
    ["show_in_navigation", page.show_in_navigation],
    ["slug", page.slug],
    ["status", statusName(page.status)],
    ["title", page.title],
    ["url", page.url],
  ]);
}

export function webhookSiteFileSnapshot(
  siteFile: Record<string, unknown>,
): Record<string, unknown> {
  return definedEntries([
    ["content_type", siteFile.content_type],
    ["date_created", siteFile.date_created],
    ["date_modified", siteFile.date_modified],
    ["date_published", siteFile.date_published],
    ["draft_content", siteFile.draft_content],
    ["enabled", siteFile.enabled],
    ["filename", siteFile.filename],
    ["generator", siteFile.generator],
    ["id", String(siteFile.id ?? "")],
    ["mode", siteFile.mode],
    ["published_content", siteFile.published_content],
    ["system", siteFile.system],
    ["url", siteFile.url],
  ]);
}

export function webhookThemeSnapshot(
  theme: Record<string, unknown>,
): Record<string, unknown> {
  return definedEntries([
    ["asset_owner_theme_id", theme.assetOwnerThemeId ?? theme.asset_owner_theme_id],
    ["checksum_sha256", theme.checksumSha256 ?? theme.checksum_sha256],
    ["created_at", theme.createdAt ?? theme.created_at],
    ["id", String(theme.id ?? "")],
    ["manifest", theme.manifest],
    ["name", theme.name],
    ["origin_theme_id", theme.originThemeId ?? theme.origin_theme_id],
    ["package_id", theme.packageId ?? theme.package_id],
    ["source_commit", theme.sourceCommit ?? theme.source_commit],
    ["source_kind", theme.sourceKind ?? theme.source_kind],
    ["source_ref", theme.sourceRef ?? theme.source_ref],
    ["source_url", theme.sourceUrl ?? theme.source_url],
    ["version", theme.version],
  ]);
}

const timestamp = "2026-08-14T12:00:00.000Z";

const itemExample = {
  attachments: [{
    category: "audio",
    duration_in_seconds: 1262,
    mime_type: "audio/mpeg",
    size_in_bytes: 277000,
    url: "https://feed.example.com/media/production/media/example.mp3",
  }],
  content_html: "<p>A representative microfeed item.</p>",
  content_text: "A representative microfeed item.",
  date_modified: timestamp,
  date_published: timestamp,
  id: "item_example",
  image: "https://feed.example.com/media/production/images/example.png",
  status: "published",
  title: "Example item",
  url: "https://feed.example.com/i/example-item-item_example/",
};

const pageExample = {
  content_html: "<p>A representative microfeed Page.</p>",
  content_text: "A representative microfeed Page.",
  date_created: timestamp,
  date_modified: timestamp,
  date_published: timestamp,
  id: "page_example",
  is_not_found_page: false,
  meta_description: "A representative Page used for webhook testing.",
  navigation_label: "Example",
  navigation_order: 10,
  show_in_navigation: true,
  slug: "example",
  status: "published",
  title: "Example Page",
  url: "https://feed.example.com/example/",
};

const siteFileExample = {
  content_type: "text/plain",
  date_created: timestamp,
  date_modified: timestamp,
  date_published: timestamp,
  draft_content: "Contact: mailto:security@example.com",
  enabled: true,
  filename: "security.txt",
  id: "site_file_example",
  mode: "override",
  published_content: "Contact: mailto:security@example.com",
  system: false,
  url: "https://feed.example.com/security.txt",
};

const themeExample = {
  asset_owner_theme_id: null,
  checksum_sha256: "a".repeat(64),
  created_at: timestamp,
  id: "theme_example",
  manifest: {
    assets: [],
    author: "Example Publisher",
    files: {
      rssStylesheet: "rss.xsl",
      webBodyEnd: "body-end.html",
      webBodyStart: "body-start.html",
      webFeed: "feed.html",
      webHeader: "header.html",
      webItem: "item.html",
      webPage: "page.html",
      webSearch: "search.html",
    },
    formatVersion: 2,
    license: "AGPL-3.0",
    microfeed: ">=1.0.0",
    name: "Example theme",
    packageId: "org.example.theme",
    version: "1.0.0",
  },
  name: "Example theme",
  origin_theme_id: null,
  package_id: "org.example.theme",
  source_commit: null,
  source_kind: "github",
  source_ref: "main",
  source_url: "https://github.com/example/microfeed-theme",
  version: "1.0.0",
};

function visibilityStatus(type: WebhookEventType): string | undefined {
  return type.endsWith(".published")
    ? "published"
    : type.endsWith(".unlisted")
    ? "unlisted"
    : type.endsWith(".unpublished")
    ? "unpublished"
    : undefined;
}

function previousStatus(type: WebhookEventType): string | null {
  const hasVisibility = type.startsWith("item.") || type.startsWith("page.");
  if (hasVisibility && type.endsWith(".published")) return "unpublished";
  if (hasVisibility && type.endsWith(".unlisted")) return "published";
  if (hasVisibility && type.endsWith(".unpublished")) return "published";
  if (hasVisibility && (type.endsWith(".updated") || type.endsWith(".deleted"))) {
    return "published";
  }
  return null;
}

function exampleObject(type: WebhookEventType): Record<string, unknown> {
  if (type === "channel.updated") {
    return {
      _microfeed: {copyright: "© 2026 Example Publisher"},
      authors: [{name: "Example Publisher"}],
      description: "A representative microfeed channel.",
      expired: false,
      homepage_url: "https://feed.example.com/",
      icon: "https://feed.example.com/media/production/images/icon.png",
      id: "primary",
      language: "en",
      title: "Example channel",
    };
  }
  if (type.startsWith("item.")) {
    return {...itemExample, status: visibilityStatus(type) ?? itemExample.status};
  }
  if (type === "page.navigation_updated") {
    return {id: "navigation", page_ids: ["page_example", "page_contact"]};
  }
  if (type.startsWith("page.")) {
    const status = visibilityStatus(type) ?? pageExample.status;
    return {
      ...pageExample,
      show_in_navigation: status === "published",
      status,
    };
  }
  if (type.startsWith("site_file.")) {
    if (type === "site_file.reset") {
      return {
        ...siteFileExample,
        draft_content: "User-agent: *\nAllow: /",
        filename: "robots.txt",
        generator: "robots",
        id: "site_file_robots",
        mode: "generated",
        published_content: "User-agent: *\nAllow: /",
        system: true,
        url: "https://feed.example.com/robots.txt",
      };
    }
    return {...siteFileExample};
  }
  if (type.startsWith("theme.")) return {...themeExample};
  return {id: "endpoint_example", message: "This is a microfeed webhook test."};
}

function changedFields(type: WebhookEventType, object: Record<string, unknown>): string[] {
  if (type.endsWith(".deleted") || type === "webhook.test") return [];
  if ((type.startsWith("item.") || type.startsWith("page.")) &&
      (type.endsWith(".published") || type.endsWith(".unlisted") ||
        type.endsWith(".unpublished"))) return ["status"];
  if (type === "site_file.published") {
    return ["date_published", "published_content"];
  }
  if (type === "page.navigation_updated") return ["page_ids"];
  if (type.startsWith("theme.")) return ["active_theme_id"];
  if (type === "channel.updated") return ["description", "title"];
  if (type === "item.updated" || type === "page.updated") {
    return ["content_html", "title"];
  }
  if (type === "site_file.updated") return ["draft_content", "enabled"];
  if (type === "site_file.reset") return ["draft_content", "mode"];
  return Object.keys(object).filter((field) => field !== "id").sort();
}

export function webhookEventInputForSnapshot(
  type: WebhookEventType,
  snapshot: Record<string, unknown>,
): WebhookEventInput {
  const object = structuredClone(snapshot);
  const status = visibilityStatus(type);
  if (status && (type.startsWith("item.") || type.startsWith("page."))) {
    object.status = status;
    if (type.startsWith("page.")) {
      object.show_in_navigation = status === "published";
    }
  }
  if (type === "site_file.published") {
    if (typeof object.draft_content === "string") {
      object.published_content = object.draft_content;
    }
    object.date_published = typeof object.date_published === "string"
      ? object.date_published
      : new Date().toISOString();
  }
  const subjectType = webhookSubjectType(type);
  const subjectId = String(object.id);
  const priorStatus = (type.startsWith("item.") || type.startsWith("page.")) &&
      (type.endsWith(".updated") || type.endsWith(".deleted"))
    ? statusName(snapshot.status) ?? previousStatus(type)
    : previousStatus(type);
  return {
    changedFields: changedFields(type, object),
    object,
    previousStatus: priorStatus,
    subjectId,
    subjectType,
    type,
  };
}

export function webhookGeneratedEventInput(
  type: WebhookEventType,
): WebhookEventInput {
  return webhookEventInputForSnapshot(type, exampleObject(type));
}

function exampleApiPath(
  subjectType: WebhookSubjectType,
  subjectId: string,
  type: WebhookEventType,
): string | undefined {
  if (type === "page.navigation_updated") return undefined;
  if (subjectType === "channel") return "/api/v1/channels/primary/";
  if (subjectType === "item") return `/api/v1/items/${subjectId}/`;
  if (subjectType === "page") return `/api/v1/pages/${subjectId}/`;
  if (subjectType === "site_file") return `/api/v1/site-files/${subjectId}/`;
  return undefined;
}

export function webhookGeneratedEnvelope(type: WebhookEventType): Record<string, unknown> {
  const input = webhookGeneratedEventInput(type);
  const subjectType = input.subjectType ?? webhookSubjectType(type);
  const eventId = `evt_example_${type.replaceAll(".", "_")}`;
  const path = exampleApiPath(subjectType, input.subjectId, type);
  return {
    api_version: "1",
    context: {
      causation_id: null,
      correlation_id: eventId,
      origin: "dashboard",
      request_id: "req_example",
    },
    data: {
      changed_fields: input.changedFields ?? [],
      object: input.object,
      previous_status: input.previousStatus ?? null,
      truncated_fields: [],
    },
    id: eventId,
    site: {id: "site_example", url: "https://feed.example.com"},
    subject: {
      ...(path ? {api_path: path} : {}),
      id: input.subjectId,
      type: subjectType,
    },
    test: true,
    timestamp,
    type,
  };
}

export const WEBHOOK_EVENT_EXAMPLES = Object.fromEntries(
  WEBHOOK_EVENT_TYPES.map((type) => [type, webhookGeneratedEnvelope(type)]),
) as Record<WebhookEventType, Record<string, unknown>>;
