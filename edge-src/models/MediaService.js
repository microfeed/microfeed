import {randomShortUUID, toSlug} from "../../common-src/StringUtils";
import {categorizeMedia} from "../../common-src/MediaFileUtils";

// Derive a human title from an original filename or an object key (strip the
// directory + extension, turn separators into spaces).
function deriveTitle(nameOrKey) {
  if (!nameOrKey) {
    return "";
  }
  const base = String(nameOrKey).split("/").pop() || "";
  const noExt = base.replace(/\.[a-z0-9]+$/i, "");
  return noExt.replace(/[-_]+/g, " ").trim();
}

/**
 * Orchestrates the media inventory: dedup-aware registration of uploads,
 * reconciliation with the R2 bucket, on-demand usage computation, and
 * guarded deletion.
 *
 * Constructed with the repos it needs plus an injected media store (the R2
 * seam), so tests can supply a fake store capturing deleteObject/listObjects.
 */
export default class MediaService {
  constructor(
    {mediaRepo, itemRepo, channelRepo, settingsRepo} = {},
    mediaStore = null,
  ) {
    this.mediaRepo = mediaRepo;
    this.itemRepo = itemRepo;
    this.channelRepo = channelRepo;
    this.settingsRepo = settingsRepo;
    this.mediaStore = mediaStore;
  }

  /**
   * Register an uploaded object in the inventory. If a row with the same
   * content hash already exists, return that existing row's url (dedup) and
   * do NOT insert a duplicate. Otherwise insert a new row.
   */
  async registerUpload({hash, key, url, size, contentType, width, height, originalFilename, title, slug} = {}) {
    if (hash) {
      const existing = await this.mediaRepo.getByContentHash(hash);
      if (existing) {
        return {
          id: existing.id,
          url: existing.url,
          deduped: true,
        };
      }
    }

    // Also dedup on the r2 key so re-registering the same object is idempotent.
    if (key) {
      const existingByKey = await this.mediaRepo.getByR2Key(key);
      if (existingByKey) {
        return {
          id: existingByKey.id,
          url: existingByKey.url,
          deduped: true,
        };
      }
    }

    const id = randomShortUUID(11);
    const finalTitle = (title && title.trim()) || deriveTitle(originalFilename) || deriveTitle(key) || "file";
    const finalSlug = await this._uniqueSlug(slug || finalTitle);
    const category = categorizeMedia(originalFilename || key, contentType);
    await this.mediaRepo.insert({
      id,
      r2_key: key,
      url,
      title: finalTitle,
      slug: finalSlug,
      original_filename: originalFilename || null,
      content_hash: hash || null,
      size: size !== undefined && size !== null ? size : null,
      content_type: contentType || null,
      category,
      width: width !== undefined && width !== null ? width : null,
      height: height !== undefined && height !== null ? height : null,
    });

    return {
      id,
      url,
      title: finalTitle,
      slug: finalSlug,
      category,
      deduped: false,
    };
  }

  /**
   * Replace the bytes of an existing media object in place. The caller has
   * already PUT the new bytes to the SAME r2 object key, so every reference in
   * the project (which points at that unchanged url) now serves the new file.
   * Here we only refresh the row's derived metadata (hash/size/content type/
   * category). r2_key, url, title and slug are intentionally preserved so all
   * existing links keep working.
   */
  async replaceObject(id, {hash, size, contentType, width, height} = {}) {
    const row = await this.mediaRepo.getById(id);
    if (!row) {
      return {error: "not found"};
    }
    const category = categorizeMedia(row.original_filename || row.r2_key, contentType) || row.category;
    await this.mediaRepo.update(id, {
      content_hash: hash || null,
      size: size !== undefined && size !== null ? size : row.size,
      content_type: contentType || row.content_type,
      category,
      width: width !== undefined && width !== null ? width : row.width,
      height: height !== undefined && height !== null ? height : row.height,
    });
    return {
      id,
      url: row.url,
      category,
      width: width !== undefined && width !== null ? width : row.width,
      height: height !== undefined && height !== null ? height : row.height,
      replaced: true,
    };
  }

  /**
   * Produce a media slug that is unique across the inventory. Slugifies the
   * base, then appends -2, -3, … until no existing row owns it.
   */
  async _uniqueSlug(base, ignoreId = null) {
    const root = toSlug(base) || "image";
    let candidate = root;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.mediaRepo.getBySlug(candidate);
      if (!existing || existing.id === ignoreId) {
        return candidate;
      }
      n += 1;
      candidate = `${root}-${n}`;
    }
  }

  /**
   * Rename a media row: set a new title and (re-slugified, uniqueness-checked)
   * slug. Returns the updated {id, title, slug}.
   */
  async updateMeta(id, {title, slug} = {}) {
    const row = await this.mediaRepo.getById(id);
    if (!row) {
      return {error: "not found"};
    }
    const finalTitle = (title && title.trim()) || row.title || deriveTitle(row.original_filename) || "image";
    const finalSlug = await this._uniqueSlug(slug || finalTitle, id);
    await this.mediaRepo.update(id, {title: finalTitle, slug: finalSlug});
    return {id, title: finalTitle, slug: finalSlug};
  }

  /**
   * List the bucket and insert inventory rows for any objects not yet
   * recorded (backfill for pre-existing images). Objects are listed without
   * their bytes, so no content hash is available at reconcile time.
   */
  async reconcileFromR2() {
    if (!this.mediaStore || !this.mediaStore.listObjects) {
      return {added: []};
    }
    const objects = await this.mediaStore.listObjects();
    const added = [];
    for (const obj of objects) {
      if (!obj || !obj.key) {
        continue;
      }
      const existing = await this.mediaRepo.getByR2Key(obj.key);
      if (existing) {
        continue;
      }
      const id = randomShortUUID(11);
      const filename = String(obj.key).split("/").pop() || "";
      const title = deriveTitle(obj.key) || "file";
      const slug = await this._uniqueSlug(title);
      const category = categorizeMedia(obj.key);
      await this.mediaRepo.insert({
        id,
        r2_key: obj.key,
        // The internal url equals the r2 key (both include the project/env prefix).
        url: obj.key,
        title,
        slug,
        original_filename: filename,
        // No file bytes from a list call, so content hash is unknown.
        content_hash: null,
        size: obj.size !== undefined && obj.size !== null ? obj.size : null,
        content_type: null,
        category,
      });
      added.push({id, r2_key: obj.key, url: obj.key, title, slug, category});
    }
    return {added};
  }

  async _loadAllReferenceSources() {
    const items = this.itemRepo ? (await this.itemRepo.list()).results || [] : [];
    const channels = this.channelRepo ? (await this.channelRepo.list()).results || [] : [];
    const settings = this.settingsRepo ? (await this.settingsRepo.list()).results || [] : [];
    return {items, channels, settings};
  }

  /**
   * Scan all items.data, channels.data and settings.data JSON (including
   * rich-text HTML embedded inside those blobs) for occurrences of each media
   * url. Returns each media row annotated with `used` and `references`.
   *
   * Because every media url is matched as a substring of the serialized JSON
   * blob, this naturally covers top-level fields (e.g. `image`) AND urls
   * embedded inside rich-text HTML strings (e.g. `content_html`).
   */
  async computeUsage(mediaRows = null) {
    const rows = mediaRows || (await this.mediaRepo.listAll()).results || [];
    const {items, channels, settings} = await this._loadAllReferenceSources();

    const sources = [];
    items.forEach((row) => {
      sources.push({type: "item", id: row.id, label: this._itemLabel(row), data: row.data});
    });
    channels.forEach((row) => {
      sources.push({type: "channel", id: row.id, label: this._channelLabel(row), data: row.data});
    });
    settings.forEach((row) => {
      sources.push({type: "settings", id: row.category, label: row.category, data: row.data});
    });

    return rows.map((media) => {
      const references = [];
      const url = media.url;
      if (url) {
        sources.forEach((source) => {
          if (source.data && String(source.data).includes(url)) {
            references.push({type: source.type, id: source.id, label: source.label});
          }
        });
      }
      return {
        ...media,
        used: references.length > 0,
        references,
      };
    });
  }

  _itemLabel(row) {
    try {
      const data = JSON.parse(row.data || "{}");
      return data.title || row.slug || row.id;
    } catch (_) {
      return row.slug || row.id;
    }
  }

  _channelLabel(row) {
    try {
      const data = JSON.parse(row.data || "{}");
      return data.title || row.id;
    } catch (_) {
      return row.id;
    }
  }

  /**
   * Paginated inventory joined with computed usage, for the manager view.
   */
  async listWithUsage({page = 1, limit = 50, unusedOnly = false} = {}) {
    const withUsage = await this.computeUsage();
    const filtered = unusedOnly ? withUsage.filter((row) => !row.used) : withUsage;
    const safeLimit = Math.max(1, limit);
    const safePage = Math.max(1, page);
    const start = (safePage - 1) * safeLimit;
    const pageRows = filtered.slice(start, start + safeLimit);
    return {
      results: pageRows,
      page: safePage,
      limit: safeLimit,
      total: filtered.length,
      hasMore: start + safeLimit < filtered.length,
    };
  }

  /**
   * Delete the given media ids, but only if they are unused. Usage is
   * recomputed here (delete-time guard) to avoid a race with a concurrent
   * edit. For each unused id, delete the R2 object then remove the row.
   */
  async deleteUnused(ids = []) {
    const deleted = [];
    const refused = [];
    if (!ids || ids.length === 0) {
      return {deleted, refused};
    }

    const withUsage = await this.computeUsage();
    const usageById = new Map(withUsage.map((row) => [row.id, row]));

    for (const id of ids) {
      const row = usageById.get(id) || (await this.mediaRepo.getById(id));
      if (!row) {
        refused.push({id, reason: "not found"});
        continue;
      }
      const annotated = usageById.get(id);
      if (annotated && annotated.used) {
        refused.push({id, reason: "used"});
        continue;
      }
      if (this.mediaStore && this.mediaStore.deleteObject) {
        await this.mediaStore.deleteObject(row.url);
      }
      await this.mediaRepo.delete(id);
      deleted.push(id);
    }

    return {deleted, refused};
  }

  /**
   * Delete a single media id with the same unused guard.
   */
  async delete(id) {
    return this.deleteUnused([id]);
  }
}

export function createMediaService(env, db, mediaStore) {
  // Lazy requires to keep this factory usable from edge functions.
  const MediaRepo = require("./MediaRepo").default;
  const ItemRepo = require("./ItemRepo").default;
  const ChannelRepo = require("./ChannelRepo").default;
  const SettingsRepo = require("./SettingsRepo").default;
  return new MediaService(
    {
      mediaRepo: new MediaRepo(db),
      itemRepo: new ItemRepo(db),
      channelRepo: new ChannelRepo(db),
      settingsRepo: new SettingsRepo(db),
    },
    mediaStore,
  );
}
