# Learning Track Ordering Refactor

## Context

Research into production-grade ordered-list implementations (Figma, Linear, Jira, Airtable, Spotify, Notion) identified several architectural gaps in Knowlune's learning track ordering model. The core finding: **order belongs on the track–course join row, not the course record, and should be separated from user-visible position, provenance, and track-level ordering mode.**

The immediate order-in-picker bug is fixed (`7f09d3b6`). This plan covers the clean architectural follow-up.

## Current State vs Target

| Concern | Current | Target |
|---------|---------|--------|
| Mutable order | `position` (dense int on `LearningPathEntry`) | `orderKey` (same field, renamed for clarity) |
| Curated order | `manifestPosition` on `ImportedCourse` (wrong scope) | `manifestOrdinal` on `LearningPathEntry` |
| Order mode | `isManuallyOrdered` per-entry (wrong scope) | `orderMode` on `LearningPath` |
| Provenance | ❌ | `source: "manifest" \| "user"` on entry |
| Manifest identity | ❌ | `baseManifestHash` on `LearningPath` |
| Import flow | Two-pass (createPathWithCourses → applyManifestOrder) | Single canonical write |

## Stories

### S01: Scope `manifestOrdinal` to `LearningPathEntry`

**What**: Move the manifest-defined position from `ImportedCourse.manifestPosition` to `LearningPathEntry.manifestOrdinal`. Remove `manifestPosition` from the course type.

**Why**: A course can appear in multiple tracks with different manifest positions. The order is a property of the membership, not the course.

**Files**: `src/data/types.ts`, `src/lib/trackManifestImport.ts`, `src/app/components/figma/InlineCoursePicker.tsx`, `src/stores/useLearningPathStore.ts`

**Migration**: Existing tracks keep their `position` values. New imports populate `manifestOrdinal` on each entry. The picker sorts by `LearningPathEntry` manifest ordinal where available (requires joining entries with courses in the picker — may need a store lookup). **Risk**: The picker currently sorts by `ImportedCourse.manifestPosition` which is always available. After this change, the picker needs to look up entries for manifest order, or fall back to alphabetical for courses not yet in any track. **Decision needed**: For the picker, provide a `manifestOrdinalByCourseId: Map<string, number>` from the store, or keep a lightweight course-level cache.

**E2E risk**: Low — ordering behavior changes only for new imports. Existing tracks are unaffected.

### S02: Add `orderMode` to `LearningPath`

**What**: Add `orderMode: "manifest" | "custom"` to the `LearningPath` type. Set to `"manifest"` on import. Flip to `"custom"` on first user drag reorder. Remove `isManuallyOrdered` from individual entries (the flag duplicates the mode).

**Why**: The research is unanimous — ordering mode is container-scoped. Linear, Airtable, and Notion all make it a view/container property. Per-item flags create ambiguity when some items are moved and others aren't.

**Files**: `src/data/types.ts`, `src/stores/useLearningPathStore.ts` (`createPathWithCourses`, `applyManifestOrder`, `reorderPathCourses`), `src/app/components/learning-path/PathTimeline.tsx`

**Migration**: One-time: any track with ≥1 entry where `isManuallyOrdered === true` gets `orderMode = "custom"`. All others default to `"manifest"`. The `isManuallyOrdered` field is kept on the type (still read by existing code) but new writes stop setting it.

### S03: Add provenance fields (`source`, `state`, `manifestCourseKey`)

**What**: Add to `LearningPathEntry`:
- `source: "manifest" | "user"` — who added this entry
- `state: "active" | "removed-upstream" | "detached"` — relationship to manifest
- `manifestCourseKey: string | null` — stable ID for merge matching (currently folder name, future: manifest `courseId`)

**Why**: These are prerequisites for the merge/re-import flow. They're cheap to add now, zero-cost when unused, and prevent a second migration later.

**Files**: `src/data/types.ts`, `src/lib/trackManifestImport.ts` (populate on import), `src/stores/useLearningPathStore.ts` (populate defaults for manual adds)

### S04: Clean up two-pass import

**What**: Merge the pre-sort + `createPathWithCourses` + `applyManifestOrder` sequence into a single `createPathFromManifest` store method that writes entries in canonical manifest order in one pass.

**Why**: The research flags two-pass ordering as a smell — production systems write canonical order once. The current defensive-no-op `applyManifestOrder` call after `createPathWithCourses` is noise when it works and a silent wrong-order when it diverges.

**Files**: `src/lib/trackManifestImport.ts`, `src/stores/useLearningPathStore.ts`

### S05 (Optional): Rename `position` → `orderKey`

**What**: Rename the `position` field on `LearningPathEntry` to `orderKey`. Keep it as a dense integer for now (fractional indexing is overkill for our list sizes). The rename clarifies it's a sortable implementation field, not a user-facing ordinal — display position is always `index + 1` at render time.

**Why**: The research distinguishes "sortable key" from "display position." Trello's `pos` can differ from what the user sees. Making this explicit in naming prevents confusion.

**Files**: `src/data/types.ts`, every file that reads/writes `position` (~15 files). Search-and-replace with type-checker validation.

**Risk**: Touches many files. Can be deferred indefinitely — the rename is cosmetic, not functional.

## Execution Order

```
S01 (scope fix) → S02 (mode) → S03 (provenance) → S04 (single-pass import)
                                                      ↓
                                               S05 (rename, optional)
```

S01–S03 are independently shippable. S04 depends on S01. S05 can be done anytime after S01.

## Not In This Plan

- **Fractional indexing / LexoRank**: Overkill for 16–50 item lists. Dense integers with transactional renumbering are simpler and correct at our scale.
- **Manifest versioning + merge engine**: Build when the user asks for "update my track from the new manifest."
- **Picker/commit order separation**: Our current flow (select → single confirm) already matches the research recommendation for curated tracks.
