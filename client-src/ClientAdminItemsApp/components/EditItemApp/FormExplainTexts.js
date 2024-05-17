import { ITEM_STATUSES_DICT } from "../../../../common-src/Constants";

export const ITEM_CONTROLS = {
  TITLE: "item_title",
  IMAGE: "item_image",
  MEDIA_FILE: "item_media_file",
  PUB_DATE: "item_pub_date",
  LINK: "item_link",
  DESCRIPTION: "item_description",
  GUID: "item_guid",
  ITUNES_EXPLICIT: "item_itunes_explicit",
  ITUNES_TITLE: "item_itunes_title",
  ITUNES_EPISODE_TYPE: "item_itunes_episode_type",
  ITUNES_SEASON: "item_itunes_season",
  ITUNES_EPISODE: "item_itunes_episode",
  ITUNES_BLOCK: "item_itunes_block",
  STATUS: "item_status",
  LANGUAGE: "item_language",
  CATEGORY: "item_category",
};

export const CONTROLS_TEXTS_DICT = {
  [ITEM_CONTROLS.TITLE]: {
    linkName: "Title",
    modalTitle: "Item / Title",
    text:
      "An item's title. It could be a podcast episode's title, a blog post's title, a custom title of a curated article...<br>" +
      "If it's a podcast episode, please don’t specify the episode number or season number in this tag. " +
      "Instead, specify those details in the appropriate tags ( <itunes:episode>, <itunes:season>). " +
      "Also, don’t repeat the title of your show within your episode title.",
    rss: "<channel><item><title>Title Here</title></item></channel>",
    json: '{ "items": [{"title": "Title Here"}] }',
  },
  [ITEM_CONTROLS.IMAGE]: {
    linkName: "Item image",
    modalTitle: "Item / Image",
    text:
      "A square-sized image specific to this item. " +
      "If it's a podcast episode, the image size should be a minimum size of 1400 x 1400 pixels and a maximum size of 3000 x 3000 pixels, " +
      "in JPEG or PNG format, 72 dpi, with appropriate file extensions (.jpg, .png), and in the RGB colorspace - this is a requirement of Apple Podcasts.",
    rss: '<channel><item><itunes:image href="https://cdn-site.com/img.jpg" /></item></channel>',
    json: '{ "items": [{"image": "https://cdn-site.com/img.jpg"}] }',
  },
  [ITEM_CONTROLS.MEDIA_FILE]: {
    linkName: "Media file",
    modalTitle: "Item / Media file",
    text:
      "An item can have a main media file. For example, if it's a podcast episode, then a media file should be an audio; " +
      "if it's a self-hosted photo album, then a media file should be a high-definition image; " +
      "if it's a content curation site, then a media file could be an external url (e.g., an article url from New York Times).<br>" +
      "To track download stats of a media file, you can add 3rd-party tracking urls " +
      "(e.g., <a href='https://op3.dev/'>OP3</a>, <a href='http://analytics.podtrac.com/'>Podtrac</a>, <a href='https://chartable.com/'>Chartable</a>...) at <a href='/admin/settings/'>Settings / Tracking urls</a>.",
    rss: '<channel><item><enclosure url="https://cdn-site.com/audio.mp3" type="audio/mpeg" length="277000"/><itunes:duration>00:21:02</itunes:duration></item></channel>',
    json: '{ "items": [{"attachments": [{"url": "https://cdn-site.com/audio.mp3", "mime_type": "audio/mpeg", "size_in_byte": 277000, "duration_in_seconds": 1262 }], "_microfeed": {"duration_hhmmss": "00:21:02"}}] }',
  },
  [ITEM_CONTROLS.PUB_DATE]: {
    linkName: "Published date",
    modalTitle: "Item / Published date",
    text: "The date and time when an item was released.",
    rss: "<channel><item><pubDate>Wed, 30 Nov 2022 04:31:48 GMT</pubDate></item></channel>",
    json: '{ "items": [{"date_published": "2022-11-30T04:31:31.867Z", "_microfeed": {"date_published_ms": 1669782691867, "date_published_short": "Tue Nov 29 2022"}}] }',
  },
  [ITEM_CONTROLS.LINK]: {
    linkName: "Link",
    modalTitle: "Item / Link",
    text: "An item's web link. By default, it's a web page on your microfeed. But you can set it to fit your use case.",
    rss: "<channel><item><link>https://example.com/page1.html</link></item></channel>",
    json: '{ "items": [{"url": "https://example.com/page1.html"}] }',
  },
  [ITEM_CONTROLS.DESCRIPTION]: {
    linkName: "Description",
    modalTitle: "Item / Description",
    text:
      "An item's description. <br>" +
      "If this is a podcast episode, you'd better limit the description length to be within 4000 characters, " +
      "or Apple Podcasts and other podcast apps/websites may truncate the text.<br>" +
      "If this is a blog post, then you can write as many words as you want :)",
    rss: "<channel><item><description><![CDATA[<p>some text here<br></p>]]></description></item></channel>",
    json: '{ "items": [{"content_html": "<p>some text here<br></p>", "content_text": "some text here"}] }',
  },
  [ITEM_CONTROLS.GUID]: {
    linkName: "<guid>",
    modalTitle: "Item / GUID",
    text:
      "An item's guid. By default, it's the id of this item. But you can set it to fit your use case.<br>" +
      "It is very important that each episode have a unique GUID and that it never changes once it's set, even if an episode’s metadata, like title or enclosure URL, do change.<br>" +
      "Failing to comply with these guidelines may result in duplicate episodes being shown to listeners, inaccurate data in Analytics, and can cause issues with your podcasts’s listing and chart placement in Apple Podcasts and other podcast apps/websites.",
    rss: "<channel><item><guid>z9H7LSkykS1</guid></item></channel>",
    json: '{ "items": [{"_microfeed": {"guid": "z9H7LSkykS1"}}] }',
  },
  [ITEM_CONTROLS.ITUNES_EXPLICIT]: {
    linkName: "<itunes:explicit>",
    modalTitle: "Item / <itunes:explicit>",
    text:
      "The episode parental advisory information.<br>" +
      "If you specify yes, indicating the presence of explicit content, Apple Podcasts displays an Explicit parental advisory graphic for your episode. Episodes containing explicit material aren’t available in some Apple Podcasts territories.<br>" +
      "If you specify no, indicating that the episode does not contain explicit language or adult content, Apple Podcasts displays a Clean parental advisory graphic for your episode.",
    rss: "<channel><item><itunes:explicit>false</itunes:explicit></item></channel>",
    json: '{ "items": [{"_microfeed": {"itunes:explicit": true}}] }',
  },
  [ITEM_CONTROLS.ITUNES_TITLE]: {
    linkName: "<itunes:title>",
    modalTitle: "Item / <itunes:title>",
    text:
      "An episode title specific for Apple Podcasts." +
      "itunes:title is a string containing a clear concise name of your episode on Apple Podcasts.<br>" +
      "Don’t specify the episode number or season number in this tag. Instead, specify those details in the appropriate tags ( itunes:episode, itunes:season). Also, don’t repeat the title of your show within your episode title.<br>" +
      "Separating episode and season number from the title makes it possible for Apple to easily index and order content from all shows.",
    rss: "<channel><item><itunes:title>Title Here</itunes:title></item></channel>",
    json: '{ "items": [{"_microfeed": {"itunes:title": "Title Here"}}] }',
  },
  [ITEM_CONTROLS.ITUNES_EPISODE_TYPE]: {
    linkName: "<itunes:episodeType>",
    modalTitle: "Item / <itunes:episodeType>",
    text:
      "The episode type in Apple Podcasts.<br>" +
      "If an episode is a trailer or bonus content, use this tag.<br>" +
      "Where the episodeType value can be one of the following:<br>" +
      "<b>full</b> (default). Specify full when you are submitting the complete content of your show.<br>" +
      "<b>trailer</b>. Specify trailer when you are submitting a short, promotional piece of content that represents a preview of your current show.<br>" +
      "<b>bonus</b>. Specify bonus when you are submitting extra content for your show (for example, behind the scenes information or interviews with the cast) or cross-promotional content for another show.",
    rss: "<channel><item><itunes:episodeType>full</itunes:episodeType></item></channel>",
    json: '{ "items": [{"_microfeed": {"itunes:episodeType": "full"}}] }',
  },
  [ITEM_CONTROLS.ITUNES_SEASON]: {
    linkName: "<itunes:season>",
    modalTitle: "Item / <itunes:season>",
    text:
      "The episode season number in Apple Podcasts.<br>" +
      "If an episode is within a season use this tag.<br>" +
      "Where season is a non-zero integer (1, 2, 3, etc.) representing your season number.<br>" +
      "To allow the season feature for shows containing a single season, if only one season exists in the RSS feed, Apple Podcasts doesn’t display a season number. When you add a second season to the RSS feed, Apple Podcasts displays the season numbers.",
    rss: "<channel><item><itunes:season>2</itunes:season></item></channel>",
    json: '{ "items": [{"_microfeed": {"itunes:season": 2}}] }',
  },
  [ITEM_CONTROLS.ITUNES_EPISODE]: {
    linkName: "<itunes:episode>",
    modalTitle: "Item / <itunes:episode>",
    text:
      "An episode number in Apple Podcasts.<br>" +
      "If all your episodes have numbers and you would like them to be ordered based on them, use this tag for each one.<br>" +
      "Episode numbers are optional for itunes:type episodic shows, but are mandatory for serial shows.<br>" +
      "Where episode is a non-zero integer (1, 2, 3, etc.) representing your episode number.<br>" +
      "If you are using your RSS feed to distribute a free version of an episode that is already available to Apple Podcasts paid subscribers, make sure the episode numbers are the same so you don’t have duplicate episodes appear on your show page. Learn more about how to set up your show for a subscription.",
    rss: "<channel><item><itunes:episode>3</itunes:episode></item></channel>",
    json: '{ "items": [{"_microfeed": {"itunes:episode": 3}}] }',
  },
  [ITEM_CONTROLS.ITUNES_BLOCK]: {
    linkName: "<itunes:block>",
    modalTitle: "Item / <itunes:block>",
    text:
      "The episode show or hide status on Apple Podcasts.<br>" +
      "If you want an episode removed from the Apple directory, select 'yes'.<br>" +
      "Specifying the itunes:block tag with a 'yes' value prevents that episode from appearing in Apple Podcasts.<br>" +
      "For example, you might want to block a specific episode if you know that its content would otherwise cause the entire podcast to be removed from Apple Podcasts.<br>" +
      "Specifying any value other than 'yes' has no effect.",
    rss: "<channel><item><itunes:block>Yes</itunes:block></item></channel>",
    json: '{ "items": [{"_microfeed": {"itunes:block": true}}] }',
  },
  [ITEM_CONTROLS.STATUS]: {
    linkName: "Item status",
    modalTitle: "Item / status",
    text:
      "An item's status is either published, unlisted, or unpublished. <ul class='list-decimal list-inside'>" +
      `${Object.keys(ITEM_STATUSES_DICT)
        .map(
          (k) =>
            `<li>${ITEM_STATUSES_DICT[k].name}: ${ITEM_STATUSES_DICT[k].description}</li>`
        )
        .join("")}` +
      "</ul>",
  },
  [ITEM_CONTROLS.LANGUAGE]: {
    linkName: "Language",
    modalTitle: "Item / Language",
    text:
      "The language of the item. Specify the language using an ISO 639-1 code.<br>" +
      "For example, use 'en' for English, 'es' for Spanish, etc.",
    rss: "<channel><item><language>en</language></item></channel>",
    json: '{ "items": [{"language": "en"}] }',
  },
  [ITEM_CONTROLS.CATEGORY]: {
    linkName: "Category",
    modalTitle: "Item / Category",
    text:
      "The category of the item. Specify the category using a standard category name.<br>" +
      "For example, use 'Technology', 'Health', 'Education', etc.",
    rss: "<channel><item><category>Technology</category></item></channel>",
    json: '{ "items": [{"category": "Technology"}] }',
  },
};
