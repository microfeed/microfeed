export const PREDEFINED_SUBSCRIBE_METHODS = {
  'apple podcasts': {
    name: 'Apple Podcasts',
    type: 'apple podcasts',
    url: '',
    image: '/assets/brands/subscribe/apple.jpg',
    enabled: true,
    editable: true,
  },
  'spotify': {
    name: 'Spotify',
    type: 'spotify',
    url: '',
    image: '/assets/brands/subscribe/spotify.jpg',
    enabled: true,
    editable: true,
  },
  'google podcasts': {
    name: 'Google Podcasts',
    type: 'google podcasts',
    url: '',
    image: '/assets/brands/subscribe/google.png',
    enabled: true,
    editable: true,
  },
  'amazon music': {
    name: 'Amazon Music',
    type: 'amazon music',
    url: '',
    image: '/assets/brands/subscribe/amazon.jpg',
    enabled: true,
    editable: true,
  },
  'overcast': {
    name: 'Overcast',
    type: 'overcast',
    url: '',
    image: '/assets/brands/subscribe/overcast.jpg',
    enabled: true,
    editable: true,
  },
  'pocket casts': {
    name: 'Pocket Casts',
    type: 'pocket casts',
    url: '',
    image: '/assets/brands/subscribe/pocketcasts.jpg',
    enabled: true,
    editable: true,
  },
  'castro': {
    name: 'Castro',
    type: 'castro',
    url: '',
    image: '/assets/brands/subscribe/castro.jpg',
    enabled: true,
    editable: true,
  },
  'listen notes': {
    name: 'Listen Notes',
    type: 'listen notes',
    url: '',
    image: '/assets/brands/subscribe/listennotes.jpg',
    enabled: true,
    editable: true,
  },
  'rss': {
    name: 'RSS',
    type: 'rss',
    url: '',
    image: '/assets/brands/subscribe/rss.png',
    enabled: true,
    editable: true,
  },
  'json': {
    name: 'JSON',
    type: 'json',
    url: '',
    image: '/assets/brands/subscribe/json.png',
    enabled: true,
    editable: true,
  },
  'custom': {
    name: 'Custom',
    type: 'custom',
    url: '',
    image: '/assets/brands/subscribe/custom.png',
    enabled: true,
    editable: true,
  },
};

export const PREDEFINED_SOCIAL_ACCOUNTS = {
  'instagram': {
    name: 'Instagram',
    type: 'instagram',
    url: '',
    image: '/assets/brands/social/instagram.png',
    enabled: true,
    editable: true,
  },
  'linkedin': {
    name: 'LinkedIn',
    type: 'linkedin',
    url: '',
    image: '/assets/brands/social/linkedin.png',
    enabled: true,
    editable: true,
  },
  'pinterest': {
    name: 'Pinterest',
    type: 'pinterest',
    url: '',
    image: '/assets/brands/social/pinterest.png',
    enabled: true,
    editable: true,
  },
  'telegram': {
    name: 'Telegram',
    type: 'telegram',
    url: '',
    image: '/assets/brands/social/telegram.png',
    enabled: true,
    editable: true,
  },
  'tiktok': {
    name: 'Tiktok',
    type: 'tiktok',
    url: '',
    image: '/assets/brands/social/tiktok.png',
    enabled: true,
    editable: true,
  },
  'twitch': {
    name: 'Twitch',
    type: 'twitch',
    url: '',
    image: '/assets/brands/social/twitch.png',
    enabled: true,
    editable: true,
  },
  'twitter': {
    name: 'Twitter',
    type: 'twitter',
    url: '',
    image: '/assets/brands/social/twitter.png',
    enabled: true,
    editable: true,
  },
  'wechat': {
    name: 'Wechat',
    type: 'wechat',
    url: '',
    image: '/assets/brands/social/wechat.png',
    enabled: true,
    editable: true,
  },
  'youtube': {
    name: 'YouTube',
    type: 'youtube',
    url: '',
    image: '/assets/brands/social/youtube.png',
    enabled: true,
    editable: true,
  },
};

export const OUR_BRAND = {
  domain: 'feedkit.org',
};

export const ENCLOSURE_CATEGORIES = {
  AUDIO: 'audio',
  DOCUMENT: 'document',
  VIDEO: 'video',
  IMAGE: 'image',
  EXTERNAL_URL: 'external_url',
};
export const ENCLOSURE_CATEGORIES_DICT = {
  [ENCLOSURE_CATEGORIES.AUDIO]: {
    name: 'Audio',
    fileTypes: ['mp3'],
  },
  [ENCLOSURE_CATEGORIES.VIDEO]: {
    name: 'Video',
    fileTypes: ['mp4', 'mov'],
  },
  [ENCLOSURE_CATEGORIES.DOCUMENT]: {
    name: 'Document',
    fileTypes: ['pdf'],
  },
  [ENCLOSURE_CATEGORIES.EXTERNAL_URL]: {
    name: 'External URL',
    fileTypes: [],
  },
};

export const NAV_ITEMS = {
  EDIT_CHANNEL: 'edit_channel',
  NEW_ITEM: 'new_item',
  ALL_ITEMS: 'all_items',
  SETTINGS: 'settings',
};

export const NAV_ITEMS_DICT = {
  [NAV_ITEMS.EDIT_CHANNEL]: {
    name: 'Edit channel',
  },
  [NAV_ITEMS.NEW_ITEM]: {
    name: 'Add new item',
  },
  [NAV_ITEMS.ALL_ITEMS]: {
    name: 'See all items',
  },
  [NAV_ITEMS.SETTINGS]: {
    name: 'Settings',
  },
};

export const CHANNEL_STATUSES = {
  PUBLIC: 'public',
  OFFLINE: 'offline',
  PASSCODE: 'passcode',
};

export const CHANNEL_STATUSES_DICT = {
  [CHANNEL_STATUSES.PUBLIC]: {
    name: 'Public',
    description: 'Make the entire site publicly accessible, including all non-Admin web pages, rss feed and json feed.',
  },
  [CHANNEL_STATUSES.OFFLINE]: {
    name: 'Offline',
    description: 'Make the entire site offline. All non-Admin web pages, rss feed and json feed will be 404-ed.',
  },
  [CHANNEL_STATUSES.PASSCODE]: {
    name: 'Passcode',
    description: 'Protect all pages with a passcode.',
  },
};

export const ITEM_STATUSES = {
  PUBLISHED: 'published',
  UNPUBLISHED: 'unpublished',
};

export const ITEM_STATUSES_DICT = {
  [ITEM_STATUSES.PUBLISHED]: {
    name: 'Published',
    description: 'Visible to public',
  },
  [ITEM_STATUSES.UNPUBLISHED]: {
    name: 'Unpublished',
    description: 'Not visible to public. You can continue to edit and save it as a draft.'
  },
};

const Constants = {
};

export default Constants;
