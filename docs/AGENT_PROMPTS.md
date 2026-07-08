# Agent Prompts — microfeed CMS rebuild

Copy-paste one block per task into a fresh Sonnet session. One task = one session. Companion: [ACTION_PLAN.md](./ACTION_PLAN.md).

## Shared rules (every task obeys these)
- **Branch: work on `rebuild/cms` only. Never commit to `main`.** Deploy triggers on push to `main`; the rebuild stays off `main` until v1 is complete + fully checked, then merges. Commit per task on `rebuild/cms`.
- Repo: `microfeed`. Issues on fork `kiran-brahma/microfeed`. **Read issue #1 (master PRD) + the task's epic issue before coding.** All decisions are settled there — do not re-decide; if something is genuinely undecided, STOP and ask.
- **Content-type field spec: [`docs/CONTENT_TYPES.md`](docs/CONTENT_TYPES.md)** — authoritative in-repo copy of the type/field/target catalog (use this if GitHub issue #1 is unreachable). Do NOT infer field sets from old editor code.
- **Tests-first:** write the named failing tests, run, confirm RED, then implement to GREEN. Run `yarn test` — everything green before you stop.
- **React component tests:** add `/** @jest-environment jsdom */` at the top of the file; use @testing-library/react.
- **Dep installs:** use `corepack yarn@4.9.2 add …` (plain yarn = classic 1.22, corrupts the berry lockfile). After ANY install, rebuild the native addon for Node 22: `fnm exec --using 22 -- corepack yarn@4.9.2 rebuild better-sqlite3` (installs under Node 24 break its ABI and fail DB tests).
- Touch **only** the files this task needs. No scope creep, no drive-by refactors.
- SQL: always parameterized (`?` binds), never string-interpolate user values.
- When code-complete + green, STOP and hand to the **Reviewer prompt** (bottom of this file). Fix findings, then the task is done.
- Do not start a task whose dependencies aren't merged.

---

## Phase 0 — Foundations & test harness (issue #2)

### 0.1 — Schema migration
> Implement task 0.1 in issue #2 (read master PRD #1 first). Update `ops/db/init.sql`: add `content_type` + `slug` columns to `items`, a unique composite index `(content_type, slug)`, and tables `tags`, `item_tags`, `item_relations` per master PRD "Schema changes". Keep channels/settings. Tests-first: a schema test running `init.sql` against better-sqlite3 asserting every table/index/column/constraint exists. Follow the shared rules.

### 0.2 — better-sqlite3 D1-substitute harness (needs 0.1)
> Implement task 0.2 in issue #2. Build a test utility exposing a D1-compatible interface (`prepare().bind().run()/all()/first()`, `batch()`) backed by better-sqlite3, plus a helper for a fresh migrated in-memory DB per test. Tests-first: prove the interface returns the result shapes the code expects (e.g. `{results:[...]}`). Prior art: `edge-src/models/FeedCrudManager.test.js`. Shared rules apply.

### 0.3 — CI test gate (needs 0.2)
> Implement task 0.3 in issue #2. Add/update a GitHub Actions workflow so `yarn test` (+ lint if present) runs on push + PR and the Cloudflare deploy job depends on it passing. Verify a failing test blocks deploy. Shared rules apply.

---

## Phase 1 — Data layer split (issue #3, needs Phase 0)

### 1.1 — QueryBuilder (pure, parameterized)
> Implement task 1.1 in issue #3 (read master PRD #1). Pure module turning a query spec into `{sql, binds}`: operators from the `key__op` DSL, `IN` lists, ORDER BY, LIMIT. All user values bound as `?` (fixes the current `IN(...)` injection); table/column names from a fixed allow-list only. Tests-first: per-operator cases + an explicit injection test (quotes/semicolons bound, not interpolated). Shared rules apply.

### 1.2 — Paginator (pure) (needs 1.1)
> Implement task 1.2 in issue #3. Extract cursor/sort logic from `FeedDb.getContent` (next/prev cursor, oldest/newest, pub_date cursors) into a pure module. Tests-first: both sort orders, forward/back paging, empty/single/exact-limit boundaries. Shared rules apply.

### 1.3 — Repositories (needs 1.1, 1.2)
> Implement task 1.3 in issue #3. Build `ItemRepo`, `ChannelRepo`, `SettingsRepo` over the D1 binding using QueryBuilder + Paginator (get-by-id, list+paginate, insert, update, upsert; include content_type/slug). Tests-first: integration against the Phase 0 harness; slug-unique-per-type enforced. Shared rules apply.

### 1.4 — Retire FeedDb internals (needs 1.3)
> Implement task 1.4 in issue #3. Rewire existing callers (getContent/putContent/feed reads) to the repositories; remove the hand-built SQL/query-DSL from `FeedDb`. Tests-first: existing feed read/write paths still pass (add handler-level tests if missing). No unparameterized SQL remains. Shared rules apply.

### 1.4b — Async-D1 fix (BLOCKING — review finding)
> Fix a production-breaking bug in the Phase 1 data layer. Cloudflare D1 statement methods `.all()`, `.first()`, `.run()` and `db.batch()` all return Promises, but `BaseRepo`, `ItemRepo`, and `FeedDb` call them synchronously (e.g. `BaseRepo.list()` returns `.all()` unawaited; `FeedDb.getContent` does `this.channelRepo.getPrimaryPublished()` and `this.settingsRepo.listAll().results` with no await). Tests pass only because the better-sqlite3 D1-substitute's `run/all/first` are synchronous — masking the missing awaits.
> Tests-first: (1) in `test-utils/d1-substitute.js` make `run()`, `all()`, and `first()` `async` (return Promises) so the double matches D1; run the suite and confirm it goes RED where awaits are missing. (2) Then make every consumer correct: `BaseRepo` methods (`list`, `getFirst`, `getById`, `insert`, `update`, `upsert`) `async` + `await` the statement call; `ItemRepo.listPaginated` `async` + `await` its `list`; `FeedDb.getContent`, `_getContent`, `_putChannelToContent`, `_updateOrAddSetting`, `_putItemToContent`, `getPrimaryPublished`/`listAll` call sites — add `await` everywhere a repo/statement is used. Update Paginator only if it touches statement results (it takes plain rows, so likely unchanged). Green the suite. Do NOT weaken the harness back to sync. Shared rules apply.

---

## Phase 2 — Content Type registry (issue #4, needs Phase 1)

### 2.1 — Field-kind primitives
> Implement task 2.1 in issue #4 (read master PRD #1). For each field kind (text, richtext, media, image, boolean, number, date, enum, url, tags, reference): `validate(def,value)` and `toInternal/toPublic(def,value)`. media/image reuse the URL-host-stripping from the current CRUD manager. tags/reference validate shape only. Tests-first: per-kind valid + invalid + round-trip. Pure, no DB. Shared rules apply.

### 2.2 — ContentTypeRegistry (needs 2.1)
> Implement task 2.2 in issue #4. Create `edge-src/registry/` declaring the 5 built-in types with field defs exactly per master PRD "Content type specifications" (kind, required, enum options, feed mapping, family). Interface: `getType`, `listTypes`, `getFieldDefs`, `isAggregator`. Tests-first: correct defs per type; unknown type throws; a hypothetical 6th type needs only a new declaration. Shared rules apply.

### 2.3 — Data-driven mapper + validator (needs 2.1, 2.2)
> Implement task 2.3 in issue #4. Generic `mapItem(type, payload)` + `validateItem(type, payload)` iterating field defs via the field-kind primitives — replacing both `_publicToInternalSchemaFor*` translators. Returns internal schema or `{errors:[{field,message}]}`. Tests-first: podcast payload maps to the old internal shape (port old expectations); invalid → per-field errors; blog/photo map correctly. Delete the two hand-written translators. Shared rules apply.

---

## Phase 3 — CRUD seam (issue #5, needs Phases 1–2)

### 3.1 — ContentService create/update
> Implement task 3.1 in issue #5 (read master PRD #1). Refactor `FeedCrudManager` → `ContentService` on ItemRepo + registry. `create(type,payload)`/`update(id,payload)` validate via validateItem; failure → `{errors:[{field,message}]}`; success writes internal schema + content_type + slug (auto-gen, unique per type). Tests-first (integration): valid create persists; invalid writes nothing + per-field errors; update merges+revalidates; dup slug rejected. Shared rules apply.

### 3.2 — Soft delete + restore (needs 3.1)
> Implement task 3.2 in issue #5. `delete(id)` sets status=DELETED (excluded from default queries); add `restore(id)`. Tests-first: delete hides but recovers; status transitions correct. Shared rules apply.

### 3.3 — Hard purge + R2 cleanup (needs 3.2)
> Implement task 3.3 in issue #5. `purge(id)` hard-deletes the row, its item_tags/item_relations links, and its R2 media (via `common-src/R2Utils.js`/presigned flow). Guard: only soft-deleted or forced. Tests-first: row+links removed; R2 delete invoked per media url (mock client, assert calls); guard rejects live items. If Phase 4 tables absent, ship row+R2 purge and add link cleanup once they exist. Shared rules apply.

### 3.4 — Bulk operations (needs 3.1)
> Implement task 3.4 in issue #5. `bulkPublish/bulkUnpublish/bulkDelete/bulkTag(ids,tagIds)` — transactional/batched, validate ids, skip+report unknown. Tests-first: mixed valid/invalid ids; partial-failure reporting; post-batch state. bulkTag needs Phase 4. Shared rules apply.

### 3.5 — Type-aware API handlers (needs 3.1–3.4)
> Implement task 3.5 in issue #5. Update `functions/api/items` + `[itemId]` and add bulk/purge/restore routes to call ContentService, accept content_type, return structured errors. Keep `x-microfeedapi-key` auth. Tests-first (integration): POST/PUT/DELETE/purge/restore/bulk — success + validation-error + auth-failure. Shared rules apply.

---

## Phase 4 — Taxonomy & relations (issue #6, needs Phases 1,3)

### 4.1 — TagRepo + tag CRUD
> Implement task 4.1 in issue #6 (read master PRD #1). `TagRepo` over `tags` (create/rename/delete/list/get-by-slug; slug unique) + tag CRUD endpoints (usual auth). Tests-first (integration): CRUD; dup slug rejected; delete cascades from item_tags. Shared rules apply.

### 4.2 — Item↔tag linking (needs 4.1)
> Implement task 4.2 in issue #6. Tag-linking over `item_tags`: set an item's tags (replace-set), query items-by-tag, query item's tags. Wire the `tags` field kind so ContentService writes links on create/update. Tests-first: set replaces prior; query-by-tag correct; delete/purge removes links. Shared rules apply.

### 4.3 — Ordered gallery membership (needs 4.2)
> Implement task 4.3 in issue #6. Membership over `item_relations` (`rel_type='gallery_member'`, position): set members, reorder, query ordered photos, validate members are `photo`. Wire the `reference` field kind so ContentService persists membership. Tests-first: set+reorder preserves position; non-photo rejected; ordered query; purge cleans relations. Shared rules apply.

### 4.4 — Aggregation resolver (needs 4.2, 4.3)
> Implement task 4.4 in issue #6. Resolver: given an aggregator item, produce matched items — gallery → ordered members; landing_page → items matching its filter (content_types + tags + sort + limit) via QueryBuilder + tag joins. Tests-first: landing by type/tags/both + sort + limit; gallery ordered; empty results. Shared rules apply.

---

## Phase 5 — Admin UI (issue #7, needs Phases 2–4; 5.1a–c can start early)

UI tests assert rendered behaviour from props, not internals.

### 5.1a — headlessui → v2
> Implement task 5.1a in issue #7 (read master PRD #1). Migrate every `@headlessui/react` usage to v2. No redesign. Tests-first: interaction tests per usage (open/close/select). No v1 API remains. Shared rules apply.

### 5.1b — react-quill → TipTap
> Implement task 5.1b in issue #7. Swap `AdminRichEditor` (+ media dialog) to TipTap, preserving public props (value/onChange/image insert). Remove react-quill. Tests-first: renders value, emits onChange, inserts image/link. Shared rules apply.

### 5.1c — Restyle shared components (needs 5.1a)
> Implement task 5.1c in issue #7. Modern Tailwind tokens on AdminInput/Select/Switch/Radio/Textarea/Dialog/buttons — consistent spacing/typography, no behaviour change. Tests-first: smoke render + change-event per component. Shared rules apply.

### 5.2 — Schema-driven FormRenderer (needs Phase 2, 5.1)
> Implement task 5.2 in issue #7. `<FormRenderer type fieldDefs value onChange errors />` mapping simple kinds → widgets (text→input, richtext→TipTap, boolean→switch, number, date→datetime, enum→select, url). Required indicators + bind server error list to fields. (media/image=5.3a, tags=5.4b, reference=5.5a.) Tests-first: right widgets from defs; edits propagate; required + error binding. Shared rules apply.

### 5.3a — Media/image upload widget (needs 5.2)
> Implement task 5.3a in issue #7. image/media widget reusing the existing R2 presigned upload flow; progress + preview; emits stored url; register with FormRenderer. Tests-first: requests presigned url, uploads, emits url; error path (mock client). Shared rules apply.

### 5.3b — Type picker + new/edit flow (needs 5.2, 5.3a, Phase 3)
> Implement task 5.3b in issue #7. "Add new" → type picker → FormRenderer for chosen type; edit route loads item into renderer; nav single "New" → picker. Tests-first: type renders its form; edit loads values; save posts to type-aware API; validation errors per field. Shared rules apply.

### 5.3c — Item list + filtering (needs Phases 3,4)
> Implement task 5.3c in issue #7. Item list (all types) with type badge, status, filter by content_type/status/tag, pagination. Tests-first: renders items; filters narrow; pagination. Shared rules apply.

### 5.3d — Bulk actions (needs 5.3c, 3.4)
> Implement task 5.3d in issue #7. Multi-select in the list → bulk publish/unpublish/delete/tag via Phase 3 endpoints; result toast with per-id outcome. Tests-first: selection posts right ids/action; outcomes surfaced. Shared rules apply.

### 5.4a — Tag manager screen (needs 4.1)
> Implement task 5.4a in issue #7. CRUD screen over Phase 4 tag endpoints. Tests-first: CRUD interactions; dup-slug error surfaced. Shared rules apply.

### 5.4b — Tags widget (needs 5.2, Phase 4)
> Implement task 5.4b in issue #7. `tags` field widget: list existing tags, multi-select, inline-add (create then select); register with FormRenderer. Tests-first: lists/selects/inline-adds; selection → tag ids on save. Shared rules apply.

### 5.5a — Gallery curator (needs 5.2, 4.3)
> Implement task 5.5a in issue #7. `GalleryCurator`: pick `photo` items, drag to order; writes ordered membership (4.3); register as the `reference` widget. Tests-first: add/remove/reorder → correct ordered member list. Shared rules apply.

### 5.5b — Landing filter builder (needs 5.2, 4.4)
> Implement task 5.5b in issue #7. `LandingFilterBuilder`: choose content_types + tags + sort + limit + layout, live preview via aggregation resolver (4.4). Tests-first: emits valid filter spec; preview reflects filter. Shared rules apply.

---

## Phase 6 — Public web + feeds (issue #8, needs Phases 2–4)

Feed-builder tests are pure: content in → string out.

### 6.1 — Registry-driven JSON feed builder
> Implement task 6.1 in issue #8 (read master PRD #1). Refactor `FeedPublicJsonBuilder` to serialize any item from its registry field→json mapping; every type appears; aggregators serialize resolved members (4.4). Tests-first: podcast/blog/photo shapes; gallery/landing with resolved members; snapshots. Shared rules apply.

### 6.2 — RSS podcast + blog (needs 6.1)
> Implement task 6.2 in issue #8. Refactor `FeedPublicRssBuilder`: podcast full iTunes RSS (parity); blog clean RSS 2.0 at `/blog/rss`; driven by per-type rss mapping; no-mapping types excluded. Tests-first: podcast iTunes tags + enclosure; blog validates as RSS 2.0; photo/gallery/landing → no RSS. Shared rules apply.

### 6.3a — Routing + record-type templates (needs 6.1)
> Implement task 6.3a in issue #8. Routes + fixed modern edge templates: `/i/[slug]` podcast, `/blog/[slug]` article, `/photo/[slug]` photo. Resolve by (content_type, slug); honour published/unlisted/unpublished; 404 unknown. Tests-first: each route renders right item; visibility rules; 404. Shared rules apply.

### 6.3b — Remove Mustache theming (needs 6.3a)
> Implement task 6.3b in issue #8. Delete the user-editable Mustache theming (`Theme.js` custom-code templates, CODE_FILES/customCode settings, admin code editor). Tests-first: pages render via fixed templates, no Mustache path; grep-clean of removed settings; update existing tests. Shared rules apply.

### 6.4 — Aggregator web rendering (needs 6.3a, Phase 4)
> Implement task 6.4 in issue #8. `/gallery/[slug]` renders ordered photos (grid); `/[slug]` landing renders resolved filtered list in chosen layout (list|grid) + intro richtext; uses 4.4 resolver. Tests-first: gallery ordered; landing matches filter (sort+limit+layout); empty states. Shared rules apply.

### 6.5 — Registry-generated OpenAPI (needs Phases 2,3,4)
> Implement task 6.5 in issue #8. Generate the OpenAPI spec from the registry (all types' fields + item/tag/bulk/purge endpoints); wire to the existing openapi route. Tests-first: spec includes each type + endpoints; valid OpenAPI. Shared rules apply.

---

## Reviewer prompt (run after every task, in a sub-agent)

> You are reviewing ONE completed task of the microfeed CMS rebuild. Read master PRD #1 and the task's epic issue for its acceptance criteria. Review only the diff for this task. Verify the FULL checklist and report CONFIRMED/PLAUSIBLE findings, most-severe first:
> 1. **Tests green + coverage** — `yarn test` passes; new code has tests; tests were written first (red→green); changed files covered.
> 2. **Spec conformance** — implementation satisfies the task's acceptance criteria line by line; flag any gap.
> 3. **No scope creep / no regressions** — only this task's files changed; no unrelated edits; existing behaviour intact.
> 4. **Standards + injection safety** — matches repo conventions; ALL SQL parameterized, no interpolation of user values.
> Do not fix — report. The implementer fixes before closing.
