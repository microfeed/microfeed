// import {projectPrefix} from "../../common-src/R2Utils";
import {randomShortUUID} from "../../common-src/StringUtils";
import {STATUSES, PREDEFINED_SUBSCRIBE_METHODS, SETTINGS_CATEGORIES} from '../../common-src/Constants';

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

export default class FeedDb {
  constructor(env, request) {
    const {
      FEED_DB,
    } = env;
    this.FEED_DB = FEED_DB;

    const urlObj = new URL(request.url);
    this.baseUrl = urlObj.origin;
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
   *        'table': 'channels',
   *        'queryKwargs': {
   *          'status': STATUSES.PUBLISHED,
   *          'channel_type': PRIMARY,
   *        },
   *        {
   *          'table': 'settings',
   *          'queryKwargs': {
   *            ...
   *          }
   *        }
   *      }
   *    ]
   */
  async _getContent(things) {
    const batchStatements = [];
    things.forEach((thing) => {
      let sql = `SELECT * FROM ${thing.table}`;
      const whereList = [];
      const bindList = [];
      if (thing.queryKwargs) {
        Object.keys(thing.queryKwargs).forEach((kwargKey) => {
          whereList.push(`${kwargKey} = ?`);
          bindList.push(thing.queryKwargs[kwargKey]);
        })
      }
      if (whereList.length > 0) {
        sql = `${sql} WHERE ${whereList.join(' AND ')}`;
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
        })
      }
    }
    return contentJson;
  }

  async getContent(extraThings = []) {
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
      ...extraThings,
    ];

    let contentJson = await this._getContent(things);
    if (Object.keys(contentJson).length === 0) {
      contentJson = await this.initDb();
    }
    return contentJson;
  }

  _updateSetting(batchStatements, settings, category) {
    if (settings[category] && Object.keys(settings[category]).length > 0) {
      const {...data} = settings[category];
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

  async putContent(feed) {
    const {channel, settings} = feed;
    if (channel) {
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
    if (settings) {
      const categories = [
        SETTINGS_CATEGORIES.SUBSCRIBE_METHODS,
        SETTINGS_CATEGORIES.WEB_GLOBAL_SETTINGS,
        SETTINGS_CATEGORIES.ANALYTICS,
        SETTINGS_CATEGORIES.STYLES,
        SETTINGS_CATEGORIES.ACCESS,
      ];
      let batchStatements = [];
      const updatedCategories = [];
      categories.forEach((category) => {
        this._updateSetting(batchStatements, settings, category);
        updatedCategories.push(category);
      });
      let responses = await this.FEED_DB.batch(batchStatements);

      batchStatements = [];
      for (let i = 0; i < responses.length; i++) {
        const {results} = responses[i];
        if (results.changes === 0) {
          this._addSetting(batchStatements, settings, updatedCategories[i]);
        }
      }
      if (batchStatements.length > 0) {
        await this.FEED_DB.batch(batchStatements);
      }
    }
  }
}
