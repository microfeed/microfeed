import {buildItemSlug, randomShortUUID} from "../../common-src/StringUtils";
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
    typeId: itemObj.type_id,
    primaryCategoryId: itemObj.primary_category_id,
    secondaryCategoryId: itemObj.secondary_category_id,
    itunesSeriesId: itemObj.itunes_series_id,
    slug: itemObj.slug,
    seoTitle: itemObj.seo_title,
    seoDescription: itemObj.seo_description,
    canonicalUrl: itemObj.canonical_url,
    noindex: !!itemObj.noindex,
    ogImage: itemObj.og_image,
    createdAt: itemObj.created_at,
    updatedAt: itemObj.updated_at,
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
      'copyright': `©${(new Date()).getFullYear()}`,
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

    const defaultItemTypes = [
      {name: 'Podcast', slug: 'podcast', description: '', sort_order: 1},
      {name: 'Video', slug: 'video', description: '', sort_order: 2},
      {name: 'Blog Post', slug: 'blog-post', description: '', sort_order: 3},
      {name: 'Static Page', slug: 'static-page', description: '', sort_order: 4},
    ];
    defaultItemTypes.forEach((type) => {
      batchStatements.push(this.getInsertSql('item_types', {
        name: type.name,
        slug: type.slug,
        description: type.description,
        sort_order: type.sort_order,
      }));
    });

    batchStatements.push(this.getInsertSql('site_seo', {
      id: 1,
      site_name: '',
      default_title: '',
      default_description: '',
      default_og_image: '',
      twitter_handle: '',
      logo_url: '',
      language: '',
    }));

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
      } else if (thing.table === 'item_types') {
        contentJson.itemTypes = response.results.map((result) => ({
          id: result.id,
          name: result.name,
          slug: result.slug,
          description: result.description,
          sortOrder: result.sort_order,
          createdAt: result.created_at,
          updatedAt: result.updated_at,
        }));
      } else if (thing.table === 'categories') {
        contentJson.categories = response.results.map((result) => ({
          id: result.id,
          name: result.name,
          slug: result.slug,
          parentId: result.parent_id,
          description: result.description,
          sortOrder: result.sort_order,
          createdAt: result.created_at,
          updatedAt: result.updated_at,
        }));
      } else if (thing.table === 'site_seo') {
        const siteSeo = response.results && response.results.length > 0 ? response.results[0] : null;
        contentJson.siteSeo = siteSeo ? {
          id: siteSeo.id,
          siteName: siteSeo.site_name,
          defaultTitle: siteSeo.default_title,
          defaultDescription: siteSeo.default_description,
          defaultOgImage: siteSeo.default_og_image,
          twitterHandle: siteSeo.twitter_handle,
          logoUrl: siteSeo.logo_url,
          language: siteSeo.language,
          createdAt: siteSeo.created_at,
          updatedAt: siteSeo.updated_at,
        } : {};
      } else if (thing.table === 'itunes_series') {
        contentJson.itunesSeries = response.results.map((result) => ({
          id: result.id,
          name: result.name,
          slug: result.slug,
          description: result.description,
          image: result.image,
          sortOrder: result.sort_order,
          createdAt: result.created_at,
          updatedAt: result.updated_at,
        }));
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
      {
        table: 'item_types',
        orderBy: ['sort_order', 'id'],
      },
      {
        table: 'categories',
        orderBy: ['sort_order', 'id'],
      },
      {
        table: 'site_seo',
        limit: 1,
      },
      {
        table: 'itunes_series',
        orderBy: ['sort_order', 'id'],
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
    const {
      id,
      pubDateMs,
      status,
      typeId,
      primaryCategoryId,
      secondaryCategoryId,
      itunesSeriesId,
      slug,
      seoTitle,
      seoDescription,
      canonicalUrl,
      noindex,
      ogImage,
      ...data
    } = item;
    let finalSlug = slug;
    if (!finalSlug && data.title) {
      finalSlug = buildItemSlug(data.title);
    } else if (finalSlug) {
      finalSlug = buildItemSlug(finalSlug);
    }
    const keyValuePairs = {
      status,
      type_id: typeId,
      primary_category_id: primaryCategoryId,
      secondary_category_id: secondaryCategoryId,
      itunes_series_id: itunesSeriesId,
      slug: finalSlug,
      seo_title: seoTitle,
      seo_description: seoDescription,
      canonical_url: canonicalUrl,
      noindex: typeof noindex === 'boolean' ? (noindex ? 1 : 0) : (noindex ? 1 : 0),
      og_image: ogImage,
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

  async getItemTypeBySlug(slug) {
    if (!slug) {
      return null;
    }
    const res = await this.FEED_DB.prepare(
      'SELECT * FROM item_types WHERE slug = ? LIMIT 1'
    ).bind(slug).all();
    return res && res.results && res.results.length > 0 ? res.results[0] : null;
  }

  async deleteItemById(itemId) {
    return await this.FEED_DB.prepare('DELETE FROM items WHERE id = ?').bind(itemId).run();
  }
}
