export const SETTINGS_CONTROLS = {
  SUBSCRIBE_METHODS: 'subscribe_methods',
  ITEMS_SORT_ORDER: 'items_sort_order',
};

export const CONTROLS_TEXTS_DICT = {
  [SETTINGS_CONTROLS.SUBSCRIBE_METHODS]: {
    linkName: 'Subscribe methods',
    modalTitle: 'Subscribe methods',
    text: "How can your audience subscribe to your feed? For example: JSON, RSS, Apple Podcasts, Spotify...",
    rss: null,
    json: '{ "_microfeed": { "subscribe_methods": [{"name": "RSS", "type": "rss", "url": "https://www.microfeed.org/rss/"}] } }',
  },
  [SETTINGS_CONTROLS.ITEMS_SORT_ORDER]: {
    linkName: 'Sort by',
    modalTitle: 'Items sorting',
    text: "Choose which item timestamp controls the feed order.",
    rss: null,
    json: '{ "_microfeed": { "items_sort": "published_at", "items_order": "desc" } }',
  },
};
