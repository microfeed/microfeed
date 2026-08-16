# Repository guidance

## Development workflow

- When a user asks to implement, fix, refactor, test, document, update CI, or
  otherwise change this repository, use the `develop-microfeed` skill. Do not
  use it for read-only questions, explanations, reviews, or status reports.
- For documentation changes, also use the `document-microfeed` skill. For
  changes to the bundled default theme or generic theme starter, also use the
  `develop-microfeed-theme` skill.
- Do not make changes directly on `main`. Create or continue a focused branch
  named `<type>/<short-kebab-case>` where `<type>` is `feature`, `fix`, `docs`,
  `refactor`, `test`, `ci`, or `chore`. Existing nonconforming branches may be
  continued when they already contain the task's work.
- Preserve unrelated changes. Never stash, reset, discard, or stage them to
  make a task branch clean; use an isolated worktree when necessary.
- Before publishing, run `git diff --check` and `yarn check`, commit only the
  scoped files with a concise imperative title, and open a draft pull request
  against `microfeed/microfeed` when GitHub authentication is available.
- After editing and testing, stop every development server you started before
  handing work back. Confirm each process has exited so a human operator can
  run `yarn dev` without a port conflict; never stop a server you did not start.

## Instance management and Cloudflare deployment

- When a user asks a coding agent to operate `yarn manage` against local or
  Cloudflare state, use the repository's `deploy-microfeed` skill. This covers
  accounts, initialization, connection, development, deployment, themes,
  snapshots, status, destruction, Pages migration, domains, Access, built-in
  authentication, configuration, and instance selection.
- Perform every Cloudflare deployment change through `yarn manage`. Do not
  improvise with raw Wrangler commands, direct Cloudflare API calls, or a
  separate deployment implementation.
- Do not use or recommend Cloudflare repository imports, Workers Builds,
  deploy buttons, GitHub Actions, or API-token deployment. Both people and
  agents deploy from a local clone through `yarn manage`.
- Treat `docs/manage-cli.md` as the canonical command, option, side-effect, and
  safety reference for both people and agents. Read the relevant command
  section before using an unfamiliar or destructive option. Keep that reference
  and `manage-cli/help.ts` synchronized whenever CLI behavior changes.
- Never delete or overwrite an unrelated Cloudflare resource. Let the
  management CLI enforce its collision, reuse, and resume checks.
- For removal, first run `yarn manage destroy --dry-run` and relay its complete
  resource list and dashboard inspection links. Obtain explicit approval for
  that exact site, account, application, database, bucket, custom address, and
  data-deletion scope before running `yarn manage destroy --confirm <site>`.
  Never use `--yes`, delete reused data, bypass an identity mismatch, or
  improvise lower-level deletion commands. Do not inspect or change Zero Trust
  or SSL settings. Report the final Workers & Pages, D1, and R2 dashboard links,
  the exact resource names, and whether each should be absent or preserved.
- Never ask for or accept a Cloudflare token or microfeed password in chat.
  Coding agents must never use `--admin-password`; that unsafe option is only
  for unattended automation whose operator accepts command-history and
  process-list exposure.
- Discover authorization and accounts first with `yarn manage accounts --json`.
  When the user wants a separate named login, use `yarn manage accounts
  --profile <name> --reauthorize`; do not replace another Wrangler profile.
  Let Wrangler open browser authorization when required. If one account is
  returned, use it; if several are returned, explain their names and ID
  suffixes in plain language and ask the user to choose. Pass the exact full
  account ID to initialization and every later operation. Never pick the first
  account.
- For built-in login, pass only the sign-in email to initialization. Relay the one-time
  password-creation link printed after deployment, let the user choose their
  password in the browser, then rerun `yarn manage status`. Never ask the user
  to paste the password or the private link back into chat.

## Source architecture

- Keep all Astro and Worker application code under `src/`.
- Put Worker-only code that uses bindings, D1, R2, or request runtime state in
  `src/server/`. Server modules may import from `src/shared/`, but never from
  `src/client/` or browser components.
- Put browser-only helpers in `src/client/`. React client components may import
  from `src/client/` and `src/shared/`, but never from `src/server/`.
- Put runtime-neutral constants, types, paths, and utilities in `src/shared/`.
- Keep repository deployment tooling in `manage-cli/`. It may import
  runtime-neutral modules from `src/shared/`, but must not import Worker-only or
  browser-only modules.
- Astro routes and middleware coordinate server modules and UI components. Keep
  route files thin and do not introduce a standalone Worker entry point.
- Keep stable, unprocessed public assets in `public/`; do not move them into the
  source bundle or change their public URLs without an explicit migration.

## Theme repositories

- When a user asks a coding agent to initialize, export, copy, fork, inspect,
  or begin developing a theme from a saved instance, use the repository's
  `export-microfeed-theme` skill.
- Use `yarn manage theme init` to create a new theme identity from the site's
  effective appearance. Use `yarn manage theme export` when the user wants an
  exact installed immutable version and must preserve its package identity.
- Initialize or export and verify only. Do not install, activate, deactivate,
  delete, stage, commit, create a remote, or push unless the user separately
  requests that action. Stop every preview server started for verification.

## API contracts and documentation

- Treat `src/shared/ApiSchemas.ts` and `src/shared/OpenApiDocument.ts` as the
  source of truth for the external API contract. Define reusable request and
  response schemas with Zod, then register every public API operation in the
  OpenAPI document with its method, path, parameters, request body, response
  statuses, response schemas, authentication, and compatibility behavior.
- Update an API handler and its OpenAPI operation together. Reuse the same Zod
  schemas in runtime validation wherever possible, keep route files thin, and
  preserve existing fields or authentication methods explicitly when backward
  compatibility requires them.
- Present Bearer authentication as the only API-key authentication method in
  the UI, OpenAPI, Scalar, and LLM documentation. Keep compatibility-only
  authentication behavior in runtime code and focused tests without exposing
  it as a choice to new integrations.
- Never hand-edit OpenAPI JSON, OpenAPI YAML, Scalar input, `llms.txt`, or
  `llms-full.txt` as independent contracts. They must be generated from
  `OPENAPI_DOCUMENT`; the full LLM reference must remain self-contained by
  embedding that complete generated contract.
- Add contract and runtime tests for every changed or new endpoint. Verify that
  generated reference formats still describe the same document, then run
  `yarn lint:openapi` and `yarn check` before publishing.

## Content management CLI

- When a user asks a coding agent to list, read, create, update, delete, or
  upload media for content on a microfeed site, use the
  `manage-microfeed-content` skill.
  Do not use that operational skill when changing the CLI implementation or
  documentation itself.
- Treat `docs/microfeed-cli.md` as the canonical command, option, output, and
  safety reference for the content-management CLI. Keep it synchronized with
  the shared help inventory in `packages/cli/src/help.ts` and the command
  implementation whenever CLI behavior changes.
- Prefer `yarn microfeed` when managing content from a repository clone. It
  runs the local `@microfeed/cli` workspace without a global installation.
- Use `--json` and JSON files or standard input for deterministic agent
  operations. Do not scrape dashboard pages or construct OAuth requests by
  hand when the CLI supports the operation.
- Distinguish standalone media, an item image (cover art or thumbnail), and the
  one main media attachment (JSON Feed `attachments[0]` and RSS enclosure).
  Use `yarn microfeed media upload <path> --json` for an inline rich-text image,
  then insert the permanent `media_url` into `content_html`. Use
  `--attachment-file <path>` when the user asks to attach or enclose a media
  file, and `--image-file <path>` only for item cover art. Do not construct,
  read, or print short-lived upload URLs, and use `--image <url>` only for cover
  art that is already hosted.
- Never ask for, read, print, log, or copy an API key, OAuth access token,
  refresh token, client secret, or encrypted credential file. Environment
  credentials are supplied by the operator and must remain opaque to agents.
- `yarn microfeed login <site-url>` requires the administrator to sign in and
  approve scopes in a browser. Start the command when needed, clearly ask the
  user to complete that browser step, and do not attempt to approve consent on
  the user's behalf.
- Before deleting an item, identify the exact saved-instance name and item ID,
  explain the effect, and obtain confirmation. Use
  `yarn microfeed item delete <item-id> --confirm <item-id>` only after that
  confirmation; never bypass the exact-ID safeguard.

## Frontend components

- Prefer the project-owned shadcn/ui components in `src/components/ui/` for new frontend work and when substantially revising an existing interface.
- Use the Base UI variants selected in `components.json` whenever shadcn/ui offers them. Prefer extending a shared shadcn/ui component over creating a one-off control or introducing another primitive component library.
- Compose interfaces from shared components and design tokens, using the `cn` helper for class merging. Keep accessibility behavior supplied by Base UI intact.
- Migrate legacy interfaces incrementally when they are already being changed; do not rewrite unrelated working screens solely to adopt shadcn/ui.

## Interactive styling

- Every enabled clickable control must use a pointer cursor. This includes links, buttons, radio buttons, checkboxes, switches, and custom controls with `role="button"` or `role="switch"`.
- Prefer enforcing shared interaction behavior in the global stylesheet instead of repeating cursor utilities in individual components.
- Disabled controls must use the native `disabled` attribute or `aria-disabled="true"` and show a `not-allowed` cursor rather than a pointer.
