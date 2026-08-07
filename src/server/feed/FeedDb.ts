import {randomShortUUID} from "@/shared/StringUtils";
import {
  STATUSES, PREDEFINED_SUBSCRIBE_METHODS,
  SETTINGS_CATEGORIES, DEFAULT_ITEMS_PER_PAGE, MAX_ITEMS_PER_PAGE,
} from '@/shared/Constants';
import {msToRFC3339, rfc3399ToMs} from "@/shared/TimeUtils";
import {
  encodeItemCursor,
  ITEM_ORDERS,
  ITEM_SORTS,
  type ItemOrder,
  type ItemSort,
  resolveItemPagination,
  resolveItemPaginationSettings,
  type ResolvedItemPagination,
} from "@/shared/ItemPagination";
import FeedPublicJsonBuilder from "./FeedPublicJsonBuilder";
import {
  publicCacheTagsForFeedUpdate,
  publicCacheTagsForImageTarget,
  type PublicCachePurger,
  purgePublicCache,
} from "@/server/cache/public-cache";
import type {FeedContent, ImageMetadataTarget} from "@/types";

/**
 * support url query parameters:
 * Canonical pagination uses sort=created_at|updated_at|published_at,
 * order=asc|desc, and Base64URL [timestamp, item ID] cursors. Explicit legacy
 * sort=newest_first|oldest_first requests keep numeric published timestamps.
 *
 * if next_cursor and prev_cursor co-exist, we choose next_cursor and ignore prev_cursor
 *
 * Example: /json/?sort=published_at&order=desc
 */
export function getFetchItemsParams(
  request: Request,
  queryKwargs: Record<string, any> = {},
  limit: number | null = null,
  defaultSort?: ItemSort,
  defaultOrder?: ItemOrder,
) {
  return {
    defaultOrder,
    defaultSort,
    queryKwargs,
    limit,
    searchParams: new URL(request.url).searchParams,
  };
}

function getSettingJson(settingObj: any) {
  return {
    ...JSON.parse(settingObj.data),
  };
}

function getChannelJson(channelObj: any) {
  return {
    id: channelObj.id,
    status: channelObj.status,
    is_primary: channelObj.is_primary,
    ...JSON.parse(channelObj.data),
  };
}

function getItemJson(itemObj: any) {
  return {
    createdAtMs: rfc3399ToMs(itemObj.created_at),
    id: itemObj.id,
    status: itemObj.status,
    pubDateMs: rfc3399ToMs(itemObj.pub_date),
    updatedAtMs: rfc3399ToMs(itemObj.updated_at),
    ...JSON.parse(itemObj.data)
  };
}

export default class FeedDb {
  [member: string]: any;

  constructor(
    runtimeEnv: Pick<
      Env,
      | "DEPLOYMENT_ENVIRONMENT"
      | "FEED_DB"
      | "MICROFEED_CLOUDFLARE_ACCOUNT_ID"
    >,
    request: Request,
    publicCachePurger?: PublicCachePurger,
  ) {
    this.FEED_DB = runtimeEnv.FEED_DB;
    this.publicCacheInvalidationEnabled =
      runtimeEnv.DEPLOYMENT_ENVIRONMENT !== "preview" &&
      Boolean(runtimeEnv.MICROFEED_CLOUDFLARE_ACCOUNT_ID?.trim()) &&
      publicCachePurger !== undefined;
    this.publicCachePurger = publicCachePurger;

    const urlObj = new URL(request.url);
    this.baseUrl = urlObj.origin;

    this.request = request;
  }

  /**
   * INSERT INTO users (name, age) VALUES (?1, ?2)
   * UPDATE users SET name = ?1 WHERE id = ?2
   */
  getInsertSql(
    table: any,
    keyValuePairs: any,
    ignoreConflicts: any = false,
  ) {
    let sql = `INSERT${ignoreConflicts ? " OR IGNORE" : ""} INTO ${table}`;
    const colList = Object.keys(keyValuePairs)
    const bindList = Object.values(keyValuePairs);
    const placeholderList = bindList.map(() => '?');
    sql = `${sql} (${colList.join(', ')}) VALUES (${placeholderList.join(', ')})`;
    return this.FEED_DB.prepare(sql).bind(...bindList)
  }

  getUpdateSql(table: any, queryKwargs: any, keyValuePairs: any) {
    let sql = `UPDATE ${table} SET`;
    const setList = ['updated_at = ?'];
    const bindList = [(new Date()).toISOString()];
    Object.keys(keyValuePairs).forEach((key: any) => {
      setList.push(`${key} = ?`);
      bindList.push(keyValuePairs[key]);
    });
    sql = `${sql} ${setList.join(', ')}`;
    if (queryKwargs && Object.keys(queryKwargs).length > 0) {
      const queryKeys: any[] = [];
      Object.keys(queryKwargs).forEach((queryKey: any) => {
        queryKeys.push(`${queryKey}=?`);
        bindList.push(queryKwargs[queryKey]);
      })
      sql = `${sql} WHERE ${queryKeys.join(' AND ')}`;
    }
    return this.FEED_DB.prepare(sql).bind(...bindList)
  }

  getUpsertSql(table: any, primaryKey: any, queryKwargs: any, keyValuePairs: any) {
    const timestamp = (new Date()).toISOString();
    let updateSql = 'UPDATE SET';
    const setList = ['updated_at = ?'];
    const updateBindList = [timestamp];
    Object.keys(keyValuePairs).forEach((key: any) => {
      setList.push(`${key} = ?`);
      updateBindList.push(keyValuePairs[key]);
    });
    updateSql = `${updateSql} ${setList.join(', ')}`;

    let insertSql = `INSERT INTO ${table}`;
    const insertKeyValuePairs = {
      created_at: timestamp,
      updated_at: timestamp,
      ...queryKwargs,
      ...keyValuePairs,
    };
    const colList = Object.keys(insertKeyValuePairs)
    const insertBindList = Object.values(insertKeyValuePairs);
    const placeholderList = insertBindList.map(() => '?');
    insertSql = `${insertSql} (${colList.join(', ')}) VALUES (${placeholderList.join(', ')})`;

    const sql = `${insertSql} ON CONFLICT(${primaryKey}) DO ${updateSql}`;
    return this.FEED_DB.prepare(sql).bind(...insertBindList, ...updateBindList);
  }

  async initDb() {
    const settings = {
      [SETTINGS_CATEGORIES.SUBSCRIBE_METHODS]: {
        methods: [
          {...PREDEFINED_SUBSCRIBE_METHODS.rss, id: randomShortUUID(), editable: false, enabled: true},
          {...PREDEFINED_SUBSCRIBE_METHODS.json, id: randomShortUUID(), editable: false, enabled: true},
        ],
      },
      [SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS]: {
        publicBucketUrl: '/media/',
        favicon: {
          'url': '/assets/default/favicon.png',
          'contentType': 'image/png',
        },
        'itemsOrder': ITEM_ORDERS.DESC,
        'itemsSort': ITEM_SORTS.PUBLISHED_AT,
        'itemsPerPage': DEFAULT_ITEMS_PER_PAGE,
      },
      [SETTINGS_CATEGORIES.ACCESS]: {
        currentPolicy: 'public',
      },
      [SETTINGS_CATEGORIES.ANALYTICS]: {},
      [SETTINGS_CATEGORIES.CUSTOM_CODE]: {},
    };
    const channel = {
      image: '/assets/default/channel-image.png',
      link: this.baseUrl,
      language: 'en-us',
      categories: [],
      'itunes:explicit': false,
      'itunes:type': 'episodic',
      'itunes:complete': false,
      'itunes:block': false,
      'copyright': `©${(new Date()).getFullYear()}`,
    };

    const batchStatements = [
      this.getInsertSql('channels', {
        'id': randomShortUUID(),
        'status': STATUSES.PUBLISHED,
        'is_primary': 1,
        'data': JSON.stringify(channel),
      }, true),
    ];

    Object.keys(settings).forEach((s: any) => {
      batchStatements.push(this.getInsertSql('settings', {
        'category': s,
        'data': JSON.stringify(settings[s]),
      }, true));
    })

    await this.FEED_DB.batch(batchStatements);

    return {
      channel,
      items: [],
      settings,
    };
  }

  /**
   *  An array like this:
   *    [
   *      {
   *        'table': 'channels',  // (required)
   *        'queryKwargs': {
   *          'status': STATUSES.PUBLISHED,
   *          'channel_type': PRIMARY,
   *        },  // (optional)
   *        'limit': 1   // (optional)
   *      }
   *      {
   *        'table': 'settings',
   *        'queryKwargs': {
   *          ...
   *        }
   *      }
   *   ]
   */
  async _getContent(
    things: any,
    pagination?: ResolvedItemPagination,
  ) {
    const batchStatements: any[] = [];
    things.forEach((thing: any) => {
      let sql = `SELECT * FROM ${thing.table}`;
      const whereList: any[] = [];
      const bindList: any[] = [];
      if (thing.queryKwargs) {
        Object.keys(thing.queryKwargs).forEach((kwargKey: any) => {
          const kwargKeyComponents = kwargKey.split('__');
          let key = kwargKeyComponents[0];
          let op = '==';
          if (kwargKeyComponents.length > 0 &&
            ['!=', '>', '<', '>=', '<=', '==', 'in'].includes(kwargKeyComponents[1])) {
            op = kwargKeyComponents[1];
          }
          if (op === 'in') {
            whereList.push(`${key} ${op} (${thing.queryKwargs[kwargKey].join(',')})`);
          } else {
            bindList.push(thing.queryKwargs[kwargKey]);
            whereList.push(`${key} ${op} ?`);
          }
        })
      }
      if (whereList.length > 0) {
        sql = `${sql} WHERE ${whereList.join(' AND ')}`;
      }
      if (thing.cursor) {
        const cursorClause = `(${thing.cursor.column} ${thing.cursor.timestampOp} ? OR (` +
          `${thing.cursor.column} == ? AND id ${thing.cursor.idOp} ?))`;
        sql = `${sql}${whereList.length > 0 ? " AND" : " WHERE"} ${cursorClause}`;
        bindList.push(
          thing.cursor.timestamp,
          thing.cursor.timestamp,
          thing.cursor.id,
        );
      }
      if (thing.orderBy && thing.orderBy.length > 0) {
        sql = `${sql} ORDER BY ${thing.orderBy.join(',')}`
      }
      if (thing.limit) {
        sql = `${sql} LIMIT ${thing.limit}`;
      }
      batchStatements.push(
        this.FEED_DB.prepare(sql).bind(...bindList)
      );
    });
    const responses: any[] = await this.FEED_DB.batch(batchStatements);
    const contentJson = {};
    for (let i = 0; i < things.length; i++) {
      const response = responses[i];
      const thing = things[i];
      if (thing.table === 'settings') {
        (contentJson as any).settings = {};
        response.results.forEach((result: any) => {
          (contentJson as any)['settings'][result.category] = getSettingJson(result);
        });
      } else if (thing.table === 'channels') {
        (contentJson as any).channel = {};
        response.results.forEach((result: any) => {
          if (result.is_primary) {
            (contentJson as any)['channel'] = getChannelJson(result);
          }
        });
      } else if (thing.table === 'items') {
        const hasLookahead = thing.pageLimit !== undefined &&
          response.results.length > thing.pageLimit;
        const pageResults = hasLookahead
          ? response.results.slice(0, thing.pageLimit)
          : response.results;
        (contentJson as any)['items'] = pageResults.map((result: any) => getItemJson(result));
        if (pagination?.prevCursor !== undefined) {
          (contentJson as any)['items'].reverse();
        }

        const hasItems = (contentJson as any)['items'].length > 0;
        const requestedNextPage = pagination?.nextCursor !== undefined;
        const requestedPreviousPage = pagination?.prevCursor !== undefined;
        const hasNextPage = hasItems && (
          requestedPreviousPage ||
          (!requestedPreviousPage && hasLookahead)
        );
        const hasPreviousPage = hasItems && (
          requestedNextPage ||
          (requestedPreviousPage && hasLookahead)
        );
        const firstItem = (contentJson as any)['items'][0];
        const lastItem = (contentJson as any)['items'].at(-1);
        const cursorForItem = (item: any) => pagination?.mode === "legacy"
          ? item?.pubDateMs
          : encodeItemCursor(
            item?.[pagination?.timestampKey ?? "pubDateMs"],
            item?.id,
          );
        if (hasNextPage) {
          (contentJson as any)['items_next_cursor'] = cursorForItem(lastItem);
        }
        if (hasPreviousPage) {
          (contentJson as any)['items_prev_cursor'] = cursorForItem(firstItem);
        }
        if (pagination?.mode === "legacy") {
          (contentJson as any)['items_sort_order'] = pagination.legacySort;
        } else if (pagination) {
          (contentJson as any)['items_sort'] = pagination.sort;
          (contentJson as any)['items_order'] = pagination.order;
        }
      }
    }
    return contentJson;
  }

  async getContent(fetchItems: any = null): Promise<any> {
    let things = [
      {
        table: 'channels',
        queryKwargs: {
          status: STATUSES.PUBLISHED,
          is_primary: 1,
        },
      },
      {
        table: 'settings',
      },
    ];

    let contentJson = await this._getContent(things);
    if (Object.keys(contentJson).length === 0 || !(contentJson as any).channel ||
      Object.keys((contentJson as any).channel).length === 0 || !(contentJson as any).settings ||
      Object.keys((contentJson as any).settings).length === 0) {
      contentJson = await this.initDb();
    }

    let itemJson = {};
    if (fetchItems) {
      const webGlobalSettings = (contentJson as any).settings.webGlobalSettings || {};

      const savedPagination = resolveItemPaginationSettings(webGlobalSettings);
      const pagination = resolveItemPagination(
        fetchItems.searchParams ?? new URLSearchParams(),
        {
          order: fetchItems.defaultOrder ?? savedPagination.itemsOrder,
          sort: fetchItems.defaultSort ?? savedPagination.itemsSort,
        },
      );
      const queryKwargs = {...(fetchItems.queryKwargs || {})};
      const requestedCursor = pagination.nextCursor ?? pagination.prevCursor;
      const previousPage = pagination.prevCursor !== undefined;
      const displayDescending = pagination.order === ITEM_ORDERS.DESC;
      const queryDescending = previousPage
        ? !displayDescending
        : displayDescending;
      const queryDirection = queryDescending ? "desc" : "asc";
      const cursorDirection = previousPage
        ? displayDescending ? ">" : "<"
        : displayDescending ? "<" : ">";
      const orderBy = pagination.mode === "legacy"
        ? [
            `${pagination.column} ${queryDirection}`,
            `id ${previousPage ? "desc" : "asc"}`,
          ]
        : [
            `${pagination.column} ${queryDirection}`,
            `id ${queryDirection}`,
          ];
      let cursor;
      if (requestedCursor !== undefined) {
        try {
          if (pagination.mode === "legacy" && typeof requestedCursor === "number") {
            queryKwargs[`${pagination.column}__${cursorDirection}`] =
              msToRFC3339(requestedCursor);
          } else if (typeof requestedCursor === "object") {
            cursor = {
              column: pagination.column,
              id: requestedCursor.id,
              idOp: cursorDirection,
              timestamp: msToRFC3339(requestedCursor.timestamp),
              timestampOp: cursorDirection,
            };
          }
        } catch (error) {
          console.log(error);
        }
      }
      const fetchItemsParams = {
        cursor,
        limit: fetchItems.limit || webGlobalSettings.itemsPerPage || DEFAULT_ITEMS_PER_PAGE,
        orderBy,
        queryKwargs,
      };

      if (fetchItemsParams.limit < 0) {
        fetchItemsParams.limit = undefined;
      } else if (fetchItemsParams.limit > MAX_ITEMS_PER_PAGE) {
        fetchItemsParams.limit = MAX_ITEMS_PER_PAGE;
      }
      const pageLimit = fetchItemsParams.limit;
      const queryLimit = pageLimit === undefined ? undefined : pageLimit + 1;
      itemJson = await this._getContent(
        [{
          table: 'items',
          ...fetchItemsParams,
          limit: queryLimit,
          pageLimit,
        }],
        pagination,
      );
    }

    return {...contentJson, ...itemJson};
  }

  async getItemById(
    id: string,
    statuses: number[] = [
      STATUSES.PUBLISHED,
      STATUSES.UNLISTED,
      STATUSES.UNPUBLISHED,
    ],
  ): Promise<Record<string, any> | null> {
    const placeholders = statuses.map(() => "?").join(", ");
    const row = await this.FEED_DB.prepare(
      `SELECT * FROM items WHERE id = ? AND status IN (${placeholders}) LIMIT 1`,
    ).bind(id, ...statuses).first();
    return row ? getItemJson(row) : null;
  }

  async _putChannelToContent(channel: any) {
    const {id, status, is_primary, ...data} = channel;
    const batchStatements = [];
    batchStatements.push(this.getUpdateSql(
      'channels',
      {
        id,
      },
      {
        status,
        'is_primary': is_primary,
        data: JSON.stringify(data),
      },
    ));
    await this.FEED_DB.batch(batchStatements);
  }

  async _updateOrAddSetting(settings: any, category: any) {
    let res;
    try {
      res = await this.getUpsertSql(
        'settings',
        'category',
        {category},
        {
          data: JSON.stringify(settings[category]),
        }).run();
    } catch (error) {
      console.error('Failed to upsert setting', error);
      throw error;
    }
    console.log('Done', res);
  }

  async _putSettingsToContent(settings: any) {
    for (const category of Object.keys(settings)) {
      await this._updateOrAddSetting(settings, category);
    }
  }

  async _putItemToContent(item: any) {
    const {createdAtMs: _createdAtMs, id, pubDateMs, status, updatedAtMs: _updatedAtMs, ...data} = item;
    const keyValuePairs = {
      status,
      'pub_date': msToRFC3339(pubDateMs),
      data: JSON.stringify(data),
    };
    let res;
    try {
      res = await this.getUpsertSql(
        'items', 'id', {id}, {...keyValuePairs}).run();
    } catch (error) {
      console.error('Failed to upsert item', error);
      throw error;
    }
    console.log('Done!', res);
  }

  async _purgePublicCacheTags(tags: string[]) {
    if (!this.publicCacheInvalidationEnabled) return;
    await purgePublicCache(tags, this.publicCachePurger);
  }

  async putContent(feed: FeedContent) {
    const {channel, settings, item} = feed;
    const cacheTags = publicCacheTagsForFeedUpdate(feed);
    try {
      if (channel) {
        await this._putChannelToContent(channel);
      }

      if (settings) {
        await this._putSettingsToContent(settings);
      }

      if (item) {
        await this._putItemToContent(item);
      }
    } catch (error) {
      await this._purgePublicCacheTags(cacheTags);
      throw error;
    }
    await this._purgePublicCacheTags(cacheTags);
  }

  async removeImageMetadata(
    target: ImageMetadataTarget,
  ): Promise<string | null> {
    const timestamp = new Date().toISOString();
    let select;
    let update;
    if (target.type === "channel") {
      if (target.id) {
        select = this.FEED_DB.prepare(
          "SELECT json_extract(data, '$.image') AS image_url " +
            "FROM channels WHERE id = ? LIMIT 1",
        ).bind(target.id);
        update = this.FEED_DB.prepare(
          "UPDATE channels SET updated_at = ?, " +
            "data = json_remove(data, '$.image') WHERE id = ?",
        ).bind(timestamp, target.id);
      } else {
        select = this.FEED_DB.prepare(
          "SELECT json_extract(data, '$.image') AS image_url " +
            "FROM channels WHERE is_primary = 1 LIMIT 1",
        );
        update = this.FEED_DB.prepare(
          "UPDATE channels SET updated_at = ?, " +
            "data = json_remove(data, '$.image') WHERE is_primary = 1",
        ).bind(timestamp);
      }
    } else if (target.type === "item") {
      select = this.FEED_DB.prepare(
        "SELECT json_extract(data, '$.image') AS image_url " +
          "FROM items WHERE id = ? LIMIT 1",
      ).bind(target.id);
      update = this.FEED_DB.prepare(
        "UPDATE items SET updated_at = ?, " +
          "data = json_remove(data, '$.image') WHERE id = ?",
      ).bind(timestamp, target.id);
    } else {
      const category = SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS;
      select = this.FEED_DB.prepare(
        "SELECT json_extract(data, '$.favicon.url') AS image_url " +
          "FROM settings WHERE category = ? LIMIT 1",
      ).bind(category);
      update = this.FEED_DB.prepare(
        "UPDATE settings SET updated_at = ?, " +
          "data = json_remove(data, '$.favicon') WHERE category = ?",
      ).bind(timestamp, category);
    }

    const [selected] = await this.FEED_DB.batch([select, update]);
    await this._purgePublicCacheTags(
      publicCacheTagsForImageTarget(target),
    );
    const imageUrl = selected.results[0]?.image_url;
    return typeof imageUrl === "string" ? imageUrl : null;
  }

  async getPublicJsonData(
    content: any = null,
    forOneItem: any = false,
  ): Promise<any> {
    if (!content) {
      content = await this.getContent();
    }
    const builder = new FeedPublicJsonBuilder(content, this.baseUrl, this.request, forOneItem);
    return builder.getJsonData();
  }
}
