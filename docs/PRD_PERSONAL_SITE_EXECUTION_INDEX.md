# Personal Site Rebuild — Execution Index

This planning set supersedes the older `rebuild/cms` branch assumptions for the next phase of work.

## Branch and promotion model

- Base branch for every issue: `main`
- One issue = one feature branch = one PR
- When an issue is complete and merged, cut the next branch from the new `main`
- No parallel source-code work. Deliver strictly sequentially.

## PRD set

Read these in order:

1. [PRD_IMAGE_PIPELINE_AND_BRAND_MODEL.md](./PRD_IMAGE_PIPELINE_AND_BRAND_MODEL.md)
2. [PRD_EDITOR_WORKSPACE_AND_TIPTAP.md](./PRD_EDITOR_WORKSPACE_AND_TIPTAP.md)
3. [PRD_HOME_PAGE_SINGLETON.md](./PRD_HOME_PAGE_SINGLETON.md)
4. [PRD_RELATED_CONTENT.md](./PRD_RELATED_CONTENT.md)

## Global settled decisions

- All raster image uploads for image fields normalize to AVIF, except animated images, which are allowed and bypass AVIF normalization.
- SVG is allowed untouched.
- All non-animated image-field uploads use one shared 1:1 cropper-based upload flow.
- Final raster output is max `1024x1024`, never upscaled.
- Original uploads are not preserved separately.
- Existing media remains unchanged; the new pipeline applies to future uploads and replacements.
- `channel.image` becomes the single canonical global brand/public image field.
- Public image styling is square-first. Logo display is capped at `50x50` with letterboxing, not cropping.
- A new `home_page` singleton content type owns `/`.
- Home page supports hybrid composition: channel-field toggles, recent-items block, manual featured items block, filtered content block.
- Home page never renders the related-content strip.
- The content editor becomes editor-first: left admin-nav rail collapsible, right item-data rail collapsible, default desktop state = left closed / right open, mobile rails become overlays, primary save actions stay sticky in the main editor header.
- TipTap expansion uses only extensions installable with current dependencies.
- Related content is two-way, max 3 rendered, published-only, same card style everywhere, heading = `Read next`, ordering by related item updated date, any non-home type can relate to any other non-home type.

## Tests-first protocol

Every issue follows this exact loop:

1. Add or adjust failing tests first.
2. Run the smallest relevant test set and confirm RED.
3. Implement the smallest code change that can make the tests pass.
4. Re-run the same targeted tests and confirm GREEN.
5. Run the broader relevant suite for the touched seam.
6. Perform self-review against the issue checklist.
7. Outsource review to a sub-agent using the standard review prompt below.
8. Fix every confirmed or plausible finding.
9. Re-run the relevant tests and stop only when green.

## What a good test means here

- Test external behavior, not implementation details.
- Prefer the highest seam already present in the repo.
- Use pure tests for pure modules.
- Use component tests for editor and public rendering behavior.
- Use route/handler tests for HTTP seams.
- Use repository/integration tests for persistence and relation behavior.
- Do not assert internal class state, CSS class names that are not user-contractual, or helper-call counts unless the seam itself is the contract.

## Standard outsourced review prompt

Use this exact review request after implementation:

> You are reviewing one completed personal-site PRD issue for `microfeed`. Review only the diff for this issue against its PRD and this execution index. Verify:
> 1. Tests were written first and the changed seam is covered.
> 2. The implementation matches every settled decision in the PRD.
> 3. No scope creep or regressions were introduced.
> 4. The code uses existing repo seams where possible and does not duplicate logic that the PRD intended to centralize.
> 5. Public behavior, editor behavior, media behavior, and relation behavior remain consistent with the PRD acceptance criteria.
> 6. Findings must be ordered by severity, with concrete file references and a short explanation of the behavioral risk.
> Do not fix the code. Report confirmed or plausible findings only.

## Issue-body requirements

Each issue created from these PRDs must include:

- exact branch source (`main`)
- explicit start gate
- explicit stop gate
- exact tests to write first
- exact files/modules to inspect first
- no hidden decisions left to the implementation agent
- this tests-first protocol
- this outsourced review requirement

## Stop conditions

An implementation agent must stop and ask instead of assuming when:

- a PRD decision conflicts with current code in a way that changes product behavior
- a required dependency is missing from current repo dependencies
- a required branch/PR state is not available
- a supposedly reusable seam cannot support the required behavior without re-scoping the issue
