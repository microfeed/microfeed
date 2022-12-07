export const ITEM_CONTROLS = {
  TITLE: 'item_title',
  IMAGE: 'item_image',
  MEDIA_FILE: 'item_media_file',
  PUB_DATE: 'item_pub_date',
  LINK: 'item_link',
  DESCRIPTION: 'item_description',
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
    rss: '<channel><item><enclosure url="https://cdn-site.com/img.png" type="image/png" length="277000"/></item></channel>',
    json: '{ "items": [{"attachments": [{"url": "https://cdn-site.com/img.png", "mime_type": "image/png", "size_in_byte": 277000 }]}] }',
  },

  [ITEM_CONTROLS.PUB_DATE]: {
    linkName: 'Published date',
    modalTitle: 'Item / Published date',
    text: "An item's title. It could be a podcast episode's title, a blog post's title, a custom title of a curated article...",
    rss: '<channel><item><title>Title Here</title></item></channel>',
    json: '{ "items": [{"title": "Title Here"}] }',
  },
  [ITEM_CONTROLS.LINK]: {
    linkName: 'Link',
    modalTitle: 'Item / Link',
    text: "An item's title. It could be a podcast episode's title, a blog post's title, a custom title of a curated article...",
    rss: '<channel><item><title>Title Here</title></item></channel>',
    json: '{ "items": [{"title": "Title Here"}] }',
  },
  [ITEM_CONTROLS.DESCRIPTION]: {
    linkName: 'Description',
    modalTitle: 'Item / Description',
    text: "An item's title. It could be a podcast episode's title, a blog post's title, a custom title of a curated article...",
    rss: '<channel><item><title>Title Here</title></item></channel>',
    json: '{ "items": [{"title": "Title Here"}] }',
  },
};
