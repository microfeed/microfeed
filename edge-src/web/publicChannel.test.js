import {serializeChannelForWeb} from "./publicChannel";

describe("serializeChannelForWeb", () => {
  test("prefixes a bucket-relative channel image with publicBucketUrl", () => {
    const channel = {title: "Site", image: "media-x/production/images/channel-abc.jpeg"};
    const result = serializeChannelForWeb(channel, "https://media.example.com");
    expect(result.image).toBe("https://media.example.com/media-x/production/images/channel-abc.jpeg");
    expect(result.title).toBe("Site");
  });

  test("leaves an absolute-rooted image resolving against site root", () => {
    const channel = {image: "/assets/default/channel-image.png"};
    const result = serializeChannelForWeb(channel, "https://media.example.com");
    // urlJoinWithRelative keeps root-absolute paths on the site origin.
    expect(result.image).toBe("/assets/default/channel-image.png");
  });

  test("returns the channel unchanged when there is no image", () => {
    const channel = {title: "No Image"};
    expect(serializeChannelForWeb(channel, "https://media.example.com")).toEqual({title: "No Image"});
  });

  test("handles empty publicBucketUrl without throwing", () => {
    const channel = {image: "media-x/production/images/channel-abc.jpeg"};
    const result = serializeChannelForWeb(channel, "");
    expect(result.image).toBe("/media-x/production/images/channel-abc.jpeg");
  });

  test("tolerates a null channel", () => {
    expect(serializeChannelForWeb(null, "https://media.example.com")).toEqual({});
  });
});
