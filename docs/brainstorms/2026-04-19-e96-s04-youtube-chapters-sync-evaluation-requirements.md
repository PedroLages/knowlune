# E96-S04 — YouTube Chapters Sync Evaluation

**Date:** 2026-04-19
**Type:** Research + decision (no implementation code required unless recommendation flips)
**Parent epic:** E96 — P3/P4 sync table finalization
**Status:** Requirements captured

---

## Problem Frame

E96-S01 created 11 P3/P4 Supabase tables but explicitly deferred `youtubeCourseChapters` (see `docs/brainstorms/2026-04-19-e96-s01-p3-p4-supabase-migrations-requirements.md:122`). This story resolves that deferral by producing a decision: implement sync now, defer to a future epic, or mark as won't-implement.

The output of this story is a **decision document** with rationale, plus either (a) migration SQL + tableRegistry entry if we implement now, or (b) a `docs/known-issues.yaml` entry + closeout commit if we defer or reject.

---

## Goal

Decide whether `youtubeChapters` (Dexie store, entity type `YouTubeCourseChapter`) should be synced to Supabase, and capture the decision durably so future epics don't re-litigate it.

## Non-Goals

- Implementing sync wiring before the decision is made.
- Re-opening whether YouTube course imports themselves should sync (resolved in E94-S02 — yes, via `importedCourses` + `importedVideos`).
- Reworking the Dexie schema for `youtubeChapters` (shape is fine as-is).

---

## Audit Findings (Verified Against Codebase)

### Does the store exist?

Yes.

- **Type**: `YouTubeCourseChapter` at `src/data/types.ts:1170-1178`
  - Fields: `id` (UUID PK), `courseId` (FK → `ImportedCourse`), `videoId` (YouTube video ID string, not FK to `importedVideos.id`), `title`, `startTime` (seconds), `endTime?` (seconds), `order`
- **Dexie table**: `youtubeChapters: EntityTable<YouTubeCourseChapter, 'id'>` at `src/db/schema.ts:131`
- **Schema**: `'id, courseId, order'` (introduced v26, present in checkpoint at `src/db/checkpoint.ts:101`, carried forward unchanged through v52)

### Is it used?

Yes, read paths exist.

- **Write (sole mutation path)**: `src/stores/useYouTubeImportStore.ts:352` — `db.youtubeChapters.bulkAdd(chapterRecords)` inside the course-import save transaction. **No update path. No delete path. No cascading delete from `importedCourses`.**
- **Reads**:
  - `src/ai/tutor/transcriptContext.ts:103` — fetches chapters for a course to find the chapter containing the tutor's current video position (for chapter-level context injection)
  - `src/ai/quizChunker.ts:77` — fetches chapters to chunk transcripts by chapter for quiz generation
- **UI editor**: `src/app/components/figma/YouTubeChapterEditor.tsx` edits the in-memory `store.chapters` during the import wizard only (`YouTubeImportDialog.tsx:539`). **Post-import editing UI does not exist.**

### Sync exclusion history

Consistently excluded from every sync tier:

- E92-S02 Dexie v52 migration: listed among local-only / cache / server-authoritative tables (`src/db/schema.ts:1425`)
- E94-S02 P2 field-stripping plan: excluded from P2 sync (commented at `src/stores/useYouTubeImportStore.ts:343-345`)
- E96-S01 P3/P4 migration brainstorm: deferred with pointer to this story (`docs/brainstorms/2026-04-19-e96-s01-p3-p4-supabase-migrations-requirements.md:122`)

### Data volume and mutation frequency

- **Volume per course**: ~1 chapter per video for auto-generated imports; N chapters per video if the source YouTube video has timestamped chapters in its description (typical: 3–20 per video). A 20-video course with chapters could produce 100–400 rows.
- **Volume per user**: Bounded by number of YouTube courses imported. Low — tens of courses at most for heavy users.
- **Mutation frequency**: **Create-once, read-many.** Written exactly once during import; never updated; never deleted (not even on course delete — this is an existing bug, logged separately).

### Derivability

Chapter data is deterministically derivable from inputs that already sync via E94-S02:

- `courseId`, `videoId` — already in `importedCourses` + `importedVideos`
- `title`, `startTime`, `endTime`, `order` — derived from YouTube API chapter metadata (either parsed from video description on import, or from YouTube Data API's chapters field if present) and/or from `youtubeRuleBasedGrouping.ts` logic over video durations.

In other words: given a restored `importedCourse` + its `importedVideos`, an offline client could re-derive the chapters by re-running the import-time chapter extraction. This is **not user-authored content** — it's a derived cache of structural metadata.

---

## Decision

**Recommendation: Defer (won't-implement-now).** Mark as `wont-fix` unless a future use case creates authored mutation.

### Rationale

1. **Create-once, zero-mutation data.** There is no update, delete, or conflict path to preserve across devices. Syncing would only save a round-trip of re-derivation — not user intent.
2. **Deterministically derivable from already-synced upstream data.** `importedCourses` and `importedVideos` sync via E94-S02. Chapters can be regenerated on any device from those plus YouTube metadata (which is cacheable per `youtubeVideoCache`, also local-only).
3. **No cross-device authored state.** No post-import editor exists. The `YouTubeChapterEditor` writes to a Zustand store during the import wizard, and the final `bulkAdd` happens once. A second device re-importing the same playlist would regenerate equivalent chapters.
4. **Precedent.** `youtubeVideoCache`, `youtubeTranscripts`, `courseEmbeddings`, `transcriptEmbeddings`, `videoCaptions`, `bookFiles`, `courseThumbnails` all follow the same "derivable / cacheable / server-can-regenerate" exclusion pattern. Adding `youtubeChapters` to sync would violate the established rule.
5. **Low carrying cost to defer.** One `docs/known-issues.yaml` entry documents the decision; if a future feature (e.g., user-authored chapter titles, reordering, deletion) lands, the entry points straight back here for re-evaluation.

### What would flip this to "implement now"

Any of the following would convert the recommendation:

- A post-import chapter editor ships (user can rename, reorder, split, merge, or delete chapters) — chapters become authored content.
- Chapter progress, bookmarks, or notes are attached to chapter IDs (rather than to `videoId + timestamp`) such that losing the chapter ID breaks referential integrity across devices.
- Chapter extraction becomes non-deterministic (e.g., LLM-generated chapter titles where users would lose personalization on re-import).

None of these exist today. If they land in a future epic, re-open this evaluation.

### What would flip it to "never implement"

- A decision to drop YouTube course imports entirely.
- Migration of chapter data into a JSON column on `importedCourses` or `importedVideos` (folding the data into already-synced parents, eliminating the standalone table).

---

## Deliverables (given the deferral recommendation)

1. **Decision document** (this file) — durable record of the audit and rationale.
2. **Known-issues entry** in `docs/known-issues.yaml`:
   - `id`: `KI-E96-S04-L01` (or next available ID in the file's scheme)
   - `status`: `wont-fix`
   - `severity`: `low`
   - `title`: "youtubeChapters not synced to Supabase"
   - `rationale`: one-paragraph summary pointing to this requirements doc
   - `re-open-triggers`: the three conditions listed under "What would flip this to implement now"
3. **Closeout commit** on the E96-S04 branch adding items 1 and 2. No code changes. Sprint-status.yaml updated to mark E96-S04 complete.

### Out of scope (handled elsewhere, or deferred as follow-ups)

- **Missing cascade delete on `importedCourses` deletion**: chapters orphan when a course is deleted. This is a pre-existing bug unrelated to sync. Log separately in known-issues; do not fix in this story.
- **`videoId` is not an FK to `importedVideos.id`**: it's the raw YouTube ID string. This is fine for the local-only design but is worth noting if sync is ever revisited.

---

## Success Criteria

- [ ] Decision document exists at `docs/brainstorms/2026-04-19-e96-s04-youtube-chapters-sync-evaluation-requirements.md` (this file)
- [ ] `docs/known-issues.yaml` has a `wont-fix` entry with re-open triggers pointing back here
- [ ] `docs/implementation-artifacts/sprint-status.yaml` reflects E96-S04 as complete
- [ ] No production code changes in the E96-S04 PR (it is a docs-only closeout)
- [ ] A future maintainer reading the known-issues entry can decide in under 2 minutes whether to re-open the question, without re-doing the audit

---

## Open Questions

None. Autopilot decision: proceed with the deferral path and the three deliverables above. If the reviewer disagrees with the recommendation, the fallback (implement-now migration SQL + tableRegistry entry) is mechanical and can be produced in a follow-up without further brainstorming — the shape is the same straightforward `id`-PK table as other P3/P4 tables already migrated in E96-S01, with `user_id` added for RLS and `updated_at`/`deleted_at` for LWW.

---

## References

- Parent brainstorm (deferral source): `docs/brainstorms/2026-04-19-e96-s01-p3-p4-supabase-migrations-requirements.md`
- Type definition: `src/data/types.ts:1170`
- Dexie schema: `src/db/schema.ts:131`
- Sole write site: `src/stores/useYouTubeImportStore.ts:352`
- Read sites: `src/ai/tutor/transcriptContext.ts:103`, `src/ai/quizChunker.ts:77`
- Exclusion comments: `src/db/schema.ts:1425`, `src/db/checkpoint.ts:145`
- E94-S02 P2 sync plan (upstream parents): `docs/plans/2026-04-19-003-feat-e94-s02-course-book-metadata-sync-field-stripping-plan.md`
