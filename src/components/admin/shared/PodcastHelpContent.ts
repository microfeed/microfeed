import type {AdminHelpContent} from "./AdminHelpLabel";

export function getPodcastHelpContent(isItem: boolean) {
  const help = (linkName: string, text: string, rss: string, fields: Record<string, unknown>): AdminHelpContent => ({
    linkName, modalTitle: `${isItem ? "Item" : "Channel"} / ${linkName}`, text,
    rss: isItem ? `<item>\n${rss}\n</item>` : `<channel>\n${rss}\n</channel>`,
    json: JSON.stringify(isItem ? {items: [{_microfeed: {podcast: fields}}]} : {_microfeed: {podcast: fields}}, null, 2),
    jsonNote: "Podcast fields use the _microfeed.podcast extension. On API updates, omitted properties are preserved; null clears a property, and supplied lists replace the whole list.",
    rssReference: {label: "Podcasting 2.0 specification", url: "https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/1.0.md"},
  });
  return {
    transcripts: help("Transcripts", "Link a timed VTT or SRT transcript, or upload one. You can provide multiple languages or formats. " +
      "A transcript improves accessibility in supporting podcast apps. When language is omitted, apps use the feed language. Apple Podcasts may also require choosing publisher-provided transcripts in Podcasts Connect.",
    '<podcast:transcript url="https://example.com/episode.vtt" type="text/vtt" language="en" />',
    {transcripts: [{url: "https://example.com/episode.vtt", type: "text/vtt", language: "en"}]}),
    chapters: help("Chapters", "Divide the episode into named sections with a start time, and optional image and link. " +
      "Use Upload chapter JSON to import a complete list from a file, then review it before replacing any existing chapters. " +
      "Start times must be unique; entries are saved in chronological order. microfeed generates a JSON chapter file from your saved entries without changing the audio file. " +
      "The file is available for published and unlisted items when the site and RSS feed are available.",
    '<podcast:chapters url="https://example.com/i/episode-id/chapters.json" type="application/json+chapters" />',
    {chapters: [{startTime: 0, title: "Introduction"}, {startTime: 90, title: "Main discussion", url: "https://example.com/notes/"}]}),
    people: help("Hosts, guests, and credits", "Credit the people who participate in the podcast with their names, roles, profile links, and photos. " +
      (isItem ? "An episode's list replaces all channel participants, so include the hosts as well as any guests. Clear the list to inherit channel participants."
        : "List the regular participants here. An episode can replace this list with its own participants.") +
      " Podcast participants are separate from SEO authors and the podcast publisher.",
    '<podcast:person role="host" group="cast" href="https://example.com/alex/" img="https://example.com/alex.jpg">Alex Smith</podcast:person>',
    {people: [{name: "Alex Smith", role: "host", group: "cast", href: "https://example.com/alex/", img: "https://example.com/alex.jpg"}]}),
    funding: help("Support the show", "Add donation or membership links with the labels listeners should see in supporting podcast apps, such as Support the show or Become a member.",
    '<podcast:funding url="https://example.com/support/">Support the show</podcast:funding>',
    {funding: [{label: "Support the show", url: "https://example.com/support/"}]}),
    license: help("Content license", "Declare the license that applies to the podcast's audio or video. Choose a listed license, or enter a custom identifier and a link to the full license. " +
      (isItem ? "An episode license overrides the channel license. Remove it to inherit the channel license." : "This is the default license for episodes without their own license.") +
      " This field does not change the separate copyright text.",
    '<podcast:license>cc-by-4.0</podcast:license>', {license: {identifier: "cc-by-4.0"}}),
    locked: help("Feed import lock", "Ask other podcast hosting platforms to reject imports of this feed. Turn the lock off before moving to another host. " +
      "This is an advisory signal; it does not make the feed private or restrict listeners. Unspecified omits the tag. No owner email is published by this setting.",
    '<podcast:locked>yes</podcast:locked>', {locked: true}),
  };
}
