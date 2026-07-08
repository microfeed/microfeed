# microfeed → personal-website CMS — Action Plan

Your reference for driving the rebuild. Implementation agent = Sonnet (200K). Companion file: [AGENT_PROMPTS.md](./AGENT_PROMPTS.md).

GitHub Issues (fork `kiran-brahma/microfeed`): master PRD #1; phase epics #2–#8.

---

## What we're building

Turn the single-purpose podcast CMS into a personal-website CMS via a **code-declared Content Type registry**.

- **Record types:** `podcast_episode` (media + iTunes + RSS), `blog_article` (richtext + tags + RSS), `photo` (image + caption + tags).
- **Aggregator types:** `gallery` (explicit ordered curation of photos), `landing_page` (dynamic filter by type + tags).
- **Clean slate** — no back-compat, DB empty. Relational tags/relations. Strict validation. Soft-delete + hard-purge. Bulk ops. Modern schema-driven admin (headlessui v2 + TipTap). Fixed modern per-type web templates (Mustache theming removed). CI test gate.

Full decisions live in issue #1. Don't re-decide — it's settled.

---

## How each task runs (the loop)

1. Open the task's prompt in [AGENT_PROMPTS.md](./AGENT_PROMPTS.md). Paste into a fresh Sonnet session.
2. Agent reads master PRD #1 + the epic, does **one task only**, **tests-first** (red → green).
3. Agent stops when code-complete and `yarn test` is green.
4. **Outsource review** — paste the Reviewer prompt (bottom of AGENT_PROMPTS.md) into a sub-agent. Full checklist: tests+coverage, spec conformance, no scope creep/regressions, standards + SQL-injection safety.
5. Fix any CONFIRMED/PLAUSIBLE findings. Re-run tests.
6. Commit, tick the box below, move to the next task.

**One task = one session.** Never bundle tasks. Respect dependencies.

---

## Execution order & progress

Do top-to-bottom. Deps in parens must be merged first.

### Phase 0 — Foundations & test harness (#2) ✅ done + reviewed
- [x] 0.1 Schema migration (items +content_type/+slug; tags, item_tags, item_relations)
- [x] 0.2 better-sqlite3 D1-substitute test harness (0.1)
- [x] 0.3 CI test gate before deploy (0.2)

**Phase 0 review notes (carry forward):**
- Actual `item_relations` columns are `parent_item_id` / `child_item_id` (not `parent_id`/`child_id`). Phase 3.3 + 4.3 must use these names.
- `item_relations` has `UNIQUE(parent_item_id, rel_type, position)`. Phase 4.3 reorder must run in a transaction and avoid transient position collisions (e.g. offset positions or clear+reinsert), else the unique index aborts the update.
- Harness `batch()` is now atomic (transaction-wrapped) to match D1 — 3.4/3.3 atomicity tests are meaningful.
- Purge (3.3) still deletes tag/relation links explicitly; do not rely solely on FK cascade (D1 FK enforcement is not guaranteed).

### Phase 1 — Data layer split (#3)  · needs Phase 0
- [x] 1.1 QueryBuilder — pure, parameterized, injection-safe ✅ reviewed (SELECT-only; 1.3 repos build parameterized INSERT/UPDATE/UPSERT separately)
- [x] 1.2 Paginator — pure cursor logic (1.1) ✅ reviewed
- [x] 1.3 Repositories: Item/Channel/Settings (1.1, 1.2) ✅ reviewed
- [x] 1.4 Retire FeedDb SQL internals (1.3) ✅ reviewed
- [x] **1.4b Async-D1 fix** ✅ harness now async+transactional (matches D1); all repo/FeedDb paths await. Missing-`await` class now caught by the double, not hidden.

**Phase 1 complete.** Data layer: QueryBuilder (injection-safe) + Repositories + Paginator; FeedDb hand-built SQL retired; harness enforces D1's async contract.

### Phase 2 — Content Type registry (#4)  · needs Phase 1 ✅ done + reviewed
- [x] 2.1 Field-kind primitives (validate/map, pure) ✅
- [x] 2.2 ContentTypeRegistry — declare 5 types (2.1) ✅ catalog corrected in review (see below)
- [x] 2.3 Data-driven item mapper + validator (2.1, 2.2) ✅

**Phase 2 review notes:** first pass drifted from spec (agent was offline, inferred from old editor). Corrected in review: podcast `url→link` + `content_html→description` targets (were wrong, untested); added blog `author`/`excerpt`, photo `caption`/`taken_date`; dropped extraneous `url` from non-podcast types. Added tests for the podcast mapping. Authoritative catalog now in [docs/CONTENT_TYPES.md](CONTENT_TYPES.md) so offline sessions don't re-drift.

> ⚠️ **Run tests under Node 22** (`fnm exec --using 22 -- corepack yarn@4.9.2 test`, or volta). The repo's `better-sqlite3` native addon is built for Node 22; Node 24/26 fail with `NODE_MODULE_VERSION` ABI errors that look like test failures but aren't. CI already uses Node 22.x.

### Phase 3 — CRUD seam (#5)  · needs Phases 1–2
- [x] 3.1 ContentService create/update + strict validation ✅ reviewed (validation gates writes; per-type slug; deep-merge+revalidate; middleware swap keeps upsertItem via inheritance)
- [x] 3.2 Soft delete + restore (3.1) ✅ reviewed
- [x] 3.3 Hard purge + R2 media cleanup (3.2) ✅ reviewed (fixed MediaStore double-prefix R2-key bug in review)
- [x] 3.4 Bulk operations (3.1) ✅ reviewed (publish/unpublish/delete/tag, per-id outcome, transactional; tag-existence validation deferred to Phase 4)
- [x] 3.5 Type-aware API handlers (3.1–3.4) ✅ reviewed (POST/PUT/DELETE/restore/purge/bulk via ContentService, structured errors, GET untouched; +jest .html mock infra)

**Phase 3 complete** — full CRUD seam: typed create/update, soft-delete+restore, purge+R2, bulk, all behind validated HTTP handlers.

### Phase 4 — Taxonomy & relations (#6)  · needs Phases 1,3
- [x] 4.1 TagRepo + tag CRUD ✅ reviewed
- [x] 4.2 Item↔tag linking + tags field wiring (4.1) ✅ reviewed (item_tags source of truth; strip blob, hydrate on merge)
- [x] 4.3 Ordered gallery membership + reference wiring (4.2) ✅ reviewed (clear+reinsert; photo-type validation before write)
- [x] 4.4 Aggregation resolver (4.2, 4.3) ✅ reviewed (+fixed landing filter_tags collision via string_list kind)

### Phase 5 — Admin UI (#7)  · needs Phases 2–4
- [x] 5.0 React test infra (jsdom + Testing Library, per-file opt-in) ✅ reviewed
- [x] 5.1a Upgrade @headlessui/react → v2 ✅ reviewed
- [x] 5.1b Replace react-quill → TipTap ✅ reviewed
- [x] 5.1c Restyle shared admin components ✅ reviewed (+fixed pre-existing TipTap jsdom flake via ProseMirror polyfills)
- [x] 5.2 Schema-driven FormRenderer (core + simple widgets) ✅ reviewed (override widget seam for media/tags/reference)
- [x] 5.3a Media/image upload widget ✅ reviewed
- [x] 5.3b-api Admin ContentService item endpoints (session-authed) ✅ reviewed
- [x] 5.3b Type picker + new/edit flow ✅ reviewed (schema editor, old form retired, no data loss)
- [x] 5.3c Item list + filtering ✅ reviewed (type badges, content_type/status/tag filters, extracted ItemListView)
- [x] 5.3d Bulk actions in list ✅ reviewed (admin bulk endpoint + multi-select bar)
- [x] 5.4a Tag manager screen ✅ reviewed (admin tag endpoints + manager page + nav)
- [x] 5.4b Tags widget — multiselect + inline add ✅ reviewed (wired into SchemaItemEditor)
- [x] 5.5a Gallery curator ✅ reviewed (photo-list endpoint + member-id exposure + ordered curator)
- [x] 5.5b Landing filter builder ✅ reviewed (per-key widget override, resolveFilter + preview endpoint, filter_tags picker, live LandingPreview). **Phase 5 complete - all 37 tasks done.**

### Phase 6 — Public web + feeds (#8)  · needs Phases 2–4
- [x] 6.1 FeedItemSerializer (pure, registry-driven) ✅ reviewed
- [x] 6.1b Wire serializer into JSON feed (all types, tags, members) ✅ reviewed
- [x] 6.2 RSS: podcast (iTunes) + blog (basic) ✅ reviewed (registry rss config; type-filtered; legacy /rss reads new shape)
- [x] 6.3a Type-prefixed routing + record-type templates ✅ reviewed
- [x] 6.3b Remove Mustache custom-code theming ✅ reviewed (grep-clean + build green; WebResponseBuilder/CodeInjector removed)
- [x] 6.4 Aggregator web rendering: gallery + landing + home ✅ reviewed
- [x] 6.5 Registry-generated OpenAPI spec ✅ reviewed. **Phase 6 complete.**

**37 tasks.** Phases 0→4 are the backbone (build in order). Phases 5 and 6 both sit on 2–4 and can run in parallel by two agents once Phase 4 is done.

---

## Definition of done (whole project)
Registry owns all types; add-a-type = one file. Complete CRUD (create/update/soft-delete/restore/purge/bulk) with strict validation. Tags + galleries + landing pages work. Every type has a modern public page + appears in JSON; podcast + blog have RSS. All SQL parameterized. Tests green, CI gates deploys.

## Branch & deploy workflow
- All rebuild work lives on branch **`rebuild/cms`**. `main` stays clean + deployable.
- Deploy triggers **only** on push to `main` → so `rebuild/cms` never deploys. Commit/push freely there.
- Do NOT merge to `main` until the full v1 check passes (all 37 tasks green + reviewed).
- **Cutover task (before/at merge):** the live D1 already has an old `items` table; `init.sql` is `CREATE TABLE IF NOT EXISTS`, so it will NOT add `content_type`/`slug` to the existing table and the new unique index errors on the missing columns. Since the DB is **blank**, reset it at cutover — drop the `items` table (or delete+recreate the D1) so `init.sql` rebuilds it fresh with the new schema. (Longer term: add real `ALTER TABLE` migrations; `IF NOT EXISTS` never migrates an existing table.)

## Guardrails
- Issues target the **fork** `kiran-brahma/microfeed`, not upstream `microfeed/microfeed`.
- Agent must **stop and ask** if anything is genuinely undecided — never assume.
- No task touches files outside its scope. Review enforces this.
