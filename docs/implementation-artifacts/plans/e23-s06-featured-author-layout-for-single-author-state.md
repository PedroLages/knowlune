# Plan: E23-S06 — Featured Author Layout For Single Author State

## Context

The Authors page (`src/app/pages/Authors.tsx`) currently renders ALL authors in a 3-column card grid. With only one author (Chase Hughes) in `allAuthors`, this produces a single small card floating in an empty grid — visually underwhelming and inconsistent with the polish level of other pages.

This story adds a **featured/hero layout** that activates when `allAuthors.length === 1`, presenting the sole author with a richer, spotlight-style card. When multiple authors exist, the existing grid layout remains unchanged.

**Branch**: `feature/e23-s06-featured-author-layout-for-single-author-state`

## Current State

### Authors.tsx (lines 17-98)
- Page header: `<h1>Our Authors</h1>` with dynamic subtitle
- Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`
- Each card: Avatar (96px), name, title, specialty badges (max 3), stats row (courses, hours, lessons)
- Cards link to `/authors/:authorId`

### AuthorProfile.tsx (lines 29-192)
- Full profile page with hero card (avatar 128px, name, title, quote, specialties, social links)
- Stats strip: 4 stat cards (courses, hours, lessons, experience)
- Bio section with education
- Courses grid

### Data Layer
- `src/data/authors/index.ts`: exports `allAuthors` (currently `[chaseHughes]`)
- `src/lib/authors.ts`: `getAuthorStats(author)` returns `{ courses, courseCount, totalLessons, totalHours, totalVideos, categories }`
- `src/lib/authors.ts`: `getAvatarSrc(basePath, displaySize)` returns responsive avatar props

### Author Type (`src/data/types.ts:78-90`)
```typescript
interface Author {
  id: string; name: string; avatar: string; title: string;
  bio: string; shortBio: string; specialties: string[];
  yearsExperience: number; education?: string;
  socialLinks: AuthorSocialLinks; featuredQuote?: string;
}
```

### Test Infrastructure
- No existing Authors unit tests (no `src/app/pages/__tests__/Authors.test.tsx`)
- No existing Authors E2E tests
- Navigation helper pattern: `navigateAndWait()` in `tests/support/helpers/navigation.ts`
- E2E fixture: `tests/support/fixtures.ts`

## Implementation Steps

### Step 1: Create `FeaturedAuthor` component

**File**: `src/app/components/figma/FeaturedAuthor.tsx` (new)

**Why `figma/`**: Custom components that aren't part of the shadcn/ui library live in `src/app/components/figma/` per project convention.

**Props**:
```typescript
interface FeaturedAuthorProps {
  author: Author
}
```

**Layout** (mobile-first):
- **Card** wrapping: `<Card className="rounded-3xl border-0 shadow-sm">`
- **Inner layout**: `<CardContent className="p-6 sm:p-8">`
  - **Top section**: `flex flex-col sm:flex-row gap-6`
    - **Left**: Avatar (size-24 sm:size-28), ring styling matching AuthorProfile pattern
    - **Right**: Name (h2, font-semibold text-xl), title (text-muted-foreground), featured quote (blockquote with `border-l-2 border-brand`), specialty badges
  - **Stats strip**: 4 stat cards in `grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6`
    - Reuse the `StatCard` inline component pattern from `AuthorProfile.tsx` (or extract if shared)
    - Stats: Courses, Content (hours), Lessons, Experience
  - **Bottom section**: Short bio paragraph + "View Full Profile" CTA
    - Bio: `<p className="text-muted-foreground leading-relaxed mt-4">{author.shortBio}</p>`
    - CTA: `<Button variant="brand" asChild><Link to={/authors/${author.id}>View Full Profile</Link></Button>`

**Design tokens**:
- Card: `bg-card` (inherited from `<Card>`)
- Avatar ring: `ring-2 ring-border/50`
- Name: `text-foreground` (default)
- Title/bio: `text-muted-foreground`
- Quote border: `border-brand`
- Badge: `variant="secondary"` (existing pattern)
- Stats icon: `text-brand`
- CTA: `variant="brand"` on `<Button>`

**Accessibility**:
- Author name as `<h2>` (page has `<h1>Our Authors</h1>`)
- Avatar `alt={author.name}`
- Stats icons: `aria-hidden="true"` (labels provide context)
- CTA: descriptive link text "View Full Profile"
- Entire card NOT wrapped in a link (CTA button is the explicit navigation target — avoids nested interactive elements)

### Step 2: Update Authors.tsx to conditionally render

**File**: `src/app/pages/Authors.tsx`

**Changes**:
1. Import `FeaturedAuthor` component
2. Branch rendering on `allAuthors.length === 1`:

```tsx
{allAuthors.length === 1 ? (
  <FeaturedAuthor author={allAuthors[0]} />
) : (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {/* existing grid code (lines 32-95) */}
  </div>
)}
```

3. Keep page header unchanged (already handles singular: "Meet the expert behind your learning journey")

**data-testid attributes**:
- `data-testid="featured-author"` on FeaturedAuthor root
- `data-testid="author-grid"` on the grid div (for multi-author test assertions)

### Step 3: Extract `StatCard` to shared location (optional)

**Decision**: Keep `StatCard` as a local component within `FeaturedAuthor.tsx` (same pattern as `AuthorProfile.tsx`). If a third consumer appears, extract then. Avoid premature abstraction.

### Step 4: Write unit tests

**File**: `src/app/pages/__tests__/Authors.test.tsx` (new)

**Test cases**:
1. **Single author renders featured layout**: Mock `allAuthors` to have 1 entry → assert `data-testid="featured-author"` is rendered, grid is not
2. **Multiple authors render grid**: Mock `allAuthors` to have 2+ entries → assert grid is rendered, featured is not
3. **Featured layout shows correct content**: Author name, title, short bio, "View Full Profile" link
4. **Stats display correctly**: Course count, hours, lessons from `getAuthorStats`

**Mocking strategy**: Mock `@/data/authors` to control `allAuthors` array length. Mock `@/lib/authors` for `getAuthorStats` return values.

### Step 5: Write E2E tests

**File**: `tests/e2e/story-e23-s06.spec.ts` (new)

**Test cases**:
1. **AC1 — Featured layout renders**: Navigate to `/authors`, assert `[data-testid="featured-author"]` visible, author name visible, short bio visible, stats visible
2. **AC3 — Navigation to profile**: Click "View Full Profile", assert URL changes to `/authors/chase-hughes`, assert profile page heading visible
3. **AC4 — Responsive layout**: Check at 375px, 768px, 1440px — no horizontal overflow, content visible
4. **AC5 — Design tokens**: Handled by ESLint (design-tokens/no-hardcoded-colors) — no E2E test needed

**Navigation helper**: Add `goToAuthors()` to `tests/support/helpers/navigation.ts`:
```typescript
export async function goToAuthors(page: Page): Promise<void> {
  await navigateAndWait(page, '/authors')
  await page.waitForSelector('h1:has-text("Our Authors")', { state: 'visible', timeout: 10000 })
}
```

### Step 6: Commit

```
feat(E23-S06): add featured author layout for single author state
```

## Files Summary

| File | Change | Type |
|------|--------|------|
| `src/app/components/figma/FeaturedAuthor.tsx` | New featured author component | New |
| `src/app/pages/Authors.tsx` | Conditional rendering: featured vs grid | Modify |
| `src/app/pages/__tests__/Authors.test.tsx` | Unit tests for both layouts | New |
| `tests/e2e/story-e23-s06.spec.ts` | E2E ATDD tests | New |
| `tests/support/helpers/navigation.ts` | Add `goToAuthors()` helper | Modify |

## Reuse

| Existing Code | Location | How to Use |
|---------------|----------|------------|
| `Card`, `CardContent` | `@/app/components/ui/card` | Wrapper for featured layout |
| `Badge` | `@/app/components/ui/badge` | Specialty badges |
| `Avatar`, `AvatarImage`, `AvatarFallback` | `@/app/components/ui/avatar` | Author avatar |
| `Button` | `@/app/components/ui/button` | "View Full Profile" CTA |
| `getAuthorStats()` | `@/lib/authors` | Stats data |
| `getAvatarSrc()` | `@/lib/authors` | Responsive avatar src/srcSet |
| `StatCard` pattern | `AuthorProfile.tsx:175-190` | Local stat display component |
| `navigateAndWait()` | `tests/support/helpers/navigation.ts` | E2E navigation |

## Scope Boundaries

- **In scope**: FeaturedAuthor component, Authors.tsx conditional rendering, unit tests, E2E tests, navigation helper
- **Out of scope**: AuthorProfile.tsx changes, data layer changes, DB migrations, route changes, sidebar changes (E23-S04), pre-seeded course de-emphasis (E23-S05)

## Verification

```bash
# Build
npm run build

# Lint (catches hardcoded colors)
npm run lint

# Unit tests
npm run test:unit

# E2E ATDD tests
npx playwright test tests/e2e/story-e23-s06.spec.ts --project=chromium

# E2E smoke (navigation still works)
npx playwright test tests/e2e/navigation.spec.ts --project=chromium

# Visual check
npm run dev  # navigate to /authors → featured layout visible
```

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `allAuthors` is static import — can't easily test multi-author path without mocking | Unit tests mock the import; E2E tests use the real single-author state (which is the target behavior) |
| FeaturedAuthor duplicates styling from AuthorProfile hero | Acceptable — 2 consumers doesn't justify extraction. Comment noting the shared pattern. |
| Future Epic 25 (Author CRUD) will add dynamic authors from IndexedDB | The `allAuthors.length === 1` check will naturally switch to grid when more authors are added. No migration needed. |
