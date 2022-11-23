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
}
