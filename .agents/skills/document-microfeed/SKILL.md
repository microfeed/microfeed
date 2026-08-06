---
name: document-microfeed
description: Create, revise, organize, validate, and publish microfeed documentation. Use when changing the public Starlight site under docs/, the documentation portions of the root README, docs navigation or styling, AI-readable llms.txt output, documentation screenshots, the canonical yarn manage reference, or the GitHub Pages documentation workflow.
---

# Document microfeed

Keep the public documentation human-first, product-led, and directly useful to
AI agents. Assume readers may have no prior Cloudflare, Git, or server
administration experience.

## Keep each source focused

- Use the root `README.md` for the product summary and shortest successful
  deployment path.
- Use task guides under `docs/` for approachable procedures and explanations.
- Keep `docs/manage-cli.md` as the canonical command, option, side-effect, and
  safety contract. Update it together with `manage-cli/help.ts` when CLI
  behavior changes.
- Keep agent execution safeguards in repository skills and `AGENTS.md`, not on
  the public documentation site.
- Derive API references from `src/shared/OpenApiDocument.ts`; do not maintain a
  duplicate OpenAPI specification under `docs/`.

Link to the canonical source instead of copying long reference material into a
task guide.

## Write for successful outcomes

1. Lead with what the reader will accomplish.
2. Present the recommended path before advanced alternatives.
3. Define Cloudflare-specific and development terms when they first appear.
4. Provide copyable commands and say where to run them.
5. Describe the expected result, a verification step, and the safest recovery
   when an important step fails.
6. Use consistent placeholders such as `<instance-name>`. Never include real
   account IDs, emails, tokens, private addresses, or setup links.

Use plain `.md` for guides. Reserve `.mdx` for product pages that need
components. Give every page `title` and `description` frontmatter, keep heading
levels sequential, use descriptive link text, and tag code fences.

## Maintain the Starlight site

- Keep the independent Astro project rooted at `docs/`; do not couple it to the
  Worker build.
- Update `docs/astro.config.ts` whenever a public page is added, moved, or
  removed from navigation.
- Keep `site` set to `https://docs.microfeed.org` with no repository base path.
- Preserve Pagefind search, the sitemap, and generated `/llms.txt`,
  `/llms-small.txt`, and `/llms-full.txt` artifacts.
- Put theme-safe shared styles in `docs/src/styles/custom.css` and preserve
  keyboard focus, contrast, reduced motion, and mobile behavior.
- Keep maintainer-only publishing and writing procedures in this skill rather
  than exposing them as public docs pages.

The initial documentation release contains no content illustrations. When a
user explicitly adds screenshots later, use sanitized demo data, descriptive
filenames, useful alt text, optimized assets, and documented viewport
conventions. Never let an image be the only instruction.

## Validate documentation changes

Run focused checks while iterating, then run:

```console
yarn vitest run tests/unit/docs-site.test.ts
yarn docs:check
git diff --check
yarn check
```

For visual changes, preview the site with `yarn docs:dev` and verify desktop and
mobile layouts, light and dark themes, keyboard navigation, and search where
relevant. Stop every development or preview server started for verification.

## Publish safely

Pull requests build and validate the site without deploying it. Merges to
`main` and manual workflow dispatches deploy `docs/dist` through GitHub Actions.

Treat repository Pages settings and DNS as separately authorized external
changes. For the one-time handoff:

1. Select GitHub Actions as the repository Pages source.
2. Add and verify `docs.microfeed.org` in Pages settings before changing DNS.
3. Point the `docs.microfeed.org` CNAME to `microfeed.github.io`, without the
   repository name.
4. Wait for verification, enable HTTPS, and check the homepage, internal links,
   search, sitemap, and all three LLM text endpoints.

If deployment fails, inspect the workflow build before changing DNS and keep
the last working domain settings in place.
