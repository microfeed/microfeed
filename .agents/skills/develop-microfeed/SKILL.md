---
name: develop-microfeed
description: Develop and contribute changes to the microfeed repository safely from branch creation through validation, commit, push, and draft pull request. Use when Codex is asked to implement a feature, fix a bug, refactor code, add tests, update documentation or CI, or perform other repository maintenance. Do not use for read-only questions, explanations, reviews, or status reports.
---

# Develop microfeed

Follow the repository's [agent rules](../../../AGENTS.md) and human-facing
[contribution guide](../../../CONTRIBUTING.md). Keep the change focused and
leave the repository in a reviewable state.

## Design principles

- **Keep Cloudflare Free sufficient.** Keep every feature required for initial
  deployment or normal core use available on Cloudflare Free. Before
  implementation, verify the current official Cloudflare documentation for
  service availability and every limit the design exercises. Evaluate
  worst-case Worker CPU time and relevant request, storage, operation, payload,
  and other quotas; do not copy changing numeric limits into this skill.
  Redesign an essential path that does not fit. Permit paid-only capabilities
  only as optional enhancements with complete free-account behavior.
- **Design for people, with or without an agent.** Assume no technical fluency
  across the product interface, `yarn manage`, documentation, and agent
  guidance. Use familiar, task-oriented vocabulary first; introduce technical
  terms only when necessary and explain them where they appear. Keep deployment
  on one `yarn manage` workflow that works directly or through an agent, and
  make its choices, effects, progress, and recovery steps clear. Do not depend
  on an agent-only deployment path.

## Prepare the work

1. Confirm the repository root contains `package.json`, `yarn.lock`, `src/`,
   and `manage-cli/`.
2. Inspect `git status --short`, the current branch, recent commits, worktrees,
   and remotes before editing. Identify exactly which existing changes belong
   to the task.
3. Never work directly on `main`. Continue an existing task branch when it is
   relevant, or create `<type>/<short-kebab-case>` using the primary outcome:
   - `feature`: new user-facing behavior
   - `fix`: defect correction
   - `docs`: documentation only
   - `refactor`: behavior-preserving restructuring
   - `test`: test-only work
   - `ci`: continuous-integration changes
   - `chore`: repository maintenance spanning other categories
4. Base ordinary work on the current upstream `main`. Use another base only
   when the user explicitly requests dependent or stacked work.
5. If unrelated changes are present, preserve them exactly. Create an isolated
   worktree and transfer only known task hunks. Never stash, reset, discard, or
   silently include unrelated files.

## Implement the change

1. Inspect the affected implementation, tests, and documentation before
   editing. Prefer the smallest coherent change that satisfies the request.
2. Respect the source boundaries, frontend component rules, and interactive
   styling requirements in `AGENTS.md`.
3. Add or update focused tests for behavior changes and regression fixes.
   Update contributor or user documentation when commands, behavior, or public
   expectations change.
4. Treat Cloudflare deployment as a separate workflow. Invoke
   [`deploy-microfeed`](../deploy-microfeed/SKILL.md) for any install, deploy,
   publish, configure, or destroy request; do not improvise deployment steps.
5. Do not commit secrets, local instance state, build output, generated Worker
   types, or unrelated formatting changes.

## Change the external API

When adding or changing a public endpoint, keep runtime behavior and every
reference format synchronized through the shared contract:

1. Inspect the route, transport-neutral service, existing schemas, generated
   OpenAPI document, and relevant runtime and contract tests.
2. Add or update reusable Zod request and response schemas in
   `src/shared/ApiSchemas.ts`. Preserve deprecated inputs or outputs explicitly
   when existing integrations require backward compatibility.
3. Register the operation in `src/shared/OpenApiDocument.ts`, including its
   method, path, operation ID, parameters, request body, every response status
   and schema, authentication, descriptions, and compatibility notes.
   Document Bearer as the only API-key authentication method; compatibility-only
   authentication remains a tested runtime detail and is not shown in API
   reference formats or product UI.
4. Implement the Astro route using the same schemas where practical and shared
   domain services. Do not make an internal HTTP request to microfeed's own API
   or duplicate business logic solely for a transport. Put canonical external
   endpoints under the current versioned API base from `src/shared/ApiVersion.ts`.
   When an existing unversioned endpoint must remain compatible, route both
   paths to the same server-side handler and keep the compatibility path out of
   generated reference formats and new product examples.
5. Do not maintain OpenAPI JSON, OpenAPI YAML, Scalar, `llms.txt`, or
   `llms-full.txt` separately. `src/server/openapi/document.ts` derives them
   from `OPENAPI_DOCUMENT`, and `llms-full.txt` embeds the complete generated
   contract so it remains self-contained.
6. Add focused tests for handler behavior and contract generation. Ensure every
   new route is represented in `OPENAPI_DOCUMENT`, the embedded LLM contract
   parses back to that same document, and compatibility behavior is covered.
7. Run `yarn lint:openapi` while iterating, followed by the normal
   `git diff --check` and `yarn check` validation before publishing.

## Validate and review

1. Run targeted tests or checks while iterating.
2. Before committing, run:

   ```console
   git diff --check
   yarn check
   ```

3. If the local sandbox blocks Wrangler logging or Worker test ports, request
   the minimum permission needed and rerun the same check.
4. Review `git status --short`, the complete diff, generated files, and the
   proposed commit scope. Resolve failures before publishing; do not weaken or
   skip checks to obtain a passing result.

## Commit and publish

1. Stage explicit task paths, not the entire mixed worktree. Commit with a
   concise imperative title that describes the full change; Conventional
   Commit prefixes are optional.
2. Treat publishing as available only when the configured Git remote can push
   and either the connected GitHub integration can create a pull request or
   `gh auth status` succeeds. Never ask for a token or credential in chat.
3. Push the topic branch to `microfeed/microfeed` when the authenticated user
   has write access. Otherwise reuse an existing contributor fork and keep the
   PR target on `microfeed/microfeed`. Obtain approval before creating a new
   fork or adding a new external repository.
4. Open a draft pull request against the requested base, defaulting to `main`.
   Prefer the connected GitHub integration and use `gh pr create --draft` as a
   fallback. Use the repository PR template and include the change, rationale,
   developer or user impact, related issue when one exists, validation, and
   risks. Do not create or add screenshots unless the user explicitly requests
   them; otherwise describe visual verification in the pull request.
5. If authentication, push permission, an existing fork, or a remote base is
   unavailable, keep the validated local commit and report the exact missing
   prerequisite. Do not improvise another remote or expose credentials.
6. Report the branch, commit, PR repository and base, draft URL, and validation
   results. Never mark a draft ready for review or merge it unless the user
   explicitly requests that separate action.

## Protect history and scope

- Do not rewrite, delete, squash, rebase, force-push, or retarget another
  contributor's branch. For an agent-owned stacked branch, verify the exact
  refs before rebasing and use only `--force-with-lease`.
- Do not broaden a development request into a deployment, release, repository
  settings change, fork creation, or merge without explicit authorization.
- Keep each pull request small enough to review as one logical change. Split
  unrelated outcomes into separate branches and draft pull requests.
