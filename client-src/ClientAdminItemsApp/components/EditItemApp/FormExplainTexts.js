export const ITEM_CONTROLS = {
  TITLE: 'item_title',
  IMAGE: 'item_image',
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
    linkName: 'Item Image',
    modalTitle: 'Item / Image',
    text: "An item's image.",
    rss: '<channel><item><itunes:image href="https://cdn-site.com/img.jpg" /></item></channel>',
    json: '{ "items": [{"image": "https://cdn-site.com/img.jpg"}] }',
  },
};
