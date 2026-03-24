# Featured Author Layout For Single Author State — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the lonely single-card grid on the Authors page with a rich featured/hero layout when there is exactly one author.

**Architecture:** Conditional rendering in `Authors.tsx` — branch on `allAuthors.length === 1` to show a new `FeaturedAuthor` component (hero card with avatar, stats, bio, CTA) vs. the existing multi-author grid. No data layer changes. Component goes in `src/app/components/figma/` per project convention.

**Tech Stack:** React, TypeScript, Tailwind CSS v4 (design tokens), shadcn/ui (Card, Badge, Avatar, Button), Vitest + Testing Library (unit), Playwright (E2E)

---

## Context

The Authors page (`src/app/pages/Authors.tsx`) renders all authors in a 3-column card grid. Currently `allAuthors` contains exactly one author (Chase Hughes). This produces a single small card in a wide empty grid — visually underwhelming.

This story adds a **featured/hero layout** that activates when `allAuthors.length === 1`. When multiple authors exist (future Epic 25 adds author CRUD), the grid remains unchanged.

### Current Files

| File | What It Does |
|------|-------------|
| `src/app/pages/Authors.tsx` | Page component — grid of author cards |
| `src/app/pages/AuthorProfile.tsx` | Full profile page — hero + stats + bio + courses (visual reference for featured layout) |
| `src/data/authors/index.ts` | Exports `allAuthors: Author[]` (currently `[chaseHughes]`) |
| `src/lib/authors.ts` | `getAuthorStats(author)`, `getAvatarSrc(basePath, displaySize)` |
| `src/data/types.ts:78-90` | `Author` interface — id, name, avatar, title, bio, shortBio, specialties, yearsExperience, education?, socialLinks, featuredQuote? |

### Reuse Inventory

| Existing Code | Location | How to Use |
|---------------|----------|------------|
| `Card`, `CardContent` | `@/app/components/ui/card` | Wrapper for featured layout |
| `Badge` | `@/app/components/ui/badge` | Specialty badges |
| `Avatar`, `AvatarImage`, `AvatarFallback` | `@/app/components/ui/avatar` | Author avatar |
| `Button` | `@/app/components/ui/button` | "View Full Profile" CTA (`variant="brand"`) |
| `getAuthorStats()` | `@/lib/authors` | Stats data (courseCount, totalHours, totalLessons) |
| `getAvatarSrc()` | `@/lib/authors` | Responsive avatar src/srcSet |
| `StatCard` pattern | `AuthorProfile.tsx:175-190` | Inline stat display component — duplicate locally |
| `navigateAndWait()` | `tests/support/helpers/navigation.ts` | E2E navigation |

---

## Task 1: Create `FeaturedAuthor` Component

**Files:**
- Create: `src/app/components/figma/FeaturedAuthor.tsx`

### Step 1: Create the component file with the featured layout

Create `src/app/components/figma/FeaturedAuthor.tsx`:

```tsx
import { Link } from 'react-router'
import { BookOpen, Clock, GraduationCap, Award } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Button } from '@/app/components/ui/button'
import type { Author } from '@/data/types'
import { getAuthorStats, getAvatarSrc } from '@/lib/authors'

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof BookOpen
  value: string | number
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 shadow-sm">
      <Icon className="size-5 text-brand mb-1" aria-hidden="true" />
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function FeaturedAuthor({ author }: { author: Author }) {
  const stats = getAuthorStats(author)

  return (
    <Card className="rounded-3xl border-0 shadow-sm" data-testid="featured-author">
      <CardContent className="p-6 sm:p-8">
        {/* Hero section: avatar + info */}
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Avatar */}
          <Avatar className="size-24 sm:size-28 shrink-0 ring-2 ring-border/50 self-center sm:self-start">
            <AvatarImage {...getAvatarSrc(author.avatar, 112)} alt={author.name} />
            <AvatarFallback className="text-2xl font-semibold bg-brand/10 text-brand">
              {getInitials(author.name)}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-semibold">{author.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{author.title}</p>

            {/* Featured Quote */}
            {author.featuredQuote && (
              <blockquote className="text-sm italic text-muted-foreground border-l-2 border-brand pl-3 mt-3">
                &ldquo;{author.featuredQuote}&rdquo;
              </blockquote>
            )}

            {/* Specialty Badges */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-3">
              {author.specialties.map(specialty => (
                <Badge key={specialty} variant="secondary" className="text-xs">
                  {specialty}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <StatCard
            icon={BookOpen}
            value={stats.courseCount}
            label={stats.courseCount === 1 ? 'Course' : 'Courses'}
          />
          <StatCard icon={Clock} value={`${Math.round(stats.totalHours)}h`} label="Content" />
          <StatCard icon={GraduationCap} value={stats.totalLessons} label="Lessons" />
          <StatCard icon={Award} value={`${author.yearsExperience}y`} label="Experience" />
        </div>

        {/* Short bio + CTA */}
        <p className="text-muted-foreground leading-relaxed mt-6">{author.shortBio}</p>

        <div className="flex justify-end mt-4">
          <Button variant="brand" asChild>
            <Link to={`/authors/${author.id}`}>View Full Profile</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

### Step 2: Verify the build compiles

Run: `npm run build`
Expected: PASS (component isn't imported yet, but TypeScript should type-check it via project includes)

### Step 3: Commit

```bash
git add src/app/components/figma/FeaturedAuthor.tsx
git commit -m "feat(E23-S06): add FeaturedAuthor component"
```

---

## Task 2: Wire FeaturedAuthor into Authors Page

**Files:**
- Modify: `src/app/pages/Authors.tsx`

### Step 1: Add conditional rendering

In `Authors.tsx`, import `FeaturedAuthor` and branch on author count:

```tsx
import { FeaturedAuthor } from '@/app/components/figma/FeaturedAuthor'
```

Replace the grid `<div>` (lines 31-96) with:

```tsx
{allAuthors.length === 1 ? (
  <FeaturedAuthor author={allAuthors[0]} />
) : (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="author-grid">
    {/* existing grid code unchanged */}
  </div>
)}
```

Add `data-testid="author-grid"` to the existing grid wrapper div for test assertions.

### Step 2: Verify the build compiles and the page renders

Run: `npm run build`
Expected: PASS

Run: `npm run dev` → navigate to `/authors`
Expected: Featured layout visible with Chase Hughes spotlight card

### Step 3: Commit

```bash
git add src/app/pages/Authors.tsx
git commit -m "feat(E23-S06): conditionally render featured layout for single author"
```

---

## Task 3: Write Unit Tests

**Files:**
- Create: `src/app/pages/__tests__/Authors.test.tsx`

### Step 1: Write the unit tests

Create `src/app/pages/__tests__/Authors.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

// Mock the authors data module — control allAuthors length
const mockAuthors = vi.hoisted(() => ({
  allAuthors: [] as import('@/data/types').Author[],
}))

vi.mock('@/data/authors', () => mockAuthors)

// Mock getAuthorStats and getAvatarSrc
vi.mock('@/lib/authors', () => ({
  getAuthorStats: () => ({
    courses: [],
    courseCount: 5,
    totalLessons: 120,
    totalHours: 40,
    totalVideos: 100,
    categories: ['general'],
  }),
  getAvatarSrc: (basePath: string) => ({ src: `${basePath}-96w.jpg` }),
}))

// Mock useCourseStore (used by getAuthorStats in real code, but we mock getAuthorStats)
vi.mock('@/stores/useCourseStore', () => ({
  useCourseStore: { getState: () => ({ courses: [] }) },
}))

const makeAuthor = (overrides: Partial<import('@/data/types').Author> = {}): import('@/data/types').Author => ({
  id: 'test-author',
  name: 'Test Author',
  avatar: '/images/test',
  title: 'Expert',
  bio: 'Full bio text.',
  shortBio: 'Short bio text.',
  specialties: ['Skill A', 'Skill B'],
  yearsExperience: 10,
  socialLinks: {},
  ...overrides,
})

// Lazy import after mocks are set up
const { Authors } = await import('../Authors')

function renderAuthors() {
  return render(
    <MemoryRouter>
      <Authors />
    </MemoryRouter>
  )
}

describe('Authors page', () => {
  beforeEach(() => {
    mockAuthors.allAuthors = []
  })

  describe('single author (featured layout)', () => {
    beforeEach(() => {
      mockAuthors.allAuthors = [makeAuthor()]
    })

    it('renders featured layout instead of grid', () => {
      renderAuthors()
      expect(screen.getByTestId('featured-author')).toBeInTheDocument()
      expect(screen.queryByTestId('author-grid')).not.toBeInTheDocument()
    })

    it('shows author name, title, and short bio', () => {
      renderAuthors()
      expect(screen.getByText('Test Author')).toBeInTheDocument()
      expect(screen.getByText('Expert')).toBeInTheDocument()
      expect(screen.getByText('Short bio text.')).toBeInTheDocument()
    })

    it('shows View Full Profile link', () => {
      renderAuthors()
      const link = screen.getByRole('link', { name: /view full profile/i })
      expect(link).toHaveAttribute('href', '/authors/test-author')
    })

    it('shows specialty badges', () => {
      renderAuthors()
      expect(screen.getByText('Skill A')).toBeInTheDocument()
      expect(screen.getByText('Skill B')).toBeInTheDocument()
    })

    it('displays singular subtitle text', () => {
      renderAuthors()
      expect(screen.getByText('Meet the expert behind your learning journey')).toBeInTheDocument()
    })
  })

  describe('multiple authors (grid layout)', () => {
    beforeEach(() => {
      mockAuthors.allAuthors = [
        makeAuthor({ id: 'author-1', name: 'Author One' }),
        makeAuthor({ id: 'author-2', name: 'Author Two' }),
      ]
    })

    it('renders grid instead of featured layout', () => {
      renderAuthors()
      expect(screen.getByTestId('author-grid')).toBeInTheDocument()
      expect(screen.queryByTestId('featured-author')).not.toBeInTheDocument()
    })

    it('shows both author names in grid', () => {
      renderAuthors()
      expect(screen.getByText('Author One')).toBeInTheDocument()
      expect(screen.getByText('Author Two')).toBeInTheDocument()
    })
  })
})
```

### Step 2: Run unit tests to verify they pass

Run: `npx vitest run src/app/pages/__tests__/Authors.test.tsx`
Expected: All tests PASS

### Step 3: Run full unit test suite to check for regressions

Run: `npm run test:unit`
Expected: All existing tests still PASS

### Step 4: Commit

```bash
git add src/app/pages/__tests__/Authors.test.tsx
git commit -m "test(E23-S06): add unit tests for featured vs grid author layout"
```

---

## Task 4: Add E2E Navigation Helper

**Files:**
- Modify: `tests/support/helpers/navigation.ts`

### Step 1: Add `goToAuthors()` helper

Append to `tests/support/helpers/navigation.ts`:

```typescript
/** Navigate to the Authors page. */
export async function goToAuthors(page: Page): Promise<void> {
  await navigateAndWait(page, '/authors')
  await page.waitForSelector('h1', { state: 'visible', timeout: 10000 })
}
```

### Step 2: Commit

```bash
git add tests/support/helpers/navigation.ts
git commit -m "test(E23-S06): add goToAuthors navigation helper"
```

---

## Task 5: Write E2E ATDD Tests

**Files:**
- Create: `tests/e2e/story-e23-s06.spec.ts`

### Step 1: Write the E2E tests

Create `tests/e2e/story-e23-s06.spec.ts`:

```typescript
/**
 * ATDD tests for E23-S06: Featured Author Layout For Single Author State
 *
 * Tests validate the featured layout renders for the single-author state
 * (current production data has exactly one author).
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

test.describe('E23-S06: Featured Author Layout', () => {
  // AC1: Featured layout renders for single author
  test('AC1: featured layout shows author name, bio, stats, and badges', async ({ page }) => {
    await navigateAndWait(page, '/authors')
    await page.waitForLoadState('load')

    // Featured layout should be visible
    const featured = page.locator('[data-testid="featured-author"]')
    await expect(featured).toBeVisible()

    // Grid should NOT be visible
    await expect(page.locator('[data-testid="author-grid"]')).not.toBeVisible()

    // Author name visible
    await expect(featured.getByRole('heading', { level: 2 })).toBeVisible()

    // "View Full Profile" CTA visible
    await expect(featured.getByRole('link', { name: /view full profile/i })).toBeVisible()

    // At least one badge visible
    await expect(featured.locator('.inline-flex').first()).toBeVisible()
  })

  // AC3: Navigation to profile works
  test('AC3: clicking View Full Profile navigates to author profile', async ({ page }) => {
    await navigateAndWait(page, '/authors')
    await page.waitForLoadState('load')

    const profileLink = page.getByRole('link', { name: /view full profile/i })
    await profileLink.click()

    // Should navigate to the author's profile page
    await page.waitForLoadState('load')
    await expect(page).toHaveURL(/\/authors\//)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  // AC4: Responsive layout at 3 breakpoints
  test('AC4: featured layout renders correctly at all viewports', async ({ page }) => {
    const viewports = [
      { width: 375, height: 812, label: 'mobile' },
      { width: 768, height: 1024, label: 'tablet' },
      { width: 1440, height: 900, label: 'desktop' },
    ]

    for (const { width, height, label } of viewports) {
      await page.setViewportSize({ width, height })
      await navigateAndWait(page, '/authors')
      await page.waitForLoadState('load')

      // Featured layout should be visible
      await expect(
        page.locator('[data-testid="featured-author"]'),
        `Featured layout not visible at ${label} (${width}px)`,
      ).toBeVisible()

      // No horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth, `Horizontal overflow at ${label} (${width}px)`).toBeLessThanOrEqual(
        clientWidth,
      )
    }
  })
})
```

### Step 2: Run E2E tests

Run: `npx playwright test tests/e2e/story-e23-s06.spec.ts --project=chromium`
Expected: All tests PASS

### Step 3: Run smoke tests for regression

Run: `npx playwright test tests/e2e/navigation.spec.ts --project=chromium`
Expected: PASS (navigation to /authors still works)

### Step 4: Commit

```bash
git add tests/e2e/story-e23-s06.spec.ts
git commit -m "test(E23-S06): add E2E ATDD tests for featured author layout"
```

---

## Task 6: Final Verification

### Step 1: Full build

Run: `npm run build`
Expected: PASS

### Step 2: Lint (catches hardcoded colors)

Run: `npm run lint`
Expected: PASS (no hardcoded color violations)

### Step 3: Full unit test suite

Run: `npm run test:unit`
Expected: All tests PASS

### Step 4: E2E test suite (story + smoke)

Run: `npx playwright test tests/e2e/story-e23-s06.spec.ts tests/e2e/navigation.spec.ts --project=chromium`
Expected: All tests PASS

### Step 5: Visual verification

Run: `npm run dev` → navigate to `/authors`
Expected:
- Featured hero card visible with Chase Hughes
- Avatar, name, title, quote, specialty badges, stats strip, short bio, "View Full Profile" CTA
- Mobile (375px): stacked vertical layout, 2x2 stats grid
- Desktop (1440px): horizontal avatar + info, 4-column stats grid
- Clicking "View Full Profile" navigates to `/authors/chase-hughes`

---

## Files Summary

| File | Change | Type |
|------|--------|------|
| `src/app/components/figma/FeaturedAuthor.tsx` | New featured author hero component | Create |
| `src/app/pages/Authors.tsx` | Conditional: featured (1 author) vs grid (2+) | Modify |
| `src/app/pages/__tests__/Authors.test.tsx` | Unit tests for both layout branches | Create |
| `tests/e2e/story-e23-s06.spec.ts` | E2E ATDD tests (AC1, AC3, AC4) | Create |
| `tests/support/helpers/navigation.ts` | Add `goToAuthors()` helper | Modify |

## Scope Boundaries

- **In scope**: FeaturedAuthor component, Authors.tsx conditional rendering, unit tests, E2E tests, navigation helper
- **Out of scope**: AuthorProfile.tsx changes, data layer changes, DB migrations, route changes, sidebar restructuring (E23-S04), pre-seeded course de-emphasis (E23-S05)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `allAuthors` is a static import — can't test multi-author in E2E | Unit tests mock the import; E2E validates the real single-author state |
| FeaturedAuthor duplicates `StatCard` pattern from AuthorProfile | Acceptable for 2 consumers (YAGNI). Extract if a 3rd appears. |
| Future Epic 25 (Author CRUD) adds dynamic authors from IndexedDB | The `allAuthors.length === 1` check will naturally switch to grid. No migration needed. |
| AC5 (design tokens) — no E2E test needed | Enforced by ESLint rule `design-tokens/no-hardcoded-colors` at save-time |
