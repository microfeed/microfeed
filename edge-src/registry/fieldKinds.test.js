import {STATUSES} from "../../common-src/Constants";
import {validate, toInternal, toPublic} from "./fieldKinds";

describe("fieldKinds", () => {
  test("text and richtext validate strings and round-trip unchanged", () => {
    const textDef = {kind: "text", required: true};
    const richtextDef = {kind: "richtext"};

    expect(validate(textDef, "hello")).toBeNull();
    expect(validate(textDef, "")).toMatch(/required/i);
    expect(toInternal(textDef, "hello")).toBe("hello");
    expect(toPublic(textDef, "hello")).toBe("hello");

    expect(validate(richtextDef, "<p>hello</p>")).toBeNull();
    expect(toInternal(richtextDef, "<p>hello</p>")).toBe("<p>hello</p>");
    expect(toPublic(richtextDef, "<p>hello</p>")).toBe("<p>hello</p>");
  });

  test("media strips URL hosts and restores the public attachment shape", () => {
    const def = {kind: "media"};
    const publicValue = {
      category: "audio",
      url: "https://cdn.example.com/media/audio.mp3",
      mime_type: "audio/mpeg",
      size_in_bytes: 100,
      duration_in_seconds: 10,
    };

    expect(validate(def, publicValue)).toBeNull();
    expect(toInternal(def, publicValue)).toEqual({
      category: "audio",
      url: "media/audio.mp3",
      contentType: "audio/mpeg",
      sizeByte: 100,
      durationSecond: 10,
    });
    expect(toPublic(def, {
      category: "audio",
      url: "media/audio.mp3",
      contentType: "audio/mpeg",
      sizeByte: 100,
      durationSecond: 10,
    })).toEqual({
      ...publicValue,
      url: "media/audio.mp3",
    });
  });

  test("image and url validate and round-trip", () => {
    const imageDef = {kind: "image"};
    const urlDef = {kind: "url", required: true};

    expect(validate(imageDef, "https://cdn.example.com/image.png")).toBeNull();
    expect(toInternal(imageDef, "https://cdn.example.com/image.png")).toBe("image.png");
    expect(toPublic(imageDef, "image.png")).toBe("image.png");

    expect(validate(urlDef, "https://example.com/page")).toBeNull();
    expect(validate(urlDef, "not-a-url")).toMatch(/valid url/i);
    expect(toInternal(urlDef, "https://example.com/page")).toBe("https://example.com/page");
    expect(toPublic(urlDef, "https://example.com/page")).toBe("https://example.com/page");
  });

  test("boolean, number, date, enum, tags, and reference validate as expected", () => {
    expect(validate({kind: "boolean", required: true}, true)).toBeNull();
    expect(validate({kind: "boolean"}, "true")).toMatch(/boolean/i);

    expect(validate({kind: "number", integer: true}, "12")).toBeNull();
    expect(toInternal({kind: "number", integer: true}, "12")).toBe(12);
    expect(toPublic({kind: "number", integer: true}, 12)).toBe(12);
    expect(validate({kind: "number", integer: true}, "12.5")).toMatch(/integer/i);

    expect(validate({kind: "date"}, 1672707197212)).toBeNull();
    expect(toInternal({kind: "date"}, "2023-01-03T00:35:14.212Z")).toBe(1672706114212);
    expect(toPublic({kind: "date"}, 1672706114212)).toBe(1672706114212);

    const statusDef = {
      kind: "enum",
      options: ["published", "unlisted", "unpublished"],
      valueMap: {
        published: STATUSES.PUBLISHED,
        unlisted: STATUSES.UNLISTED,
        unpublished: STATUSES.UNPUBLISHED,
      },
    };
    expect(validate(statusDef, "published")).toBeNull();
    expect(toInternal(statusDef, "published")).toBe(STATUSES.PUBLISHED);
    expect(toPublic(statusDef, STATUSES.PUBLISHED)).toBe("published");
    expect(validate(statusDef, "archived")).toMatch(/one of/i);

    const multipleEnumDef = {
      kind: "enum",
      multiple: true,
      options: ["podcast_episode", "blog_article", "photo"],
    };
    expect(validate(multipleEnumDef, ["photo", "blog_article"])).toBeNull();
    expect(toInternal(multipleEnumDef, ["photo", "blog_article"])).toEqual(["photo", "blog_article"]);
    expect(validate(multipleEnumDef, ["photo", "gallery"])).toMatch(/one of/i);

    const tagsDef = {kind: "tags"};
    expect(validate(tagsDef, ["tag_1", "tag_2"])).toBeNull();
    expect(toInternal(tagsDef, ["tag_1", "tag_2"])).toEqual(["tag_1", "tag_2"]);
    expect(toPublic(tagsDef, ["tag_1", "tag_2"])).toEqual(["tag_1", "tag_2"]);

    const referenceDef = {kind: "reference"};
    expect(validate(referenceDef, ["item_a", "item_b"])).toBeNull();
    expect(toInternal(referenceDef, ["item_a", "item_b"])).toEqual(["item_a", "item_b"]);
    expect(toPublic(referenceDef, ["item_a", "item_b"])).toEqual(["item_a", "item_b"]);
  });

  test("string_list validates an array of non-empty strings and round-trips unchanged", () => {
    const def = {kind: "string_list"};

    expect(validate(def, ["tag_1", "tag_2"])).toBeNull();
    expect(toInternal(def, ["tag_1", "tag_2"])).toEqual(["tag_1", "tag_2"]);
    expect(toPublic(def, ["tag_1", "tag_2"])).toEqual(["tag_1", "tag_2"]);

    expect(validate(def, "not-an-array")).toMatch(/array/i);
    expect(validate(def, ["tag_1", ""])).toMatch(/non-empty strings/i);
  });
});
