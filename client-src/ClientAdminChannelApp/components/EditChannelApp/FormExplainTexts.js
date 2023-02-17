export const CHANNEL_CONTROLS = {
  TITLE: 'channel_title',
  IMAGE: 'channel_image',
  PUBLISHER: 'channel_publisher',
  WEBSITE: 'channel_website',
  CATEGORIES: 'channel_categories',
  LANGUAGE: 'channel_language',
  DESCRIPTION: 'channel_description',
  ITUNES_TYPE: 'channel_itunes_type',
  ITUNES_EMAIL: 'channel_itunes_email',
  COPYRIGHT: 'channel_copyright',
  ITUNES_TITLE: 'channel_itunes_title',
  ITUNES_EXPLICIT: 'channel_itunes_explicit',
  ITUNES_BLOCK: 'channel_itunes_block',
  ITUNES_NEW_RSS_URL: 'channel_itunes_new_rss_url',
  ITUNES_COMPLETE: 'channel_itunes_complete',
};

export const CONTROLS_TEXTS_DICT = {
  [CHANNEL_CONTROLS.TITLE]: {
    linkName: 'Title',
    modalTitle: 'Channel / Title',
    text: "A channel's name. <br>" +
      "If this channel is a podcast, then it would be a podcast name, e.g., The Joe Rogan Experience, The Daily...<br>" +
      "If this is a blog, then it's the blog site's name, e.g., TechCrunch, Daring Fireball...",
    rss: '<channel><title>Title Here</title></channel>',
    json: '{ "title": "Title Here" }',
  },
  [CHANNEL_CONTROLS.IMAGE]: {
    linkName: 'Channel image',
    modalTitle: 'Channel / Image',
    text: "A channel's image.<br>" +
      "If it's a podcast, then the image must be a minimum size of 1400 x 1400 pixels and a maximum size of 3000 x 3000 pixels, " +
      "in JPEG or PNG format, 72 dpi, with appropriate file extensions (.jpg, .png), and in the RGB colorspace - " +
      "this is the requirement of Apple Podcasts.",
    rss: '<channel><itunes:image href="https://cdn-site.com/img.jpg" /><image><url>https://cdn-site.com/img.jpg</url></image></channel>',
    json: '{ "icon": "https://cdn-site.com/img.jpg" }',
  },
  [CHANNEL_CONTROLS.PUBLISHER]: {
    linkName: 'Publisher',
    modalTitle: 'Channel / Publisher',
    text: "A channel's author / publisher. <br>" +
      "If this channel is a podcast, then it would be the publisher's name, e.g., Gimlet Media, New York Times, Joe Rogan...",
    rss: '<channel><itunes:author>Publisher Here</itunes:author></channel>',
    json: '{ "authors": [{"name": "Publisher Here"}] }',
  },
  [CHANNEL_CONTROLS.WEBSITE]: {
    linkName: 'Website',
    modalTitle: 'Channel / Website',
    text: "A channel's website. By default, it's the url of this website. " +
      "But you can set it to fit your use case, e.g., your homepage on your university's website.",
    rss: '<channel><link>Website Here</link></channel>',
    json: '{ "home_page_url": "Website Here" }',
  },
  [CHANNEL_CONTROLS.CATEGORIES]: {
    linkName: 'Categories',
    modalTitle: 'Channel / Categories',
    text: "A channel's categories. All available categories are from <a href='https://podcasters.apple.com/support/1691-apple-podcasts-categories'>Apple Podcasts</a>.<br>" +
      "If this is apodcast, although you can specify more than one category, Apple Podcasts only recognizes the first category and subcategory.",
    rss: '<channel><itunes:category text="Arts" /></channel>',
    json: '{ "_microfeed": {"categories": [{"name": "Arts"}]} }',
  },
  [CHANNEL_CONTROLS.LANGUAGE]: {
    linkName: 'Language',
    modalTitle: 'Channel / Language',
    text: "A channel's language.<br>The primary language for the feed in the format specified in RFC 5646. " +
      "The value is usually a 2-letter language tag from ISO 639-1, optionally followed by a region tag. " +
      "(Examples: en or en-US.)",
    rss: '<channel><language>en-us</language></channel>',
    json: '{ "language": "en-us" }',
  },
  [CHANNEL_CONTROLS.DESCRIPTION]: {
    linkName: 'Description',
    modalTitle: 'Channel / Description',
    text: "A channel's description.<br>" +
      "If this channel is a podcast, the maximum amount of text allowed for the description is 4000 characters - this is a requirement of Apple Podcasts.<br>" +
      "If this is a blog, then you can write as many words as you want for the description.",
    rss: '<channel><description><![CDATA[ <p>some html here</p> ]]></description></channel>',
    json: '{ "description": "<p>some html here</p>" }',
  },
  [CHANNEL_CONTROLS.ITUNES_TYPE]: {
    linkName: '<itunes:type>',
    modalTitle: 'Channel / <itunes:type>',
    text: "The type of show.<br>" +
      "If your show is Serial you must use this tag.<br>" +
      "Its values can be one of the following:<br>" +
      "<b>Episodic</b> (default). Specify episodic when episodes are intended to be consumed without any specific order. Apple Podcasts will present newest episodes first and display the publish date (required) of each episode. If organized into seasons, the newest season will be presented first - otherwise, episodes will be grouped by year published, newest first.<br>" +
      "For new subscribers, Apple Podcasts adds the newest, most recent episode in their Library.<br>" +
      "<b>Serial</b>. Specify serial when episodes are intended to be consumed in sequential order. Apple Podcasts will present the oldest episodes first and display the episode numbers (required) of each episode. If organized into seasons, the newest season will be presented first and itunes:episode numbers must be given for each episode.",
    rss: '<channel><itunes:type>episodic</itunes:type></channel>',
    json: '{ "_microfeed": {"itunes:type": "episodic"} }',
  },
  [CHANNEL_CONTROLS.ITUNES_EMAIL]: {
    linkName: '<itunes:email>',
    modalTitle: 'Channel / <itunes:email>',
    text: "The podcast owner's contact email. It'll be public in the rss feed. Many podcast platforms require this email to validate your podcast ownership.",
    rss: '<channel><itunes:owner><itunes:email>myname@mycompany.com</itunes:email></itunes:owner></channel>',
    json: '{ "_microfeed": {"itunes:email": "myname@mycompany.com"} }',
  },
  [CHANNEL_CONTROLS.COPYRIGHT]: {
    linkName: 'Copyright',
    modalTitle: 'Channel / Copyright',
    text: "The show copyright details.<br>" +
      "If your show is copyrighted you should use this tag. For example:<br>" +
      "<em>Copyright 1995-2019 John John Appleseed</em>",
    rss: '<channel><copyright>©2023</copyright></channel>',
    json: '{ "_microfeed": {"itunes:type": "©2023"} }',
  },
  [CHANNEL_CONTROLS.ITUNES_TITLE]: {
    linkName: '<itunes:title>',
    modalTitle: 'Channel / <itunes:title>',
    text: "The show title specific for Apple Podcasts.<br>" +
      "itunes:title is a string containing a clear concise name of your show on Apple Podcasts.",
    rss: '<channel><itunes:title>a title here</itunes:title></channel>',
    json: '{ "_microfeed": {"itunes:title": "a title here"} }',
  },
  [CHANNEL_CONTROLS.ITUNES_EXPLICIT]: {
    linkName: '<itunes:explicit>',
    modalTitle: 'Channel / <itunes:explicit>',
    text: "The podcast parental advisory information.<br>" +
      "If you specify yes, indicating the presence of explicit content, Apple Podcasts displays an Explicit parental advisory graphic for your podcast.<br>" +
      "Podcasts containing explicit material aren’t available in some Apple Podcasts territories.<br>" +
      "If you specify no, indicating that your podcast doesn’t contain explicit language or adult content, Apple Podcasts displays a Clean parental advisory graphic for your podcast.",
    rss: '<channel><itunes:explicit>true</itunes:explicit></channel>',
    json: '{ "_microfeed": {"itunes:explicit": true} }',
  },
  [CHANNEL_CONTROLS.ITUNES_BLOCK]: {
    linkName: '<itunes:block>',
    modalTitle: 'Channel / <itunes:block>',
    text: "The podcast show or hide status in Apple Podcasts.<br>" +
      "If you want your show removed from the Apple directory, select 'yes'.<br>" +
      "Specifying the itunes:block tag with a 'yes' value, prevents the entire podcast from appearing in Apple Podcasts.<br>" +
      "Specifying any value other than 'yes' has no effect.",
    rss: '<channel><itunes:block>Yes</itunes:block></channel>',
    json: '{ "_microfeed": {"itunes:block": true} }',
  },
  [CHANNEL_CONTROLS.ITUNES_COMPLETE]: {
    linkName: '<itunes:complete>',
    modalTitle: 'Channel / <itunes:complete>',
    text: "The podcast update status.<br>" +
      "If you will never publish another episode to your show, select 'yes'.<br>" +
      "Specifying the itunes:complete tag with a 'yes' value indicates that a podcast is complete and you will not post any more episodes in the future.<br>" +
      "Specifying any value other than 'yes' has no effect.",
    rss: '<channel><itunes:complete>Yes</itunes:complete></channel>',
    json: '{ "_microfeed": {"itunes:complete": true} }',
  },
  [CHANNEL_CONTROLS.ITUNES_NEW_RSS_URL]: {
    linkName: '<itunes:new-rss-url>',
    modalTitle: 'Channel / <itunes:new-rss-url>',
    text: "The new podcast RSS Feed URL.<br>" +
      "If you change the URL of your podcast feed, you should use this tag in your new feed.<br>" +
      "Use the itunes:new-feed-url tag to manually change the URL where your podcast is located.<br>" +
      "You should maintain your old feed until you have migrated your existing subscribers. Learn how to update your podcast RSS feed URL.<br>" +
      "Note: The itunes:new-feed-url tag reports new feed URLs to Apple Podcasts and isn’t displayed in Apple Podcasts.",
    rss: '<channel><itunes:new-rss-url>https://a-new-rss-url.com/feed</itunes:new-rss-url></channel>',
    json: '{ "_microfeed": {"itunes:new-rss-url": "https://a-new-rss-url.com/feed"} }',
  },
};
