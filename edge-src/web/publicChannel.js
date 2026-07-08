import {urlJoinWithRelative} from "../../common-src/StringUtils";

/**
 * Prepares a channel object for the public web layer. The channel's stored
 * image is a bucket-relative path (e.g. "media-<x>/production/images/..."),
 * just like item images — but unlike items it is NOT run through the feed
 * serializer, so nothing prefixes the public bucket URL. Left raw it renders
 * relative to the page origin (e.g. *.pages.dev) and 404s. This joins it with
 * publicBucketUrl the same way FeedItemSerializer does for image fields, so
 * the nav logo and home hero resolve to the real bucket URL. No image ->
 * channel returned unchanged (callers fall back to the text brand).
 */
export function serializeChannelForWeb(channel, publicBucketUrl = "") {
  const c = channel || {};
  if (!c.image) {
    return c;
  }
  return {...c, image: urlJoinWithRelative(publicBucketUrl, c.image)};
}

export default serializeChannelForWeb;
