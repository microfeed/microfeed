---
name: document-microfeed
description: Create, revise, organize, validate, and publish microfeed documentation. Use when changing the public Starlight site under docs/, the documentation portions of the root README, docs navigation or styling, AI-readable llms.txt output, documentation screenshots, the canonical yarn manage reference, or the Cloudflare documentation Worker workflow.
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
- Keep `docs/microfeed-cli.md` as the canonical command, option, output, and
  safety contract for `@microfeed/cli`. Update it together with the help
  inventory in `packages/cli/src/help.ts` when content CLI behavior changes.
- Keep `docs/theme-kit-cli.md` as the canonical command, option, output, and
  failure-behavior reference for `@microfeed/theme-kit`. Update it together
  with `packages/theme-kit/src/help.ts` and the command implementation when
  theme-kit CLI behavior changes.
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

Do not create, capture, add, or replace documentation screenshots unless the
user explicitly requests screenshots. This keeps the repository small and
avoids image churn for routine UI and documentation changes. When screenshots
are explicitly requested, store them under `docs/public/images/screenshots/`,
use public or demo content, remove private emails, account IDs, credentials,
and setup links, and give every image a descriptive filename and useful alt
text. Keep source captures replaceable, optimize generated composites and
animation, and provide desktop and mobile variants only when requested. Never
let an image be the only instruction.

## Validate documentation changes

Do not add unit tests that freeze documentation or README prose, headings,
links, command snippets, sidebar labels, or exact file contents. Documentation
must remain manually editable without test churn. Test executable behavior,
schemas, generators, and public contracts at their implementation boundaries.

Run focused checks while iterating, then run:

```console
yarn docs:check
git diff --check
yarn check
```

For visual changes, preview the site with `yarn docs:dev` and verify desktop and
mobile layouts, light and dark themes, keyboard navigation, and search where
relevant. Stop every development or preview server started for verification.

## Publish safely

Pull requests and pushes validate the site without deploying it. Publish only
from an up-to-date local checkout using browser-authenticated Wrangler; do not
add Git integration, deployment Actions, API tokens, or repository secrets.

Before changing production, confirm Wrangler is using the Cloudflare account
that owns `microfeed.org`, then deploy the isolated preview environment:

```console
yarn docs:upload-preview
```

Verify the returned `microfeed-docs-preview` workers.dev URL, including internal
links, search, the sitemap, the custom 404 page, and all three LLM text
endpoints. Deploy that local source only after the preview passes:

```console
yarn docs:deploy
```

`docs/wrangler.jsonc` is the source of truth for the asset-only
`microfeed-docs` Worker and its `docs.microfeed.org` Custom Domain. It must not
gain a runtime entry point, asset binding, `run_worker_first`, or secrets.

After deployment, repeat the preview checks against `https://docs.microfeed.org`.
If production validation fails, inspect the last ten deployments with
`yarn wrangler deployments list --config docs/wrangler.jsonc` and use the
interactive `yarn wrangler rollback <version-id> --config docs/wrangler.jsonc`
only after identifying the last known-good version.
