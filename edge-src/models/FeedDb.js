// import {projectPrefix} from "../../common-src/R2Utils";
import {buildAudioUrlWithTracking, PUBLIC_URLS, randomShortUUID} from "../../common-src/StringUtils";
import {
  STATUSES,
  PREDEFINED_SUBSCRIBE_METHODS,
  SETTINGS_CATEGORIES,
  ENCLOSURE_CATEGORIES, ITEM_STATUSES
} from '../../common-src/Constants';
import {humanizeMs, msToRFC3339} from "../../common-src/TimeUtils";
import {convert} from "html-to-text";

const DEFAULT_MICROFEED_VERSION = 'v1';

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

class FeedPublicJsonBuilder {
  constructor(content, request) {
    this.content = content;
    this.request = request;
    this.settings = content.settings || {};
    this.webGlobalSettings = this.settings.webGlobalSettings || {};
    this.publicBucketUrl = this.webGlobalSettings.publicBucketUrl || '';

    const urlObj = new URL(this.request.url);
    this.baseUrl = urlObj.origin;
  }

  _decorateForItem(itemId, item, baseUrl) {
    item.webUrl = PUBLIC_URLS.webItem(itemId, item.title, baseUrl);
    item.pubDate = humanizeMs(item.pubDateMs);
    item.pubDateRfc3339 = msToRFC3339(item.pubDateMs);
    item.descriptionText = convert(item.description, {});

    if (item.image) {
      item.image = `${this.publicBucketUrl}/${item.image}`;
    }
    if (item.mediaFile && item.mediaFile.category) {
      item.mediaFile.isAudio = item.mediaFile.category === ENCLOSURE_CATEGORIES.AUDIO;
      item.mediaFile.isDocument = item.mediaFile.category === ENCLOSURE_CATEGORIES.DOCUMENT;
      item.mediaFile.isExternalUrl = item.mediaFile.category === ENCLOSURE_CATEGORIES.EXTERNAL_URL;
      item.mediaFile.isVideo = item.mediaFile.category === ENCLOSURE_CATEGORIES.VIDEO;
      item.mediaFile.isImage = item.mediaFile.category === ENCLOSURE_CATEGORIES.IMAGE;

      if (!item.mediaFile.isExternalUrl) {
        item.mediaFile.url = `${this.publicBucketUrl}/${item.mediaFile.url}`;
      }
    }
  }

  _buildPublicContentChannel() {
    const channel = this.content.channel || {};
    const publicContent = {};
    publicContent['title'] = channel.title || 'untitled';

    if (channel.link) {
      publicContent['home_page_url'] = channel.link;
    }

    publicContent['feed_url'] = PUBLIC_URLS.jsonFeed(this.baseUrl);

    if (channel.description) {
      publicContent['description'] = channel.description;
    }

    if (channel.image) {
      publicContent['icon'] = `${this.publicBucketUrl}/${channel.image}`;
    }

    if (this.webGlobalSettings.favicon) {
      publicContent['favicon'] = `${this.publicBucketUrl}/${this.webGlobalSettings.favicon.url}`;
    }

    if (channel.publisher) {
      publicContent['authors'] = [{
        'name': channel.publisher,
      }];
    }

    if (channel.language) {
      publicContent['language'] = channel.language;
    }

    if (channel['itunes:complete']) {
      publicContent['expired'] = true;
    }
    return publicContent;
  }

  _buildPublicContentMicrofeedExtra() {
    const channel = this.content.channel || {};
    const subscribeMethods = this.settings.subscribeMethods || {'methods': []};
    const microfeedExtra = {
      microfeed_version: this.content.microfeed_version || DEFAULT_MICROFEED_VERSION,
      categories: channel.categories || [],
    };
    if (!subscribeMethods.methods) {
      microfeedExtra['subscribe_methods'] = '';
    } else {
      microfeedExtra['subscribe_methods'] = subscribeMethods.methods.filter((m) => m.enabled).map((m) => {
        if (!m.editable) {
          switch (m.type) {
            case 'rss':
              m.url = PUBLIC_URLS.rssFeed();
              return m;
            case 'json':
              m.url = PUBLIC_URLS.jsonFeed();
              return m;
            default:
              return m;
          }
        }
        return m;
      });
    }
    if (channel['itunes:explicit']) {
      microfeedExtra['itunes:explicit'] = true;
    }
    if (channel['itunes:title']) {
      microfeedExtra['itunes:title'] = channel['itunes:title'];
    }
    if (channel['copyright']) {
      microfeedExtra['copyright'] = channel['copyright'];
    }
    if (channel['itunes:title']) {
      microfeedExtra['itunes:title'] = channel['itunes:title'];
    }
    if (channel['itunes:type']) {
      microfeedExtra['itunes:type'] = channel['itunes:type'];
    }
    if (channel['itunes:block']) {
      microfeedExtra['itunes:block'] = channel['itunes:block'];
    }
    if (channel['itunes:complete']) {
      microfeedExtra['itunes:complete'] = channel['itunes:complete'];
    }
    if (channel['itunes:new-feed-url']) {
      microfeedExtra['itunes:new-feed-url'] = channel['itunes:new-feed-url'];
    }
    if (channel['itunes:email']) {
      microfeedExtra['itunes:email'] = channel['itunes:email'];
    }
    return microfeedExtra;
  }

  _buildPublicContentItem(itemId, item, mediaFile) {
    let trackingUrls = [];
    if (this.settings.analytics && this.settings.analytics.urls) {
      trackingUrls = this.settings.analytics.urls || [];
    }

    const newItem = {
      id: itemId,
      title: item.title || 'untitled',
    };
    const attachment = {};
    if (mediaFile.url) {
      attachment['url'] = buildAudioUrlWithTracking(mediaFile.url, trackingUrls);
    }
    if (mediaFile.contentType) {
      attachment['mime_type'] = mediaFile.contentType;
    }
    if (mediaFile.sizeByte) {
      attachment['size_in_byte'] = mediaFile.sizeByte;
    }
    if (mediaFile.durationSecond) {
      attachment['duration_in_seconds'] = mediaFile.durationSecond;
    }
    if (Object.keys(attachment).length > 0) {
      newItem['attachments'] = [attachment];
    }
    if (item.link) {
      newItem['url'] = item.link;
    }
    if (mediaFile.isExternalUrl && mediaFile.url) {
      newItem['external_url'] = mediaFile.url;
    }
    if (item.description) {
      newItem['content_html'] = item.description;
    }
    if (item.descriptionText) {
      newItem['content_text'] = item.descriptionText;
    }
    if (item.image) {
      newItem['image'] = item.image;
    }
    if (mediaFile.isImage && mediaFile.url) {
      newItem['banner_image'] = mediaFile.url;
    }
    if (item.pubDateRfc3339) {
      newItem['date_published'] = item.pubDateRfc3339;
    }
    if (item.updatedDateRfc3339) {
      newItem['date_modified'] = item.updatedDateRfc3339;
    }
    if (item.language) {
      newItem['language'] = item.language;
    }

    const _microfeed = {
      is_audio: mediaFile.isAudio,
      is_document: mediaFile.isDocument,
      is_external_url: mediaFile.isExternalUrl,
      is_video: mediaFile.isVideo,
      is_image: mediaFile.isImage,
      web_url: item.webUrl,
    };
    if (item['itunes:title']) {
      _microfeed['itunes:title'] = item['itunes:title'];
    }
    if (item['itunes:block']) {
      _microfeed['itunes:block'] = item['itunes:block'];
    }
    if (item['itunes:episodeType']) {
      _microfeed['itunes:episodeType'] = item['itunes:episodeType'];
    }
    if (item['itunes:season']) {
      _microfeed['itunes:season'] = item['itunes:season'];
    }
    if (item['itunes:episode']) {
      _microfeed['itunes:episode'] = item['itunes:episode'];
    }
    if (item['itunes:explicit']) {
      _microfeed['itunes:explicit'] = item['itunes:explicit'];
    }
    if (item.pubDate) {
      _microfeed['date_published_short'] = item.pubDate;
    }
    if (item.pubDateMs) {
      _microfeed['date_published_ms'] = item.pubDateMs;
    }

    newItem['_microfeed'] = _microfeed;
    return newItem;
  }

  getJsonData() {
    const publicContent = {
      version: 'https://jsonfeed.org/version/1.1',
      ...this._buildPublicContentChannel(this.content),
    };

    const {items, settings} = this.content;
    const channel = this.content.channel || {};
    const existingitems = items || {};
    publicContent['items'] = [];
    Object.keys(existingitems).forEach((itemId) => {
      const item = existingitems[itemId];
      if (item.status === ITEM_STATUSES.UNPUBLISHED) {
        return;
      }
      this._decorateForItem(itemId, item, this.baseUrl);
      const mediaFile = item.mediaFile || {};
      const newItem = this._buildPublicContentItem(itemId, item, mediaFile);
      publicContent.items.push(newItem);
    })
    if (channel['itunes:type'] === 'episodic') {
      publicContent.items.sort((a, b) => b['_microfeed']['date_published_ms'] - a['_microfeed']['date_published_ms']);
    } else {
      publicContent.items.sort((a, b) => a['_microfeed']['date_published_ms'] - b['_microfeed']['date_published_ms']);
    }

    publicContent['_microfeed'] = this._buildPublicContentMicrofeedExtra();
    return publicContent;
  }
}

export default class FeedDb {
  constructor(env, request) {
    const {
      FEED_DB,
    } = env;
    this.FEED_DB = FEED_DB;

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

  async getPublicJsonData(content=null) {
    if (!content) {
      content = await this.getContent();
    }
    const builder = new FeedPublicJsonBuilder(content, this.request);
    return builder.getJsonData();
  }
}
