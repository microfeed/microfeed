// import {projectPrefix} from "../../common-src/R2Utils";
import {randomShortUUID} from "../../common-src/StringUtils";
import {
  STATUSES,
  PREDEFINED_SUBSCRIBE_METHODS,
  SETTINGS_CATEGORIES,
} from '../../common-src/Constants';
import {msToRFC3339, rfc3399ToMs} from "../../common-src/TimeUtils";
import FeedPublicJsonBuilder from "./FeedPublicJsonBuilder";

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
    const setList = [];
    Object.keys(keyValuePairs).forEach((key) => {
      setList.push(`${key} = ?`);
    });
    const bindList = Object.values(keyValuePairs);
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
      },
      [SETTINGS_CATEGORIES.ANALYTICS]: {},
      [SETTINGS_CATEGORIES.STYLES]: {},
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
      this.getInsertSql('settings', {
        'category': SETTINGS_CATEGORIES.SUBSCRIBE_METHODS,
        'data': JSON.stringify(settings[SETTINGS_CATEGORIES.SUBSCRIBE_METHODS]),
      }),
      this.getInsertSql('settings', {
        'category': SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
        'data': JSON.stringify(settings[SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS]),
      }),
      this.getInsertSql('channels', {
        'id': randomShortUUID(),
        'status': STATUSES.PUBLISHED,
        'is_primary': 1,
        'data': JSON.stringify(channel),
      }),
    ];

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
  async _getContent(things) {
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
          if (kwargKeyComponents.length > 0) {
            switch(kwargKeyComponents[1]) {
              case 'ne':
                op = '!=';
                break;
              default:
                break;
            }
          }
          whereList.push(`${key} ${op} ?`);
          bindList.push(thing.queryKwargs[kwargKey]);
        })
      }
      if (whereList.length > 0) {
        sql = `${sql} WHERE ${whereList.join(' AND ')}`;
      }
      if (thing.limit) {
        sql = `${sql} LIMIT ${thing.limit}`;
      }
      batchStatements.push(
        this.FEED_DB.prepare(sql).bind(...bindList)
      );
    });
    const responses = await this.FEED_DB.batch(batchStatements);
    const contentJson = {
      'channel': {},
      'items': [],
      'settings': {},
    };
    for (let i = 0; i < things.length; i++) {
      const response = responses[i];
      const thing = things[i];
      if (thing.table === 'settings') {
        response.results.forEach((result) => {
          contentJson['settings'][result.category] = getSettingJson(result);
        });
      } else if (thing.table === 'channels') {
        response.results.forEach((result) => {
          if (result.is_primary) {
            contentJson['channel'] = getChannelJson(result);
          }
        });
      } else if (thing.table === 'items') {
        response.results.forEach((result) => {
          contentJson['items'].push(getItemJson(result));
        });
      }
    }
    return contentJson;
  }

  async getContent(fetchItems = null) {
    const things = [
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

    if (fetchItems) {
      things.push({
        table: 'items',
        ...fetchItems,
      });
    }

    let contentJson = await this._getContent(things);
    if (Object.keys(contentJson).length === 0 || !contentJson.channel ||
      Object.keys(contentJson.channel).length === 0 || !contentJson.settings ||
      Object.keys(contentJson.settings).length === 0) {
      contentJson = await this.initDb();
    }
    return contentJson;
  }

  _updateSetting(batchStatements, updatedCategories, settings, category) {
    if (settings[category] && Object.keys(settings[category]).length > 0) {
      const {...data} = settings[category];
      updatedCategories.push(category);
      batchStatements.push(this.getUpdateSql(
        'settings',
        {
          category,
        },
        {
          data: JSON.stringify(data),
        },
      ));
      return category;
    }
  }

  _addSetting(batchStatements, settings, category) {
    if (settings[category] && Object.keys(settings[category]).length > 0) {
      const {...data} = settings[category];
      batchStatements.push(this.getInsertSql(
        'settings',
        {
          category,
          data: JSON.stringify(data),
        },
      ));
      return category;
    }
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
    // XXX: d1 is obviously not for prime time :(
    // This ugly "insert" then "update" pattern is for d1 alpha.
    let res;
    try {
      console.log('Trying to update...');
      res = await this.getUpdateSql(
        'settings',
        {
          category,
        },
        {
          data: JSON.stringify(settings[category]),
        },
      ).run();
    } catch (error) {
      console.log('Failed to update for ', category, error);
    }
    try {
      console.log('Trying to insert...', category);
      console.log(settings);
      res = await this.getInsertSql(
        'settings',
        {
          category,
          data: JSON.stringify(settings[category]),
        },
      ).run();
    } catch (error) {
      console.log('Failed to insert for ', category, error);
    }
    console.log('Done', res);
  }

  async _putSettingsToContent(settings) {
    Object.keys(settings).forEach((category) => {
      this._updateOrAddSetting(settings, category);
    });
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
      console.log('Inserting...')
      res = await this.getInsertSql('items', {
        id,
        ...keyValuePairs,
      }).run();
    } catch (error) {
      console.log('Failed to insert.', error);
    }
    try {
      console.log('Trying to update...', id);
      res = await this.getUpdateSql(
        'items',
        {
          id,
        },
        {
          ...keyValuePairs,
        },
      ).run();
    } catch (error) {
      console.log('Failed to update.', error);
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

  async getPublicJsonData(content=null) {
    if (!content) {
      content = await this.getContent();
    }
    const builder = new FeedPublicJsonBuilder(content, this.baseUrl);
    return builder.getJsonData();
  }
}
