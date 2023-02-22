import {randomShortUUID} from "../../common-src/StringUtils";
import {
  STATUSES, PREDEFINED_SUBSCRIBE_METHODS,
  SETTINGS_CATEGORIES, DEFAULT_ITEMS_PER_PAGE, ITEMS_SORT_ORDERS, MAX_ITEMS_PER_PAGE,
} from '../../common-src/Constants';
import {msToRFC3339, rfc3399ToMs} from "../../common-src/TimeUtils";
import FeedPublicJsonBuilder from "./FeedPublicJsonBuilder";

/**
 * support url query parameters:
 * - next_cursor: pub_date in milliseconds
 * - prev_cursor: pub_date in milliseconds
 * - sort: "oldest_first", or "newest_first" (default).
 *
 * if next_cursor and prev_cursor co-exist, we choose next_cursor and ignore prev_cursor
 *
 * Example: /json/?next_cursor=1669249854169&sort=oldest_first
 */
export function getFetchItemsParams(request, queryKwargs = {}, limit = null) {
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
    fetchItems.fromUrl.sortOrder = sortOrder;
  }
  if (nextCursor) {
    try {
      fetchItems.fromUrl.nextCursor = parseInt(nextCursor, 10);
    } catch (error) {
      console.log(error);
    }
  } else if (prevCursor) {
    try {
      fetchItems.fromUrl.prevCursor = parseInt(prevCursor, 10);
    } catch (error) {
      console.log(error);
    }
  }
  return fetchItems;
}

function getSettingJson(settingObj) {
  return {
    ...JSON.parse(settingObj.data),
  };
}

function getChannelJson(channelObj) {
  return {
    id: channelObj.id,
    status: channelObj.status,
    is_primary: channelObj.is_primary,
    ...JSON.parse(channelObj.data),
  };
}

function getItemJson(itemObj) {
  return {
    id: itemObj.id,
    status: itemObj.status,
    pubDateMs: rfc3399ToMs(itemObj.pub_date),
    ...JSON.parse(itemObj.data)
  };
}

export default class FeedDb {
  constructor(env, request) {
    this.FEED_DB = env.FEED_DB;

    const urlObj = new URL(request.url);
    this.baseUrl = urlObj.origin;

    this.request = request;
  }

  /**
   * INSERT INTO users (name, age) VALUES (?1, ?2)
   * UPDATE users SET name = ?1 WHERE id = ?2
   */
  getInsertSql(table, keyValuePairs) {
    let sql = `INSERT INTO ${table}`;
    const colList = Object.keys(keyValuePairs)
    const bindList = Object.values(keyValuePairs);
    const placeholderList = bindList.map(() => '?');
    sql = `${sql} (${colList.join(', ')}) VALUES (${placeholderList.join(', ')})`;
    return this.FEED_DB.prepare(sql).bind(...bindList)
  }

  getUpdateSql(table, queryKwargs, keyValuePairs) {
    let sql = `UPDATE ${table} SET`;
    const setList = ['updated_at = ?'];
    const bindList = [(new Date()).toISOString()];
    Object.keys(keyValuePairs).forEach((key) => {
      setList.push(`${key} = ?`);
      bindList.push(keyValuePairs[key]);
    });
    sql = `${sql} ${setList.join(', ')}`;
    if (queryKwargs && Object.keys(queryKwargs).length > 0) {
      const queryKeys = [];
      Object.keys(queryKwargs).forEach((queryKey) => {
        queryKeys.push(`${queryKey}=?`);
        bindList.push(queryKwargs[queryKey]);
      })
      sql = `${sql} WHERE ${queryKeys.join(' AND ')}`;
    }
    return this.FEED_DB.prepare(sql).bind(...bindList)
  }

  getUpsertSql(table, primaryKey, queryKwargs, keyValuePairs) {
    let updateSql = 'UPDATE SET';
    const setList = ['updated_at = ?'];
    const updateBindList = [(new Date()).toISOString()];
    Object.keys(keyValuePairs).forEach((key) => {
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
    };

    const batchStatements = [
      this.getInsertSql('channels', {
        'id': randomShortUUID(),
        'status': STATUSES.PUBLISHED,
        'is_primary': 1,
        'data': JSON.stringify(channel),
      }),
    ];

    Object.keys(settings).forEach((s) => {
      batchStatements.push(this.getInsertSql('settings', {
        'category': s,
        'data': JSON.stringify(settings[s]),
      }));
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
  async _getContent(things, sortOrder, fromUrl) {
    const batchStatements = [];
    things.forEach((thing) => {
      let sql = `SELECT * FROM ${thing.table}`;
      const whereList = [];
      const bindList = [];
      if (thing.queryKwargs) {
        Object.keys(thing.queryKwargs).forEach((kwargKey) => {
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
    const responses = await this.FEED_DB.batch(batchStatements);
    const contentJson = {};
    for (let i = 0; i < things.length; i++) {
      const response = responses[i];
      const thing = things[i];
      if (thing.table === 'settings') {
        contentJson.settings = {};
        response.results.forEach((result) => {
          contentJson['settings'][result.category] = getSettingJson(result);
        });
      } else if (thing.table === 'channels') {
        contentJson.channel = {};
        response.results.forEach((result) => {
          if (result.is_primary) {
            contentJson['channel'] = getChannelJson(result);
          }
        });
      } else if (thing.table === 'items') {
        let nextCursor;
        let prevCursor;
        contentJson['items'] = response.results.map((result) => getItemJson(result));
        if (sortOrder === ITEMS_SORT_ORDERS.NEWEST_FIRST) {
          contentJson['items'].sort((a, b) => (b.pubDateMs - a.pubDateMs));
        } else {
          contentJson['items'].sort((a, b) => (a.pubDateMs - b.pubDateMs));
        }
        contentJson['items'].forEach((itemJson) => {
          nextCursor = itemJson.pubDateMs;
          if (!prevCursor) {
            prevCursor = itemJson.pubDateMs;
          }
        });

        if (thing.limit <= contentJson['items'].length) {
          contentJson['items_next_cursor'] = nextCursor;
        }
        if (fromUrl.nextCursor || fromUrl.prevCursor) {
          contentJson['items_prev_cursor'] = prevCursor;
        }
      }
    }
    return contentJson;
  }

  async getContent(fetchItems = null) {
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
    if (Object.keys(contentJson).length === 0 || !contentJson.channel ||
      Object.keys(contentJson.channel).length === 0 || !contentJson.settings ||
      Object.keys(contentJson.settings).length === 0) {
      contentJson = await this.initDb();
    }

    let itemJson = {};
    if (fetchItems) {
      const webGlobalSettings = contentJson.settings.webGlobalSettings || {};

      const fromUrl = fetchItems.fromUrl || {};
      const queryKwargs = fetchItems.queryKwargs || {};
      const sortOrder = fromUrl.sortOrder || webGlobalSettings.itemsSortOrder || ITEMS_SORT_ORDERS.NEWEST_FIRST;
      const {nextCursor, prevCursor} = fromUrl;

      let orderBy = sortOrder === ITEMS_SORT_ORDERS.NEWEST_FIRST ?
        ['pub_date desc', 'id'] : ['pub_date', 'id'];
      if (nextCursor) {
        const queryParam = sortOrder === ITEMS_SORT_ORDERS.NEWEST_FIRST ? 'pub_date__<' : 'pub_date__>';
        try {
          queryKwargs[queryParam] = msToRFC3339(nextCursor);
        } catch (error) {
          console.log(error);
        }
      } else if (prevCursor) {
        orderBy = sortOrder === ITEMS_SORT_ORDERS.NEWEST_FIRST ? ['pub_date', 'id'] : ['pub_date desc', 'id'];
        const queryParam = sortOrder === ITEMS_SORT_ORDERS.NEWEST_FIRST ? 'pub_date__>' : 'pub_date__<';
        try {
          queryKwargs[queryParam] = msToRFC3339(prevCursor);
        } catch (error) {
          console.log(error);
        }
      }
      const fetchItemsParams = {
        limit: fetchItems.limit || webGlobalSettings.itemsPerPage || DEFAULT_ITEMS_PER_PAGE,
        orderBy,
        queryKwargs,
      };
      if (fetchItemsParams.limit > MAX_ITEMS_PER_PAGE) {
        fetchItemsParams.limit = MAX_ITEMS_PER_PAGE;
      }
      things = [{
        table: 'items',
        ...fetchItemsParams,
      }];
      itemJson = await this._getContent(things, sortOrder, fromUrl);
      itemJson['items_sort_order'] = sortOrder;
    }

    return {...contentJson, ...itemJson};
  }

  async _putChannelToContent(channel) {
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

  async _updateOrAddSetting(settings, category) {
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

  async _putSettingsToContent(settings) {
    for (const category of Object.keys(settings)) {
      await this._updateOrAddSetting(settings, category);
    }
  }

  async _putItemToContent(item) {
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

  async putContent(feed) {
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

  async getPublicJsonData(content=null, forOneItem=false) {
    if (!content) {
      content = await this.getContent();
    }
    const builder = new FeedPublicJsonBuilder(content, this.baseUrl, this.request, forOneItem);
    return builder.getJsonData();
  }
}
