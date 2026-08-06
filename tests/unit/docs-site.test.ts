import {readdir, readFile, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const docsRoot = path.join(repositoryRoot, "docs");

async function documentationFiles(
  directory = docsRoot,
): Promise<string[]> {
  const entries = await readdir(directory, {withFileTypes: true});
  const files: string[] = [];
  for (const entry of entries) {
    if (["dist", "node_modules", "public", "scripts", "src"].includes(
      entry.name,
    )) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await documentationFiles(entryPath));
    } else if (/\.mdx?$/u.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

function frontmatter(source: string): string {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/u);
  const metadata = match?.[1];
  if (!metadata) throw new Error("Missing frontmatter");
  return metadata;
}

describe("documentation site", () => {
  it("keeps every guide directly readable with required metadata", async () => {
    const files = await documentationFiles();
    expect(files.length).toBeGreaterThanOrEqual(20);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      const metadata = frontmatter(source);
      expect(metadata, file).toMatch(/^title: .+/mu);
      expect(metadata, file).toMatch(/^description: .+/mu);
    }

    const mdxFiles = files
      .filter((file) => file.endsWith(".mdx"))
      .map((file) => path.relative(docsRoot, file));
    expect(mdxFiles).toEqual(["index.mdx"]);
  });

  it("keeps the initial documentation release free of content images", async () => {
    const files = await documentationFiles();
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source, file).not.toMatch(/!\[[^\]]*\]\([^)]+\)/u);
      expect(source, file).not.toMatch(/<img\b/u);
      expect(source, file).not.toContain("/screenshots/");
    }

    await expect(stat(path.join(docsRoot, "public", "screenshots")))
      .rejects.toThrow();
  });

  it("keeps the homepage concise and links readers to deeper guidance", async () => {
    const homepage = await readFile(path.join(docsRoot, "index.mdx"), "utf8");

    expect(homepage).toContain(
      "description: Publish on your own domain with a lightweight, open-source, headless CMS that runs entirely on Cloudflare.",
    );
    expect(homepage).toContain(
      '<span class="hero-line hero-topic-line"><span>Publish</span><span class="sr-only">blogs, podcasts, documents, video, audio, and curations</span>',
    );
    expect(homepage).toContain(
      '<br><span class="hero-line">on your own domain</span><br><span class="hero-line">without hosting fees</span>',
    );
    expect(homepage).toContain(
      "tagline: A <span class=\"brand-highlight\">lightweight</span>, <span class=\"brand-highlight\">open-source</span> CMS that runs entirely in your <span class=\"cloudflare-brand\">Cloudflare</span> account. Bring a domain you own; microfeed provides a website, RSS and JSON feeds, and a <span class=\"brand-highlight\">headless</span> Admin API. It’s <span class=\"brand-highlight\">serverless</span>!",
    );
    expect(homepage).toContain(
      'Own <span class="brand-highlight">your code</span> and <span class="brand-highlight">your data</span>.',
    );
    expect(homepage.match(/class="brand-highlight"/gu)).toHaveLength(6);
    expect(homepage).toContain(
      '<aside class="r2-capacity-card" aria-label="10 GB of media storage included">',
    );
    expect(homepage).toContain(
      '<p class="r2-capacity-title">of media storage included</p>',
    );
    expect(homepage).toContain(
      '<span class="r2-capacity-badge">For free!</span>',
    );
    expect(homepage).not.toContain("Included monthly");
    for (const capacity of [
      "10,000</strong> optimized images",
      "300 hours</strong> of podcast audio",
      "5–10 hours</strong> of HD video",
      "5,000</strong> typical PDFs",
    ]) {
      expect(homepage).toContain(capacity);
    }
    expect(homepage).toContain(
      "Estimates based on typical optimized files. Actual capacity varies.",
    );
    expect(homepage).toContain(
      'class="r2-capacity-link" href="https://developers.cloudflare.com/r2/pricing/" target="_blank" rel="noreferrer"',
    );
    expect(homepage).toContain("link: /start-here/");
    expect(homepage).toContain(
      "link: https://github.com/microfeed/microfeed",
    );
    expect(homepage).toContain("target: _blank");
    expect(homepage).toContain("rel: noreferrer");

    for (const reason of [
      "Open source",
      "Serverless",
      "Free-tier friendly",
      "Headless",
    ]) {
      expect(homepage).toContain(`<h3>${reason}</h3>`);
    }
    expect(homepage).toContain(
      "https://developers.cloudflare.com/r2/pricing/",
    );
    expect(homepage).toContain(
      "Standard R2 includes 10 GB-month of storage and free egress",
    );
    expect(homepage.replaceAll(/<[^>]+>/gu, "")).toContain(
      "Deploy microfeed to Cloudflare.",
    );
    expect(homepage).toContain("/start-here/ai-agent/");

    for (const topic of [
      "podcasts",
      "blogs",
      "documents",
      "video",
      "audio",
      "curations",
    ]) {
      expect(homepage).toContain(`<span>${topic}</span>`);
    }
    expect(homepage).toContain('class="sr-only"');
    expect(homepage).toContain('class="rotating-topic" aria-hidden="true"');
    expect(homepage).toContain(
      '<span class="rotating-topic-track"><span>blogs</span><span>podcasts</span>',
    );
    expect(homepage.match(/class="cloudflare-brand"/gu)).toHaveLength(4);
    expect(homepage).toContain(
      "```console\n   git clone https://github.com/microfeed/microfeed.git\n   ```",
    );
    expect(homepage).toContain(
      "```text frame=\"terminal\"\n   Deploy microfeed to Cloudflare.\n   ```",
    );
    expect(homepage).toContain(
      '<footer class="home-attribution" aria-label="Site attribution">',
    );
    expect(homepage).toContain(
      '<a href="https://www.listennotes.com" target="_blank" rel="noreferrer">Listen Notes, Inc.',
    );
    expect(homepage).toContain(
      '<a class="home-cloudflare-link" href="https://www.cloudflare.com" target="_blank" rel="noreferrer">Cloudflare',
    );
    expect(homepage).toContain(
      ", not affiliated with <a class=\"home-cloudflare-link\"",
    );
    expect(homepage).not.toContain("<pre><code>");

    const customCss = await readFile(
      path.join(docsRoot, "src", "styles", "custom.css"),
      "utf8",
    );
    expect(customCss).toContain("--microfeed-sky: #19b7fa;");
    expect(customCss).toContain("--microfeed-ink: #2c2b3d;");
    expect(customCss).toContain("--cloudflare-orange: #f48120;");
    expect(customCss).toContain(
      "--cloudflare-wordmark: var(--cloudflare-orange);",
    );
    expect(customCss).toMatch(
      /:root,[\s\S]*?--sl-color-text-accent: var\(--microfeed-sky\);[\s\S]*?--sl-color-bg: #ffffff;[\s\S]*?--sl-color-bg-nav: rgba\(245, 247, 250, 0\.94\);/u,
    );
    expect(customCss).toMatch(
      /:root\[data-theme="dark"\],[\s\S]*?--sl-color-text-accent: #19b7fa;[\s\S]*?--sl-color-bg: #171721;[\s\S]*?--cloudflare-wordmark: var\(--cloudflare-orange\);/u,
    );
    expect(customCss).not.toContain(":root[data-has-hero] {");
    expect(customCss).toMatch(
      /\.rotating-topic \{[\s\S]*?color: var\(--microfeed-sky\);/u,
    );
    expect(customCss).toMatch(
      /\.cloudflare-brand \{[\s\S]*?color: var\(--cloudflare-wordmark\);[\s\S]*?font-weight: 650;/u,
    );
    expect(customCss).toMatch(
      /\.brand-highlight \{[\s\S]*?background: #ffe45e;[\s\S]*?color: var\(--microfeed-ink\);/u,
    );
    expect(customCss).toMatch(
      /\.why-grid \{[\s\S]*?grid-auto-rows: 1fr;[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/u,
    );
    expect(customCss).toMatch(
      /\.why-card \{[\s\S]*?height: 100%;[\s\S]*?margin: 0;/u,
    );
    expect(customCss).toMatch(
      /\.r2-capacity-card \{[\s\S]*?border-radius: 1\.5rem;[\s\S]*?var\(--sl-color-black\);/u,
    );
    expect(customCss).toMatch(
      /html\[data-has-hero\]:not\(\[data-has-sidebar\]\) \{[\s\S]*?--sl-content-width: 75rem;/u,
    );
    expect(customCss).toMatch(
      /\.hero > \.hero-html \{[\s\S]*?width: min\(100%, 34rem\);/u,
    );
    expect(customCss).toMatch(
      /@media \(min-width: 50rem\) \{[\s\S]*?grid-template-columns: 8fr 5fr;/u,
    );
    expect(customCss).toMatch(
      /\.r2-capacity-card::before \{[\s\S]*?var\(--microfeed-sky\),[\s\S]*?var\(--cloudflare-orange\)/u,
    );
    expect(customCss).toMatch(
      /\.r2-capacity-list li \+ li::before \{[\s\S]*?content: "or";/u,
    );
    expect(customCss).toMatch(
      /\.home-attribution \{[\s\S]*?border-top: 1px solid var\(--sl-color-hairline-light\);[\s\S]*?text-align: center;/u,
    );
    expect(customCss).not.toMatch(
      /\.rotating-topic \{[^}]*background(?:-color)?:/u,
    );
    expect(customCss).not.toMatch(
      /\.cloudflare-brand \{[^}]*text-decoration/u,
    );
    expect(customCss).toMatch(
      /:root\[data-has-hero\]\[data-theme="light"\] \.hero \.sl-link-button\.primary \{[\s\S]*?background: var\(--microfeed-ink\);[\s\S]*?color: #ffffff;/u,
    );
    expect(customCss).toMatch(
      /\.sl-markdown-content a:not\(\[class\]\) \{[\s\S]*?font-weight: 700;[\s\S]*?text-underline-offset: 0\.18em;/u,
    );
    expect(customCss).toMatch(
      /\.hero h1 \{[\s\S]*?max-width: none;[\s\S]*?line-height: 1\.1;/u,
    );
    expect(customCss).toMatch(
      /\.hero-topic-line \{[\s\S]*?display: inline-flex;[\s\S]*?column-gap: 0\.18em;/u,
    );
    expect(customCss).toMatch(
      /\.quick-start-list \.expressive-code pre,[\s\S]*?\.quick-start-list \.expressive-code \.code \{[\s\S]*?overflow-wrap: anywhere;[\s\S]*?white-space: pre-wrap;/u,
    );
    expect(customCss).toContain("@keyframes rotate-homepage-topic");
    expect(customCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.rotating-topic-track \{[\s\S]*?animation: none;/u,
    );

    for (const route of [
      "/dashboard/channel-and-feeds/",
      "/dashboard/publish/",
      "/dashboard/",
      "/dashboard/customize/",
      "/api/",
      "/manage/",
    ]) {
      expect(homepage).toContain(`href="${route}"`);
    }

    for (const removedSection of [
      "Publish once. Reach people and software.",
      "From zero to a working site",
      "What the dashboard covers",
      "Choose what you need",
      "Live examples",
    ]) {
      expect(homepage).not.toContain(removedSection);
    }
  });

  it("keeps documentation links on known local routes", async () => {
    const files = await documentationFiles();
    const routes = new Set(files.map((file) => {
      const relativePath = path.relative(docsRoot, file)
        .replace(/\.mdx?$/u, "")
        .replace(/(^|\/)index$/u, "");
      return `/${relativePath}${relativePath ? "/" : ""}`;
    }));
    routes.add("/404/");

    for (const file of files) {
      const source = await readFile(file, "utf8");
      const links = [
        ...source.matchAll(/\]\((\/[^)\s#?]+)(?:[?#][^)]*)?\)/gu),
        ...source.matchAll(/\bhref="(\/[^"#?]+)(?:[?#][^"]*)?"/gu),
        ...source.matchAll(/^\s+link: (\/[^\s#?]+)(?:[?#].*)?$/gmu),
      ].flatMap((match) => match[1] ? [match[1]] : []);
      for (const link of links) {
        expect(routes.has(link), `${file}: ${link}`).toBe(true);
      }
    }
  });

  it("keeps maintainer documentation procedures in the repository skill", async () => {
    await expect(stat(path.join(
      docsRoot,
      "contribute",
      "style-guide.md",
    ))).rejects.toThrow();
    await expect(stat(path.join(
      docsRoot,
      "contribute",
      "publishing.md",
    ))).rejects.toThrow();

    const docsConfig = await readFile(
      path.join(docsRoot, "astro.config.ts"),
      "utf8",
    );
    expect(docsConfig).not.toContain("Documentation style");
    expect(docsConfig).not.toContain("Publish the docs site");

    const documentationSkill = await readFile(path.join(
      repositoryRoot,
      ".agents",
      "skills",
      "document-microfeed",
      "SKILL.md",
    ), "utf8");
    expect(documentationSkill).toContain("name: document-microfeed");
    expect(documentationSkill).toContain("## Write for successful outcomes");
    expect(documentationSkill).toContain("## Maintain the Starlight site");
    expect(documentationSkill).toContain("## Publish safely");
    expect(documentationSkill).toContain("docs.microfeed.org");
  });

  it("keeps the README short and assigns detailed guidance to docs", async () => {
    const readme = await readFile(
      path.join(repositoryRoot, "README.md"),
      "utf8",
    );
    expect(readme.length).toBeLessThan(12_000);
    expect(readme).toContain("https://docs.microfeed.org/");
    expect(readme).toContain("Deploy microfeed to Cloudflare.");
    expect(readme).toContain("docs/manage-cli.md");

    const manageReference = await readFile(
      path.join(docsRoot, "manage-cli.md"),
      "utf8",
    );
    expect(manageReference).toContain(
      "This is the canonical capability reference",
    );
    expect(manageReference).toContain("## `yarn manage deploy`");
    expect(manageReference).toContain("## `yarn manage destroy`");
  });

  it("isolates the Starlight build and configures Pages without a base path", async () => {
    const rootConfig = await readFile(
      path.join(repositoryRoot, "astro.config.ts"),
      "utf8",
    );
    expect(rootConfig).not.toContain("starlight");

    const docsConfig = await readFile(
      path.join(docsRoot, "astro.config.ts"),
      "utf8",
    );
    expect(docsConfig).toContain('site: "https://docs.microfeed.org"');
    expect(docsConfig).not.toMatch(/\bbase\s*:/u);
    expect(docsConfig).toContain("starlightLlmsTxt");
    expect(docsConfig).not.toMatch(/\bsocial:\s*\[/u);
    expect(docsConfig).toContain(
      'SocialIcons: "./src/components/GitHubRepoButtons.astro"',
    );
    expect(docsConfig).toContain(
      'src: "https://buttons.github.io/buttons.js"',
    );

    const githubButtons = await readFile(
      path.join(docsRoot, "src", "components", "GitHubRepoButtons.astro"),
      "utf8",
    );
    expect(githubButtons).toContain(
      'href="https://github.com/microfeed/microfeed/fork"',
    );
    expect(githubButtons).toContain(
      'href="https://github.com/microfeed/microfeed"',
    );
    expect(githubButtons.match(/data-show-count="true"/gu)).toHaveLength(2);
    expect(githubButtons.match(/data-size="large"/gu)).toHaveLength(2);
    expect(githubButtons).toContain(
      'aria-label="Fork microfeed/microfeed on GitHub"',
    );
    expect(githubButtons).toContain(
      'aria-label="Star microfeed/microfeed on GitHub"',
    );

    const workflow = await readFile(
      path.join(repositoryRoot, ".github/workflows/docs.yml"),
      "utf8",
    );
    expect(workflow).toContain("node-version: 24");
    expect(workflow).toContain("yarn install --immutable");
    expect(workflow).toContain("yarn docs:check");
    expect(workflow).toContain("path: docs/dist");
    expect(workflow).toContain("github.event_name != 'pull_request'");
  });

  it("preserves generated per-instance OpenAPI routes without duplicating the spec", async () => {
    const document = await readFile(
      path.join(repositoryRoot, "src/shared/OpenApiDocument.ts"),
      "utf8",
    );
    const generator = await readFile(
      path.join(repositoryRoot, "src/server/openapi/document.ts"),
      "utf8",
    );
    const reference = await readFile(
      path.join(repositoryRoot, "src/server/api/reference.ts"),
      "utf8",
    );
    const versionedYamlRoute = await readFile(
      path.join(repositoryRoot, "src/pages/api/v1/openapi.yaml.ts"),
      "utf8",
    );
    const legacyApiRoute = await readFile(
      path.join(repositoryRoot, "src/pages/api/openapi.yaml.ts"),
      "utf8",
    );
    const legacyJsonRoute = await readFile(
      path.join(repositoryRoot, "src/pages/json/openapi.yaml.ts"),
      "utf8",
    );
    expect(document).toContain("createDocument");
    expect(document).toContain('openapi: "3.1.1"');
    expect(generator).toContain("OPENAPI_YAML");
    expect(reference).toContain("server/openapi/document");
    expect(reference).toContain("getApiOpenApiYaml");
    expect(versionedYamlRoute).toContain("getApiOpenApiYaml as GET");
    expect(legacyApiRoute).toContain("redirectApiDocs");
    expect(legacyApiRoute).toContain("`${API_BASE_PATH}openapi.yaml`");
    expect(legacyJsonRoute).toContain("`${API_BASE_PATH}openapi.yaml`");
    await expect(stat(path.join(docsRoot, "openapi.yaml"))).rejects.toThrow();
  });
});
