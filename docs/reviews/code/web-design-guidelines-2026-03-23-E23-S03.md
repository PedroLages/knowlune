# Web Design Guidelines Review - E23-S03 "Rename Instructors to Authors"

**Date:** 2026-03-23
**Reviewer:** Claude (automated)
**Files Reviewed:**
- `src/app/pages/Authors.tsx`
- `src/app/pages/AuthorProfile.tsx`
- `src/app/pages/CourseDetail.tsx`
- `src/app/components/figma/CourseCard.tsx`

---

## Summary

The rename from "Instructors" to "Authors" is a clean terminology change. The reviewed files show generally strong adherence to web design guidelines with good accessibility patterns already in place (aria-hidden on decorative icons, focus-visible rings, semantic HTML). A few medium/low issues were found, mostly pre-existing.

**Verdict:** 0 BLOCKER, 0 HIGH, 4 MEDIUM, 5 LOW

---

## MEDIUM

### M1. Hardcoded colors in CourseCard category colors map

**File:** `src/app/components/figma/CourseCard.tsx:36-42`

The `categoryColors` record uses hardcoded Tailwind colors (`bg-emerald-100 text-emerald-700`, `bg-amber-100 text-amber-700`, `bg-red-100 text-red-700`, `bg-purple-100 text-purple-700`) instead of design tokens. This violates the project's design token enforcement policy and will break in dark mode.

```typescript
const categoryColors: Record<CourseCategory, string> = {
  'behavioral-analysis': 'bg-emerald-100 text-emerald-700',  // hardcoded
  'confidence-mastery': 'bg-amber-100 text-amber-700',       // hardcoded
  'operative-training': 'bg-red-100 text-red-700',           // hardcoded
  'research-library': 'bg-purple-100 text-purple-700',       // hardcoded
}
```

**Note:** Pre-existing issue, not introduced by this story. Only `influence-authority` correctly uses `bg-brand-soft text-brand-soft-foreground`.

### M2. Hardcoded colors in CourseCard progress variant difficulty badges

**File:** `src/app/components/figma/CourseCard.tsx:621-626`

The progress variant difficulty badges use hardcoded green/amber colors with manual dark mode overrides instead of design tokens:

```typescript
'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100'
'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
```

Should use `bg-success-soft text-success` and `bg-warning-soft text-warning` (or equivalent tokens).

**Note:** Pre-existing issue.

### M3. Gradient fallback uses hardcoded colors

**File:** `src/app/components/figma/CourseCard.tsx:432`

```
bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50
```

Uses hardcoded blue/indigo gradient colors. Should use design token-based alternatives.

**Note:** Pre-existing issue.

### M4. Missing accessible name on progress variant card wrapper

**File:** `src/app/components/figma/CourseCard.tsx:742-754`

The progress variant wraps the card in a `<div onClick={...}>` without `role`, `tabIndex`, or `aria-label`. Unlike the library/overview variant (lines 760-777), which correctly adds `role="link"`, `tabIndex={0}`, and `aria-label`, the progress variant card is not keyboard accessible and has no semantic role.

```tsx
<div
  onClick={e => {
    guardNavigation(e)
    if (!e.defaultPrevented) navigate(lessonLink)
  }}
  {...previewHandlers}
  className="h-full"
>
```

**Recommendation:** Add `role="link"`, `tabIndex={0}`, `aria-label={course.title}`, and the same `onKeyDown` handler as the library/overview variant.

**Note:** Pre-existing issue, but relevant since CourseCard was in scope.

---

## LOW

### L1. Social links missing aria-label for screen readers

**File:** `src/app/pages/AuthorProfile.tsx:105-114`

External social links show platform name as text and an ExternalLink icon, but lack an explicit `aria-label` to communicate the full context (e.g., "Visit Twitter profile, opens in new tab"). The `target="_blank"` behavior is not communicated to assistive technology.

**Recommendation:** Add `aria-label={`Visit ${author.name}'s ${platform} profile (opens in new tab)`}` or append a visually hidden "(opens in new tab)" text.

### L2. ExternalLink icon missing aria-hidden

**File:** `src/app/pages/AuthorProfile.tsx:113`

The `<ExternalLink className="size-3" />` icon in social links is missing `aria-hidden="true"`. While Lucide icons default to `aria-hidden`, explicit annotation is safer and consistent with the pattern used elsewhere in these files.

### L3. Stats icons in Authors.tsx missing accessible labels for hidden text

**File:** `src/app/pages/Authors.tsx:73-89`

The stats row uses `<span className="hidden sm:inline">` to hide labels like "courses" and "lessons" on small screens. When hidden, screen readers still see them (good), but sighted mobile users only see numbers with icons, which may lack context. Consider using `sr-only` text as a fallback or keeping labels always visible.

**Note:** This is a minor UX consideration, not a WCAG violation since screen readers can still access the labels.

### L4. Author link in CourseCard uses empty alt text for avatar

**File:** `src/app/components/figma/CourseCard.tsx:510`

The author avatar inside the course card link uses `alt=""`, which is correct for decorative images. However, since the avatar is inside a link that only shows the author name as a sibling `<span>`, this is fine. No action needed -- noted for awareness.

### L5. Bio paragraphs use array index as React key

**File:** `src/app/pages/AuthorProfile.tsx:141`

```tsx
{author.bio.split('\n\n').map((paragraph, i) => (
  <p key={i}>{paragraph}</p>
))}
```

Using array index as key is acceptable here since the list is static and never reordered, but noted as a minor code quality observation.

---

## Positive Observations

The following patterns are well-implemented across the reviewed files:

1. **Focus management:** `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` on interactive card links (Authors.tsx:38, CourseCard.tsx:776)
2. **Semantic HTML:** Proper heading hierarchy (h1 > h2 > h3), breadcrumb navigation, blockquote for quotes
3. **Responsive design:** Mobile-first grid layouts with `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` breakpoints
4. **Decorative icon treatment:** Consistent `aria-hidden="true"` on decorative icons (Authors.tsx:73,80,86; AuthorProfile.tsx:148,186)
5. **Design token usage in new/modified code:** All text colors use `text-muted-foreground`, `text-brand`, etc. The renamed components follow token conventions correctly.
6. **Link semantics:** CourseCard library/overview variants use `role="link"` with keyboard handler for Enter/Space (CourseCard.tsx:760-777)
7. **Responsive touch targets:** Avatar and card links are large enough for touch interaction
8. **Image accessibility:** All `<img>` and `<AvatarImage>` elements have meaningful `alt` text
9. **Button variants:** CTA buttons correctly use `variant="brand"` (CourseDetail.tsx:131, CourseCard.tsx:681)
10. **Breadcrumb navigation:** Both AuthorProfile and CourseDetail use proper `<Breadcrumb>` component with semantic markup

---

## Rename-Specific Verification

The Instructors-to-Authors rename was verified across the four files:

| Check | Status |
|-------|--------|
| Import paths updated (`@/data/authors`, `@/lib/authors`) | PASS |
| Variable names updated (`author`, `authorId`, `getAuthorById`) | PASS |
| Route paths updated (`/authors/`, `/authors/${author.id}`) | PASS |
| User-facing text updated ("Our Authors", "Author Not Found", "Back to Authors") | PASS |
| Breadcrumb labels updated ("Authors") | PASS |
| No leftover "instructor" references in reviewed files | PASS |
