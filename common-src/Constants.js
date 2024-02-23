export const STATUSES = {
  PUBLISHED: 1,
  UNPUBLISHED: 2,
  DELETED: 3,
  UNLISTED: 4,
};

export const SETTINGS_CATEGORIES = {
  SUBSCRIBE_METHODS: 'subscribeMethods',
  WEB_GLOBAL_SETTINGS: 'webGlobalSettings',
  CUSTOM_CODE: 'customCode',
  ANALYTICS: 'analytics',
  ACCESS: 'access',
  API_SETTINGS: 'apiSettings',
};

export const DEFAULT_ITEMS_PER_PAGE = 20;
export const MAX_ITEMS_PER_PAGE = 300;
export const ITEMS_SORT_ORDERS = {
  OLDEST_FIRST: 'oldest_first',
  NEWEST_FIRST: 'newest_first',
};

export const CODE_TYPES = {
  SHARED: 'shared',
  THEMES: 'themes',
};

export const CODE_FILES = {
  WEB_HEADER: 'webHeader',
  WEB_BODY_START: 'webBodyStart',
  WEB_BODY_END: 'webBodyEnd',
  WEB_FEED: 'webFeed',
  WEB_ITEM: 'webItem',
  RSS_STYLESHEET: 'rssStylesheet',
};

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

export const OUR_BRAND = {
  domain: 'microfeed.org',
  brandName: 'microfeed',
  whatsnewEndpoint: 'https://www.microfeed.org/json/',
  whatsnewWebsite: 'https://www.microfeed.org',
  exampleCdnUrl: 'https://media-cdn.microfeed.org',
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
    name: 'audio',
    fileTypes: ['mp3', 'm4b', 'flac', 'wav', 'webm', 'ogg', 'aac'],
  },
  [ENCLOSURE_CATEGORIES.VIDEO]: {
    name: 'video',
    fileTypes: ['mp4', 'webm', 'ogg'],
  },
  [ENCLOSURE_CATEGORIES.DOCUMENT]: {
    name: 'document',
    fileTypes: ['pdf', 'docx', 'doc', 'xlsx', 'ppt', 'pptx', 'txt'],
  },
  [ENCLOSURE_CATEGORIES.IMAGE]: {
    name: 'image',
    fileTypes: ['png', 'jpg', 'jpeg', 'gif', 'heic', 'cr2', 'bmp'],
  },
  [ENCLOSURE_CATEGORIES.EXTERNAL_URL]: {
    name: 'external url',
    fileTypes: [],
  },
};

export const SUPPORTED_ENCLOSURE_CATEGORIES = [
  ENCLOSURE_CATEGORIES.AUDIO,
  ENCLOSURE_CATEGORIES.VIDEO,
  ENCLOSURE_CATEGORIES.DOCUMENT,
  ENCLOSURE_CATEGORIES.IMAGE,
  ENCLOSURE_CATEGORIES.EXTERNAL_URL,
];

export const NAV_ITEMS = {
  ADMIN_HOME: 'admin_home',
  EDIT_CHANNEL: 'edit_channel',
  NEW_ITEM: 'new_item',
  ALL_ITEMS: 'all_items',
  SETTINGS: 'settings',
};

export const NAV_ITEMS_DICT = {
  [NAV_ITEMS.ADMIN_HOME]: {
    name: 'Home',
  },
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

export const ONBOARDING_TYPES = {
  VALID_PUBLIC_BUCKET_URL: 1,
  PROTECTED_ADMIN_DASHBOARD: 2,
  CUSTOM_DOMAIN: 3,
};

export const ITEM_STATUSES_STRINGS_DICT = {
  'published': STATUSES.PUBLISHED,
  'unpublished': STATUSES.UNPUBLISHED,
  'unlisted': STATUSES.UNLISTED,
};

export const ITEM_STATUSES_DICT = {
  [STATUSES.PUBLISHED]: {
    name: 'published',
    description: '<b>listed</b> on the web/rss/json feed, and <b>visible</b> via the direct web link.',
  },
  [STATUSES.UNPUBLISHED]: {
    name: 'unpublished',
    description: '<b>not listed</b> on the web/rss/json feed, and <b>not visible</b> via the direct web link. ' +
      'An admin can still find it and edit on the <a href="/admin/items/list/">See all items</a> page.</li>'
  },
  [STATUSES.UNLISTED]: {
    name: 'unlisted',
    description: '<b>not listed</b> on the web/rss/json feed, but <b>visible</b> via the direct web link.'
  },
};

export const LANGUAGE_CODES_LIST = [
  {
    "name": "Afrikaans",
    "code": "af"
  },
  {
    "name": "Albanian",
    "code": "sq"
  },
  {
    "name": "Basque",
    "code": "eu"
  },
  {
    "name": "Belarusian",
    "code": "be"
  },
  {
    "name": "Bulgarian",
    "code": "bg"
  },
  {
    "name": "Catalan",
    "code": "ca"
  },
  {
    "name": "Chinese (Simplified)",
    "code": "zh-cn"
  },
  {
    "name": "Chinese (Traditional)",
    "code": "zh-tw"
  },
  {
    "name": "Croatian",
    "code": "hr"
  },
  {
    "name": "Czech",
    "code": "cs"
  },
  {
    "name": "Danish",
    "code": "da"
  },
  {
    "name": "Dutch",
    "code": "nl"
  },
  {
    "name": "Dutch (Belgium)",
    "code": "nl-be"
  },
  {
    "name": "Dutch (Netherlands)",
    "code": "nl-nl"
  },
  {
    "name": "English",
    "code": "en"
  },
  {
    "name": "English (Australia)",
    "code": "en-au"
  },
  {
    "name": "English (Belize)",
    "code": "en-bz"
  },
  {
    "name": "English (Canada)",
    "code": "en-ca"
  },
  {
    "name": "English (Ireland)",
    "code": "en-ie"
  },
  {
    "name": "English (Jamaica)",
    "code": "en-jm"
  },
  {
    "name": "English (New Zealand)",
    "code": "en-nz"
  },
  {
    "name": "English (Phillipines)",
    "code": "en-ph"
  },
  {
    "name": "English (South Africa)",
    "code": "en-za"
  },
  {
    "name": "English (Trinidad)",
    "code": "en-tt"
  },
  {
    "name": "English (United Kingdom)",
    "code": "en-gb"
  },
  {
    "name": "English (United States)",
    "code": "en-us"
  },
  {
    "name": "English (Zimbabwe)",
    "code": "en-zw"
  },
  {
    "name": "Estonian",
    "code": "et"
  },
  {
    "name": "Faeroese",
    "code": "fo"
  },
  {
    "name": "Finnish",
    "code": "fi"
  },
  {
    "name": "French",
    "code": "fr"
  },
  {
    "name": "French (Belgium)",
    "code": "fr-be"
  },
  {
    "name": "French (Canada)",
    "code": "fr-ca"
  },
  {
    "name": "French (France)",
    "code": "fr-fr"
  },
  {
    "name": "French (Luxembourg)",
    "code": "fr-lu"
  },
  {
    "name": "French (Monaco)",
    "code": "fr-mc"
  },
  {
    "name": "French (Switzerland)",
    "code": "fr-ch"
  },
  {
    "name": "Galician",
    "code": "gl"
  },
  {
    "name": "Gaelic",
    "code": "gd"
  },
  {
    "name": "German",
    "code": "de"
  },
  {
    "name": "German (Austria)",
    "code": "de-at"
  },
  {
    "name": "German (Germany)",
    "code": "de-de"
  },
  {
    "name": "German (Liechtenstein)",
    "code": "de-li"
  },
  {
    "name": "German (Luxembourg)",
    "code": "de-lu"
  },
  {
    "name": "German (Switzerland)",
    "code": "de-ch"
  },
  {
    "name": "Greek",
    "code": "el"
  },
  {
    "name": "Hawaiian",
    "code": "haw"
  },
  {
    "name": "Hungarian",
    "code": "hu"
  },
  {
    "name": "Icelandic",
    "code": "is"
  },
  {
    "name": "Indonesian",
    "code": "in"
  },
  {
    "name": "Irish",
    "code": "ga"
  },
  {
    "name": "Italian",
    "code": "it"
  },
  {
    "name": "Italian (Italy)",
    "code": "it-it"
  },
  {
    "name": "Italian (Switzerland)",
    "code": "it-ch"
  },
  {
    "name": "Japanese",
    "code": "ja"
  },
  {
    "name": "Korean",
    "code": "ko"
  },
  {
    "name": "Macedonian",
    "code": "mk"
  },
  {
    "name": "Norwegian",
    "code": "no"
  },
  {
    "name": "Polish",
    "code": "pl"
  },
  {
    "name": "Portuguese",
    "code": "pt"
  },
  {
    "name": "Portuguese (Brazil)",
    "code": "pt-br"
  },
  {
    "name": "Portuguese (Portugal)",
    "code": "pt-pt"
  },
  {
    "name": "Romanian",
    "code": "ro"
  },
  {
    "name": "Romanian (Moldova)",
    "code": "ro-mo"
  },
  {
    "name": "Romanian (Romania)",
    "code": "ro-ro"
  },
  {
    "name": "Russian",
    "code": "ru"
  },
  {
    "name": "Russian (Moldova)",
    "code": "ru-mo"
  },
  {
    "name": "Russian (Russia)",
    "code": "ru-ru"
  },
  {
    "name": "Serbian",
    "code": "sr"
  },
  {
    "name": "Slovak",
    "code": "sk"
  },
  {
    "name": "Slovenian",
    "code": "sl"
  },
  {
    "name": "Spanish",
    "code": "es"
  },
  {
    "name": "Spanish (Argentina)",
    "code": "es-ar"
  },
  {
    "name": "Spanish (Bolivia)",
    "code": "es-bo"
  },
  {
    "name": "Spanish (Chile)",
    "code": "es-cl"
  },
  {
    "name": "Spanish (Colombia)",
    "code": "es-co"
  },
  {
    "name": "Spanish (Costa Rica)",
    "code": "es-cr"
  },
  {
    "name": "Spanish (Dominican Republic)",
    "code": "es-do"
  },
  {
    "name": "Spanish (Ecuador)",
    "code": "es-ec"
  },
  {
    "name": "Spanish (El Salvador)",
    "code": "es-sv"
  },
  {
    "name": "Spanish (Guatemala)",
    "code": "es-gt"
  },
  {
    "name": "Spanish (Honduras)",
    "code": "es-hn"
  },
  {
    "name": "Spanish (Mexico)",
    "code": "es-mx"
  },
  {
    "name": "Spanish (Nicaragua)",
    "code": "es-ni"
  },
  {
    "name": "Spanish (Panama)",
    "code": "es-pa"
  },
  {
    "name": "Spanish (Paraguay)",
    "code": "es-py"
  },
  {
    "name": "Spanish (Peru)",
    "code": "es-pe"
  },
  {
    "name": "Spanish (Puerto Rico)",
    "code": "es-pr"
  },
  {
    "name": "Spanish (Spain)",
    "code": "es-es"
  },
  {
    "name": "Spanish (Uruguay)",
    "code": "es-uy"
  },
  {
    "name": "Spanish (Venezuela)",
    "code": "es-ve"
  },
  {
    "name": "Swedish",
    "code": "sv"
  },
  {
    "name": "Swedish (Finland)",
    "code": "sv-fi"
  },
  {
    "name": "Swedish (Sweden)",
    "code": "sv-se"
  },
  {
    "name": "Turkish",
    "code": "tr"
  },
  {
    "name": "Ukranian",
    "code": "uk"
  }
];

export const ITUNES_CATEGORIES_DICT = {
  'Arts': [
    'Books',
    'Design',
    'Fashion & Beauty',
    'Food',
    'Performing Arts',
    'Visual Arts'
  ],
  'Business': [
    'Careers',
    'Entrepreneurship',
    'Investing',
    'Management',
    'Marketing',
    'Non-Profit'
  ],
  'Comedy': [
    'Comedy Interviews',
    'Improv',
    'Stand-Up'
  ],
  'Education': [
    'Courses',
    'How To',
    'Language Learning',
    'Self-Improvement'
  ],
  'Fiction': [
    'Comedy Fiction',
    'Drama',
    'Science Fiction'
  ],
  'Government': [],
  'History': [],
  'Health & Fitness': [
    'Alternative Health',
    'Fitness',
    'Medicine',
    'Mental Health',
    'Nutrition',
    'Sexuality'
  ],
  'Kids & Family': [
    'Education for Kids',
    'Parenting',
    'Pets & Animals',
    'Stories for Kids'
  ],
  'Leisure': [
    'Animation & Manga',
    'Automotive',
    'Aviation',
    'Crafts',
    'Games',
    'Hobbies',
    'Home & Garden',
    'Video Games'
  ],
  'Music': [
    'Music Commentary',
    'Music History',
    'Music Interviews'
  ],
  'News': [
    'Business News',
    'Daily News',
    'Entertainment News',
    'News Commentary',
    'Politics',
    'Sports News',
    'Tech News'
  ],
  'Religion & Spirituality': [
    'Buddhism',
    'Christianity',
    'Hinduism',
    'Islam',
    'Judaism',
    'Religion',
    'Spirituality'
  ],
  'Science': [
    'Astronomy',
    'Chemistry',
    'Earth Sciences',
    'Life Sciences',
    'Mathematics',
    'Natural Sciences',
    'Nature',
    'Physics',
    'Social Sciences'
  ],
  'Society & Culture': [
    'Documentary',
    'Personal Journals',
    'Philosophy',
    'Places & Travel',
    'Relationships'
  ],
  'Sports': [
    'Baseball',
    'Basketball',
    'Cricket',
    'Fantasy Sports',
    'Football',
    'Golf',
    'Hockey',
    'Rugby',
    'Soccer',
    'Swimming',
    'Tennis',
    'Volleyball',
    'Wilderness',
    'Wrestling'
  ],
  'Technology': [],
  'True Crime': [],
  'TV & Film': [
    'After Shows',
    'Film History',
    'Film Interviews',
    'Film Reviews',
    'TV Reviews'
  ]
};

const Constants = {
};

export default Constants;
