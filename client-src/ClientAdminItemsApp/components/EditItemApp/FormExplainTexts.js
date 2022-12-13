import {ADMIN_URLS} from "../../../../common-src/StringUtils";

export const ITEM_CONTROLS = {
  TITLE: 'item_title',
  IMAGE: 'item_image',
  MEDIA_FILE: 'item_media_file',
  PUB_DATE: 'item_pub_date',
  LINK: 'item_link',
  DESCRIPTION: 'item_description',
  GUID: 'item_guid',
  ITUNES_EXPLICIT: 'item_itunes_explicit',
  ITUNES_TITLE: 'item_itunes_title',
  ITUNES_EPISODE_TYPE: 'item_itunes_episode_type',
  ITUNES_SEASON: 'item_itunes_season',
  ITUNES_EPISODE: 'item_itunes_episode',
  ITUNES_BLOCK: 'item_itunes_block',
  STATUS: 'item_status',
};

export const CONTROLS_TEXTS_DICT = {
  [ITEM_CONTROLS.TITLE]: {
    linkName: 'Title',
    modalTitle: 'Item / Title',
    text: "An item's title. It could be a podcast episode's title, a blog post's title, a custom title of a curated article...",
    rss: '<channel><item><title>Title Here</title></item></channel>',
    json: '{ "items": [{"title": "Title Here"}] }',
  },
  [ITEM_CONTROLS.IMAGE]: {
    linkName: 'Item image',
    modalTitle: 'Item / Image',
    text: "An item's image.",
    rss: '<channel><item><itunes:image href="https://cdn-site.com/img.jpg" /></item></channel>',
    json: '{ "items": [{"image": "https://cdn-site.com/img.jpg"}] }',
  },
  [ITEM_CONTROLS.MEDIA_FILE]: {
    linkName: 'Media file',
    modalTitle: 'Item / Media file',
    text: "An item can have a main media file. For example, if it's a podcast episode, then a media file would be an audio.",
    rss: '<channel><item><enclosure url="https://cdn-site.com/audio.mp3" type="audio/mpeg" length="277000"/><itunes:duration>00:21:02</itunes:duration></item></channel>',
    json: '{ "items": [{"attachments": [{"url": "https://cdn-site.com/audio.mp3", "mime_type": "audio/mpeg", "size_in_byte": 277000, "duration_in_seconds": 1262 }], "_microfeed": {"duration_hhmmss": "00:21:02"}}] }',
  },

  [ITEM_CONTROLS.PUB_DATE]: {
    linkName: 'Published date',
    modalTitle: 'Item / Published date',
    text: "An item's published date.",
    rss: '<channel><item><pubDate>Wed, 30 Nov 2022 04:31:48 GMT</pubDate></item></channel>',
    json: '{ "items": [{"date_published": "2022-11-30T04:31:31.867Z", "_microfeed": {"date_published_ms": 1669782691867, "date_published_short": "Tue Nov 29 2022"}}] }',
  },
  [ITEM_CONTROLS.LINK]: {
    linkName: 'Link',
    modalTitle: 'Item / Link',
    text: "An item's web link.",
    rss: '<channel><item><link>https://example.com/page1.html</link></item></channel>',
    json: '{ "items": [{"url": "https://example.com/page1.html"}] }',
  },
  [ITEM_CONTROLS.DESCRIPTION]: {
    linkName: 'Description',
    modalTitle: 'Item / Description',
    text: "An item's description.",
    rss: '<channel><item><description><![CDATA[<p>some text here<br></p>]]></description></item></channel>',
    json: '{ "items": [{"content_html": "<p>some text here<br></p>", "content_text": "some text here"}] }',
  },
  [ITEM_CONTROLS.GUID]: {
    linkName: '<guid>',
    modalTitle: 'Item / Description',
    text: "An item's guid. By default, it's the id of this item. But you can change it to fit your use case.",
    rss: '<channel><item><guid>z9H7LSkykS1</guid></item></channel>',
    json: '{ "items": [{"_microfeed": {"guid": "z9H7LSkykS1"}}] }',
  },
  [ITEM_CONTROLS.ITUNES_EXPLICIT]: {
    linkName: '<itunes:explicit>',
    modalTitle: 'Item / <itunes:explicit>',
    text: "",
    rss: '<channel><item><itunes:explicit>false</itunes:explicit></item></channel>',
    json: '{ "items": [{"_microfeed": {"itunes:explicit": true}}] }',
  },
  [ITEM_CONTROLS.ITUNES_TITLE]: {
    linkName: '<itunes:title>',
    modalTitle: 'Item / <itunes:title>',
    text: "An item's title in Apple Podcasts.",
    rss: '<channel><item><itunes:title>Title Here</itunes:title></item></channel>',
    json: '{ "items": [{"_microfeed": {"itunes:title": "Title Here"}}] }',
  },
  [ITEM_CONTROLS.ITUNES_EPISODE_TYPE]: {
    linkName: '<itunes:episodeType>',
    modalTitle: 'Item / <itunes:episodeType>',
    text: "",
    rss: '<channel><item><itunes:episodeType>full</itunes:episodeType></item></channel>',
    json: '{ "items": [{"_microfeed": {"itunes:episodeType": "full"}}] }',
  },
  [ITEM_CONTROLS.ITUNES_SEASON]: {
    linkName: '<itunes:season>',
    modalTitle: 'Item / <itunes:season>',
    text: "",
    rss: '<channel><item><itunes:season>2</itunes:season></item></channel>',
    json: '{ "items": [{"_microfeed": {"itunes:season": 2}}] }',
  },
  [ITEM_CONTROLS.ITUNES_EPISODE]: {
    linkName: '<itunes:episode>',
    modalTitle: 'Item / <itunes:episode>',
    text: "",
    rss: '<channel><item><itunes:episode>3</itunes:episode></item></channel>',
    json: '{ "items": [{"_microfeed": {"itunes:episode": 3}}] }',
  },
  [ITEM_CONTROLS.ITUNES_BLOCK]: {
    linkName: '<itunes:block>',
    modalTitle: 'Item / <itunes:block>',
    text: "",
    rss: '<channel><item><itunes:block>Yes</itunes:block></item></channel>',
    json: '{ "items": [{"_microfeed": {"itunes:block": true}}] }',
  },
  [ITEM_CONTROLS.STATUS]: {
    linkName: 'Item status',
    modalTitle: 'Item / status',
    text: "An item's status is either published, unlisted, or unpublished. <ul class='list-decimal list-inside'>" +
      "<li>published: <b>listed</b> on the web/rss/json feed, and <b>visible</b> via the direct web link.</li>" +
      "<li>unlisted: <b>not listed</b> on the web/rss/json feed, but <b>visible</b> via the direct web link.</li>" +
      "<li>unpublished: <b>not listed</b> on the web/rss/json feed, and <b>not visible</b> via the direct web link. " +
      `An admin can still find it and edit on the <a href="${ADMIN_URLS.allItems()}">See all items</a> page.</li>` +
      "</ul>",
  },
};
