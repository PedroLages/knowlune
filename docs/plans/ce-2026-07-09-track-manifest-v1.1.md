# CE Plan: Track Manifest v1.1 — Course Import Metadata

**Status**: Ready for approval
**Created**: 2026-07-09
**Based on**: ChatGPT Deep Research Round 3 — architectural separation of track vs course manifests

---

## Summary

Upgrade `track-manifest.json` from v1.0 to v1.1 with new fields that help Knowlune find, import, validate, and display courses. Keep lesson/PDF ordering in `course-manifest.json` per course — track manifest only controls course-level metadata.

## Current State (v1.0)

```json
{
  "version": "1.0",
  "track": {
    "name": "DevOps → Platform Engineer",
    "description": "...",
    "difficulty": "intermediate",
    "courses": [
      { "folder": "Linux Admin Bootcamp", "position": 1, "notes": "Phase 0" }
    ]
  }
}
```

**TypeScript type** (`src/lib/courseManifest.ts` L58-73):
```typescript
interface TrackManifestCourse {
  folder: string
  position: number
  notes?: string
}
```

## Target State (v1.1)

New fields, all optional for backward compatibility:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `string` | Stable identifier (auto-derived from folder if missing) |
| `phase` | `string` | Roadmap phase label |
| `weeks` | `string` | Estimated time range |
| `priority` | `"required" \| "optional" \| "bonus"` | Course priority |
| `source` | `{ type, url?, driveFolderId? }` | Direct import source |
| `courseManifest` | `string` | Per-course manifest filename |
| `expected` | `{ sections?, videos?, pdfs?, captions? }` | Validation counts |
| `importPolicy` | `{ preferManifest?, fallbackToFolderStructure?, sectionStrategy?, lessonStrategy? }` | Import strategy hints |
| `aliases` | `string[]` | Alternative folder names |

## Changes Required

### Phase 1: Add types (`src/lib/courseManifest.ts`)

Add 3 new interfaces + extend `TrackManifestCourse`:

```typescript
interface TrackManifestCourseSource {
  type: 'local' | 'server' | 'drive' | 'youtube'
  url?: string
  driveFolderId?: string
}

interface TrackManifestCourseExpected {
  sections?: number
  videos?: number
  pdfs?: number
  captions?: number
}

interface TrackManifestCourseImportPolicy {
  preferManifest?: boolean
  fallbackToFolderStructure?: boolean
  sectionStrategy?: 'folder-prefix' | 'flat' | 'manifest-only'
  lessonStrategy?: 'section-scoped-numeric-prefix' | 'global-numeric-prefix' | 'manifest-only'
}

// Extend existing:
interface TrackManifestCourse {
  id: string                    // required (auto-derived if missing)
  folder: string
  position: number
  notes?: string
  phase?: string                // NEW
  weeks?: string                // NEW
  priority?: 'required' | 'optional' | 'bonus'  // NEW
  source?: TrackManifestCourseSource             // NEW
  courseManifest?: string                         // NEW
  expected?: TrackManifestCourseExpected         // NEW
  importPolicy?: TrackManifestCourseImportPolicy // NEW
  aliases?: string[]                              // NEW
}
```

All new fields are optional (backward compatible with v1.0 manifests). Only `id` becomes required — v1.0 manifests without it will use `folder` as fallback during parsing.

### Phase 2: Update parser (`src/lib/courseManifest.ts`)

Update `parseTrackManifestCourse` to:
- Auto-derive `id` from `folder` (slugify) if missing
- Parse new optional fields from raw JSON
- Default `source.type` to `"local"` if missing

### Phase 3: Add tests (`src/lib/__tests__/courseManifest.test.ts`)

- Full v1.1 manifest parses correctly
- v1.0 manifest (only folder/position) still parses
- `id` auto-derived when missing
- Invalid `priority` value throws validation error

### Phase 4: Update importer (`src/lib/trackManifestImport.ts`)

- Read `courseManifest` field to find per-course manifests
- Log `expected` counts vs actual during import (advisory)
- Use `source.url` for server imports
- Match `aliases` when resolving folders

### Phase 5: Example files (new)

- `docs/examples/track-manifest-v1.1.json`
- `docs/examples/course-manifest-v1.0.json`

## What NOT to change

- **Course manifest** — stays at v1.0 shape
- **Sidebar** — already fixed (`05794264`)
- **`lessonBasedCurriculum.ts`** — no changes
- **Import pipeline** — add logging only, no structural changes

## Files

| File | Change |
|------|--------|
| `src/lib/courseManifest.ts` | Types + parser (+40 lines) |
| `src/lib/__tests__/courseManifest.test.ts` | Tests (+60 lines) |
| `src/lib/trackManifestImport.ts` | Use new fields (+20 lines) |
| `docs/examples/track-manifest-v1.1.json` | NEW |
| `docs/examples/course-manifest-v1.0.json` | NEW |

## Verification

1. `npm run build` — green
2. `npm run lint` — green
3. `npm run test:unit -- src/lib/__tests__/courseManifest.test.ts` — all pass (v1.0 + v1.1)
4. `npm run test:unit -- src/lib/__tests__/trackManifestImport.test.ts` — all pass

## Decisions

| Decision | Rationale |
|----------|-----------|
| `id` is required in v1.1 but backward compat with auto-derive | Prevents breaking existing manifests |
| All new fields optional | v1.0 manifests continue to work |
| `expected` counts are advisory only (not enforced) | False positives would block valid imports |
| `importPolicy` is advisory (not enforced) | Importer already uses section-scoped prefix as default |
| Track manifest does NOT contain lesson ordering | That's `course-manifest.json`'s job |
| Separate example files, not inline in source | Keep tests using inline JSON, examples as reference docs |
