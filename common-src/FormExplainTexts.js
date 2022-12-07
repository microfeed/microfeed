export const CONTROLS = {
  CHANNEL_TITLE: 'channel_title',
  CHANNEL_PUBLISHER: 'channel_publisher',
  CHANNEL_WEBSITE: 'channel_website',
  CHANNEL_CATEGORIES: 'channel_categories',
  CHANNEL_LANGUAGE: 'channel_language',
  CHANNEL_ITUNES_COMPLETE: 'channel_itunes_complete',
};

export const CONTROLS_TEXTS_DICT = {
  [CONTROLS.CHANNEL_TITLE]: {
    linkName: 'Title',
    modalTitle: 'Channel / Title',
    text: "A channel's name. If this channel is a podcast, then it would be a podcast name.",
    rss: '<channel><title>Title Here</title></channel>',
    json: '{ "title": "Title Here" }',
  },
  [CONTROLS.CHANNEL_PUBLISHER]: {
    linkName: 'Publisher',
    modalTitle: 'Channel / Publisher',
    text: "A channel's author / publisher. If this channel is a podcast, then it would be the publisher's name.",
    rss: '<channel><itunes:author>Publisher Here</itunes:author></channel>',
    json: '{ "authors": [{"name": "Publisher Here"}] }',
  },
  [CONTROLS.CHANNEL_WEBSITE]: {
    linkName: 'Website',
    modalTitle: 'Channel / Website',
    text: "A channel's website.",
    rss: '<channel><link>Website Here</link></channel>',
    json: '{ "home_page_url": "Website Here" }',
  },
  [CONTROLS.CHANNEL_CATEGORIES]: {
    linkName: 'Categories',
    modalTitle: 'Channel / Categories',
    text: "A channel's categories. All available categories are from Apple Podcasts.",
    rss: '<channel><itunes:category text="Arts" /></channel>',
    json: '{ "_microfeed": {"categories": [{"name": "Arts"}]} }',
  },
  [CONTROLS.CHANNEL_LANGUAGE]: {
    linkName: 'Language',
    modalTitle: 'Channel / Language',
    text: "A channel's language.",
    rss: '<channel><language>en-us</language></channel>',
    json: '{ "language": "en-us" }',
  },

  [CONTROLS.CHANNEL_ITUNES_COMPLETE]: {
    linkName: '<itunes:complete>',
    modalTitle: 'Channel / <itunes:complete>',
    text: "",
    rss: '<channel><title>Title Here</title></channel>',
    json: '{ "_microfeed": {"<itunes:complete>": "yes"} }',
  },
};
