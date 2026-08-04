import {randomShortUUID} from "@/shared/StringUtils";
import {
  STATUSES, PREDEFINED_SUBSCRIBE_METHODS,
  SETTINGS_CATEGORIES, DEFAULT_ITEMS_PER_PAGE, ITEMS_SORT_ORDERS, MAX_ITEMS_PER_PAGE,
} from '@/shared/Constants';
import {msToRFC3339, rfc3399ToMs} from "@/shared/TimeUtils";
import {
  decodeItemListCursor,
  encodeItemListCursor,
  ITEM_LIST_SORT_ORDERS,
  itemListSortDefinition,
} from "@/shared/ItemList";
import FeedPublicJsonBuilder from "./FeedPublicJsonBuilder";

/**
 * support url query parameters:
 * - next_cursor: selected sort timestamp in milliseconds
 * - prev_cursor: selected sort timestamp in milliseconds
 * - sort: "oldest_first", "newest_first", "updated_asc", or "updated_desc".
 *
 * if next_cursor and prev_cursor co-exist, we choose next_cursor and ignore prev_cursor
 *
 * Example: /json/?next_cursor=1669249854169&sort=oldest_first
 */
export function getFetchItemsParams(
  request: Request,
  queryKwargs: Record<string, any> = {},
  limit: number | null = null,
  defaultSortOrder?: string,
) {
  const fetchItems = {
    queryKwargs,
    fromUrl: {},
    limit,
  };

  const { searchParams } = new URL(request.url)
  const nextCursor = searchParams.get('next_cursor');
  const prevCursor = searchParams.get('prev_cursor');
  const sortOrder = searchParams.get('sort');
  if (sortOrder) {
    (fetchItems.fromUrl as any).sortOrder = sortOrder;
  } else if (defaultSortOrder) {
    (fetchItems.fromUrl as any).sortOrder = defaultSortOrder;
  }
  if (nextCursor) {
    const decodedCursor = decodeItemListCursor(nextCursor);
    const numericCursor = Number(nextCursor);
    if (decodedCursor || Number.isFinite(numericCursor)) {
      (fetchItems.fromUrl as any).nextCursor = decodedCursor ?? numericCursor;
    }
  } else if (prevCursor) {
    const decodedCursor = decodeItemListCursor(prevCursor);
    const numericCursor = Number(prevCursor);
    if (decodedCursor || Number.isFinite(numericCursor)) {
      (fetchItems.fromUrl as any).prevCursor = decodedCursor ?? numericCursor;
    }
  }
  return fetchItems;
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
    id: itemObj.id,
    status: itemObj.status,
    pubDateMs: rfc3399ToMs(itemObj.pub_date),
    updatedAtMs: rfc3399ToMs(itemObj.updated_at),
    ...JSON.parse(itemObj.data)
  };
}

export default class FeedDb {
  [member: string]: any;

  constructor(env: Pick<Env, "FEED_DB">, request: Request) {
    this.FEED_DB = env.FEED_DB;

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
    let updateSql = 'UPDATE SET';
    const setList = ['updated_at = ?'];
    const updateBindList = [(new Date()).toISOString()];
    Object.keys(keyValuePairs).forEach((key: any) => {
      setList.push(`${key} = ?`);
      updateBindList.push(keyValuePairs[key]);
    });
    updateSql = `${updateSql} ${setList.join(', ')}`;

    let insertSql = `INSERT INTO ${table}`;
    const insertKeyValuePairs = {...queryKwargs, ...keyValuePairs};
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
        'itemsSortOrder': ITEMS_SORT_ORDERS.NEWEST_FIRST,
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
  async _getContent(things: any, sortOrder?: any, fromUrl?: any) {
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
        let nextCursor;
        let prevCursor: any;
        const sort = itemListSortDefinition(
          sortOrder,
          ITEM_LIST_SORT_ORDERS.PUBLISHED_DESC,
        );
        (contentJson as any)['items'] = response.results.map((result: any) => getItemJson(result));
        (contentJson as any)['items'].sort((a: any, b: any) => {
          const timestampDifference = sort.descending
            ? b[sort.timestampKey] - a[sort.timestampKey]
            : a[sort.timestampKey] - b[sort.timestampKey];
          return timestampDifference || a.id.localeCompare(b.id);
        });
        (contentJson as any)['items'].forEach((itemJson: any) => {
          nextCursor = sort.column === "updated_at"
            ? encodeItemListCursor(itemJson[sort.timestampKey], itemJson.id)
            : itemJson[sort.timestampKey];
          if (!prevCursor) {
            prevCursor = nextCursor;
          }
        });

        if (thing.limit <= (contentJson as any)['items'].length) {
          (contentJson as any)['items_next_cursor'] = nextCursor;
        }
        if (fromUrl.nextCursor || fromUrl.prevCursor) {
          (contentJson as any)['items_prev_cursor'] = prevCursor;
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

      const fromUrl = fetchItems.fromUrl || {};
      const queryKwargs = fetchItems.queryKwargs || {};
      const sort = itemListSortDefinition(
        fromUrl.sortOrder || webGlobalSettings.itemsSortOrder,
        ITEM_LIST_SORT_ORDERS.PUBLISHED_DESC,
      );
      const sortOrder = sort.order;
      const {nextCursor, prevCursor} = fromUrl;
      const compoundNextCursor = sort.column === "updated_at" &&
          typeof nextCursor === "object"
        ? nextCursor
        : undefined;
      const compoundPrevCursor = sort.column === "updated_at" &&
          typeof prevCursor === "object"
        ? prevCursor
        : undefined;

      let orderBy = [
        `${sort.column}${sort.descending ? " desc" : ""}`,
        'id',
      ];
      if (nextCursor) {
        const queryParam = `${sort.column}__${sort.descending ? '<' : '>'}`;
        try {
          if (!compoundNextCursor) {
            queryKwargs[queryParam] = msToRFC3339(nextCursor);
          }
        } catch (error) {
          console.log(error);
        }
      } else if (prevCursor) {
        orderBy = [
          `${sort.column}${sort.descending ? "" : " desc"}`,
          'id desc',
        ];
        const queryParam = `${sort.column}__${sort.descending ? '>' : '<'}`;
        try {
          if (!compoundPrevCursor) {
            queryKwargs[queryParam] = msToRFC3339(prevCursor);
          }
        } catch (error) {
          console.log(error);
        }
      }
      const fetchItemsParams = {
        cursor: compoundNextCursor
          ? {
              column: sort.column,
              id: compoundNextCursor.id,
              idOp: ">",
              timestamp: msToRFC3339(compoundNextCursor.timestamp),
              timestampOp: sort.descending ? "<" : ">",
            }
          : compoundPrevCursor
          ? {
              column: sort.column,
              id: compoundPrevCursor.id,
              idOp: "<",
              timestamp: msToRFC3339(compoundPrevCursor.timestamp),
              timestampOp: sort.descending ? ">" : "<",
            }
          : undefined,
        limit: fetchItems.limit || webGlobalSettings.itemsPerPage || DEFAULT_ITEMS_PER_PAGE,
        orderBy,
        queryKwargs,
      };

      if (fetchItemsParams.limit < 0) {
        fetchItemsParams.limit = undefined;
      } else if (fetchItemsParams.limit > MAX_ITEMS_PER_PAGE) {
        fetchItemsParams.limit = MAX_ITEMS_PER_PAGE;
      }
      things = [{
        table: 'items',
        ...fetchItemsParams,
      }];
      itemJson = await this._getContent(things, sortOrder, fromUrl);
      (itemJson as any)['items_sort_order'] = sortOrder;
    }

    return {...contentJson, ...itemJson};
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
      console.log('Failed to upsert', error);
    }
    console.log('Done', res);
  }

  async _putSettingsToContent(settings: any) {
    for (const category of Object.keys(settings)) {
      await this._updateOrAddSetting(settings, category);
    }
  }

  async _putItemToContent(item: any) {
    const {id, pubDateMs, status, ...data} = item;
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
      console.log('Failed to upsert', error);
    }
    console.log('Done!', res);
  }

  async putContent(feed: any) {
    const {channel, settings, item} = feed;
    if (channel) {
      await this._putChannelToContent(channel);
    }

    if (settings) {
      await this._putSettingsToContent(settings);
    }

    if (item) {
      await this._putItemToContent(item);
    }
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
