import {readFile, readdir} from "node:fs/promises";
import path from "node:path";

import {describe, expect, it} from "vitest";

import {BUNDLED_THEME_CATALOG} from "@/shared/themes/BundledThemeCatalog";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const mediaExtension = /\.(?:avif|gif|jpe?g|m4a|mov|mp3|mp4|ogg|png|svg|wav|webm|webp)$/iu;

interface FixtureItem {
  attachments?: Array<{mime_type?: string; url?: string}>;
  banner_image?: string;
  image?: string;
}

interface Fixture {
  icon?: string;
  items?: FixtureItem[];
}

interface MediaNotes {
  media: Array<{licenseName: string; sourcePage: string; url: string}>;
}

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {withFileTypes: true});
  return (await Promise.all(entries.map(async (entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(filename) : [filename];
  }))).flat();
}

function fixtureMediaUrls(fixture: Fixture): string[] {
  const urls = new Set<string>();
  if (fixture.icon) urls.add(fixture.icon);
  for (const item of fixture.items ?? []) {
    if (item.image) urls.add(item.image);
    if (item.banner_image) urls.add(item.banner_image);
    for (const attachment of item.attachments ?? []) {
      if (
        attachment.url &&
        /^(?:audio|image|video)\//u.test(attachment.mime_type ?? "")
      ) {
        urls.add(attachment.url);
      }
    }
  }
  return [...urls];
}

describe("Built-in theme fixture media", () => {
  it("uses documented direct HTTPS media without checked-in binaries", async () => {
    for (const entry of BUNDLED_THEME_CATALOG) {
      const directory = path.join(repositoryRoot, "themes", entry.directory);
      const fixture = JSON.parse(await readFile(
        path.join(directory, entry.manifest.previewFixture!),
        "utf8",
      )) as Fixture;
      const notes = JSON.parse(await readFile(
        path.join(directory, "fixture-media.json"),
        "utf8",
      )) as MediaNotes;
      const documented = new Map(notes.media.map((media) => [media.url, media]));

      for (const url of fixtureMediaUrls(fixture)) {
        const parsed = new URL(url);
        expect(parsed.protocol, `${entry.key}: ${url}`).toBe("https:");
        expect(parsed.hostname, `${entry.key}: ${url}`).not.toBe("example.test");
        const media = documented.get(url);
        expect(media, `${entry.key}: missing license notes for ${url}`).toBeDefined();
        expect(media?.licenseName.trim()).not.toBe("");
        expect(new URL(media!.sourcePage).protocol).toBe("https:");
      }

      const packagedMedia = (await filesUnder(directory))
        .filter((filename) => mediaExtension.test(filename));
      expect(packagedMedia, entry.key).toEqual([]);
    }
  });
});
