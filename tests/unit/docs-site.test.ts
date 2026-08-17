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

  it("publishes optimized screenshots with descriptive placement", async () => {
    const screenshotRoot = path.join(
      docsRoot,
      "public",
      "images",
      "screenshots",
    );
    const expectedAssets = [
      "1-deploy-1.png",
      "1-deploy-2.png",
      "1-deploy-3.png",
      "1-deploy-4.png",
      "1-deploy-5.png",
      "1-deploy-6.png",
      "1-deploy-walkthrough.mp4",
      "2-dashboard-1-home.png",
      "2-dashboard-2-add-item.png",
      "2-dashboard-2-edit-channel.png",
      "2-dashboard-overview-desktop.png",
      "2-dashboard-overview-mobile.png",
      "3-api-1.png",
      "4-code-editor-1.png",
    ];
    for (const asset of expectedAssets) {
      const metadata = await stat(path.join(screenshotRoot, asset));
      expect(metadata.isFile(), asset).toBe(true);
      expect(metadata.size, asset).toBeGreaterThan(1_000);
    }

    const video = await readFile(path.join(
      screenshotRoot,
      "1-deploy-walkthrough.mp4",
    ));
    expect(video.subarray(4, 8).toString("ascii")).toBe("ftyp");
    expect(video.byteLength).toBeLessThan(10_000_000);
    const trackHeaderMarker = video.indexOf(Buffer.from("tkhd"));
    expect(trackHeaderMarker).toBeGreaterThan(4);
    const trackHeaderStart = trackHeaderMarker - 4;
    const trackHeaderSize = video.readUInt32BE(trackHeaderStart);
    const fixedPointScale = 65_536;
    expect(video.readUInt32BE(
      trackHeaderStart + trackHeaderSize - 8,
    ) / fixedPointScale).toBe(2_560);
    expect(video.readUInt32BE(
      trackHeaderStart + trackHeaderSize - 4,
    ) / fixedPointScale).toBe(1_656);
    for (const composite of [
      "2-dashboard-overview-desktop.png",
      "2-dashboard-overview-mobile.png",
    ]) {
      const png = await readFile(path.join(screenshotRoot, composite));
      expect([...png.subarray(0, 8)]).toEqual([
        137,
        80,
        78,
        71,
        13,
        10,
        26,
        10,
      ]);
      expect(png.byteLength, composite).toBeLessThan(500_000);
    }

    const placements = new Map([
      ["dashboard/index.md", "2-dashboard-1-home.png"],
      ["dashboard/edit-channel.md", "2-dashboard-2-edit-channel.png"],
      ["dashboard/publish.md", "2-dashboard-2-add-item.png"],
      ["api/index.md", "3-api-1.png"],
    ]);
    for (const [file, asset] of placements) {
      const source = await readFile(path.join(docsRoot, file), "utf8");
      expect(source, file).toContain(`](/images/screenshots/${asset})`);
      expect(source, file).toMatch(
        new RegExp(`!\\[[^\\]]+\\]\\(/images/screenshots/${asset}\\)`, "u"),
      );
    }

    const deploymentGuide = await readFile(
      path.join(docsRoot, "start-here/ai-agent.md"),
      "utf8",
    );
    expect(deploymentGuide).toContain(
      '<video class="docs-walkthrough" controls autoplay muted playsinline preload="metadata"',
    );
    expect(deploymentGuide).toContain(
      '<source src="/images/screenshots/1-deploy-walkthrough.mp4" type="video/mp4">',
    );
    expect(deploymentGuide).toContain(
      'aria-label="A silent Codex deployment walkthrough',
    );

  });

  it("keeps Edit channel separate from Settings", async () => {
    const dashboardTour = await readFile(
      path.join(docsRoot, "dashboard/index.md"),
      "utf8",
    );
    expect(dashboardTour).toContain(
      "**Edit channel** manages the channel image, title, publisher, website,",
    );
    expect(dashboardTour).toContain(
      "It does not\ncontain the **Edit channel** form.",
    );
    expect(dashboardTour).not.toContain(
      "**Settings** manages channel identity and description",
    );

    const editChannelGuide = await readFile(
      path.join(docsRoot, "dashboard/edit-channel.md"),
      "utf8",
    );
    expect(editChannelGuide).toContain(
      "Select **Edit channel** in the left navigation.",
    );
    expect(editChannelGuide).toContain(
      "Select **Save changes** when the channel is ready to update.",
    );
    expect(editChannelGuide).toContain(
      "Channel changes are never saved on a timer",
    );
    expect(editChannelGuide).toContain("## Keep the copyright year current");
    expect(editChannelGuide).toContain("`{{current_year}}`");
    expect(editChannelGuide).toContain("current UTC year");
    expect(editChannelGuide).toContain(
      "Existing channels with a fixed year are not changed automatically.",
    );
    expect(editChannelGuide).not.toContain(
      "Open **Settings** for the controls on this page.",
    );

    const publishGuide = await readFile(
      path.join(docsRoot, "dashboard/publish.md"),
      "utf8",
    );
    expect(publishGuide).toContain("after a five-second pause");
    expect(publishGuide).toContain(
      "plus completed media uploads and replacements, save immediately",
    );

    const docsConfig = await readFile(
      path.join(docsRoot, "astro.config.ts"),
      "utf8",
    );
    expect(docsConfig).toContain(
      '{ label: "Edit channel", link: "/dashboard/edit-channel/" }',
    );
    expect(docsConfig).toContain(
      '{ label: "Media and feeds", link: "/dashboard/media-and-feeds/" }',
    );

    const mediaAndFeedsGuide = await readFile(
      path.join(docsRoot, "dashboard/media-and-feeds.md"),
      "utf8",
    );
    expect(mediaAndFeedsGuide).toContain(
      "Open **Settings** for the controls on this page.",
    );
    expect(mediaAndFeedsGuide).toContain(
      "separate [Edit channel](/dashboard/edit-channel/) page.",
    );
    expect(mediaAndFeedsGuide).not.toContain(
      "## Channel identity",
    );
  });

  it("separates themes and shared code from site access guidance", async () => {
    const [themesGuide, siteAccessGuide, docsConfig] = await Promise.all([
      readFile(path.join(docsRoot, "dashboard/themes.md"), "utf8"),
      readFile(path.join(docsRoot, "dashboard/customize.md"), "utf8"),
      readFile(path.join(docsRoot, "astro.config.ts"), "utf8"),
    ]);

    expect(themesGuide).toContain("title: Themes and website code");
    expect(themesGuide).toContain("## Edit shared website code");
    expect(themesGuide).toContain("Google Analytics, Meta Pixel");
    expect(themesGuide).toContain("Shared code wraps every installed theme");
    expect(themesGuide).toContain("## Work with versioned themes");
    expect(themesGuide).not.toContain("## Access control");

    expect(siteAccessGuide).toContain("title: Site access");
    expect(siteAccessGuide).toContain("## Compare access modes");
    expect(siteAccessGuide).toContain("| **Public** |");
    expect(siteAccessGuide).toContain("| **Headless** |");
    expect(siteAccessGuide).toContain("| **Offline** |");
    expect(siteAccessGuide).not.toContain("## Edit shared website code");
    expect(siteAccessGuide).not.toContain("## Dashboard authentication");

    expect(docsConfig).toContain(
      '{ label: "Themes and website code", link: "/dashboard/themes/" }',
    );
    expect(docsConfig).toContain(
      '{ label: "Site access", link: "/dashboard/customize/" }',
    );
  });

  it("documents routine login changes separately from password recovery", async () => {
    const authenticationGuide = await readFile(
      path.join(docsRoot, "manage/domains-and-access.md"),
      "utf8",
    );
    expect(authenticationGuide).toContain("### Enable built-in login");
    expect(authenticationGuide).toContain(
      "yarn manage auth setup --instance <instance-name>",
    );
    expect(authenticationGuide).toContain(
      "You do not need to run `yarn manage deploy` separately.",
    );
    expect(authenticationGuide).toContain(
      "You can also ask an AI coding agent that has access to your microfeed project",
    );
    expect(authenticationGuide).toContain("## Change your built-in login");
    expect(authenticationGuide).toContain(
      "select **Account settings**. The **Login & identity** section",
    );
    expect(authenticationGuide).toContain(
      "The current browser remains signed in and microfeed CLI connections stay",
    );
    expect(authenticationGuide).toContain(
      "Every built-in dashboard session, including the current browser, is signed",
    );
    expect(authenticationGuide).toContain(
      "yarn manage auth reset-password --instance <instance-name>",
    );
    expect(authenticationGuide).toContain(
      "Completing recovery signs out all built-in dashboard sessions and revokes",
    );

    const dashboardTour = await readFile(
      path.join(docsRoot, "dashboard/index.md"),
      "utf8",
    );
    expect(dashboardTour).toContain(
      "[**Account settings**](/manage/domains-and-access/#change-your-built-in-login)",
    );

    const managementGuide = await readFile(
      path.join(docsRoot, "manage/index.md"),
      "utf8",
    );
    expect(managementGuide).toContain(
      "| Change the current login email or password | Dashboard avatar → **Account settings** |",
    );
  });

  it("links generated API references to the public versioned demo", async () => {
    const demoUrls = [
      "https://www.microfeed.org/api/v1/",
      "https://www.microfeed.org/api/v1/openapi.json",
      "https://www.microfeed.org/api/v1/openapi.yaml",
      "https://www.microfeed.org/api/v1/llms.txt",
      "https://www.microfeed.org/api/v1/llms-full.txt",
    ];
    const apiOverview = await readFile(
      path.join(docsRoot, "api/index.md"),
      "utf8",
    );
    for (const url of demoUrls) {
      expect(apiOverview).toContain(`](${url})`);
    }
    expect(apiOverview).toContain("`GET /api/v1/feed/`");
    expect(apiOverview).toContain("`<site-url>/api/v1/`");
    expect(apiOverview).not.toContain("`GET /api/feed/`");
    expect(apiOverview).not.toContain("`<site-origin>/api/`");

    const integrationGuide = await readFile(
      path.join(docsRoot, "api/build-and-test.md"),
      "utf8",
    );
    expect(integrationGuide).toContain(
      "https://feed.example.com/api/v1/feed/?limit=3",
    );
    expect(integrationGuide).not.toContain(
      "https://feed.example.com/api/feed/?limit=3",
    );
  });

  it("keeps the homepage concise and links readers to deeper guidance", async () => {
    const homepage = await readFile(path.join(docsRoot, "index.mdx"), "utf8");

    expect(homepage).toContain(
      "description: Publish a website, RSS feed, and JSON Feed from an open-source CMS in your own Cloudflare account.",
    );
    expect(homepage).toContain(
      '<span class="hero-line hero-topic-line"><span>Publish</span><span class="sr-only">blogs, podcasts, documents, video, audio, and curations</span>',
    );
    expect(homepage).toContain(
      '<br><span class="hero-line">on your own domain</span><br><span class="hero-line">without managing servers</span>',
    );
    expect(homepage).toContain(
      "tagline: An <span class=\"brand-highlight\">agentic</span>, <span class=\"brand-highlight\">lightweight</span>, <span class=\"brand-highlight\">open-source</span> CMS that runs in your <span class=\"cloudflare-brand\">Cloudflare</span> account. microfeed gives you a website, RSS and JSON feeds, a private dashboard, and an API for integrations or coding agents.",
    );
    expect(homepage).toContain(
      'Own <span class="brand-highlight">your code</span> and <span class="brand-highlight">your data</span>.',
    );
    expect(homepage.match(/class="brand-highlight"/gu)).toHaveLength(5);
    expect(homepage).toContain(
      '<aside class="r2-capacity-card" aria-label="10 GB-month of free Standard media storage">',
    );
    expect(homepage).toContain(
      '<p class="r2-capacity-title">of Standard storage in the monthly free tier</p>',
    );
    expect(homepage).toContain(
      '<span class="r2-capacity-badge">Free</span>',
    );
    for (const capacity of [
      "10,000</strong> optimized images",
      "300 hours</strong> of podcast audio",
      "5–10 hours</strong> of HD video",
      "5,000</strong> typical PDFs",
    ]) {
      expect(homepage).toContain(capacity);
    }
    expect(homepage).toContain(
      "File-size estimates vary. Cloudflare bills storage as GB-month and also counts operations.",
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
      "Many personal and small sites can stay within",
    );
    for (const pricingUrl of [
      "https://developers.cloudflare.com/workers/platform/pricing/",
      "https://developers.cloudflare.com/d1/platform/pricing/",
      "https://developers.cloudflare.com/r2/pricing/",
    ]) expect(homepage).toContain(pricingUrl);
    expect(homepage).not.toContain("<h2>Quick start</h2>");
    expect(homepage).not.toContain(
      "git clone https://github.com/microfeed/microfeed.git",
    );

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
      '<footer class="home-attribution" aria-label="Site attribution">',
    );
    expect(homepage).toContain(
      '<a href="https://www.listennotes.com" target="_blank" rel="noreferrer">Listen Notes, Inc.',
    );
    expect(homepage).toContain("template: doc");
    expect(homepage).toContain("tableOfContents: false");
    expect(homepage).toContain(
      '<a class="home-cloudflare-link" href="https://www.cloudflare.com" target="_blank" rel="noreferrer">Cloudflare',
    );
    expect(homepage).toContain(
      ", not affiliated with <a class=\"home-cloudflare-link\"",
    );
    expect(homepage).not.toContain("<pre><code>");

    const quickStart = await readFile(
      path.join(docsRoot, "start-here", "index.md"),
      "utf8",
    );
    expect(quickStart).toContain("title: Quick start");
    expect(quickStart).toContain("## Before you begin");
    expect(quickStart).toContain("## Deploy with an agent");
    expect(quickStart).toContain("```console wrap");
    expect(quickStart).toContain(
      "git clone https://github.com/microfeed/microfeed.git",
    );
    expect(quickStart).toContain("cd microfeed");
    expect(quickStart).toContain('```text frame="terminal" wrap');
    expect(quickStart).toContain("Deploy microfeed to Cloudflare.");
    expect(quickStart).toContain(
      '<video class="docs-walkthrough" controls autoplay muted playsinline preload="metadata"',
    );
    expect(quickStart).toContain(
      '<source src="/images/screenshots/1-deploy-walkthrough.mp4" type="video/mp4">',
    );
    const walkthroughIndex = quickStart.indexOf("1-deploy-walkthrough.mp4");
    expect(walkthroughIndex).toBeGreaterThan(
      quickStart.indexOf("The result is a microfeed site"),
    );
    expect(walkthroughIndex).toBeLessThan(
      quickStart.indexOf("## Confirm the installation"),
    );
    expect(quickStart).toContain("## Confirm the installation");
    expect(quickStart).toContain("`yarn manage status`");
    expect(quickStart).toContain("[Deploy with an AI coding agent](./ai-agent/)");
    expect(quickStart).toContain("[Deploy manually](./manual/)");

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
      /html\[data-has-hero\]\[data-has-sidebar\]:not\(\[data-has-toc\]\) \{[\s\S]*?--sl-content-width: 75rem;/u,
    );
    expect(customCss).toMatch(
      /\.hero > \.hero-html \{[\s\S]*?width: min\(100%, 34rem\);/u,
    );
    expect(customCss).toMatch(
      /@media \(min-width: 90rem\) \{[\s\S]*?grid-template-columns: 8fr 5fr;/u,
    );
    expect(customCss).toMatch(
      /@media \(max-width: 50rem\) \{[\s\S]*?\.hero > \.hero-html \{[\s\S]*?margin-block-start: clamp\(2\.5rem, 10vw, 4rem\);/u,
    );
    expect(customCss).toMatch(
      /@media \(min-width: 50rem\) and \(max-width: 89\.999rem\) \{[\s\S]*?\[data-has-hero\]\[data-has-sidebar\] \.hero \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/u,
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
    expect(customCss).not.toContain(".quick-start-list");
    expect(customCss).toContain("@keyframes rotate-homepage-topic");
    expect(customCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.rotating-topic-track \{[\s\S]*?animation: none;/u,
    );

    for (const route of [
      "/dashboard/media-and-feeds/",
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
      const fileRoute = path.relative(docsRoot, file)
        .replace(/\.mdx?$/u, "")
        .replace(/(^|\/)index$/u, "");
      const pageUrl = new URL(
        `/${fileRoute}${fileRoute ? "/" : ""}`,
        "https://docs.microfeed.org",
      );
      const links = [
        ...source.matchAll(/\]\((\/[^)\s#?]+)(?:[?#][^)]*)?\)/gu),
        ...source.matchAll(/\bhref="(\/[^"#?]+)(?:[?#][^"]*)?"/gu),
        ...source.matchAll(/^\s+link: (\/[^\s#?]+)(?:[?#].*)?$/gmu),
      ].flatMap((match) => match[1] ? [match[1]] : []);
      for (const link of links) {
        if (link.startsWith("/images/")) continue;
        expect(routes.has(link), `${file}: ${link}`).toBe(true);
      }

      const relativeLinks = [
        ...source.matchAll(
          /\]\(((?!https?:\/\/|mailto:|#|\/)[^)\s#?]+)(?:[?#][^)]*)?\)/gu,
        ),
      ].flatMap((match) => match[1] ? [match[1]] : []);
      for (const link of relativeLinks) {
        const resolvedRoute = new URL(link, pageUrl).pathname;
        expect(routes.has(resolvedRoute), `${file}: ${link}`).toBe(true);
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
    expect(docsConfig).toContain('label: "Installation"');
    expect(docsConfig).toContain(
      '{ label: "Quick start", link: "/start-here/" }',
    );
    expect(docsConfig).not.toContain('label: "Start here"');
    expect(docsConfig).not.toContain('label: "Choose your path"');
    expect(docsConfig).toContain(
      'favicon:\n        "https://media-cdn.microfeed.org/production/images/favicon-99ed35713d5dad0bb07a4255ec6d73b2.png"',
    );

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
    expect(documentationSkill).toContain(
      "Do not create, capture, add, or replace documentation screenshots unless the",
    );
    const developmentSkill = await readFile(path.join(
      repositoryRoot,
      ".agents",
      "skills",
      "develop-microfeed",
      "SKILL.md",
    ), "utf8");
    expect(developmentSkill).toContain(
      "Do not create or add screenshots unless the user explicitly requests",
    );
  });

  it("keeps the canonical CLI references discoverable in docs", async () => {
    const manageReference = await readFile(
      path.join(docsRoot, "manage-cli.md"),
      "utf8",
    );
    expect(manageReference).toContain(
      "This is the canonical capability reference",
    );
    expect(manageReference).toContain("## `yarn manage deploy`");
    expect(manageReference).toContain("## `yarn manage destroy`");

    const microfeedReference = await readFile(
      path.join(docsRoot, "microfeed-cli.md"),
      "utf8",
    );
    expect(microfeedReference).toContain(
      "This is the canonical capability reference",
    );
    expect(microfeedReference).toContain("title: microfeed cli reference");
    expect(microfeedReference).toContain(
      "npm install --global @microfeed/cli",
    );
    for (const command of [
      "login",
      "logout",
      "instances",
      "item list",
      "item get",
      "item create",
      "item update",
      "item delete",
      "api",
    ]) {
      expect(microfeedReference).toContain(
        `## \`yarn microfeed ${command}\``,
      );
    }
    for (const option of [
      "--instance <name>",
      "--json",
      "--limit <1-300>",
      "--next-cursor <cursor>",
      "--prev-cursor <cursor>",
      "--sort <field>",
      "--order <direction>",
      "--title <text>",
      "--content-html <html>",
      "--date-published <datetime>",
      "--image <url>",
      "--status <status>",
      "--url <url>",
      "--input <file|->",
      "--confirm <item-id>",
      "--header <name:value>",
    ]) {
      expect(microfeedReference).toContain(`\`${option}\``);
    }

    const docsConfig = await readFile(
      path.join(docsRoot, "astro.config.ts"),
      "utf8",
    );
    expect(docsConfig).toContain(
      '{ label: "microfeed cli reference", link: "/microfeed-cli/" }',
    );
    expect(docsConfig).toContain(
      'promote: ["index", "start-here/**", "manage-cli", "microfeed-cli", "theme-kit-cli"]',
    );
  });

  it("publishes the complete webhook and agent automation learning path", async () => {
    const [docsConfig, loader] = await Promise.all([
      readFile(path.join(docsRoot, "astro.config.ts"), "utf8"),
      readFile(path.join(docsRoot, "src", "content.config.ts"), "utf8"),
    ]);
    expect(docsConfig.indexOf('label: "Content automation"')).toBeGreaterThan(
      docsConfig.indexOf('label: "API and integrations"'),
    );
    expect(docsConfig).toContain(
      'label: "Automate microfeed content with webhooks and AI agents"',
    );
    expect(docsConfig).toContain('paths: ["automation/**"');
    expect(loader).toContain('"automation/**/*.md"');

    const pages = new Map<string, string>();
    for (const file of [
      "index.md",
      "setup-and-test.md",
      "ai-agents.md",
      "recipes.md",
      "operations.md",
    ]) {
      const source = await readFile(path.join(docsRoot, "automation", file), "utf8");
      pages.set(file, source);
      expect(source, file).not.toMatch(/!\[[^\]]*\]\(/u);
    }
    expect(pages.get("index.md")).toContain("**webhook** announces what changed");
    expect(pages.get("index.md")).toContain("generated OpenAPI");
    expect(pages.get("setup-and-test.md")).toContain("webhook scaffold");
    expect(pages.get("setup-and-test.md")).toContain(
      ".microfeed/webhooks/endpoint1",
    );
    expect(pages.get("setup-and-test.md")).toContain(
      "<microfeed-root>/packages/cli/.microfeed/webhooks/endpoint1",
    );
    const setup = pages.get("setup-and-test.md") ?? "";
    expect(setup.indexOf("Endpoints → Add endpoint")).toBeGreaterThan(
      setup.indexOf("webhook scaffold"),
    );
    expect(setup.indexOf("yarn install")).toBeGreaterThan(
      setup.indexOf("Endpoints → Add endpoint"),
    );
    expect(setup.indexOf("Event explorer")).toBeGreaterThan(
      setup.indexOf("yarn install"),
    );
    expect(pages.get("setup-and-test.md")).toContain("yarn microfeed webhook listen");
    expect(pages.get("setup-and-test.md")).toContain("webhook.test");
    expect(pages.get("setup-and-test.md")).toContain("**Signing secret**");
    expect(pages.get("setup-and-test.md")).not.toContain(
      "cannot be revealed",
    );
    expect(pages.get("setup-and-test.md")).toContain(
      "Ask a coding agent to enable webhooks",
    );
    expect(pages.get("setup-and-test.md")).toContain(
      "yarn manage deploy --enable-webhooks --instance <name>",
    );
    expect(pages.get("setup-and-test.md")).toContain(
      "standalone `--disable-webhooks`",
    );
    expect(pages.get("ai-agents.md")).toContain("before JSON parsing");
    expect(pages.get("ai-agents.md")).toContain("TypeScript receiver core");
    expect(pages.get("ai-agents.md")).toContain("Python receiver core");
    expect(pages.get("ai-agents.md")).toContain('from "standardwebhooks"');
    expect(pages.get("ai-agents.md")).toContain("Cloudflare Agents SDK");
    for (const recipe of [
      "Publish announcement",
      "Editorial review",
      "Audio transcription",
      "Translate a Page",
      "Knowledge and search synchronization",
    ]) expect(pages.get("recipes.md")).toContain(`## ${recipe}`);
    expect(pages.get("operations.md")).toContain("Production readiness checklist");
    expect(pages.get("operations.md")).toContain("six total attempts");
    expect(pages.get("operations.md")).toContain(
      "one Cloudflare Worker, not a separate cleanup Worker",
    );
    expect(pages.get("operations.md")).toContain(
      "minute zero of every hour",
    );
    expect(pages.get("operations.md")).toContain(
      "existence check: no reconciliation query",
    );

    const skill = await readFile(path.join(
      repositoryRoot,
      ".agents",
      "skills",
      "build-microfeed-automation",
      "SKILL.md",
    ), "utf8");
    for (const requirement of [
      "Standard Webhooks",
      "durable",
      "deduplic",
      "least-privilege",
      "correlation",
      "causation",
      "prompt-injection",
      ".microfeed/webhooks/<endpoint-name>",
      "yarn microfeed webhook scaffold",
      "yarn microfeed webhook listen",
      "production readiness",
    ]) expect(skill.toLowerCase()).toContain(requirement.toLowerCase());
    const glossary = await readFile(
      path.join(docsRoot, "reference", "glossary.md"),
      "utf8",
    );
    expect(glossary).toContain("administrator\ncan reveal it");
    expect(glossary).not.toContain("revealed once");

    const deploymentSkill = await readFile(path.join(
      repositoryRoot,
      ".agents",
      "skills",
      "deploy-microfeed",
      "SKILL.md",
    ), "utf8");
    expect(deploymentSkill).toContain(
      "yarn manage deploy --enable-webhooks --instance <name>",
    );
    expect(deploymentSkill).toContain("Keep deployed webhooks disabled");
  });

  it("documents modern theme authoring without migration internals", async () => {
    const files = await documentationFiles();
    for (const file of files) {
      const source = (await readFile(file, "utf8")).toLowerCase();
      expect(source, file).not.toContain("settings.customcode");
      expect(source, file).not.toContain("legacy theme");
      expect(source, file).not.toContain("legacy-theme");
    }

    const themes = await readFile(
      path.join(docsRoot, "dashboard", "themes.md"),
      "utf8",
    );
    expect(themes).toContain("### Develop with an AI coding agent");
    expect(themes).toContain("### Export an installed theme with an AI coding agent");
    expect(themes).toContain("### Bundle CSS and JavaScript");
    expect(themes).toContain("#### Inline compiled output in D1");
    expect(themes).toContain("#### Emit packaged assets with Vite");
    expect(themes).toContain("#### Emit packaged assets with Webpack");
    expect(themes).toContain("microfeed never runs a theme repository's build scripts");
    expect(themes).toContain(
      "yarn manage theme init ~/microfeed-themes/my-theme --instance <instance-name>",
    );
    expect(themes).toContain(
      "yarn manage instances --json",
    );
    expect(themes).toContain(
      "yarn manage theme export\n--active --instance <instance-name> --git --json",
    );
    expect(themes).toContain(
      ".microfeed/themes/<package-id>-<version>/",
    );
    expect(themes).toContain("Do not\nuse `dist/themes/`");
    expect(themes).toContain("Do not activate, deactivate, install, delete");
    expect(themes).toContain("stop before staging");
    expect(themes).toContain("yarn preview --feed-url https://example.com/json/");
    expect(themes).toContain(
      "You do not need to create `~/microfeed-themes/` first.",
    );
    expect(themes).toContain(
      '"assets": ["assets/theme.css", "assets/theme.js"]',
    );
    expect(themes).toContain("{{_theme.asset_base_url}}theme.js");
    expect(themes).toContain("<asset-owner-theme-id>");
    expect(themes).toContain("### Render navigation items");
    expect(themes).toContain("{{#navigation_pages}}");
    expect(themes).toContain("additional Pages into its\n**More** menu");
    expect(themes).toContain("### Connect the search popup and Search page");
    expect(themes).toContain("data-microfeed-search-open");
    expect(themes).toContain("data-microfeed-search-input");
    expect(themes).toContain("data-microfeed-search-results");
    expect(themes).toContain("data-microfeed-search-details");
    expect(themes).toContain("submitting it opens `/search/?q=...`");
    expect(themes).toContain("Public typeahead calls `/search.json`");
    expect(themes).toContain("Authenticated integrations use `GET /api/v1/search/`");
    expect(themes).toContain("and is never cached");
    expect(themes).toContain("web-page.mustache");
    expect(themes).toContain("web-search.mustache");
    expect(themes.toLowerCase()).not.toContain("format v1");
    expect(themes.toLowerCase()).not.toContain("v1 theme");
    expect(themes).toContain(
      "yarn manage deploy --enable-r2 --instance <instance-name>",
    );
    expect(themes).not.toContain("## Upgrade from the old custom theme");

    const pagesAndSiteFiles = await readFile(
      path.join(docsRoot, "dashboard", "pages-search-and-site-files.md"),
      "utf8",
    );
    expect(pagesAndSiteFiles).toContain("title: Pages and Site Files");
    expect(pagesAndSiteFiles).not.toContain("## Public search");

    const manageCli = await readFile(
      path.join(docsRoot, "manage-cli.md"),
      "utf8",
    );
    expect(manageCli).toContain(
      "Use `init` to derive a new `local.<name>@0.1.0` identity",
    );
    expect(manageCli).toContain(
      "Export writes the templates, inherited assets, README, local package scripts",
    );
    expect(manageCli).toContain(
      "yarn manage theme export --active --instance personal --git --json",
    );
    expect(manageCli).toContain(
      "With `--git`, it also\ninitializes a local Git repository on `main`",
    );

    const themeKitCli = await readFile(
      path.join(docsRoot, "theme-kit-cli.md"),
      "utf8",
    );
    expect(themeKitCli).toContain(
      "Creates a generic theme repository scaffold containing `README.md`",
    );

    const themeKitReadme = await readFile(
      path.join(repositoryRoot, "packages", "theme-kit", "README.md"),
      "utf8",
    );
    expect(themeKitReadme).toContain(
      "`.microfeed/themes/<package-id>-<version>/`",
    );
    expect(themeKitReadme).toContain("Do not use `dist/themes/`");
  });

  it("advertises agentic content publishing from the main discovery paths", async () => {
    const npmPackageUrl = "https://www.npmjs.com/package/@microfeed/cli";
    const sources = await Promise.all([
      readFile(
        path.join(repositoryRoot, "packages", "cli", "README.md"),
        "utf8",
      ),
      readFile(path.join(docsRoot, "index.mdx"), "utf8"),
      readFile(path.join(docsRoot, "dashboard", "publish.md"), "utf8"),
      readFile(path.join(docsRoot, "start-here", "after-deploy.md"), "utf8"),
      readFile(path.join(docsRoot, "api", "cli.md"), "utf8"),
      readFile(path.join(docsRoot, "api", "ai-agents.md"), "utf8"),
      readFile(path.join(docsRoot, "microfeed-cli.md"), "utf8"),
      readFile(path.join(docsRoot, "start-here", "index.md"), "utf8"),
      readFile(path.join(docsRoot, "start-here", "concepts.md"), "utf8"),
    ]);

    for (const source of sources) expect(source).toContain(npmPackageUrl);

    const publishingGuide = sources[2];
    expect(publishingGuide).toContain("## Publish with a coding agent");
    expect(publishingGuide).toContain("Use --json for deterministic output");
    expect(publishingGuide).toContain("You sign");
    expect(publishingGuide).toContain("approve permissions in the browser");

    const docsConfig = await readFile(
      path.join(docsRoot, "astro.config.ts"),
      "utf8",
    );
    expect(docsConfig).toContain("Manage content with @microfeed/cli");
    expect(docsConfig).toContain("microfeed cli reference");
  });

  it("keeps direct API and CLI workflows distinct while cross-linking them", async () => {
    const [docsConfig, apiOverview, authentication, integrationGuide, agentGuide] =
      await Promise.all([
        readFile(path.join(docsRoot, "astro.config.ts"), "utf8"),
        readFile(path.join(docsRoot, "api", "index.md"), "utf8"),
        readFile(path.join(docsRoot, "api", "authentication.md"), "utf8"),
        readFile(path.join(docsRoot, "api", "build-and-test.md"), "utf8"),
        readFile(path.join(docsRoot, "api", "ai-agents.md"), "utf8"),
      ]);

    const apiSectionStart = docsConfig.indexOf('label: "API and integrations"');
    const automationSectionStart = docsConfig.indexOf(
      'label: "Content automation"',
    );
    const cliSectionStart = docsConfig.indexOf(
      'label: "@microfeed/cli and AI agents"',
    );
    const referenceSectionStart = docsConfig.indexOf('label: "Reference"');
    const contributeSectionStart = docsConfig.indexOf('label: "Contribute"');
    expect(apiSectionStart).toBeGreaterThan(-1);
    expect(automationSectionStart).toBeGreaterThan(apiSectionStart);
    expect(cliSectionStart).toBeGreaterThan(automationSectionStart);
    expect(referenceSectionStart).toBeGreaterThan(cliSectionStart);
    expect(contributeSectionStart).toBeGreaterThan(referenceSectionStart);

    const apiSection = docsConfig.slice(apiSectionStart, automationSectionStart);
    const automationSection = docsConfig.slice(
      automationSectionStart,
      cliSectionStart,
    );
    const cliSection = docsConfig.slice(cliSectionStart, referenceSectionStart);
    const referenceSection = docsConfig.slice(
      referenceSectionStart,
      contributeSectionStart,
    );
    expect(apiSection).toContain("Bearer authentication");
    expect(apiSection).not.toContain("@microfeed/cli");
    expect(apiSection).not.toContain("AI agents");
    expect(automationSection).toContain("Build webhook-driven AI agents");
    expect(cliSection).toContain("Manage content with @microfeed/cli");
    expect(cliSection).toContain("Manage content with AI agents");
    expect(cliSection).not.toContain("command reference");
    expect(referenceSection).toContain("yarn manage command reference");
    expect(referenceSection).toContain("microfeed cli reference");
    expect(referenceSection).toContain("theme-kit cli reference");

    expect(apiOverview).toContain("[microfeed CLI guide](./cli/)");
    expect(integrationGuide).toContain("[microfeed CLI guide](../cli/)");
    expect(authentication).not.toContain("microfeed CLI");
    for (const apiGuide of [apiOverview, authentication, integrationGuide]) {
      expect(apiGuide).not.toContain("browser authorization");
    }
    expect(authentication).toContain("title: Bearer authentication");
    expect(authentication).toContain("curl --request GET");
    expect(authentication).toContain(
      'Authorization: Bearer ${MICROFEED_API_KEY}',
    );
    expect(agentGuide).toContain("title: Manage content with AI agents");
    expect(agentGuide).not.toContain("title: Use the API with AI agents");
    expect(agentGuide).not.toContain("llms-full.txt");
  });

  it("publishes the standalone theme-kit CLI reference", async () => {
    const reference = await readFile(
      path.join(docsRoot, "theme-kit-cli.md"),
      "utf8",
    );

    expect(reference).toContain("title: theme-kit cli reference");
    expect(reference).toContain("npm install --global @microfeed/theme-kit");
    for (const command of [
      "## `init`",
      "## `validate`",
      "## `test`",
      "## `preview`",
      "## `fixture pull`",
    ]) {
      expect(reference).toContain(command);
    }
    expect(reference).toContain("--fixture <name-or-file>");
    expect(reference).toContain("--feed-url <url>");
    expect(reference).toContain("--output <file>");
    expect(reference).toContain("yarn manage theme");
    expect(reference).toContain("does not deploy microfeed");
  });

  it("isolates the Starlight build and configures asset-only Worker deployment", async () => {
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

    const workerConfig = JSON.parse(await readFile(
      path.join(docsRoot, "wrangler.jsonc"),
      "utf8",
    )) as {
      name: string;
      main?: unknown;
      workers_dev: boolean;
      preview_urls: boolean;
      routes: Array<{pattern: string; custom_domain: boolean}>;
      assets: {
        directory: string;
        not_found_handling: string;
        html_handling: string;
        binding?: unknown;
        run_worker_first?: unknown;
      };
      env: {
        preview: {
          name: string;
          workers_dev: boolean;
          preview_urls: boolean;
          routes: unknown[];
        };
      };
    };
    expect(workerConfig.name).toBe("microfeed-docs");
    expect(workerConfig.main).toBeUndefined();
    expect(workerConfig.workers_dev).toBe(false);
    expect(workerConfig.preview_urls).toBe(true);
    expect(workerConfig.routes).toEqual([{
      pattern: "docs.microfeed.org",
      custom_domain: true,
    }]);
    expect(workerConfig.assets).toEqual({
      directory: "./dist",
      not_found_handling: "404-page",
      html_handling: "auto-trailing-slash",
    });
    expect(workerConfig.assets.binding).toBeUndefined();
    expect(workerConfig.assets.run_worker_first).toBeUndefined();
    expect(workerConfig.env.preview).toEqual({
      name: "microfeed-docs-preview",
      workers_dev: true,
      preview_urls: true,
      routes: [],
    });

    const packageJson = JSON.parse(await readFile(
      path.join(repositoryRoot, "package.json"),
      "utf8",
    )) as {scripts: Record<string, string>};
    expect(packageJson.scripts["docs:upload-preview"]).toBe(
      "yarn docs:check && wrangler deploy --strict --env preview --config docs/wrangler.jsonc",
    );
    expect(packageJson.scripts["docs:deploy"]).toBe(
      'yarn docs:check && wrangler deploy --strict --env="" --config docs/wrangler.jsonc',
    );

    const buildCheck = await readFile(
      path.join(docsRoot, "scripts", "check-build.mjs"),
      "utf8",
    );
    expect(buildCheck).toContain('entry.name === ".DS_Store"');
    expect(buildCheck).toContain("await rm(entryPath)");

    const workflow = await readFile(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    );
    expect(workflow).toContain("yarn docs:check");
    expect(workflow).not.toContain("actions/configure-pages");
    expect(workflow).not.toContain("actions/upload-pages-artifact");
    expect(workflow).not.toContain("actions/deploy-pages");
    await expect(stat(path.join(
      repositoryRoot,
      ".github/workflows/docs.yml",
    ))).rejects.toThrow();
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
