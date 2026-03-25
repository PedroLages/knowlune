# Plan: E25-S02 — Author CRUD Dialog

## Context

Authors currently exist as **static TypeScript data** in `src/data/authors/` with no IndexedDB table. The `Author` type is defined in `src/data/types.ts:78-90`. The Authors page (`src/app/pages/Authors.tsx`) and AuthorProfile page (`src/app/pages/AuthorProfile.tsx`) read from `allAuthors` (a hardcoded array) and `getAuthorById()` (a static lookup).

This story adds full CRUD (Create, Read, Update, Delete) for authors via a dialog, persisting to IndexedDB. Since E25-S01 ("Author Data Model & Migration") is still backlog, this story subsumes that work as Task 1.

**Branch**: `feature/e25-s02-author-crud-dialog` (from `main`)

## Current Architecture

| Layer | Current State | Target State |
|-------|--------------|-------------|
| **Data Source** | `src/data/authors/index.ts` (static array) | IndexedDB `authors` table via Dexie |
| **Types** | `Author` in `src/data/types.ts:78-90` | Same type, no changes needed |
| **State** | No store — direct import of `allAuthors` | `useAuthorStore` (Zustand + Dexie) |
| **Utility** | `src/lib/authors.ts` (reads from `useCourseStore`) | Updated to read from `useAuthorStore` |
| **UI - List** | `Authors.tsx` imports `allAuthors` | Uses `useAuthorStore` + "Add Author" button |
| **UI - Profile** | `AuthorProfile.tsx` calls `getAuthorById()` | Uses `useAuthorStore` + edit/delete buttons |
| **UI - CRUD** | None | `AuthorFormDialog` + `AlertDialog` for delete |

## Implementation Strategy

**Approach**: Inside-out — DB migration → store → CRUD dialog → page integration → tests. Each task is one commit.

**Validation pattern**: Inline validation with `useState` errors (matching `CreateChallengeDialog` pattern — the codebase does NOT use `react-hook-form` + `zod` for form dialogs despite having both installed).

**Delete pattern**: `AlertDialog` with destructive styling (matching `ImportedCourseCard` pattern).

---

## Task 1: Add `authors` table to Dexie schema (v20 migration)

**Files**:
- `src/db/schema.ts`
- `src/data/types.ts` (no changes needed — `Author` type already suitable)

**Changes in `schema.ts`**:

Add v20 migration after v19:
```typescript
// v20: Authors table for CRUD management (E25-S02)
db.version(20).stores({
  // All 20 existing v19 tables (unchanged)
  importedCourses: 'id, name, importedAt, status, *tags',
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
}).upgrade(async tx => {
  // Seed existing static author data into the new table
  const { allAuthors } = await import('@/data/authors')
  const existingCount = await tx.table('authors').count()
  if (existingCount === 0) {
    await tx.table('authors').bulkAdd(allAuthors)
  }
})
```

**Update Dexie type declaration** at the top of `schema.ts`:
```typescript
authors: EntityTable<Author, 'id'>
```

**Add `Author` to the type import** from `@/data/types`.

**Indexes**: Only `id` (primary key) and `name` (for potential search). The `Author` type is small enough that filtering in-memory is fine.

**Commit**: `feat(E25-S02): add authors table to Dexie schema v20`

---

## Task 2: Create `useAuthorStore` Zustand store

**File**: `src/stores/useAuthorStore.ts` (new file)

**Interface**:
```typescript
interface AuthorState {
  authors: Author[]
  isLoaded: boolean
  loadAuthors: () => Promise<void>
  addAuthor: (data: Omit<Author, 'id'>) => Promise<Author>
  updateAuthor: (id: string, data: Partial<Omit<Author, 'id'>>) => Promise<void>
  deleteAuthor: (id: string) => Promise<void>
  getAuthorById: (id: string) => Author | undefined
}
```

**Key patterns** (following `useChallengeStore` and `useCourseStore`):
- `loadAuthors()`: Loads from `db.authors.toArray()`, with `isLoaded` guard to prevent redundant loads
- `addAuthor()`: Generates UUID via `crypto.randomUUID()`, persists with `persistWithRetry`, updates state after DB write succeeds (no optimistic updates)
- `updateAuthor()`: Merges partial data, persists, then updates state
- `deleteAuthor()`: Deletes from DB, then removes from state
- `getAuthorById()`: In-memory lookup from `authors` array (synchronous)
- All mutations use `try/catch` with `toast.error()` on failure (matching `useChallengeStore` pattern)

**Commit**: `feat(E25-S02): add useAuthorStore with CRUD operations`

---

## Task 3: Create `AuthorFormDialog` component

**File**: `src/app/components/authors/AuthorFormDialog.tsx` (new file)

**Props**:
```typescript
interface AuthorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  author?: Author  // undefined = create mode, defined = edit mode
}
```

**Form fields** (matching `Author` type in `src/data/types.ts:78-90`):

| Field | Component | Required | Validation |
|-------|-----------|----------|------------|
| name | `Input` | Yes | Non-empty, max 100 chars |
| title | `Input` | No | Max 200 chars |
| bio | `Textarea` | No | Max 2000 chars |
| shortBio | `Textarea` (small) | No | Max 200 chars |
| specialties | Tag input (custom) | No | Array of strings |
| yearsExperience | `Input type="number"` | No | >= 0, integer |
| education | `Input` | No | Max 200 chars |
| avatar | `Input` (URL) | No | Valid URL or empty |
| socialLinks.website | `Input` | No | Valid URL or empty |
| socialLinks.linkedin | `Input` | No | Valid URL or empty |
| socialLinks.twitter | `Input` | No | Valid URL or empty |
| featuredQuote | `Input` | No | Max 300 chars |

**Validation pattern** (matching `CreateChallengeDialog`):
```typescript
interface FormErrors {
  name?: string
  // ... other fields as needed
}

function validate(): FormErrors {
  const errs: FormErrors = {}
  if (!name.trim()) errs.name = 'Author name is required'
  else if (name.trim().length > 100) errs.name = 'Name must be 100 characters or less'
  // URL validation for social links
  return errs
}
```

**Specialties tag input**: Simple implementation — text input with comma-separated entry, displayed as removable Badge components. No need for a complex tag autocomplete at this stage.

**Dialog layout**:
```
┌──────────────────────────────┐
│  Create Author / Edit Author │  ← DialogTitle (dynamic)
│  Short description text      │  ← DialogDescription
├──────────────────────────────┤
│  Name*          [________]   │
│  Title          [________]   │
│  Short Bio      [________]   │
│  Bio            [________]   │
│                 [________]   │
│  Specialties    [tag] [tag]  │
│                 [________]   │
│  Years Exp.     [___]        │
│  Education      [________]   │
│  Avatar URL     [________]   │
│  ─── Social Links ────────── │
│  Website        [________]   │
│  LinkedIn       [________]   │
│  Twitter        [________]   │
│  Featured Quote [________]   │
├──────────────────────────────┤
│          [Cancel] [Save]     │
└──────────────────────────────┘
```

**Scrollable**: Use `DialogContent` with `max-h-[85vh] overflow-y-auto` since the form has many fields.

**Accessibility**:
- All fields have `<Label htmlFor>` associations
- `aria-invalid` on invalid fields
- `role="alert"` on error messages
- `aria-describedby` linking fields to error messages
- Dialog focus trap is handled by Radix UI's Dialog primitive

**Commit**: `feat(E25-S02): add AuthorFormDialog component`

---

## Task 4: Create delete confirmation with AlertDialog

**File**: `src/app/components/authors/DeleteAuthorDialog.tsx` (new file)

**Props**:
```typescript
interface DeleteAuthorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  author: Author
  onDeleted?: () => void  // callback for navigation after delete (e.g., redirect from profile)
}
```

**Pattern**: Matches `ImportedCourseCard` AlertDialog:
- Shows author name in title: `Delete "Chase Hughes"?`
- Destructive action styling: `className="bg-destructive text-destructive-foreground hover:bg-destructive/90"`
- Loading state: `{deleting ? 'Deleting…' : 'Delete'}`
- Calls `useAuthorStore().deleteAuthor(author.id)`
- Shows `toast.success('Author deleted')` on success
- Shows `toast.error('Failed to delete author')` on failure
- Calls `onDeleted()` callback after successful deletion

**Commit**: `feat(E25-S02): add DeleteAuthorDialog component`

---

## Task 5: Update Authors page to use `useAuthorStore`

**File**: `src/app/pages/Authors.tsx`

**Changes**:
1. Replace `import { allAuthors } from '@/data/authors'` with `useAuthorStore`
2. Add `useEffect` to call `loadAuthors()` on mount
3. Add "Add Author" button in page header (using `variant="brand"`)
4. Add edit/delete icon buttons to each author card (Pencil, Trash2 icons)
5. Integrate `AuthorFormDialog` (create + edit) and `DeleteAuthorDialog`
6. Handle loading state (skeleton or spinner while `!isLoaded`)

**Card actions overlay**: Add a hover-visible action bar on each card:
```tsx
<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
  <Button variant="ghost" size="icon" onClick={() => openEditDialog(author)}>
    <Pencil className="size-4" />
  </Button>
  <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(author)}>
    <Trash2 className="size-4" />
  </Button>
</div>
```

**Empty state**: When no authors exist, show an empty state with the "Add Author" CTA (matching the app's empty state pattern from Epic 10).

**Commit**: `feat(E25-S02): update Authors page with CRUD actions`

---

## Task 6: Update AuthorProfile page for edit/delete actions

**File**: `src/app/pages/AuthorProfile.tsx`

**Changes**:
1. Replace `import { getAuthorById } from '@/data/authors'` with `useAuthorStore`
2. Add `useEffect` to call `loadAuthors()` on mount
3. Add Edit and Delete buttons in the hero section (next to author name)
4. Integrate `AuthorFormDialog` (edit mode) and `DeleteAuthorDialog`
5. On delete, navigate to `/authors` using `useNavigate()`
6. Handle author not found (already exists — keep as-is)

**Commit**: `feat(E25-S02): update AuthorProfile page with edit/delete`

---

## Task 7: Update `lib/authors.ts` to read from store

**File**: `src/lib/authors.ts`

**Changes**:
1. `getAuthorStats()` — already reads courses from `useCourseStore.getState()`. No change needed (it receives `author` as a param).
2. `getAuthorForCourse()` — currently calls `getAuthorById()` from static data. Update to use `useAuthorStore.getState().getAuthorById()`.
3. Remove import of `getAuthorById` from `@/data/authors`.
4. **Keep** `getAvatarSrc()` — utility function, no data source dependency.

**Also update consuming components**:
- `src/app/components/figma/CourseCard.tsx` — currently calls `getAuthorForCourse()` from `@/lib/authors`. This should continue to work after lib update.
- `src/app/pages/CourseDetail.tsx` — same pattern.

**Commit**: `refactor(E25-S02): update lib/authors to read from store`

---

## Task 8: Write E2E tests

**File**: `tests/e2e/story-e25-s02.spec.ts` (new file)

**Test scenarios**:

1. **Create author**: Open dialog → fill required fields → submit → verify author appears in grid
2. **Create author validation**: Submit empty form → verify error messages → fill name → submit succeeds
3. **Edit author**: Click edit on existing author → modify name → save → verify updated in grid
4. **Delete author**: Click delete → confirm → verify removed from grid → verify toast
5. **Delete from profile page**: Navigate to profile → delete → verify redirect to /authors
6. **Form pre-population**: Open edit dialog → verify all fields match existing author data
7. **Empty state**: Delete all authors → verify empty state with "Add Author" CTA

**Test data setup**: Seed authors via IndexedDB helper (matching existing test patterns).

**Commit**: `test(E25-S02): add E2E tests for author CRUD`

---

## Task 9: Verify build, lint, type-check

```bash
npm run build
npm run lint
npx tsc --noEmit
npx playwright test tests/e2e/story-e25-s02.spec.ts --project=chromium
```

**Commit**: Fix any issues found.

---

## Files Summary

| Category | Files | Count |
|----------|-------|-------|
| DB | `src/db/schema.ts` | 1 |
| Store | `src/stores/useAuthorStore.ts` (new) | 1 |
| Components | `src/app/components/authors/AuthorFormDialog.tsx` (new) | 1 |
| Components | `src/app/components/authors/DeleteAuthorDialog.tsx` (new) | 1 |
| Pages | `src/app/pages/Authors.tsx` (modified) | 1 |
| Pages | `src/app/pages/AuthorProfile.tsx` (modified) | 1 |
| Lib | `src/lib/authors.ts` (modified) | 1 |
| Tests | `tests/e2e/story-e25-s02.spec.ts` (new) | 1 |
| **Total** | | **8** |

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Static `allAuthors` still imported elsewhere | Grep for all usages; update or keep backward-compat re-export |
| Dexie migration seed fails on existing DBs | Guard with `existingCount === 0` check |
| `getAuthorForCourse()` called before store loads | Return `undefined` gracefully (already handled in consuming components) |
| Many form fields make dialog too tall | ScrollArea inside DialogContent with max-height |

## Decision Log

| Decision | Rationale |
|----------|-----------|
| Subsume E25-S01 into this story | Can't build CRUD without the Dexie table; simpler to do both |
| Inline validation over react-hook-form | Match existing `CreateChallengeDialog` pattern — consistency over elegance |
| Separate `AuthorFormDialog` and `DeleteAuthorDialog` | Single Responsibility; delete uses AlertDialog (different Radix primitive) |
| No avatar file upload in this story | E25-S05 covers smart photo detection; this story uses URL input only |
| Tag input as comma-separated | KISS — a fancy tag autocomplete is not needed for the specialties field |
