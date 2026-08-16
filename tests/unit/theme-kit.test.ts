import {execFile} from "node:child_process";
import {access, cp, mkdtemp, readFile, symlink, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {promisify} from "node:util";
import {afterEach, describe, expect, it} from "vitest";
import {SyntaxValidator} from "fast-xml-validator";
import * as z from "zod";

import {loadThemePackage} from "../../packages/theme-kit/src/package";
import {
  jsonFeedFixtureToRss,
  standaloneThemePreviewDocument,
} from "../../packages/theme-kit/src/cli";
import {renderThemeKitHelp} from "../../packages/theme-kit/src/help";
import {
  generatedGenericThemeRepositoryReadme,
  generatedThemeReadme,
} from "../../packages/theme-kit/src/readme";
import {
  THEME_MAX_TEMPLATE_BYTES,
  themeContextSchema,
  themeManifestV1Schema,
} from "@/shared/themes/ThemeContract";

const temporaryDirectories: string[] = [];
const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "../..");

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
    const [manifestSchema, contextSchema, readme, repositoryReadme, manifest] =
      await Promise.all([
      readFile(new URL(".microfeed/schemas/manifest.schema.json", starter), "utf8"),
      readFile(new URL(".microfeed/schemas/theme-context.schema.json", starter), "utf8"),
      readFile(new URL("THEME.md", starter), "utf8"),
      readFile(new URL("README.md", starter), "utf8"),
      readFile(new URL("microfeed-theme.json", starter), "utf8").then(JSON.parse),
    ]);
    expect(JSON.parse(manifestSchema)).toEqual(z.toJSONSchema(themeManifestV1Schema));
    expect(JSON.parse(contextSchema)).toEqual(z.toJSONSchema(themeContextSchema));
    expect(readme).toBe(generatedThemeReadme());
    expect(repositoryReadme).toBe(generatedGenericThemeRepositoryReadme(manifest));
  });

  it("documents which Pages are available to theme navigation", () => {
    type ObjectSchema = {
      description?: string;
      items?: ObjectSchema;
      properties?: Record<string, ObjectSchema>;
      required?: string[];
    };
    const contextSchema = z.toJSONSchema(themeContextSchema) as ObjectSchema;
    const description = contextSchema.properties?.navigation_pages?.description;

    expect(description).toContain("only Published Pages");
    expect(description).toContain("Show in navigation setting is enabled");
    expect(description).toContain("in the order chosen in Admin");
    expect(description).toContain("Draft and Unlisted Pages");
    expect(description).toContain("special 404 Page never appear");
    expect(description).toContain("website-only");
    expect(contextSchema.properties?.navigation_pages?.items?.required)
      .toEqual([
        "id",
        "navigation_label",
        "navigation_order",
        "slug",
        "title",
        "url",
      ]);
    expect(contextSchema.properties?.page?.required).toEqual(expect.arrayContaining([
      "content_html",
      "date_created",
      "date_modified",
      "is_not_found_page",
      "status",
    ]));
    expect(contextSchema.properties?.page?.properties)
      .toHaveProperty("meta_description");
    expect(contextSchema.properties?.search?.description)
      .toContain("microfeed owns the public endpoint");
    expect(
      contextSchema.properties?.search?.properties?.results?.items?.properties,
    ).toMatchObject({
      content_text: expect.any(Object),
      date_published: expect.any(Object),
      highlights: expect.any(Object),
      title: expect.any(Object),
      type: expect.any(Object),
      url: expect.any(Object),
    });
  });

  it("gives new theme repositories a complete public-site contract", async () => {
    const starter = new URL(
      "../../packages/theme-kit/assets/starter/",
      import.meta.url,
    );
    const [bridge, skill, reference, bodyStart, search, header, fixture] = await Promise.all([
      readFile(new URL("CLAUDE.md", starter), "utf8"),
      readFile(new URL(".agents/skills/develop-microfeed-theme/SKILL.md", starter), "utf8"),
      readFile(new URL(".agents/skills/develop-microfeed-theme/references/public-site.md", starter), "utf8"),
      readFile(new URL("web-body-start.mustache", starter), "utf8"),
      readFile(new URL("web-search.mustache", starter), "utf8"),
      readFile(new URL("web-header.mustache", starter), "utf8"),
      readFile(new URL("fixtures/custom.json", starter), "utf8").then(JSON.parse),
    ]);

    expect(bridge).toContain(
      ".agents/skills/develop-microfeed-theme/SKILL.md",
    );
    expect(bridge).toContain("Resolve every referenced file relative");
    expect(skill).toContain("migrating a theme to v2");
    expect(skill).toContain("references/public-site.md");
    expect(reference).toContain("Theme and platform responsibilities");
    expect(reference).toContain("Do not copy the search dialog");
    expect(reference).toContain("special 404 Page");
    expect(reference).toContain("data-microfeed-search-details");
    expect(reference).toContain("at least three entries");
    expect(bodyStart).toContain("{{#navigation_pages}}");
    expect(bodyStart).toContain("data-microfeed-nav-item");
    expect(bodyStart).toContain("data-microfeed-search-open");
    expect(search).toContain('action="/search/"');
    expect(search).toContain('method="get"');
    expect(search).toContain('name="q"');
    expect(search).toContain("data-microfeed-search-input");
    expect(search).toContain("data-microfeed-search-results");
    expect(search).toContain("data-microfeed-search-details");
    expect(header).toContain("--mf-accent:");
    expect(header).toContain("--mf-background:");
    expect(header).toContain("-webkit-line-clamp: 2");
    expect(fixture.items).toHaveLength(2);

    const theme = await loadThemePackage(fileURLToPath(starter));
    const feedHtml = standaloneThemePreviewDocument(theme, fixture, "feed");
    const searchHtml = standaloneThemePreviewDocument(theme, fixture, "search");
    for (const label of ["About", "Contact", "Projects"]) {
      expect(feedHtml).toContain(`>${label}</a>`);
    }
    expect(feedHtml).toContain("data-microfeed-search-dialog");
    expect(searchHtml).toContain("data-microfeed-search-details");
    expect(searchHtml).toContain('"type":"item"');
    expect(searchHtml).toContain('"type":"page"');
  });

  it("keeps every bundled theme-development skill copy synchronized", async () => {
    const paths = [
      path.join(repositoryRoot, ".agents/skills/develop-microfeed-theme"),
      path.join(
        repositoryRoot,
        "packages/theme-kit/assets/starter/.agents/skills/develop-microfeed-theme",
      ),
      path.join(
        repositoryRoot,
        "themes/default/.agents/skills/develop-microfeed-theme",
      ),
    ];
    const skills = await Promise.all(paths.map((directory) =>
      readFile(path.join(directory, "SKILL.md"), "utf8")
    ));
    const references = await Promise.all(paths.map((directory) =>
      readFile(path.join(directory, "references/public-site.md"), "utf8")
    ));

    expect(new Set(skills).size).toBe(1);
    expect(new Set(references).size).toBe(1);

    const bridges = await Promise.all([
      "packages/theme-kit/assets/starter/CLAUDE.md",
      "themes/default/CLAUDE.md",
    ].map((filename) => readFile(path.join(repositoryRoot, filename), "utf8")));
    expect(new Set(bridges).size).toBe(1);
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

  it("creates an independent Yarn project boundary for new repositories", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "microfeed-theme-kit-init-"));
    temporaryDirectories.push(parent);
    const output = path.join(parent, ".microfeed", "themes", "example-theme");
    await execFileAsync(process.execPath, [
      "--import",
      "tsx",
      path.join(repositoryRoot, "packages/theme-kit/src/cli.ts"),
      "init",
      output,
    ], {cwd: repositoryRoot});

    await expect(readFile(path.join(output, "yarn.lock"), "utf8"))
      .resolves.toBe("");
    await expect(readFile(path.join(output, "package.json"), "utf8"))
      .resolves.toContain("@microfeed/theme-kit");
    const packageJson = JSON.parse(
      await readFile(path.join(output, "package.json"), "utf8"),
    ) as {packageManager?: string};
    const rootPackageJson = JSON.parse(
      await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
    ) as {packageManager?: string};
    expect(packageJson.packageManager).toBe(rootPackageJson.packageManager);
    await expect(readFile(path.join(output, ".yarnrc.yml"), "utf8"))
      .resolves.toBe(
        "nodeLinker: node-modules\n" +
          "npmPreapprovedPackages:\n" +
          "  - \"@microfeed/theme-kit\"\n",
      );
    await expect(readFile(path.join(output, ".gitignore"), "utf8"))
      .resolves.toBe(".yarn/\nnode_modules/\n");
    await expect(readFile(path.join(output, "CLAUDE.md"), "utf8"))
      .resolves.toContain(
        ".agents/skills/develop-microfeed-theme/SKILL.md",
      );
    await expect(access(path.join(
      output,
      ".agents/skills/develop-microfeed-theme/SKILL.md",
    ))).resolves.toBeUndefined();
  });

  it("resolves relative paths from the invoking workspace directory", async () => {
    const result = await execFileAsync(process.execPath, [
      "--import",
      "tsx",
      path.join(repositoryRoot, "packages/theme-kit/src/cli.ts"),
      "validate",
      ".",
      "--json",
    ], {
      cwd: path.join(repositoryRoot, "themes/default"),
      env: {...process.env, PROJECT_CWD: repositoryRoot},
    });
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      packageId: "microfeed.default",
    });
  });

  it("injects the shared public search component into standalone previews", async () => {
    const theme = await loadThemePackage(
      path.join(repositoryRoot, "themes/default"),
    );
    const html = standaloneThemePreviewDocument(theme, {
      home_page_url: "https://example.test/",
      items: [{
        _microfeed: {web_url: "https://example.test/i/searchable/"},
        content_text: "A searchable preview excerpt.",
        date_published: "2026-08-13T10:00:00.000Z",
        id: "searchable",
        title: "Searchable preview item",
      }],
      title: "Search preview fixture",
      version: "https://jsonfeed.org/version/1.1",
    }, "feed");

    expect(html).toContain("data-microfeed-search-open");
    expect(html).toContain("data-microfeed-search-dialog");
    expect(html).toContain(
      "Live search is unavailable in preview. Showing preview results instead.",
    );
    expect(html).toContain('"title":"Searchable preview item"');
    expect(html).toContain('"date_published":"2026-08-13T10:00:00.000Z"');
    expect(html).toContain("lockBackgroundScroll(scrollPosition)");
    expect(html).toContain("(event.metaKey || event.ctrlKey)");
  });

  it("bundles the default theme color menu into standalone previews", async () => {
    const theme = await loadThemePackage(
      path.join(repositoryRoot, "themes/default"),
    );
    const html = standaloneThemePreviewDocument(theme, {
      home_page_url: "https://example.test/",
      items: [],
      title: "Theme preview fixture",
      version: "https://jsonfeed.org/version/1.1",
    }, "feed");

    expect(html).toContain("data-microfeed-theme-menu");
    expect(html).toContain('data-microfeed-theme-option="system"');
    expect(html).toContain('data-microfeed-theme-option="light"');
    expect(html).toContain('data-microfeed-theme-option="dark"');
    expect(html).toContain("microfeed-public-theme");
    expect(html).toContain("prefers-color-scheme: dark");
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
