import {
  mediaReferenceForStorage,
  randomShortUUID,
} from "@/shared/StringUtils";
import {ENCLOSURE_CATEGORIES, ENCLOSURE_CATEGORIES_DICT, LANGUAGE_CODES_LIST} from "@/shared/Constants";
import type {DatabaseMutationCommit} from "@/server/mutation";

const LANGUAGE_CODES = LANGUAGE_CODES_LIST.map((lc: any) => lc.code);

export default class FeedCrudManager {
  [member: string]: any;

  constructor(feedContent?: any, feedDb?: any, request?: any) {
    this.feedContent = feedContent;
    this.feedDb = feedDb;
    this.request = request;
  }

  _mediaReferenceForStorage(value: string): string {
    return mediaReferenceForStorage(
      value,
      this.feedContent?.settings?.webGlobalSettings?.publicBucketUrl,
      this.request?.url,
    );
  }

  _publicToInternalSchemaForItem(item: any): Record<string, any> {
    const internalSchema: Record<string, any> = {};
    const attachment = item.attachment ?? item.attachments?.[0];

    if (item.title) {
      (internalSchema as any).title = item.title;
    }

    if (item.status) {
      (internalSchema as any).status = item.status;
    }

    if (attachment &&
        ENCLOSURE_CATEGORIES_DICT[attachment.category] &&
        attachment.url) {
      const mediaFile = {};
      if (attachment.category) {
        (mediaFile as any).category = attachment.category;
      }
      if (attachment.url) {
        // Uploaded media uses a key relative to the configured public bucket;
        // externally hosted media keeps its absolute URL.
        (mediaFile as any).url = attachment.category !== ENCLOSURE_CATEGORIES.EXTERNAL_URL ?
          this._mediaReferenceForStorage(attachment.url) : attachment.url;
      }
      if (attachment.mime_type) {
        (mediaFile as any).contentType = attachment.mime_type;
      }
      if (attachment.size_in_bytes !== undefined) {
        (mediaFile as any).sizeByte = attachment.size_in_bytes;
      } else if (attachment.size_in_byte !== undefined) {
        (mediaFile as any).sizeByte = attachment.size_in_byte;
      }
      if (attachment.duration_in_seconds !== undefined) {
        (mediaFile as any).durationSecond = attachment.duration_in_seconds;
      }
      (internalSchema as any).mediaFile = mediaFile;
    }

    if (item.url) {
      (internalSchema as any).link = item.url;
    }

    if (Object.hasOwn(item, "content_html")) {
      (internalSchema as any).description = item.content_html ?? "";
    }

    if (item.image) {
      // Uploaded media uses a key relative to the configured public bucket;
      // externally hosted images keep their absolute URL.
      (internalSchema as any).image = this._mediaReferenceForStorage(item.image);
    }

    if (item.date_published_ms) {
      (internalSchema as any).pubDateMs = item.date_published_ms;
    }

    if (!item._microfeed) {
      item._microfeed = {};
    }

    if ('itunes:title' in item._microfeed) {
      (internalSchema as any)['itunes:title'] = item._microfeed['itunes:title'];
    }

    if (typeof item._microfeed['itunes:block'] === 'boolean') {
      (internalSchema as any)['itunes:block'] = item._microfeed['itunes:block'];
    }

    if (['full', 'trailer', 'bonus'].includes(item._microfeed['itunes:episodeType'])) {
      (internalSchema as any)['itunes:episodeType'] = item._microfeed['itunes:episodeType'];
    }

    if (item._microfeed['itunes:season']) {
      (internalSchema as any)['itunes:season'] = item._microfeed['itunes:season'];
    }

    if (item._microfeed['itunes:episode']) {
      (internalSchema as any)['itunes:episode'] = item._microfeed['itunes:episode'];
    }

    if (typeof item._microfeed['itunes:explicit'] === 'boolean') {
      (internalSchema as any)['itunes:explicit'] = item._microfeed['itunes:explicit'];
    }
    return internalSchema;
  }

  _publicToInternalSchemaForChannel(channel: any): Record<string, any> {
    const internalSchema: Record<string, any> = {};
    if (channel.title) {
      (internalSchema as any).title = channel.title;
    }
    if (channel.homepage_url || channel.home_page_url) {
      (internalSchema as any).link = channel.homepage_url ?? channel.home_page_url;
    }
    if (channel.description) {
      (internalSchema as any).description = channel.description;
    }
    if (channel.icon) {
      (internalSchema as any).image = this._mediaReferenceForStorage(channel.icon);
    }
    if (channel.authors && channel.authors.length > 0 && channel.authors[0].name) {
      (internalSchema as any).publisher = channel.authors[0].name;
    }
    if (LANGUAGE_CODES.includes(channel.language)) {
      (internalSchema as any).language = channel.language;
    }
    if (typeof channel.expired === 'boolean') {
      (internalSchema as any)['itunes:complete'] = channel.expired;
    }
    if (!channel._microfeed) {
      channel._microfeed = {};
    }
    if (typeof channel._microfeed['itunes:explicit'] === 'boolean') {
      (internalSchema as any)['itunes:explicit'] = channel._microfeed['itunes:explicit'];
    }
    if (channel._microfeed['itunes:title']) {
      (internalSchema as any)['itunes:title'] = channel._microfeed['itunes:title'];
    }
    if (typeof channel._microfeed['itunes:block'] === 'boolean') {
      (internalSchema as any)['itunes:block'] = channel._microfeed['itunes:block'];
    }
    if (['episodic', 'serial'].includes(channel._microfeed['itunes:type'])) {
      (internalSchema as any)['itunes:type'] = channel._microfeed['itunes:type'];
    }
    if (channel._microfeed['copyright']) {
      (internalSchema as any)['copyright'] = channel._microfeed['copyright'];
    }
    if (channel._microfeed['itunes:email']) {
      (internalSchema as any)['itunes:email'] = channel._microfeed['itunes:email'];
    }
    return internalSchema;
  }

  async upsertItem(
    item: any,
    commit?: DatabaseMutationCommit<Record<string, unknown>>,
  ) {
    const itemId = item.id ? item.id : randomShortUUID();
    const guid = item.guid ? item.guid : itemId;
    this.feedContent.item = {
      ...this._publicToInternalSchemaForItem(item),
      id: itemId,
      guid,
    };
    await this.feedDb.putContent(
      {item: this.feedContent.item},
      commit
        ? (statements: D1PreparedStatement[]) =>
          commit(statements, this.feedContent.item)
        : undefined,
    );
    return itemId;
  }

  async saveInternalItem(
    item: any,
    commit?: DatabaseMutationCommit<Record<string, unknown>>,
  ) {
    this.feedContent.item = item;
    await this.feedDb.putContent(
      {item: this.feedContent.item},
      commit
        ? (statements: D1PreparedStatement[]) =>
          commit(statements, this.feedContent.item)
        : undefined,
    );
    return item.id;
  }

  /**
   * Assume it's primary channel for now
   * @param channel {Object}
   */
  async upsertChannel(
    channel: any,
    commit?: DatabaseMutationCommit<Record<string, unknown>>,
  ) {
    this.feedContent.channel = {
      ...this.feedContent.channel,
      ...this._publicToInternalSchemaForChannel(channel),
    };
    await this.feedDb.putContent(
      {channel: this.feedContent.channel},
      commit
        ? (statements: D1PreparedStatement[]) =>
          commit(statements, this.feedContent.channel)
        : undefined,
    );
    return this.feedContent.id;
  }
}
