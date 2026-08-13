import type {ThemeManifestV1} from "../../../src/shared/themes/ThemeContract";

type ThemeRepositoryIdentity = Pick<
  ThemeManifestV1,
  "name" | "packageId" | "version"
>;

interface ThemeRepositorySourceIdentity {
  kind: string;
  packageId: string;
  version: string;
}

export function generatedThemeRepositoryReadme(
  manifest: ThemeRepositoryIdentity,
  provenance: string,
): string {
  return `# ${manifest.name}

${provenance}

This repository contains the rendered files installed by microfeed. It does not
recreate private build tools or source files used by the original theme author.

## Develop

Use Node.js 22.12 or newer and Yarn 4:

\`\`\`console
yarn install
yarn validate
yarn test
yarn preview
\`\`\`

The empty initial \`yarn.lock\` makes this directory independent from any
parent workspace; \`yarn install\` populates it. The local Yarn configuration
preapproves only the official \`@microfeed/theme-kit\` package, leaving package
gates in place for every other dependency.

To preview against a public microfeed JSON Feed instead of a bundled fixture:

\`\`\`console
yarn preview --feed-url https://example.com/json/
\`\`\`

Read [THEME.md](./THEME.md), \`microfeed-theme.json\`, and the schemas under
\`.microfeed/schemas/\` before editing. Establish a clean validation and test
baseline before the first commit. If this directory is not already a Git
repository, initialize it after those checks pass:

\`\`\`console
git init --initial-branch main
\`\`\`

Before installing changed content, increment the semantic version in
\`microfeed-theme.json\`. Install the new version as inactive, preview it, and
activate it only as a separate confirmed action.
`;
}

export function generatedGenericThemeRepositoryReadme(
  manifest: ThemeRepositoryIdentity,
): string {
  return generatedThemeRepositoryReadme(
    manifest,
    `This is a generic standalone microfeed theme repository with the initial
identity \`${manifest.packageId}@${manifest.version}\`.`,
  );
}

export function generatedInitializedThemeRepositoryReadme(
  manifest: ThemeRepositoryIdentity,
  source: ThemeRepositorySourceIdentity,
): string {
  return generatedThemeRepositoryReadme(
    manifest,
    `This standalone microfeed theme repository was initialized from
\`${source.packageId}@${source.version}\` (${source.kind}). It has the separate
identity \`${manifest.packageId}@${manifest.version}\`, so edits cannot overwrite
the source version.`,
  );
}

export function generatedExportedThemeRepositoryReadme(
  manifest: ThemeRepositoryIdentity,
): string {
  return generatedThemeRepositoryReadme(
    manifest,
    `This standalone microfeed theme repository was exported from the exact
installed package \`${manifest.packageId}@${manifest.version}\`. The manifest
preserves that immutable identity as a clean baseline; increment its version
before installing any changed content.`,
  );
}

export function generatedThemeReadme(): string {
  return `# microfeed theme

This directory is a complete, versioned microfeed theme package. Coding agents
should edit only the paths declared in \`microfeed-theme.json\`, declared
assets, and optional fixtures. Do not edit files under \`.microfeed/schemas/\`.
The bundled \`develop-microfeed-theme\` skill gives coding agents the same safe
workflow. Its [public-site reference](./.agents/skills/develop-microfeed-theme/references/public-site.md)
documents Pages, shared navigation, the search popup, the Search page, stable
hooks, styling tokens, and the platform/theme ownership boundary. Read it
before changing public layout or behavior. Never create screenshots unless the
owner explicitly requests them.

Install the repository-local authoring CLI once with \`yarn install\`. The
generated \`package.json\` keeps validation, tests, and preview reproducible for
people, coding agents, and CI.

## Edit and test loop

1. Read \`microfeed-theme.json\` and \`.microfeed/schemas/theme-context.schema.json\`.
2. Edit the eight declared Mustache/XSL files. Mustache is logicless:
   variables, sections, inverted sections, and iteration only.
3. Run \`yarn validate\`.
4. Run \`yarn test\`.
5. Run \`yarn preview\` and inspect feed, item, Page, Search, RSS, mobile, and
   desktop views.
6. Increment the immutable semantic version before installation.

The render context is the public JSON Feed plus \`current_year\`,
\`_theme.package_id\`, \`_theme.version\`, and \`_theme.asset_base_url\`.
It also supplies the current \`page\`, ordered \`navigation_pages\`, and Search
page state when relevant; the generated context schema documents every field.
On item pages, use \`items.0\`; the old \`item\` alias is deprecated.

Keep shared navigation in Body start when it should render once across Feed,
Item, Page, and Search. Keep a shared footer and progressive enhancements in
Body end. microfeed injects and controls the public search dialog; themes add
visible \`data-microfeed-search-open\` triggers, provide the documented Search
page hooks, and style the interface without duplicating its Ajax or keyboard
controller.

Theme code is trusted when activated, so install only repositories you trust.

Declare every packaged asset in the manifest. For files under \`assets/\`,
reference them as \`{{_theme.asset_base_url}}logo.png\` (without repeating the
\`assets/\` directory). The preview server and an installed site resolve that
same URL to the packaged file.
`;
}
