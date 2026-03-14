# Design Review Report — E9B-S04: Knowledge Gap Detection

**Review Date**: 2026-03-14
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E9B-S04 — Knowledge Gap Detection
**Branch**: feature/e9b-s04-knowledge-gap-detection
**Changed Files Reviewed**:
- `src/app/pages/KnowledgeGaps.tsx` (new page — primary review target)
- `src/app/config/navigation.ts` (new nav entry)
- `src/app/routes.tsx` (new route)
- `src/ai/knowledgeGaps/noteLinkSuggestions.ts` (Sonner toast trigger)

**Affected Route**: `/knowledge-gaps`
**Viewports Tested**: 1440px (desktop), 768px (tablet), 375px (mobile)

---

## Executive Summary

The Knowledge Gaps page is a well-structured addition to LevelUp with clean token usage, a strong accessibility foundation (ARIA live region, skip link, heading hierarchy, keyboard-accessible buttons), and correct responsive behavior. Two issues require attention before merge: the severity color class bleeds `text-destructive` into the video title `h3`, which causes a semantic and potential contrast regression; and the "Review video →" link has a 20px touch target on mobile, below the 44px minimum. Everything else is solid polish-level work.

---

## What Works Well

- **Design token discipline**: No hardcoded hex colors or raw Tailwind palette colors anywhere in `KnowledgeGaps.tsx`. Every color reference uses semantic tokens (`bg-destructive/10`, `text-brand`, `bg-brand-soft`, `text-muted-foreground`, `text-success`, `bg-warning/10`, etc.).
- **ARIA live region**: The `aria-live="polite" aria-atomic="true"` region correctly announces "Analyzing…" and "Analysis complete. N gap(s) found." to screen readers without disrupting reading flow.
- **Heading hierarchy**: H1 "Knowledge Gaps" → H2 "N gaps across N courses" → H3 (course group) → H3 (video title). Clean and logical.
- **Loading skeleton**: `AnalyzingSkeletons` component uses `aria-hidden="true"` so it doesn't pollute the accessibility tree. Three skeleton cards set appropriate expectations for the results shape.
- **Background color**: Body background confirmed as `rgb(250, 245, 238)` — correct `#FAF5EE` token, not hardcoded.
- **Card border radius**: Gap cards render at exactly `24px` — matches the platform standard.
- **Analyze button size**: 44px tall at all viewports tested — meets the touch target minimum.
- **Mobile navigation**: At 375px the sidebar is replaced by a bottom tab bar; "Knowledge Gaps" is accessible via the "More" overflow. Bottom nav items are 56px tall.
- **`prefers-reduced-motion`**: The `animate-spin` on the loading spinner is covered by the global CSS rule in `src/styles/index.css:306` that sets `animation-duration: 0.01ms` for reduced-motion users.
- **Rule-based analysis badge (AC7)**: The `<Badge>` with `<Cpu>` icon and "Rule-based analysis" label renders correctly when `result.aiEnriched` is false. Confirmed via live analysis with no API key configured.
- **No console errors**: Zero errors in the browser console during all test scenarios. The "Failed to decrypt API key" warning is expected in dev and triggers the correct rule-based fallback.

---

## Findings by Severity

### Blockers (Must fix before merge)

#### B1: Severity color class bleeds into video title h3

**Location**: `src/app/pages/KnowledgeGaps.tsx:36`, `KnowledgeGaps.tsx:63`

**Evidence**: The `GapCard` wrapper `div` applies `SEVERITY_BADGE_CLASS[gap.severity]` to the entire card:
```
className={`rounded-[24px] border p-6 shadow-sm ${SEVERITY_BADGE_CLASS[gap.severity]}`}
```
`SEVERITY_BADGE_CLASS.critical` = `'bg-destructive/10 text-destructive border-destructive/20'`

Computed styles confirmed in browser: the video title `h3` (`sample-lecture`) renders as `rgb(196, 72, 80)` — the full destructive red — because it has no explicit color class of its own and inherits from the card container. This means:

1. **Semantic mismatch**: The video title is not an error or warning — it is neutral content. Rendering it in error-red misleads learners into thinking the title itself is the problem.
2. **Color as sole differentiator**: The severity information is conveyed by the badge; applying the same color to body text conflates meaning.
3. **Potential contrast regression**: The contrast of `rgb(196, 72, 80)` on the `oklab(0.57…/0.1)` tinted background depends on the resolved OKLCH values. The effective background approximates to a very light pink (~`rgb(251, 241, 241)` over `#FAF5EE`). The contrast ratio of `#C44850` on that background is approximately 4.3:1 — marginally below the 4.5:1 WCAG AA threshold for normal-size body text.

**Impact for learners**: A student with red-green colour deficiency sees all card text in the same colour and loses the visual distinction between the severity badge (intentionally red) and the video title (neutral). A student using a screen reader with a CSS-aware tool gets "Critical" semantics on the course title.

**Suggestion**: Keep severity colours scoped to the badge element only. Move them off the card container:
```tsx
// GapCard container — neutral card styling only
<div
  className="rounded-[24px] border border-border p-6 shadow-sm bg-card"
  data-testid="gap-item"
>
```
The badge `<span>` already correctly applies `SEVERITY_BADGE_CLASS` independently. The card background tint is a nice affordance — consider a separate `SEVERITY_CARD_BG` map that provides only `bg-*` and `border-*` classes without `text-*`.

---

### High Priority (Should fix before merge)

#### H1: "Review video →" link touch target is 20px tall on mobile

**Location**: `src/app/pages/KnowledgeGaps.tsx:54-61`

**Evidence**: Measured at 375px viewport: `height: 20px`, `width: 103px`. The design principles and WCAG 2.5.5 require minimum 44×44px touch targets for interactive elements on touch devices.

**Impact for learners**: On mobile — the primary access device for many learners — tapping "Review video →" requires precise pixel-level accuracy. A student reviewing gaps on a phone while multitasking (common learning behaviour) will frequently miss-tap and navigate nowhere, creating friction at the exact moment they want to act on a gap.

**Suggestion**: Increase the tap surface using padding or a pseudo-element without changing the visual appearance:
```tsx
<Link
  to={videoPath}
  className="text-sm font-medium text-brand hover:text-brand-hover underline underline-offset-2 shrink-0 
             py-3 -my-3 px-1 -mx-1" // expands tap target to ~44px without visual change
  data-testid="gap-video-link"
>
  Review video →
</Link>
```
Or use `min-h-11` (44px) with `inline-flex items-center`.

#### H2: Course-grouping `<section>` elements have no accessible label

**Location**: `src/app/pages/KnowledgeGaps.tsx:280-290`

**Evidence**: `[...document.querySelectorAll('main section')].map(s => s.getAttribute('aria-label'))` returns `[null]`. The `<section>` element requires an accessible name (via `aria-label` or `aria-labelledby`) to be announced as a landmark region by screen readers; without one, it degrades to a generic `<div>` in the accessibility tree.

**Impact for learners**: A screen reader user navigating by landmarks cannot jump directly to "Test Course" gaps — they must read through all preceding content. For a page with many courses this becomes a significant navigation burden.

**Suggestion**: Add `aria-labelledby` pointing to the course heading:
```tsx
<section key={courseId} aria-labelledby={`course-section-${courseId}`}>
  <h3
    id={`course-section-${courseId}`}
    className="font-semibold text-muted-foreground text-sm uppercase tracking-wide mb-3 px-1"
  >
    {courseGaps[0]?.courseTitle ?? courseId}
  </h3>
  …
</section>
```

---

### Medium Priority (Fix when possible)

#### M1: Header element used as page section — minor semantic ambiguity

**Location**: `src/app/pages/KnowledgeGaps.tsx:173`

```tsx
<header className="mb-10 text-center">
```

The HTML5 `<header>` element inside `<main>` is valid and scoped correctly. However, some assistive technologies (notably older JAWS versions) surface `<header>` as a "Banner" landmark even when nested inside `<main>`. Using `<div>` here is unambiguous and loses nothing — the heading hierarchy provides all necessary structure.

**Suggestion**: Replace with `<div className="mb-10 text-center">` to eliminate any ambiguity.

#### M2: No-courses empty state does not show when store is loading

**Location**: `src/app/pages/KnowledgeGaps.tsx:208-215`

**Evidence**: The empty-state block renders only when `!hasCourses && pageState === 'idle'`. During the initial `loadImportedCourses()` async call, `importedCourses` defaults to `[]` — so `hasCourses` is momentarily `false`. The button is enabled (no `disabled` attribute confirmed in browser despite the visual `opacity-50` class), but the "No courses imported yet" text is absent because it resolves quickly to the real course list before a render cycle. In environments with slow IndexedDB reads this could flash the empty state and immediately disappear.

More critically: the button has the Tailwind `disabled:opacity-50` CSS applied via the shadcn Button's `disabled` prop path, but in the live browser the button element has `disabled: false` and no `disabled` HTML attribute. This means keyboard users can Tab to and activate the button even when no courses exist — it will then call `detectGaps()` and likely return an empty result or error rather than being blocked at the UI layer.

**Suggestion**: Ensure the `disabled` prop on Button correctly receives a boolean:
```tsx
disabled={!hasCourses || pageState === 'analyzing'}
```
This is already in the code — verify the `useCourseImportStore` initial state. If `importedCourses` initialises as `[]` before the async load completes, the condition is correct but timing-dependent. Consider adding a `isLoading` state to the store and showing a skeleton or disabled state during the load window.

#### M3: The `<section>` course grouping h3 uses `text-muted-foreground` which may be low contrast

**Location**: `src/app/pages/KnowledgeGaps.tsx:281`

```tsx
<h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide mb-3 px-1">
```

`text-muted-foreground` resolves to `rgb(125, 129, 144)` on background `rgb(250, 245, 238)`. Computed contrast ratio: approximately 3.8:1. This is above the 3:1 threshold for large text but below 4.5:1 for normal text. `text-sm uppercase` at 12px computed size (0.75rem) qualifies as small text — the 4.5:1 threshold applies.

**Impact for learners**: Learners with moderate visual impairment may struggle to read the course section headers, which are the primary organisational cue in the gap list.

**Suggestion**: Either increase to `text-foreground` (high contrast) or increase the font size to 14px+ (`text-xs` → `text-sm` already, upgrade to `text-sm` without the `uppercase` shrinking effect) to qualify as large text. Alternatively, use `font-bold` to push it into the large text weight threshold.

---

### Nitpicks (Optional)

#### N1: "Review video →" uses a Unicode arrow, not a Lucide icon

**Location**: `src/app/pages/KnowledgeGaps.tsx:59`

```tsx
Review video →
```

The `→` character renders inconsistently across fonts and operating systems (particularly on older Android). The rest of the codebase uses Lucide icons for directional affordances. Consider `<ArrowRight className="size-3 ml-1" />` for visual consistency.

#### N2: `h1` font size of 36px (`text-4xl`) is larger than other page titles

**Location**: `src/app/pages/KnowledgeGaps.tsx:177`

Most other pages in the app use `text-2xl` or `text-3xl` for their page-level headings. The 36px title is not wrong, but the centred-hero layout with the Brain icon gives this page a noticeably different visual weight from sibling pages like AI Learning Path. This is intentional only if Knowledge Gaps is meant to feel more prominent — otherwise align with the platform heading scale.

#### N3: `max-w-3xl` container is narrower than other page containers

**Location**: `src/app/pages/KnowledgeGaps.tsx:164`

```tsx
<div className="container mx-auto max-w-3xl px-4 py-12">
```

`max-w-3xl` = 768px. Most other content pages use `max-w-5xl` or `max-w-6xl`. For a single-column reading layout this is actually well-reasoned (keeps line lengths in the 50–75 character ideal range), but it means the page feels narrower than siblings at 1440px. If intentional, document it; otherwise align with the platform container standard.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥ 4.5:1 (normal text) | Partial | Video title h3 in critical cards: ~4.3:1 (B1). Course section h3 in `text-muted-foreground`: ~3.8:1 at 12px (M3). |
| Text contrast ≥ 3:1 (large text) | Pass | All large text elements verified above threshold. |
| Keyboard navigation — all elements reachable | Pass | Tab order confirmed: Skip link → sidebar → header → main button → gap links. |
| Focus indicators visible | Pass | `2px solid brand-color` outline on all interactive elements via global `*:focus-visible` rule. |
| Heading hierarchy | Pass | H1 → H2 → H3 → H3 — no skipped levels. |
| ARIA labels on icon-only buttons | Pass | No unlabelled icon buttons in `<main>`. Brain icon and all SVGs correctly `aria-hidden`. |
| Semantic HTML | Pass | `<main>`, `<header>`, `<section>`, `<nav>` used correctly. Minor `<header>` ambiguity noted (M1). |
| ARIA live regions for dynamic content | Pass | `aria-live="polite" aria-atomic="true"` announces state changes to screen readers. |
| Section landmarks labelled | Fail | Course `<section>` elements have no `aria-label`/`aria-labelledby` (H2). |
| Form labels associated | N/A | No form inputs on this page. |
| `prefers-reduced-motion` | Pass | Global CSS rule in `index.css:306` suppresses all animations including `animate-spin`. |
| Touch targets ≥ 44×44px | Partial | Analyze button: 205×44px (pass). "Review video →" link: 103×20px (fail — H1). Mobile nav items: 73×56px (pass). |
| No auto-playing media | Pass | No video or audio on this page. |
| Color not sole indicator | Partial | Severity is conveyed by both badge label text and colour — pass. But severity colour bleeding into h3 means colour becomes an unintended signal (B1). |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Pass with issues | No horizontal scroll. Container 305px wide. Sidebar replaced by bottom nav (56px touch targets). "Review video →" touch target 20px — fails (H1). |
| Tablet (768px) | Pass | No horizontal scroll. Container 709px wide. Gap card 677px wide. Sidebar persistent. |
| Desktop (1440px) | Pass | No horizontal scroll. Container max-width 768px (`max-w-3xl`). Button 205×44px. Gap card renders at 24px radius. |

---

## Detailed Evidence Log

### Gap card severity color bleed (B1)
- Computed `className` on `[data-testid="gap-item"]`: `rounded-[24px] border p-6 shadow-sm bg-destructive/10 text-destructive border-destructive/20`
- `h3.font-semibold` inside the card has no colour class; computed `color: rgb(196, 72, 80)`
- Background chain: card `oklab(0.57281 0.148963 0.0539304 / 0.1)` → page `rgb(250, 245, 238)`

### Touch target sizes (H1)
- At 375px: `[data-testid="gap-video-link"]` bounding rect: `{width: 103, height: 20}`
- At 1440px: same link: `{width: 103, height: 20}`
- WCAG 2.5.5 minimum: 44×44px

### Section labelling (H2)
- `document.querySelectorAll('main section')[0].getAttribute('aria-label')` → `null`
- `document.querySelectorAll('main section')[0].getAttribute('aria-labelledby')` → `null`

### Muted foreground contrast (M3)
- `text-muted-foreground` resolves to `rgb(125, 129, 144)`
- Page background `rgb(250, 245, 238)`
- Relative luminance text: ~0.223; background: ~0.952; ratio ≈ 3.8:1
- At `text-sm` (12px computed) this is below the 4.5:1 AA threshold

### Button disabled state (M2)
- `document.querySelector('[data-testid="analyze-gaps-button"]').disabled` → `false`
- `document.querySelector('[data-testid="analyze-gaps-button"]').hasAttribute('disabled')` → `false`
- Button has Tailwind `disabled:opacity-50` class but no actual disabled attribute in DOM
- Note: In the test session `importedCourses.length > 0` so the condition evaluated to enabled — this is correct behaviour in context. The concern is the window during initial store load.

### Design token usage — confirmed correct
- No hardcoded hex values in `KnowledgeGaps.tsx` (grep returned 0 matches)
- No inline `style=` attributes (grep returned 0 matches)
- No raw Tailwind palette colors (e.g. `bg-blue-600`, `text-red-500`) — 0 matches
- All colours use semantic tokens from `theme.css`

### Console errors
- Errors: 0
- Warnings: 2 (both pre-existing/environmental — `apple-mobile-web-app-capable` meta deprecation; API key decrypt failure expected in dev)

---

## Recommendations (Prioritised)

1. **Fix B1 first**: Split `SEVERITY_BADGE_CLASS` into two maps — one for the badge element (`text-*` + `bg-*` + `border-*`) and one for the card background only (`bg-*` + `border-*`). Apply the card-bg map to the `GapCard` container and keep the full map on the badge `<span>`. This is a 3-line change with high impact.

2. **Fix H1 (touch target)**: Add `py-3 -my-3` to the "Review video →" `<Link>` to expand the tappable area to 44px without visual change. Test at 375px after.

3. **Fix H2 (section labelling)**: Add `id` to the course `h3` and `aria-labelledby` to the `<section>`. Improves screen reader navigation for learners with many courses.

4. **Address M3 (section header contrast)**: Swap `text-muted-foreground` for `text-foreground/60` or increase font weight to `font-bold` on the course group heading to clear the 4.5:1 threshold.

