---
module: curriculum
date: 2026-07-10
problem_type: ui_bug
component: database
severity: medium
symptoms:
  - "Course sidebar shows URL-encoded section titles like '03%20-%20Linux%20Fundamentals' instead of decoded text"
  - "CourseOverview syllabus module cards display %20-encoded module titles"
  - "Route /courses/:courseId/overview crashes with runtime error from stale courseAdapter import"
root_cause: logic_error
resolution_type: code_fix
tags:
  - curriculum
  - url-encoding
  - display-bug
  - routing
  - decode-uri
---

# URL-Encoded Display Issues in Course UI

## Problem

Server-imported courses store URL-encoded paths (e.g., `03%20-%20Linux%20Fundamentals`) in IndexedDB because the server file listing returns raw percent-encoded URLs. The curriculum grouping and title display code was not decoding these before rendering, producing garbled section titles and module names throughout the course UI. Additionally, a cross-import dependency from `curriculumGrouping.ts` on `courseAdapter.ts` caused a runtime route crash on `/courses/:courseId/overview`.

## Symptoms

- Course sidebar shows garbled section titles: `"03%20-%20Linux%20Fundamentals"` instead of `"Linux Fundamentals"`
- CourseOverview syllabus module cards display `%20` in module titles (e.g., `"01%20Getting%20Started"`)
- Route `/courses/:courseId/overview` crashes with a runtime error during page load — the app becomes unusable for server-imported courses
- Section ordering appears correct (prefix sorting works on encoded strings) but human-readable titles are broken

## What Didn't Work

1. **Applying `cleanSectionTitle` regex directly to encoded strings**: The function stripped numeric prefixes via regex on the raw encoded string `"03%20-%20Linux%20Fundamentals"`. The regex `replace(/^\d+\s*-\s*/, '')` matched `"03"` but then the remaining `"%20-%20Linux%20Fundamentals"` was processed through hyphen-to-space replacement, producing garbled output.

2. **Reusing `safeDecodeURIComponent` from `courseAdapter.ts`**: The helper already existed in `courseAdapter.ts` (added during a prior sidebar readability session), but `curriculumGrouping.ts` importing from `courseAdapter.ts` caused a runtime route crash. `courseAdapter` is a heavy adapter module with many dependencies; importing it in a pure utility module that loads during route initialization triggered a module resolution failure. (session history: natural approach was blocked by the circular dependency — `courseAdapter.ts` already imports from `lessonBasedCurriculum.ts`, so importing back would create a cycle)

3. **Extracting to a shared utility module**: Considered but deferred — the fix scope was already clear, and the local helper is only 7 lines. A shared utility extraction would touch unrelated files and expand the review surface for a targeted fix. (session history: discussed as an alternative during fix planning)

## Solution

### Fix 9: Decode URI-encoded section titles in course sidebar (6453ebea)

Added a `safeDecode` helper and applied it in `cleanSectionTitle` and `getSectionName` in `src/lib/lessonBasedCurriculum.ts`:

```typescript
function safeDecode(value: string): string {
  if (!value) return value
  try {
    return decodeURIComponent(value)
  } catch {
    return value // original on malformed encoding
  }
}

function getSectionName(path: string): string {
  const decoded = safeDecode(path)              // Decode before splitting
  const normalized = decoded.replace(/^\/+/, '')
  const slashIndex = normalized.indexOf('/')
  return slashIndex > 0 ? normalized.substring(0, slashIndex) : ''
}

function cleanSectionTitle(folderName: string): string {
  if (!folderName) return 'Course Content'
  const decoded = safeDecode(folderName)         // Decode before cleaning
  const cleaned = decoded
    .replace(/^\d+\s*-\s*/, '')
    .replace(/^\d+-/, '')
    .replace(/^\d+\s+/, '')
    .trim()
  if (!cleaned) return 'Course Content'
  return cleaned
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
```

### Fix 10: Decode module titles on syllabus (90d97305)

Added `cleanFolderTitle` helper and applied decoding in `getFolderName` in `src/lib/curriculumGrouping.ts`:

```typescript
function getFolderName(path: string): string {
  const decoded = safeDecodeURIComponent(path)   // Decode before using as folder key
  const parts = decoded.split('/')
  return parts.length > 1 ? parts[0] : ''
}

export function cleanFolderTitle(folderName: string): string {
  if (!folderName) return 'Course Content'
  const cleaned = folderName
    .replace(/^\d+\s*[-. ]\s*/, '')  // "01 - Overview", "01-Overview", "01. Overview"
    .trim()
  if (!cleaned) return 'Course Content'
  if (cleaned !== folderName) {
    return cleaned
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return cleaned
}
```

Sort order is preserved by using raw (undecoded) folder names for `Map` keys and `localeCompare` sorting, then only decoding for display titles. This means `"03%20-%20Linux"` sorts identically to `"03 - Linux"` since the numeric prefix is identical in both forms.

### Fix 11: Remove courseAdapter import causing route crash (f32a4a89)

Replaced the `courseAdapter` import with a local inline helper in `src/lib/curriculumGrouping.ts`:

```typescript
// Before: imported from courseAdapter (heavy module, causes route crash)
import { safeDecodeURIComponent } from '@/lib/courseAdapter'

// After: local inline helper (pure utility, zero dependencies)
function safeDecodeURIComponent(s: string): string {
  if (!s) return s
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}
```

## Why This Works

- **Fix 9/10**: URI decoding at the point of path processing transforms `"03%20-%20Linux%20Fundamentals"` into `"03 - Linux Fundamentals"`, which the existing numeric prefix stripping and humanization logic can handle correctly. Decoding only affects display values; sort keys remain undecoded so numeric-aware `localeCompare` still produces correct section ordering. `try/catch` around `decodeURIComponent` prevents malformed encodings from crashing the render path.

- **Fix 11**: `curriculumGrouping.ts` is imported by route-level page components (CourseOverview) during initialization. `courseAdapter` is a module with many imports and potential side effects (adapter wiring, heavy dependencies). A `safeDecodeURIComponent` function is 7 lines of pure code — there is no reason to import it from a heavy module. The runtime crash was likely a circular dependency or module initialization order issue. Using an inline helper eliminates the dependency entirely and makes the file self-contained. (session history: key decision — local helper preferred over shared utility extraction to keep the fix scoped and avoid touching unrelated files)

## Prevention

- **Universal rule**: Any path processing for display purposes must `decodeURIComponent()` (safely, with `try/catch`) before string manipulation. This applies to any app that stores server-originated file paths in a database.

- Never import utility functions from heavy adapter modules into pure utility modules used in route initialization. Inline trivial helpers (5-10 line pure functions) or create a dedicated shared module like `src/lib/uri.ts` for URI utilities.

- Consider adding a lint rule that flags imports into `src/lib/curriculumGrouping.ts` from modules outside `src/lib/` — it should only depend on other `src/lib/` utilities and `src/data/types`.

- Test encoded path inputs in curriculum grouping tests: use `"03%20-%20Linux%20Fundamentals/001%20intro.mp4"` as a test case for `getFolderName`, `cleanFolderTitle`, and `cleanSectionTitle`.

## Related

- [[implementation-lessons-url-batch-import-2026-06-28]] — URL-based batch import integration; paths originate from the same server file listing
- [[single-write-path-for-synced-mutations-2026-04-18]] — foundational `syncableWrite` pattern (paths are persisted via this mechanism)
- [[course-import-cover-image-shows-subdirectory-images-2026-04-30]] — another UI display bug in the course import domain
