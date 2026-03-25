# E25-S01: Author Data Model And Migration — Implementation Plan

**Story**: [25-1-author-data-model-and-migration.md](../25-1-author-data-model-and-migration.md)
**Branch**: `feature/e25-s01-author-data-model-and-migration`
**Created**: 2026-03-23

## Overview

This is a **data layer enabler story** — no UI changes. It establishes the `Author` entity in IndexedDB (Dexie v20), creates a Zustand store for reactive author management, and migrates existing data. This unblocks E25-S02 (CRUD dialog), E25-S03 (Authors page from IndexedDB), and all subsequent Author Management stories.

## Current State Analysis

### What Exists
| Component | Location | Current Behavior |
|-----------|----------|-----------------|
| `Author` interface | `src/data/types.ts:78-90` | Static display type with `avatar`, `title`, `yearsExperience`, `featuredQuote` |
| Chase Hughes data | `src/data/authors/chase-hughes.ts` | Hardcoded static data object |
| `allAuthors` array | `src/data/authors/index.ts` | Static export, used by Authors page |
| `getAuthorById()` | `src/data/authors/index.ts:9-11` | Searches static array by ID |
| Author utilities | `src/lib/authors.ts` | `getAuthorStats()`, `getAuthorForCourse()`, `getAvatarSrc()` |
| Authors page | `src/app/pages/Authors.tsx` | Reads from `allAuthors` static import |
| AuthorProfile page | `src/app/pages/AuthorProfile.tsx` | Reads from `getAuthorById()` static lookup |
| Dexie schema | `src/db/schema.ts` | v19 — no `authors` table |
| `courses` table | `src/db/schema.ts:462` | Has `authorId` index (from E23-S03 rename) |
| `importedCourses` table | `src/db/schema.ts:446` | No `authorId` field |
| Schema test | `src/db/__tests__/schema.test.ts` | Asserts `db.verno === 19`, lists 20 tables |

### What Needs to Change
1. **New `DbAuthor` interface** — database entity type (distinct from static `Author` display type)
2. **New `authors` table** — Dexie v20 with `id` PK, `name` index
3. **`importedCourses` table** — add `authorId` index
4. **v20 upgrade function** — seed Chase Hughes, migrate authorName strings
5. **New `useAuthorStore`** — Zustand store with CRUD + load
6. **Schema test updates** — v20 version, 21 tables, new table assertions
7. **Migration unit tests** — edge cases per AC8

## Implementation Tasks

### Task 1: Define `DbAuthor` Interface (AC5, AC2)

**File**: `src/data/types.ts`

Add a new `DbAuthor` interface for database persistence. Keep the existing `Author` interface unchanged (it's used for static display data by Authors.tsx and AuthorProfile.tsx — those pages will be migrated to use `DbAuthor` in E25-S03).

```typescript
// --- Database Author Entity (E25-S01) ---

export interface DbAuthorSocialLinks {
  website?: string
  linkedin?: string
  twitter?: string
}

export interface DbAuthor {
  id: string                    // UUID or slug (e.g., 'chase-hughes')
  name: string                  // Required — author's display name
  bio?: string                  // Biographical text (optional)
  photoUrl?: string             // URL or local path to author photo (optional)
  specialties?: string[]        // Specialty tags (optional)
  socialLinks?: DbAuthorSocialLinks
  isPreseeded: boolean          // true for bundled authors (prevents deletion)
  createdAt: string             // ISO 8601
  updatedAt: string             // ISO 8601
}
```

Also add `authorId?: string` to the `ImportedCourse` interface:
```typescript
export interface ImportedCourse {
  // ... existing fields ...
  authorId?: string             // FK to DbAuthor.id (null for unlinked courses)
}
```

**Why `DbAuthor` instead of extending `Author`?**
- The static `Author` has display-specific fields (`avatar`, `title`, `yearsExperience`, `featuredQuote`) that don't belong in a user-created author record
- `DbAuthor` is leaner — only fields needed for database persistence
- Avoids breaking the Authors page (E25-S03 will migrate it to use `DbAuthor`)
- Clear naming convention: `Db` prefix signals "IndexedDB entity"

**Decision point**: The `specialties` field uses `string[]` (not an indexed multi-entry field in Dexie) because specialty filtering is a future E25-S02+ concern. Keep it simple.

### Task 2: Dexie v20 Schema Declaration (AC1, AC2)

**File**: `src/db/schema.ts`

#### 2.1 Add `authors` EntityTable to the db type

At the top of the file, add `DbAuthor` to imports and add the table type:
```typescript
import type { ..., DbAuthor } from '@/data/types'

// In the db type assertion:
authors: EntityTable<DbAuthor, 'id'>
```

#### 2.2 Declare v20 stores

Add after the v19 declaration:
```typescript
// v20: Authors table + authorId on importedCourses (E25-S01)
db.version(20)
  .stores({
    // All 20 existing v19 tables (must redeclare)
    importedCourses: 'id, name, importedAt, status, *tags, authorId',  // NEW: authorId index
    importedVideos: 'id, courseId, filename',
    importedPdfs: 'id, courseId, filename',
    progress: '[courseId+videoId], courseId, videoId',
    bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
    screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
    studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
    contentProgress: '[courseId+itemId], courseId, itemId, status',
    challenges: 'id, type, deadline, createdAt',
    embeddings: 'noteId, createdAt',
    learningPath: 'courseId, position, generatedAt',
    courseThumbnails: 'courseId',
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
    courses: 'id, category, difficulty, authorId',
    quizzes: 'id, lessonId, createdAt',
    quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
    videoCaptions: '[courseId+videoId], courseId, videoId',
    // NEW: Authors table
    authors: 'id, name',
  })
  .upgrade(/* Task 3 */)
```

**Key changes from v19:**
- `importedCourses` — adds `authorId` index
- `authors` — new table with `id` PK, `name` index
- All other tables — unchanged (must redeclare per Dexie convention)

### Task 3: v20 Upgrade Function (AC3, AC4, AC7, AC9)

**File**: `src/db/schema.ts` (continuation of Task 2)

The upgrade function runs once when users open the app after the code update. It:
1. Seeds Chase Hughes as a pre-seeded author
2. Scans `importedCourses` for `authorName` fields
3. Deduplicates and creates Author records
4. Links courses to their Author records via `authorId`

```typescript
.upgrade(async tx => {
  try {
    const now = new Date().toISOString()
    const authorsTable = tx.table('authors')

    // Step 1: Seed Chase Hughes from static data
    await authorsTable.add({
      id: 'chase-hughes',
      name: 'Chase Hughes',
      bio: '...', // From chase-hughes.ts
      photoUrl: '/images/instructors/chase-hughes',
      specialties: ['Behavioral Analysis', 'Deception Detection', ...],
      socialLinks: { website: '...', twitter: '...' },
      isPreseeded: true,
      createdAt: now,
      updatedAt: now,
    })

    // Step 2: Scan importedCourses for authorName strings
    const courses = await tx.table('importedCourses').toArray()
    const authorNameMap = new Map<string, { originalName: string; courseIds: string[] }>()

    for (const course of courses) {
      const raw = course.authorName
      if (!raw || typeof raw !== 'string') continue
      const normalized = raw.trim().toLowerCase()
      if (!normalized) continue

      if (!authorNameMap.has(normalized)) {
        authorNameMap.set(normalized, { originalName: raw.trim(), courseIds: [] })
      }
      authorNameMap.get(normalized)!.courseIds.push(course.id)
    }

    // Step 3: Create Author records from deduplicated names
    let createdCount = 0
    for (const [, { originalName, courseIds }] of authorNameMap) {
      // Skip if this matches the pre-seeded author
      if (originalName.toLowerCase() === 'chase hughes') {
        // Link courses to existing Chase Hughes record
        for (const courseId of courseIds) {
          await tx.table('importedCourses').update(courseId, { authorId: 'chase-hughes' })
        }
        continue
      }

      const authorId = crypto.randomUUID()
      await authorsTable.add({
        id: authorId,
        name: originalName,
        isPreseeded: false,
        createdAt: now,
        updatedAt: now,
      })

      // Link courses to new Author
      for (const courseId of courseIds) {
        await tx.table('importedCourses').update(courseId, { authorId })
      }
      createdCount++
    }

    // Step 4: Log migration result (toast handled in app startup, not in migration)
    if (createdCount > 0) {
      console.log(`[Migration v20] Created ${createdCount} author profiles from imported courses`)
    }
  } catch (error) {
    console.error('[Migration v20] Author migration failed:', error)
    // Graceful degradation — don't rethrow, app loads without author features
    // The authors table is still created (schema change is separate from upgrade)
  }
})
```

**Design decisions:**
- **Don't rethrow** on migration failure — this is graceful degradation per AC4
- **Don't import** from `chase-hughes.ts` inside the upgrade — Dexie upgrades run in a transaction context; use inline data to avoid circular dependency risks
- **`authorName` field** on `importedCourses` doesn't exist yet (E24 would add it), so the migration is forward-compatible — it handles 0 courses with authorName gracefully
- **Toast notification** for "Created N author profiles" should be handled at the application startup level (e.g., in a migration result store or localStorage flag), not inside the Dexie upgrade function — Dexie upgrades run before React mounts

**Toast notification strategy:**
- Store `migrationResult` in localStorage during upgrade: `localStorage.setItem('e25-migration-result', JSON.stringify({ createdCount }))`
- Read and clear in app startup (or a `useEffect` in Layout.tsx)
- This approach decouples the Dexie migration from the UI layer

### Task 4: Create `useAuthorStore` Zustand Store (AC6)

**File**: `src/stores/useAuthorStore.ts` (new file)

```typescript
import { create } from 'zustand'
import { db } from '@/db'
import type { DbAuthor } from '@/data/types'

interface AuthorStoreState {
  authors: DbAuthor[]
  isLoaded: boolean
  loadAuthors: () => Promise<void>
  getAuthorById: (id: string) => DbAuthor | undefined
  createAuthor: (author: Omit<DbAuthor, 'id' | 'createdAt' | 'updatedAt' | 'isPreseeded'>) => Promise<DbAuthor>
  updateAuthor: (id: string, updates: Partial<Omit<DbAuthor, 'id' | 'isPreseeded' | 'createdAt'>>) => Promise<void>
  deleteAuthor: (id: string) => Promise<void>
}

export const useAuthorStore = create<AuthorStoreState>((set, get) => ({
  authors: [],
  isLoaded: false,

  loadAuthors: async () => {
    if (get().isLoaded && get().authors.length > 0) return
    try {
      const authors = await db.authors.toArray()
      set({ authors, isLoaded: true })
    } catch (error) {
      console.error('[AuthorStore] Failed to load authors:', error)
    }
  },

  getAuthorById: (id: string) => {
    return get().authors.find(a => a.id === id)
  },

  createAuthor: async (input) => {
    const now = new Date().toISOString()
    const author: DbAuthor = {
      ...input,
      id: crypto.randomUUID(),
      isPreseeded: false,
      createdAt: now,
      updatedAt: now,
    }
    await db.authors.add(author)
    set(state => ({ authors: [...state.authors, author] }))
    return author
  },

  updateAuthor: async (id, updates) => {
    const now = new Date().toISOString()
    await db.authors.update(id, { ...updates, updatedAt: now })
    set(state => ({
      authors: state.authors.map(a =>
        a.id === id ? { ...a, ...updates, updatedAt: now } : a
      ),
    }))
  },

  deleteAuthor: async (id) => {
    const author = get().authors.find(a => a.id === id)
    if (author?.isPreseeded) {
      throw new Error('Cannot delete pre-seeded author')
    }
    await db.authors.delete(id)
    set(state => ({ authors: state.authors.filter(a => a.id !== id) }))
  },
}))
```

**Pattern follows**: `useCourseStore.ts` (same load-guard, try/catch, set pattern).

**Key behaviors:**
- `deleteAuthor` guards against deleting pre-seeded authors (AC7 — `isPreseeded` flag)
- `createAuthor` auto-generates `id`, `createdAt`, `updatedAt`, sets `isPreseeded: false`
- `updateAuthor` auto-updates `updatedAt` timestamp
- State is updated optimistically after successful DB write (not before — per engineering patterns)

### Task 5: Schema & Migration Unit Tests (AC1, AC3, AC7, AC8)

**File**: `src/db/__tests__/schema.test.ts` (extend existing)

#### 5.1 Update existing version/table assertions

```typescript
it('should be at version 20', () => {
  expect(db.verno).toBe(20)
})

it('should create the database with correct tables including authors', async () => {
  expect(db.tables.map(t => t.name).sort()).toEqual([
    'aiUsageEvents',
    'authors',        // NEW
    'bookmarks',
    // ... all 21 tables
  ])
})
```

#### 5.2 Test authors table CRUD

```typescript
describe('authors table (v20)', () => {
  function makeAuthor(overrides: Partial<DbAuthor> = {}): DbAuthor {
    return {
      id: crypto.randomUUID(),
      name: 'Test Author',
      isPreseeded: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    }
  }

  it('should add and retrieve an author', async () => { ... })
  it('should query by name index', async () => { ... })
  it('should support optional fields (bio, photoUrl, specialties, socialLinks)', async () => { ... })
})
```

#### 5.3 Test v20 migration

```typescript
describe('v20 migration (authors)', () => {
  it('should seed Chase Hughes as pre-seeded author', async () => {
    // Create v19 DB, close, re-import v20 schema, verify chase-hughes exists
  })

  it('should migrate 0 courses without error', async () => {
    // Empty importedCourses table → no new authors created, chase-hughes still seeded
  })

  it('should deduplicate authorName case-insensitively', async () => {
    // Seed importedCourses with authorName: "John", "john", " John "
    // Verify 1 Author record created (not 3)
    // Verify all 3 courses linked to same authorId
  })

  it('should handle 100+ courses in bulk migration', async () => {
    // Seed 120 importedCourses with 10 unique authorNames
    // Verify 10 Author records created
    // Verify all 120 courses have authorId set
  })

  it('should skip empty authorName strings', async () => {
    // Seed importedCourses with authorName: "" and "   "
    // Verify no Author records created for empty names
  })

  it('should handle unicode author names', async () => {
    // Seed with authorName: "José García", "München Lehrer"
    // Verify Author records created with correct names
  })

  it('should not create duplicate for Chase Hughes authorName', async () => {
    // Seed importedCourses with authorName: "Chase Hughes"
    // Verify no new author created, courses linked to 'chase-hughes' id
  })

  it('should preserve existing data on migration failure', async () => {
    // Mock a failure scenario, verify importedCourses data intact
  })
})
```

### Task 6: Zustand Store Unit Tests (AC6)

**File**: `src/stores/__tests__/useAuthorStore.test.ts` (new file)

```typescript
describe('useAuthorStore', () => {
  it('should load authors from IndexedDB', async () => { ... })
  it('should return undefined for non-existent author ID', () => { ... })
  it('should create a new author with generated ID and timestamps', async () => { ... })
  it('should update author and refresh updatedAt', async () => { ... })
  it('should delete a non-preseeded author', async () => { ... })
  it('should throw when deleting a pre-seeded author', async () => { ... })
  it('should not re-load if already loaded with data', async () => { ... })
})
```

**Test pattern**: Use `fake-indexeddb/auto` (already a dev dependency), mirror `schema.test.ts` setup with `beforeEach` Dexie delete + re-import.

## Build Sequence

Execute tasks in this order (dependencies flow downward):

```
Task 1: DbAuthor interface + ImportedCourse.authorId
  ↓
Task 2: Dexie v20 schema declaration
  ↓
Task 3: v20 upgrade function (migration)
  ↓
Task 4: useAuthorStore Zustand store
  ↓
Task 5: Schema & migration tests
  ↓
Task 6: Store tests
```

Tasks 5 and 6 can be written in parallel (independent test files).

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/data/types.ts` | Modify | Add `DbAuthor`, `DbAuthorSocialLinks` interfaces; add `authorId?` to `ImportedCourse` |
| `src/db/schema.ts` | Modify | Add v20 schema + upgrade function; add `authors` table to db type |
| `src/stores/useAuthorStore.ts` | Create | Zustand store with CRUD + load |
| `src/db/__tests__/schema.test.ts` | Modify | Update version assertion, add authors table tests, migration tests |
| `src/stores/__tests__/useAuthorStore.test.ts` | Create | Store unit tests |

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration failure corrupts existing data | HIGH | Try/catch without rethrow; Dexie schema changes are separate from upgrade logic |
| `authorName` field doesn't exist on importedCourses yet | LOW | Migration gracefully handles 0 courses with authorName (forward-compatible) |
| Two `Author` types cause confusion | MEDIUM | Clear naming: `Author` = static display, `DbAuthor` = database entity. E25-S03 will consolidate |
| Toast notification timing | LOW | Use localStorage flag for cross-layer communication (migration → UI) |

## Out of Scope

- **UI changes** — Authors.tsx stays unchanged (reads from static data until E25-S03)
- **Import wizard integration** — E25-S04 handles author auto-detection during import
- **Photo upload** — E25-S02 handles photo management in CRUD dialog
- **Pre-seeded course linking** — The `courses` table already has `authorId: 'chase-hughes'` from E23-S03; this story doesn't modify that table
- **E2E tests** — Data-layer-only story; unit tests provide sufficient coverage

## Verification Steps

After implementation, verify:

```bash
# 1. Build succeeds
npm run build

# 2. Lint passes
npm run lint

# 3. Type check passes
npx tsc --noEmit

# 4. Unit tests pass
npm run test:unit

# 5. Schema version is 20
# (Checked by updated schema.test.ts)

# 6. Dev server starts without migration errors
npm run dev
# Check browser console for: [Migration v20] Created 0 author profiles
# (0 because no importedCourses have authorName yet)
```
