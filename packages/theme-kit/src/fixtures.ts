export const BUILT_IN_FIXTURES: Record<string, Record<string, unknown>> = {
  empty: {
    version: "https://jsonfeed.org/version/1.1",
    title: "Empty feed",
    home_page_url: "https://example.test/",
    items: [],
  },
  minimal: {
    version: "https://jsonfeed.org/version/1.1",
    title: "Minimal feed",
    home_page_url: "https://example.test/",
    items: [{id: "one", title: "Hello", content_text: "A short post."}],
  },
  rich: {
    version: "https://jsonfeed.org/version/1.1",
    title: "A very long feed title intended to exercise wrapping in narrow viewports",
    description: "Rich content and long text",
    home_page_url: "https://example.test/",
    items: [{id: "rich", title: "Rich content", content_html: "<p><strong>Bold</strong>, <em>italic</em>, and a <a href=\"https://example.test/\">link</a>.</p>", _microfeed: {web_url: "https://example.test/i/rich/"}}],
  },
  pagination: {
    version: "https://jsonfeed.org/version/1.1",
    title: "Paginated feed",
    next_url: "https://example.test/json/?next_cursor=next",
    items: [{id: "page", title: "Page item", content_text: "More pages follow."}],
    _microfeed: {items_next_cursor: "next", items_order: "desc", items_sort: "published_at"},
  },
  media: {
    version: "https://jsonfeed.org/version/1.1",
    title: "Media feed",
    items: [
      {id: "audio", title: "Audio", attachments: [{url: "https://example.test/audio.mp3", mime_type: "audio/mpeg", duration_in_seconds: 90}], _microfeed: {is_audio: true}},
      {id: "video", title: "Video", attachments: [{url: "https://example.test/video.mp4", mime_type: "video/mp4"}], _microfeed: {is_video: true}},
      {id: "image", title: "Image", image: "https://example.test/image.jpg", _microfeed: {is_image: true}},
      {id: "document", title: "Document", attachments: [{url: "https://example.test/document.pdf", mime_type: "application/pdf"}], _microfeed: {is_document: true}},
      {id: "external", title: "External", external_url: "https://example.test/article", _microfeed: {is_external_url: true}},
    ],
  },
  missing_optional: {
    version: "https://jsonfeed.org/version/1.1",
    items: [{id: "missing", title: "Only required fields"}],
  },
  authors_and_subscriptions: {
    version: "https://jsonfeed.org/version/1.1",
    title: "Many authors",
    authors: [{name: "Ada"}, {name: "Grace"}],
    items: [{id: "authors", title: "Authored", authors: [{name: "Ada"}]}],
    _microfeed: {subscribe_methods: [{name: "RSS", url: "https://example.test/rss/"}, {name: "JSON Feed", url: "https://example.test/json/"}]},
  },
  hostile_html: {
    version: "https://jsonfeed.org/version/1.1",
    title: "Trusted-code fixture",
    items: [{id: "hostile", title: "Potentially hostile HTML", content_html: "<img src=x onerror=\"document.body.dataset.fixture='executed'\"><script>document.documentElement.dataset.fixtureScript='executed'</script>"}],
  },
};
