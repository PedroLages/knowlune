---
title: "fix: Accept manifest version 1.1 in track and course manifest parsers"
type: fix
status: active
date: 2026-06-23
---

# Fix: Track Manifest Version 1.1 Rejection

## Overview

The `parseTrackManifest` and `parseCourseManifest` functions in `src/lib/courseManifest.ts` reject any manifest version that is not exactly `"1.0"`. The Photography Mastery Roadmap (and potentially other roadmaps) use `"version": "1.1"`, causing the entire manifest to fail validation. This prevents the batch import path from being used — courses are imported individually in filesystem order instead of being ordered by the manifest's explicit course array.

## Problem Frame

When a user imports a roadmap via the Bulk Import dialog:

1. `readTrackManifest` reads and validates `track-manifest.json`
2. `parseTrackManifest` checks `version` — rejects `"1.1"` because only `"1.0"` is accepted
3. The manifest fails validation entirely (`errors.length > 0`)
4. `BulkImportDialog` sees `manifestResult.ok === false`, sets `trackManifest` to `null`
5. The batch import path (`batchImportTrackCourses`) is never reached
6. Courses are imported individually without any track being created
7. No ordering from the manifest is applied

The manifest schema has not changed between versions 1.0 and 1.1 — the structure is identical. The version bump in the manifest merely signals an updated roadmap, not a schema change.

## Requirements Trace

- **R1.** `parseTrackManifest` must accept manifests with version `"1.1"` (any minor version within major version 1)
- **R2.** `parseCourseManifest` must accept manifests with version `"1.1"` for consistency (same version field, same schema)
- **R3.** Manifests with version `"2.0"` (or any future major version) must still be rejected — the schema may differ
- **R4.** When a version 1.1 manifest is imported via Bulk Import, courses must appear ordered by the manifest's `position` fields (which match the course array order in well-formed manifests), not in filesystem/alphabetical order

## Scope Boundaries

- Only the version acceptance logic in the two parser functions is changed
- No changes to the manifest schema types (`TrackManifest`, `CourseManifest`) — the 1.1 structure is identical to 1.0
- No changes to `BulkImportDialog` — it already correctly handles `manifestResult.ok` and dispatches to `batchImportTrackCourses`
- No changes to `batchImportTrackCourses` — the reorder loop already handles course positioning correctly

### Deferred to Separate Tasks

- Manifest version negotiation or migration logic for future schema changes: not needed yet
- Supporting manifest version `"2.0"`: deferred until a 2.0 schema is defined

## Context & Research

### Relevant Code and Patterns

- [src/lib/courseManifest.ts:424-544](src/lib/courseManifest.ts#L424-L544) — `parseTrackManifest` with version check on line 436
- [src/lib/courseManifest.ts:248-420](src/lib/courseManifest.ts#L248-L420) — `parseCourseManifest` with version check on line 259
- [src/lib/trackManifestImport.ts:89-257](src/lib/trackManifestImport.ts#L89-L257) — `batchImportTrackCourses` (Phase 1-3 import + reorder loop)
- [src/app/components/figma/BulkImportDialog.tsx:210-453](src/app/components/figma/BulkImportDialog.tsx#L210-L453) — Manifest read, folder sorting, and import dispatch
- [src/stores/useLearningPathStore.ts:1096-1162](src/stores/useLearningPathStore.ts#L1096-L1162) — `createPathWithCourses` (assigns sequential positions from input array order)

### Institutional Learnings

- [2026-05-10-001-feat-json-manifest-course-track-import-plan.md](docs/plans/2026-05-10-001-feat-json-manifest-course-track-import-plan.md) — Original implementation of the manifest-based batch import
- [2026-05-04-007-fix-imported-course-lesson-ordering-plan.md](docs/plans/2026-05-04-007-fix-imported-course-lesson-ordering-plan.md) — Prior ordering fix for imported courses

## Key Technical Decisions

- **Decision: Accept any `1.x` version by checking `version.startsWith('1.')`** — The schema is identical for all 1.x versions. This is forward-compatible with future minor bumps while rejecting breaking major version changes.
- **Decision: Preserve the actual version string in the returned value** — Currently both parsers hardcode `version: '1.0'` in their `ok` result. Change to use the version string from the JSON so callers can inspect it if needed. No current callers read this field, so this is a correctness fix with zero behavioral impact.
- **Decision: Update both parsers** — Even though only `parseTrackManifest` is implicated in this bug, `parseCourseManifest` has the same version check pattern and should be updated for consistency.

## Implementation Units

- [ ] **Unit 1: Update version acceptance in manifest parsers**

**Goal:** Accept manifest versions `"1.0"` and `"1.1"` (any `1.x`) while rejecting unknown major versions.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/lib/courseManifest.ts`
- Test: `src/lib/__tests__/courseManifest.test.ts`

**Approach:**

1. In `parseCourseManifest` (line 259), change the version check from strict equality to a prefix check:

   ```
   // Before: if (!version || version !== '1.0')
   // After: accepts any version starting with "1."
   ```

2. In `parseTrackManifest` (line 436), apply the same change.

3. In both parsers, change the hardcoded `version: '1.0'` in the success return value to use the actual version string from the JSON (`version` variable captured during validation).

4. Update the error messages in both parsers (lines 262 and 439) from `"Only version \\"1.0\\" is supported."` to `"Only version 1.x is supported."` so they accurately reflect the new acceptance policy.

5. The version variable is already captured — just pass it through instead of the hardcoded literal.

**Patterns to follow:**
- Existing error accumulation pattern in both parsers (push to `errors`, check at end)
- The version variable is already extracted via `asString(json.version)` before the check

**Test scenarios:**

- **Happy path:** `parseTrackManifest` with `version: "1.1"` and valid courses → returns `ok: true`, `value.version === "1.1"`
- **Happy path:** `parseCourseManifest` with `version: "1.1"` and valid course → returns `ok: true`, `value.version === "1.1"`
- **Happy path:** `parseTrackManifest` with `version: "1.0"` still works (backward compatibility)
- **Happy path:** `parseCourseManifest` with `version: "1.0"` still works (backward compatibility)
- **Edge case:** `version: "1.9"` is accepted (any 1.x minor)
- **Error path:** `version: "2.0"` is still rejected with version path error
- **Error path:** `version: "0.9"` is still rejected (not a valid major version)
- **Error path:** Missing version is still rejected

**Verification:**
- All existing manifest tests pass (no regression)
- New version 1.1 test cases pass
- `npm run build` succeeds
- `npm run test:unit` passes

---

- [ ] **Unit 2: Verify manifest import integration for version 1.1**

**Goal:** Confirm that a version 1.1 manifest flows correctly through the full import pipeline.

**Requirements:** R4

**Dependencies:** Unit 1

**Files:**
- Test: `src/lib/__tests__/trackManifestImport.test.ts`

**Approach:**

Add a test case that:
1. Creates a minimal manifest with `version: "1.1"` and courses in a specific order
2. Calls `batchImportTrackCourses` with that manifest
3. Asserts that the resulting track entries are in the manifest's course order (by position)

This validates that the fix end-to-end — version 1.1 manifests produce correctly ordered tracks.

**Patterns to follow:**
- Existing test structure in `trackManifestImport.test.ts` (mock handles, `makeManifest` helper)
- The helper function `makeManifest` currently hardcodes `version: '1.0'` — add a version parameter with default `'1.0'` for backward compatibility of existing tests

**Test scenarios:**

- **Integration:** `batchImportTrackCourses` with a `version: "1.1"` manifest containing 5 courses (positions 1-5 in array order) → track has 5 entries at positions 1-5 matching manifest array order
- **Integration:** `batchImportTrackCourses` with a `version: "1.1"` manifest where array order differs from position fields → entries are reordered to match position values (existing reorder loop behavior)

**Verification:**
- New test passes
- All existing `trackManifestImport` tests pass (no regression)
- `npm run test:unit` passes

---

- [ ] **Unit 3: Manual verification with Photography Mastery Roadmap**

**Goal:** Confirm the fix resolves the user's specific reported issue.

**Dependencies:** Unit 1

**Files:**
- No code changes — manual verification only

**Approach:**

1. With the fix applied, use the Bulk Import dialog to import the Photography Mastery Roadmap from the Unraid server path: `/mnt/user/Academy/Creative Production/Photography Mastery Roadmap/`
2. Verify that the batch import path is used (track is created automatically)
3. Verify that courses appear in the learning track detail page in the exact order specified by the manifest's `courses` array (not alphabetical, not filesystem order)
4. Spot-check: "Pat Kay - 30 Day Photography Fundamentals Accelerator" (position 1) should be first, "Cullen Kelly - Genesis Masterclass" (position 68) should be last

**Verification:**
- Track is created with name "Photography Mastery Roadmap - Hybrid Foundation for Cinematic Filmmaking"
- Courses are ordered by manifest position, matching the course array order in `track-manifest.json`

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Future version 1.2+ introduces schema changes not compatible with current code | Accepting any `1.x` version assumes minor versions are backward-compatible. If a 1.2 manifest adds new optional fields, the current lenient parsing (ignoring unknown fields) handles it gracefully. If required fields change, the existing validation will catch it via the field-specific error checks that follow the version check. This is consistent with how JSON schema evolution typically works. |

## Sources & References

- **Bug location:** [src/lib/courseManifest.ts:436](src/lib/courseManifest.ts#L436) — `version !== '1.0'` check in `parseTrackManifest`
- **Course parser:** [src/lib/courseManifest.ts:259](src/lib/courseManifest.ts#L259) — same version check in `parseCourseManifest`
- **Import flow:** [src/lib/trackManifestImport.ts](src/lib/trackManifestImport.ts) — `batchImportTrackCourses`
- **UI entry point:** [src/app/components/figma/BulkImportDialog.tsx](src/app/components/figma/BulkImportDialog.tsx) — manifest read and import dispatch
- **Test file:** [src/lib/__tests__/courseManifest.test.ts](src/lib/__tests__/courseManifest.test.ts)
- **Import test file:** [src/lib/__tests__/trackManifestImport.test.ts](src/lib/__tests__/trackManifestImport.test.ts)
- **Unraid server path:** `/mnt/user/Academy/Creative Production/Photography Mastery Roadmap/track-manifest.json`
