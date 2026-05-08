export const SETTINGS_CONTROLS = {
  SUBSCRIBE_METHODS: 'subscribe_methods',
  ITEMS_SORT_ORDER: 'items_sort_order',
};

export const CONTROLS_TEXTS_DICT = {
  [SETTINGS_CONTROLS.SUBSCRIBE_METHODS]: {
    linkName: 'Subscribe methods',
    linkNameZh: '订阅方式',
    modalTitle: 'Subscribe methods',
    modalTitleZh: '订阅方式',
    text: "How can your audience subscribe to your feed? For example: JSON, RSS, Apple Podcasts, Spotify...",
    textZh: "你的受众可以通过哪些方式订阅这个 feed？例如：JSON、RSS、Apple Podcasts、Spotify……",
    rss: null,
    json: '{ "_microfeed": { "subscribe_methods": [{"name": "RSS", "type": "rss", "url": "https://www.microfeed.org/rss/"}] } }',
  },
  [SETTINGS_CONTROLS.ITEMS_SORT_ORDER]: {
    linkName: 'Sort order',
    linkNameZh: '排序方式',
    modalTitle: 'Items sort order',
    modalTitleZh: '内容排序方式',
    text: "Sort order of items in the feed: Newest first, or Oldest first?",
    textZh: "feed 里的内容排序方式：最新优先，还是最早优先？",
    rss: null,
    json: '{ "_microfeed": { "items_sort_order": "newest_first" }',
  },
};
