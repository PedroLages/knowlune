# E25-S04: Author Auto-Detection During Import — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-detect author names from folder naming conventions during course import and link imported courses to author records.

**Architecture:** Pure detection function extracts author candidates from folder names using separator heuristics. A match-or-create function looks up existing authors (case-insensitive) or creates new ones. Both are wired into the existing `importCourseFromFolder()` flow between the scan step and the persist step. No new UI — just logic and toast enhancement.

**Tech Stack:** TypeScript, Dexie.js (IndexedDB), Vitest (unit tests), Playwright (E2E tests)

**Prerequisites (assumed complete):**
- **E25-S01**: `DbAuthor` interface, `authors` Dexie table (v20), `authorId` + `authorName` fields on `ImportedCourse`
- **E25-S02**: `useAuthorStore` with CRUD operations
- **E25-S03**: Authors page reads from IndexedDB

---

## Task 1: Create `detectAuthorFromFolderName()` — failing tests

**Files:**
- Create: `src/lib/__tests__/authorDetection.test.ts`

This is the core detection logic. We write the tests first to define behavior before implementation.

**Step 1: Write failing tests for the detection function**

```typescript
// src/lib/__tests__/authorDetection.test.ts
import { describe, it, expect } from 'vitest'
import { detectAuthorFromFolderName } from '@/lib/authorDetection'

describe('detectAuthorFromFolderName', () => {
  // Separator patterns
  it('detects author from " - " separator', () => {
    expect(detectAuthorFromFolderName('Chase Hughes - Behavioral Analysis')).toBe('Chase Hughes')
  })

  it('detects author from " — " (em-dash) separator', () => {
    expect(detectAuthorFromFolderName('John Doe — Advanced React')).toBe('John Doe')
  })

  it('detects author from " – " (en-dash) separator', () => {
    expect(detectAuthorFromFolderName('Jane Smith – Data Science')).toBe('Jane Smith')
  })

  // Only first separator is used (author is before it)
  it('uses only the first separator when multiple exist', () => {
    expect(detectAuthorFromFolderName('Bob Martin - Clean Code - Part 1')).toBe('Bob Martin')
  })

  // Trimming
  it('trims whitespace from detected author name', () => {
    expect(detectAuthorFromFolderName('  Chase Hughes  -  Course  ')).toBe('Chase Hughes')
  })

  // No match cases
  it('returns null for plain folder names', () => {
    expect(detectAuthorFromFolderName('my-videos')).toBeNull()
  })

  it('returns null for underscore-separated names', () => {
    expect(detectAuthorFromFolderName('course_files_2024')).toBeNull()
  })

  it('returns null for single word', () => {
    expect(detectAuthorFromFolderName('videos')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(detectAuthorFromFolderName('')).toBeNull()
  })

  // Edge cases
  it('returns null when left side of separator is empty', () => {
    expect(detectAuthorFromFolderName(' - Course Name')).toBeNull()
  })

  it('returns null when left side is only whitespace', () => {
    expect(detectAuthorFromFolderName('   - Course Name')).toBeNull()
  })

  // Name validation: author name should look like a person's name (2+ words, letters only)
  it('returns null when left side is a single word (likely a category, not a name)', () => {
    expect(detectAuthorFromFolderName('Programming - Advanced Topics')).toBeNull()
  })

  it('detects multi-word author names', () => {
    expect(detectAuthorFromFolderName('Robert C. Martin - Clean Architecture')).toBe('Robert C. Martin')
  })

  it('detects author names with periods and initials', () => {
    expect(detectAuthorFromFolderName('J.K. Rowling - Writing Masterclass')).toBe('J.K. Rowling')
  })

  // Parenthetical year/edition suffixes should not affect detection
  it('ignores parenthetical suffixes in folder name', () => {
    expect(detectAuthorFromFolderName('Chase Hughes - Six Minute X-Ray (2023)')).toBe('Chase Hughes')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/authorDetection.test.ts`
Expected: FAIL — module `@/lib/authorDetection` not found

**Step 3: Commit failing tests**

```bash
git add src/lib/__tests__/authorDetection.test.ts
git commit -m "test(E25-S04): add failing tests for detectAuthorFromFolderName"
```

---

## Task 2: Implement `detectAuthorFromFolderName()` — make tests pass

**Files:**
- Create: `src/lib/authorDetection.ts`

**Step 1: Implement the pure detection function**

```typescript
// src/lib/authorDetection.ts

/**
 * Separator patterns to try, in priority order.
 * Each is tried against the folder name; the first match wins.
 */
const SEPARATORS = [' - ', ' — ', ' – '] as const

/**
 * Heuristic: a person's name has 2+ space-separated tokens
 * and consists of letters, periods, hyphens, and apostrophes.
 */
const PERSON_NAME_PATTERN = /^[\p{L}.''-]+(\s+[\p{L}.''-]+)+$/u

/**
 * Attempts to extract an author name from a course folder name.
 *
 * Looks for common separator patterns ("Author - Course Title") and
 * validates that the left-side looks like a person's name (2+ words).
 *
 * @returns Detected author name, or null if no confident match.
 */
export function detectAuthorFromFolderName(folderName: string): string | null {
  if (!folderName) return null

  for (const sep of SEPARATORS) {
    const idx = folderName.indexOf(sep)
    if (idx === -1) continue

    const candidate = folderName.slice(0, idx).trim()
    if (!candidate) continue

    // Validate it looks like a person's name
    if (PERSON_NAME_PATTERN.test(candidate)) {
      return candidate
    }
  }

  return null
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/authorDetection.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/lib/authorDetection.ts
git commit -m "feat(E25-S04): implement detectAuthorFromFolderName pure function"
```

---

## Task 3: Create `matchOrCreateAuthor()` — failing tests

**Files:**
- Create: `src/lib/__tests__/authorDetection.integration.test.ts`

This function interacts with the Dexie `authors` table. It uses `fake-indexeddb` for testing.

**Step 1: Write failing integration tests**

```typescript
// src/lib/__tests__/authorDetection.integration.test.ts
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'

let matchOrCreateAuthor: typeof import('@/lib/authorDetection')['matchOrCreateAuthor']
let db: typeof import('@/db')['db']

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  const dbModule = await import('@/db')
  db = dbModule.db

  const detectionModule = await import('@/lib/authorDetection')
  matchOrCreateAuthor = detectionModule.matchOrCreateAuthor
})

describe('matchOrCreateAuthor', () => {
  it('returns null when authorName is null', async () => {
    const result = await matchOrCreateAuthor(null)
    expect(result).toBeNull()
  })

  it('matches existing author by exact name (case-insensitive)', async () => {
    // Seed an author
    await db.authors.add({
      id: 'chase-hughes',
      name: 'Chase Hughes',
      isPreseeded: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const result = await matchOrCreateAuthor('chase hughes')
    expect(result).toBe('chase-hughes')
  })

  it('creates new author when no match exists', async () => {
    const result = await matchOrCreateAuthor('Jane Smith')
    expect(result).toBeTruthy()

    // Verify created in DB
    const author = await db.authors.get(result!)
    expect(author).toBeDefined()
    expect(author!.name).toBe('Jane Smith')
    expect(author!.isPreseeded).toBe(false)
  })

  it('does not create duplicate when called twice with same name', async () => {
    const id1 = await matchOrCreateAuthor('Jane Smith')
    const id2 = await matchOrCreateAuthor('Jane Smith')
    expect(id1).toBe(id2)

    const count = await db.authors.count()
    expect(count).toBe(1)
  })

  it('matches case-insensitively with leading/trailing whitespace', async () => {
    await db.authors.add({
      id: 'john-doe',
      name: 'John Doe',
      isPreseeded: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    const result = await matchOrCreateAuthor('  JOHN DOE  ')
    expect(result).toBe('john-doe')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/authorDetection.integration.test.ts`
Expected: FAIL — `matchOrCreateAuthor` not exported

**Step 3: Commit failing tests**

```bash
git add src/lib/__tests__/authorDetection.integration.test.ts
git commit -m "test(E25-S04): add failing integration tests for matchOrCreateAuthor"
```

---

## Task 4: Implement `matchOrCreateAuthor()` — make tests pass

**Files:**
- Modify: `src/lib/authorDetection.ts` (add new export)

**Step 1: Add the match-or-create function**

Append to `src/lib/authorDetection.ts`:

```typescript
import { db } from '@/db'

/**
 * Looks up an existing author by name (case-insensitive) or creates a new one.
 *
 * @returns The author ID (existing or newly created), or null if authorName is null/empty.
 */
export async function matchOrCreateAuthor(authorName: string | null): Promise<string | null> {
  if (!authorName) return null

  const trimmed = authorName.trim()
  if (!trimmed) return null

  const normalizedInput = trimmed.toLowerCase()

  // Search all authors for case-insensitive match
  const allAuthors = await db.authors.toArray()
  const existing = allAuthors.find(a => a.name.toLowerCase() === normalizedInput)

  if (existing) {
    return existing.id
  }

  // Create new author
  const id = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const now = new Date().toISOString()

  await db.authors.add({
    id,
    name: trimmed,
    isPreseeded: false,
    createdAt: now,
    updatedAt: now,
  })

  return id
}
```

**Step 2: Run integration tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/authorDetection.integration.test.ts`
Expected: ALL PASS

**Step 3: Also run the pure function tests to confirm no regressions**

Run: `npx vitest run src/lib/__tests__/authorDetection.test.ts`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/lib/authorDetection.ts
git commit -m "feat(E25-S04): implement matchOrCreateAuthor with DB lookup/creation"
```

---

## Task 5: Integrate author detection into import flow

**Files:**
- Modify: `src/lib/courseImport.ts:1-231`

**Step 1: Add import and detection call**

At the top of `courseImport.ts`, add import:

```typescript
import { detectAuthorFromFolderName, matchOrCreateAuthor } from '@/lib/authorDetection'
```

**Step 2: Add detection between scan and persist**

After the course record is built (line ~173) and before the Dexie transaction (line ~179), insert author detection:

```typescript
    // Step 5b: Detect author from folder name (best-effort, non-blocking)
    let authorId: string | undefined
    try {
      const detectedName = detectAuthorFromFolderName(courseName)
      const matchedId = await matchOrCreateAuthor(detectedName)
      if (matchedId) {
        authorId = matchedId
      }
    } catch (error) {
      // Author detection is non-critical — log and continue
      console.warn('[Import] Author detection failed:', error)
    }

    const course: ImportedCourse = {
      id: courseId,
      name: courseName,
      importedAt: now,
      category: '',
      tags: [],
      status: 'active',
      videoCount: videos.length,
      pdfCount: pdfs.length,
      directoryHandle: dirHandle,
      ...(authorId && { authorId }),
    }
```

**Step 3: Update success toast to include author name**

Replace the existing toast (line ~195):

```typescript
    // Step 8: Show success toast (AC 1, AC 4)
    const detectedName = detectAuthorFromFolderName(courseName)
    const authorSuffix = detectedName ? ` by ${detectedName}` : ''
    toast.success(
      `Imported: ${courseName}${authorSuffix} — ${videos.length} ${videos.length === 1 ? 'video' : 'videos'}, ${pdfs.length} ${pdfs.length === 1 ? 'PDF' : 'PDFs'}`
    )
```

Note: We call `detectAuthorFromFolderName` again for the toast instead of storing the name separately — it's a pure function, calling it twice is negligible cost and keeps the code simpler.

**Step 4: Update Dexie transaction to include authors table**

The transaction tables list needs to include `db.authors` since `matchOrCreateAuthor` writes to it:

```typescript
    await db.transaction(
      'rw',
      [db.importedCourses, db.importedVideos, db.importedPdfs, db.authors],
      async () => {
        await db.importedCourses.add(course)
        if (videos.length > 0) await db.importedVideos.bulkAdd(videos)
        if (pdfs.length > 0) await db.importedPdfs.bulkAdd(pdfs)
      }
    )
```

Wait — the `matchOrCreateAuthor()` call happens BEFORE the transaction, so the author is already persisted. We need to restructure: either move author creation into the transaction, or keep it separate. Since author creation is idempotent (slug-based ID, so a duplicate `add` would throw but the author already exists), keeping it outside the transaction is simpler. The transaction only needs `importedCourses`, `importedVideos`, `importedPdfs`.

**Revised approach**: Keep the transaction as-is. The `matchOrCreateAuthor` writes to `authors` independently. If the main transaction fails, the orphaned author record is harmless (it has no linked courses).

**Step 5: Run existing import tests to verify no regressions**

Run: `npx vitest run src/lib/__tests__/courseImport.test.ts`
Expected: ALL PASS (detection is graceful — existing tests don't have author patterns in folder names, so `detectAuthorFromFolderName` returns null, and `matchOrCreateAuthor(null)` returns null)

**Step 6: Commit**

```bash
git add src/lib/courseImport.ts
git commit -m "feat(E25-S04): integrate author detection into import flow"
```

---

## Task 6: Update unit tests for import with author detection

**Files:**
- Modify: `src/lib/__tests__/courseImport.test.ts`

**Step 1: Add test for import with author-patterned folder name**

Add to the `describe('importCourseFromFolder')` block:

```typescript
  it('should set authorId when folder name contains author pattern', async () => {
    const dirHandle = createMockDirHandle('Chase Hughes - Behavioral Analysis')
    const videoHandle = createMockFileHandle('lesson-01.mp4')

    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {
      yield { handle: videoHandle, path: 'lesson-01.mp4' }
    })
    fileSystemMocks.isSupportedVideoFormat.mockReturnValue(true)
    fileSystemMocks.getVideoFormat.mockReturnValue('mp4')
    fileSystemMocks.extractVideoMetadata.mockResolvedValue({
      duration: 120, width: 1920, height: 1080,
    })

    const course = await importCourseFromFolder()

    expect(course.authorId).toBeTruthy()
    // Verify author was created in DB
    const { db } = await import('@/db')
    const author = await db.authors.get(course.authorId!)
    expect(author).toBeDefined()
    expect(author!.name).toBe('Chase Hughes')
  })

  it('should show author name in success toast', async () => {
    const dirHandle = createMockDirHandle('John Doe - React Patterns')
    const videoHandle = createMockFileHandle('lesson.mp4')

    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {
      yield { handle: videoHandle, path: 'lesson.mp4' }
    })
    fileSystemMocks.isSupportedVideoFormat.mockReturnValue(true)
    fileSystemMocks.getVideoFormat.mockReturnValue('mp4')
    fileSystemMocks.extractVideoMetadata.mockResolvedValue({
      duration: 60, width: 1280, height: 720,
    })

    await importCourseFromFolder()

    expect(toastMocks.success).toHaveBeenCalledWith(
      'Imported: John Doe - React Patterns by John Doe — 1 video, 0 PDFs'
    )
  })

  it('should import without authorId when folder name has no author pattern', async () => {
    const dirHandle = createMockDirHandle('my-videos')
    const videoHandle = createMockFileHandle('vid.mp4')

    fileSystemMocks.showDirectoryPicker.mockResolvedValue(dirHandle)
    fileSystemMocks.scanDirectory.mockImplementation(async function* () {
      yield { handle: videoHandle, path: 'vid.mp4' }
    })
    fileSystemMocks.isSupportedVideoFormat.mockReturnValue(true)
    fileSystemMocks.getVideoFormat.mockReturnValue('mp4')
    fileSystemMocks.extractVideoMetadata.mockResolvedValue({
      duration: 60, width: 1280, height: 720,
    })

    const course = await importCourseFromFolder()

    expect(course.authorId).toBeUndefined()
  })
```

**Step 2: Run all import tests**

Run: `npx vitest run src/lib/__tests__/courseImport.test.ts`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/lib/__tests__/courseImport.test.ts
git commit -m "test(E25-S04): add import tests for author detection integration"
```

---

## Task 7: Update test factory with `authorId` support

**Files:**
- Modify: `tests/support/fixtures/factories/imported-course-factory.ts`

**Step 1: Add optional `authorId` to `ImportedCourseTestData`**

```typescript
export interface ImportedCourseTestData {
  id: string
  name: string
  importedAt: string
  category: string
  tags: string[]
  status: 'active' | 'completed' | 'paused'
  videoCount: number
  pdfCount: number
  authorId?: string  // NEW: optional author link
}
```

No change to `createImportedCourse` needed — the spread `...overrides` already handles optional fields. Just add the type.

**Step 2: Run existing E2E tests to verify no regression**

Run: `npx playwright test tests/e2e/nfr67-reimport-fidelity.spec.ts --project chromium`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/support/fixtures/factories/imported-course-factory.ts
git commit -m "chore(E25-S04): add authorId to ImportedCourseTestData factory"
```

---

## Task 8: Add E2E test for author detection during import

**Files:**
- Create: `tests/e2e/e25-s04-author-auto-detection.spec.ts`

**Note:** E2E testing of `showDirectoryPicker()` is not possible in headless Playwright (browser security restriction). The E2E test should verify the detection logic indirectly by testing the Authors page shows newly linked authors after import. However, since we can't trigger real file system import in E2E, this test should verify the detection function behavior via unit-level approach or by seeding ImportedCourse data with authorId and verifying the Authors page reflects it.

**Recommended approach:** Skip E2E for the detection logic itself (covered thoroughly by unit/integration tests). Instead, add a targeted E2E test that seeds an imported course with an `authorId` and verifies it appears linked on the Authors page.

```typescript
// tests/e2e/e25-s04-author-auto-detection.spec.ts
import { test, expect } from '@playwright/test'
import { seedImportedCourses, seedAuthors } from '../support/helpers/seed-helpers'

test.describe('E25-S04: Author Auto-Detection', () => {
  test('imported course linked to author appears on Authors page', async ({ page }) => {
    // Seed author + imported course with authorId
    await seedAuthors(page, [{
      id: 'jane-smith',
      name: 'Jane Smith',
      isPreseeded: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }])

    await seedImportedCourses(page, [{
      id: 'course-1',
      name: 'Jane Smith - React Patterns',
      importedAt: '2026-01-01T00:00:00.000Z',
      category: '',
      tags: [],
      status: 'active',
      videoCount: 5,
      pdfCount: 1,
      authorId: 'jane-smith',
    }])

    await page.goto('/authors')
    await expect(page.getByText('Jane Smith')).toBeVisible()
  })
})
```

**Important:** The `seedAuthors` helper may need to be created if E25-S01 hasn't added it yet. If the helper doesn't exist at implementation time, create it following the pattern in `seed-helpers.ts`.

**Step 1: Write the E2E test (adapt based on actual state of E25-S01/S02/S03 helpers)**

**Step 2: Run the E2E test**

Run: `npx playwright test tests/e2e/e25-s04-author-auto-detection.spec.ts --project chromium`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/e2e/e25-s04-author-auto-detection.spec.ts
git commit -m "test(E25-S04): add E2E test for author-linked imported course display"
```

---

## Task 9: Run full test suite and lint

**Step 1: Run linter**

Run: `npm run lint`
Expected: No errors (warnings OK)

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run unit tests**

Run: `npm run test:unit`
Expected: ALL PASS

**Step 4: Run build**

Run: `npm run build`
Expected: Successful build

**Step 5: Fix any issues, then commit if fixes were needed**

```bash
git add -A
git commit -m "fix(E25-S04): address lint and type check issues"
```

---

## Summary

| Task | Description | AC | Est. |
|------|-------------|-----|------|
| 1 | Write failing tests for `detectAuthorFromFolderName` | 1, 6 | 3 min |
| 2 | Implement `detectAuthorFromFolderName` | 1, 6 | 3 min |
| 3 | Write failing tests for `matchOrCreateAuthor` | 2, 3 | 3 min |
| 4 | Implement `matchOrCreateAuthor` | 2, 3 | 3 min |
| 5 | Integrate detection into import flow + toast | 1-5 | 5 min |
| 6 | Add import unit tests for author detection | 1-5 | 3 min |
| 7 | Update test factory with `authorId` | — | 2 min |
| 8 | Add E2E test for author-linked display | 1-5 | 5 min |
| 9 | Full test suite + lint + build | — | 3 min |

**Total: ~30 minutes implementation time**

## Key Design Decisions

1. **Pure detection function**: `detectAuthorFromFolderName` has zero side effects, making it trivially testable and safe to call multiple times.

2. **Separator-first heuristic**: Uses ` - `, ` — `, ` – ` separators because these are the most common patterns in course folder naming (e.g., "Author Name - Course Title"). Does NOT try to parse camelCase, underscores, or path-based detection.

3. **Person name validation**: Requires 2+ words matching `[\p{L}.''-]+` pattern to avoid false positives on category names like "Programming - Advanced Topics".

4. **Graceful degradation**: Detection failure is silent (AC5). The `try/catch` in the import flow logs a warning but never blocks the import.

5. **Idempotent author creation**: `matchOrCreateAuthor` uses slug-based IDs derived from the name. Second call with the same name finds the existing record.

6. **No UI changes**: No new dialogs, forms, or pages. The only visible change is the enhanced toast message including the author name.

## Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/authorDetection.ts` | Create | Pure detection + DB match functions |
| `src/lib/__tests__/authorDetection.test.ts` | Create | Unit tests for detection heuristic |
| `src/lib/__tests__/authorDetection.integration.test.ts` | Create | Integration tests for DB matching |
| `src/lib/courseImport.ts` | Modify | Wire detection into import flow |
| `src/lib/__tests__/courseImport.test.ts` | Modify | Add author detection import tests |
| `tests/support/fixtures/factories/imported-course-factory.ts` | Modify | Add `authorId` to test type |
| `tests/e2e/e25-s04-author-auto-detection.spec.ts` | Create | E2E test for linked display |
