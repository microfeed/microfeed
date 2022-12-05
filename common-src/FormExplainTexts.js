export const CONTROLS = {
  CHANNEL_TITLE: 'channel_title',
  CHANNEL_ITUNES_COMPLETE: 'channel_itunes_complete',
};

export const CONTROLS_TEXTS_DICT = {
  [CONTROLS.CHANNEL_TITLE]: {
    linkName: 'Title',
    modalTitle: 'Channel / Title',
    text: "A channel's name. If this channel is a podcast, then it would be a podcast name.",
    rss: '<channel><title>Title Here</title></channel>',
    json: '"title": "Title Here"',
  },
  [CONTROLS.CHANNEL_ITUNES_COMPLETE]: {
    linkName: '<itunes:complete>',
    modalTitle: 'Channel / <itunes:complete>',
    text: "",
    rss: '<channel><title>Title Here</title></channel>',
    json: '"_microfeed": {"<itunes:complete>": "yes"}',
  },
};
