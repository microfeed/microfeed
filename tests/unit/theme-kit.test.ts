import {cp, mkdtemp, readFile, symlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {SyntaxValidator} from "fast-xml-validator";
import * as z from "zod";

import {loadThemePackage} from "../../packages/theme-kit/src/package";
import {jsonFeedFixtureToRss} from "../../packages/theme-kit/src/cli";
import {renderThemeKitHelp} from "../../packages/theme-kit/src/help";
import {generatedThemeReadme} from "../../packages/theme-kit/src/readme";
import {
  THEME_MAX_TEMPLATE_BYTES,
  themeContextSchema,
  themeManifestV1Schema,
} from "@/shared/themes/ThemeContract";

const temporaryDirectories: string[] = [];

async function themeDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "microfeed-theme-kit-test-"));
  temporaryDirectories.push(directory);
  await cp(
    new URL("../../packages/theme-kit/assets/starter/", import.meta.url),
    directory,
    {recursive: true},
  );
  return directory;
}

afterEach(async () => {
  const {rm} = await import("node:fs/promises");
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, {force: true, recursive: true})
  ));
});

describe("@microfeed/theme-kit package loading", () => {
  it("preserves channel images and media metadata in JSON Feed RSS previews", () => {
    const rss = jsonFeedFixtureToRss({
      version: "https://jsonfeed.org/version/1.1",
      title: "Demo & Friends",
      description: "A demo feed",
      home_page_url: "https://demo.example/",
      feed_url: "https://demo.example/json/",
      icon: "/assets/channel.png",
      authors: [{name: "Banana Inc"}],
      language: "en",
      items: [{
        id: "episode-1",
        title: "An episode",
        url: "/items/episode-1/",
        content_html: "<p>Show notes</p>",
        date_published: "2026-08-10T12:00:00Z",
        image: "/assets/episode.png",
        authors: [{name: "Ada"}],
        attachments: [{
          duration_in_seconds: 90,
          mime_type: "audio/mpeg",
          size_in_bytes: 1234,
          url: "/media/episode.mp3",
        }],
      }],
      _microfeed: {
        base_url: "https://demo.example/",
        categories: [{name: "Technology", categories: [{name: "Tech News"}]}],
        copyright: "© 2026 Demo",
        next_url: "/json/?next_cursor=next",
        subscribe_methods: [{name: "RSS", type: "rss", url: "/rss/"}],
      },
    });

    expect(SyntaxValidator.validate(rss)).toBe(true);
    expect(rss).toContain('<atom:link rel="self" href="https://demo.example/rss/"');
    expect(rss).toContain('<atom:link rel="next" href="https://demo.example/json/?next_cursor=next"');
    expect(rss).toContain('<itunes:author>Banana Inc</itunes:author>');
    expect(rss).toContain('<itunes:image href="https://demo.example/assets/channel.png"/>');
    expect(rss).toContain('<image><title>Demo &amp; Friends</title><url>https://demo.example/assets/channel.png</url><link>https://demo.example/</link></image>');
    expect(rss).toContain('<itunes:category text="Technology"><itunes:category text="Tech News"/></itunes:category>');
    expect(rss).toContain('<itunes:image href="https://demo.example/assets/episode.png"/>');
    expect(rss).toContain('<enclosure url="https://demo.example/media/episode.mp3" type="audio/mpeg" length="1234"/>');
    expect(rss).toContain('<itunes:duration>00:01:30</itunes:duration>');
  });

  it("documents general and command-specific executable usage", () => {
    expect(renderThemeKitHelp()).toContain("theme-kit <command>");
    expect(renderThemeKitHelp()).toContain("--version");
    expect(renderThemeKitHelp()).toContain(
      "https://docs.microfeed.org/theme-kit-cli/",
    );
    expect(renderThemeKitHelp("validate")).toContain("[--json]");
    expect(renderThemeKitHelp("fixture pull")).toContain("--output <file>");
  });

  it("keeps generated schemas and agent instructions synchronized", async () => {
    const starter = new URL(
      "../../packages/theme-kit/assets/starter/",
      import.meta.url,
    );
    const [manifestSchema, contextSchema, readme] = await Promise.all([
      readFile(new URL(".microfeed/schemas/manifest.schema.json", starter), "utf8"),
      readFile(new URL(".microfeed/schemas/theme-context.schema.json", starter), "utf8"),
      readFile(new URL("THEME.md", starter), "utf8"),
    ]);
    expect(JSON.parse(manifestSchema)).toEqual(z.toJSONSchema(themeManifestV1Schema));
    expect(JSON.parse(contextSchema)).toEqual(z.toJSONSchema(themeContextSchema));
    expect(readme).toBe(generatedThemeReadme());
  });

  it("loads the starter as a complete text-only package", async () => {
    const loaded = await loadThemePackage(await themeDirectory());
    expect(loaded.manifest.packageId).toBe("example.my-theme");
    expect(loaded.assetFiles).toEqual([]);
    expect(loaded.bundle.webFeed).toContain("{{#items}}");
    const starterPackage = JSON.parse(await readFile(
      new URL("../../packages/theme-kit/assets/starter/package.json", import.meta.url),
      "utf8",
    )) as {scripts?: Record<string, string>};
    expect(starterPackage.scripts).toMatchObject({
      preview: "theme-kit preview .",
      test: "theme-kit test . --json",
      validate: "theme-kit validate . --json",
    });
  });

  it("rejects symlinked declared files", async () => {
    const directory = await themeDirectory();
    await symlink(
      path.join(directory, "web-feed.mustache"),
      path.join(directory, "linked-feed.mustache"),
    );
    const manifestFile = path.join(directory, "microfeed-theme.json");
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    manifest.files.webFeed = "linked-feed.mustache";
    await writeFile(manifestFile, JSON.stringify(manifest));
    await expect(loadThemePackage(directory)).rejects.toThrow("Symlinks are not allowed");
  });

  it("rejects unsupported declared asset types", async () => {
    const directory = await themeDirectory();
    const manifestFile = path.join(directory, "microfeed-theme.json");
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    manifest.assets = ["assets/payload.exe"];
    await writeFile(manifestFile, JSON.stringify(manifest));
    await writeFile(path.join(directory, "assets", "payload.exe"), "payload");
    await expect(loadThemePackage(directory)).rejects.toThrow("Unsupported theme asset type");
  });

  it("rejects oversized and non-UTF-8 template files before loading them", async () => {
    const oversized = await themeDirectory();
    await writeFile(
      path.join(oversized, "web-feed.mustache"),
      "x".repeat(THEME_MAX_TEMPLATE_BYTES + 1),
    );
    await expect(loadThemePackage(oversized)).rejects.toThrow("exceeds");

    const binary = await themeDirectory();
    await writeFile(
      path.join(binary, "web-feed.mustache"),
      new Uint8Array([0xff, 0xfe]),
    );
    await expect(loadThemePackage(binary)).rejects.toThrow("valid UTF-8");
  });
});
