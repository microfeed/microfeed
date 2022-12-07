export const CONTROLS = {
  CHANNEL_TITLE: 'channel_title',
  CHANNEL_IMAGE: 'channel_image',
  CHANNEL_PUBLISHER: 'channel_publisher',
  CHANNEL_WEBSITE: 'channel_website',
  CHANNEL_CATEGORIES: 'channel_categories',
  CHANNEL_LANGUAGE: 'channel_language',
  CHANNEL_DESCRIPTION: 'channel_description',
  CHANNEL_ITUNES_TYPE: 'channel_itunes_type',
  CHANNEL_ITUNES_EMAIL: 'channel_itunes_email',
  CHANNEL_COPYRIGHT: 'channel_copyright',
  CHANNEL_ITUNES_TITLE: 'channel_itunes_title',
  CHANNEL_ITUNES_EXPLICIT: 'channel_itunes_explicit',
  CHANNEL_ITUNES_BLOCK: 'channel_itunes_block',
  CHANNEL_ITUNES_NEW_RSS_URL: 'channel_itunes_new_rss_url',
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
  [CONTROLS.CHANNEL_IMAGE]: {
    linkName: 'Channel Image',
    modalTitle: 'Channel / Image',
    text: "A channel's image.",
    rss: '<channel><itunes:image href="https://cdn-site.com/img.jpg" /><image><url>https://cdn-site.com/img.jpg</url></image></channel>',
    json: '{ "icon": "https://cdn-site.com/img.jpg" }',
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
  [CONTROLS.CHANNEL_DESCRIPTION]: {
    linkName: 'Description',
    modalTitle: 'Channel / Description',
    text: "A channel's description.",
    rss: '<channel><description><![CDATA[ <p>some html here</p> ]]></description></channel>',
    json: '{ "description": "<p>some html here</p>" }',
  },
  [CONTROLS.CHANNEL_ITUNES_TYPE]: {
    linkName: '<itunes:type>',
    modalTitle: 'Channel / <itunes:type>',
    text: "episodic or series",
    rss: '<channel><itunes:type>episodic</itunes:type></channel>',
    json: '{ "_microfeed": {"itunes:type": "episodic"} }',
  },
  [CONTROLS.CHANNEL_ITUNES_EMAIL]: {
    linkName: '<itunes:email>',
    modalTitle: 'Channel / <itunes:email>',
    text: "",
    rss: '<channel><itunes:owner><itunes:email>myname@mycompany.com</itunes:email></itunes:owner></channel>',
    json: '{ "_microfeed": {"itunes:email": "myname@mycompany.com"} }',
  },
  [CONTROLS.CHANNEL_COPYRIGHT]: {
    linkName: 'Copyright',
    modalTitle: 'Channel / Copyright',
    text: "",
    rss: '<channel><copyright>©2023</copyright></channel>',
    json: '{ "_microfeed": {"itunes:type": "©2023"} }',
  },
  [CONTROLS.CHANNEL_ITUNES_TITLE]: {
    linkName: '<itunes:title>',
    modalTitle: 'Channel / <itunes:title>',
    text: "Apple Podcasts specific title.",
    rss: '<channel><itunes:title>a title here</itunes:title></channel>',
    json: '{ "_microfeed": {"itunes:title": "a title here"} }',
  },
  [CONTROLS.CHANNEL_ITUNES_EXPLICIT]: {
    linkName: '<itunes:explicit>',
    modalTitle: 'Channel / <itunes:explicit>',
    text: "",
    rss: '<channel><itunes:explicit>true</itunes:explicit></channel>',
    json: '{ "_microfeed": {"itunes:explicit": true} }',
  },
  [CONTROLS.CHANNEL_ITUNES_BLOCK]: {
    linkName: '<itunes:block>',
    modalTitle: 'Channel / <itunes:block>',
    text: "",
    rss: '<channel><itunes:block>Yes</itunes:block></channel>',
    json: '{ "_microfeed": {"itunes:block": true} }',
  },
  [CONTROLS.CHANNEL_ITUNES_COMPLETE]: {
    linkName: '<itunes:complete>',
    modalTitle: 'Channel / <itunes:complete>',
    text: "",
    rss: '<channel><itunes:complete>Yes</itunes:complete></channel>',
    json: '{ "_microfeed": {"itunes:complete": true} }',
  },
  [CONTROLS.CHANNEL_ITUNES_NEW_RSS_URL]: {
    linkName: '<itunes:new-rss-url>',
    modalTitle: 'Channel / <itunes:new-rss-url>',
    text: "",
    rss: '<channel><itunes:new-rss-url>https://a-new-rss-url.com/feed</itunes:new-rss-url></channel>',
    json: '{ "_microfeed": {"itunes:new-rss-url": "https://a-new-rss-url.com/feed"} }',
  },
};
