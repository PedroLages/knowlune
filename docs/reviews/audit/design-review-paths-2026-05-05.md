# Design Review — Learning Paths

**Review Date:** May 5, 2026  
**Reviewed By:** Design Review Agent (Playwright MCP + Code Analysis)  
**Routes Reviewed:** `/learning-paths`, `/learning-paths/:id`  
**Source Files:** `src/app/pages/LearningPaths.tsx`, `src/app/pages/LearningPathDetail.tsx`  
**Sub-components:** `PathCardHeader`, `PathProgressRing`, `TemplateCard`, `TrailMap`, `InlineEditableField`, `EmptyState`, `SortableCourseRow`  
**Testing mode:** Guest session (dark mode, mobile viewport captured; desktop assessed via code review)

---

## Executive Summary

The Learning Paths feature is architecturally solid and well-componentized. Interaction patterns (inline editing, DnD with keyboard fallback, staggered animations) are thoughtful and above average for the space. However, three issues require attention before the feature can be considered production-ready for accessibility-sensitive users: (1) the card's primary `<Link>` has `tabIndex={-1}`, making paths with no footer action effectively unreachable by keyboard, (2) the `TrailMap` SVG has no accessible description and runs an infinite pulsing animation that ignores `prefers-reduced-motion`, and (3) the 70% opacity applied to "not-started" cards risks pushing already-low-contrast text below WCAG AA thresholds. Beyond those blockers, the main requests — smaller card density, cover-image UX, and dark mode polish — are addressed in concrete, actionable recommendations below.

---

## What Works Well

- **PathProgressRing** is fully accessible: `role="progressbar"`, `aria-valuenow/min/max`, and `aria-label` are all correct.
- **MoveUpDownButtons** on the course reorder list satisfies WCAG 2.5.7 (pointer cancellation / keyboard-equivalent for drag) — a frequently missed requirement.
- **Search live region** (`role="status" aria-live="polite"`) announces result counts correctly on filter changes.
- **InlineEditableField** has keyboard support (Enter saves, Escape cancels, Ctrl+Enter for textarea), `tabIndex={0}`, and proper `aria-label` — inline editing feels like a first-class interaction pattern.
- **EmptyState** respects `prefers-reduced-motion` via `useReducedMotion()`.
- **KeyboardSensor** is configured on the DnD context in the detail page — drag-and-drop is keyboard accessible.
- **Decorative images** consistently use `alt=""` (thumbnails in cards and strips).
- **Stagger animations** using `motion/react` create a polished, sequential entry that feels well-crafted.
- **Collapsible template section** is a good progressive disclosure pattern — surfaces templates without overwhelming the primary content.

---

## Findings by Severity

### Blockers — Must Fix Before Merge

---

**B-1: Card primary `<Link>` is removed from tab order (`tabIndex={-1}`)**  
**File:** `src/app/pages/LearningPaths.tsx:214`  
**Category:** Accessibility — Keyboard Navigation

```tsx
// Line 214-218
<Link
  to={`/learning-paths/${path.id}`}
  className="block focus:outline-none mt-10"
  aria-label={`${path.name} — ${courseCount} courses, ${completionPct}% completed`}
  tabIndex={-1}   // ← removes from tab order entirely
>
```

**Impact:** Keyboard users can only reach a path via the footer action button (Continue/Start/Review). Paths with `courseCount === 0` show a bare `<ArrowRight aria-hidden="true" />` with no accessible label and no keyboard-reachable navigation target. There is no way for a screen-reader user to navigate to an empty path's detail page.

**Fix:** Remove `tabIndex={-1}`. If click propagation from the inline-edit fields is the concern, the `e.stopPropagation()` wrappers on the InlineEditableField `div` already handle that. The `focus:outline-none` on the link should also be replaced with a proper focus ring:

```tsx
<Link
  to={`/learning-paths/${path.id}`}
  className="block focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-lg mt-10"
  aria-label={`${path.name} — ${courseCount} courses, ${completionPct}% completed`}
>
```

`autofix_class: manual`

---

**B-2: `TrailMap` SVG animation ignores `prefers-reduced-motion`**  
**File:** `src/app/components/figma/TrailMap.tsx:114–120`  
**Category:** Accessibility — Motion

```tsx
// Lines 113-120: Infinite pulsing animation on current waypoint
<circle cx={wp.x} cy={cy} r="22" fill="var(--brand)" opacity="0.15">
  <animate attributeName="r" values="22;28;22" dur="2s" repeatCount="indefinite" />
  <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite" />
</circle>
```

**Impact:** SVG `<animate>` elements cannot be disabled via CSS `@media (prefers-reduced-motion)`. Users with vestibular disorders who request reduced motion will still see the pulsing trail-map animation throughout the detail page.

**Fix:** Use an `InlineReducedMotion` check. The cleanest approach is to conditionally skip the `<animate>` elements using a React hook:

```tsx
// In TrailMap component, add:
const shouldReduceMotion = useReducedMotion() // from 'motion/react'

// In the "isCurrent" waypoint rendering, conditionally render:
{!shouldReduceMotion && (
  <>
    <animate attributeName="r" values="22;28;22" dur="2s" repeatCount="indefinite" />
    <animate attributeName="opacity" values="0.15;0.05;0.15" dur="2s" repeatCount="indefinite" />
  </>
)}
```

Also add a `role="img"` and `aria-label` to the outer SVG:

```tsx
<svg
  role="img"
  aria-label={`Learning path progress: ${completedCount} of ${totalCourses} courses completed`}
  ...
/>
```

`autofix_class: manual`

---

**B-3: Incomplete opacity on "not-started" cards fails contrast**  
**File:** `src/app/pages/LearningPaths.tsx:156–160`  
**Category:** Accessibility — Color Contrast

```tsx
<Card
  className={cn(
    'group relative transition-all duration-300 hover:shadow-xl overflow-hidden rounded-2xl',
    isNotStarted && 'opacity-70'  // ← reduces ALL content contrast
  )}
>
```

**Impact:** `opacity-70` applies to the entire card including text, icons, and the progress ring. If text is rendering at 4.5:1 (the WCAG AA minimum), 70% opacity reduces it to ~3.2:1 — below the threshold. In the dark theme, muted text (`--muted-foreground`) on the card surface (`--card`) likely already starts near the minimum, making this violation near-certain.

**Fix:** Instead of reducing overall opacity, target only the decorative gradient header:

```tsx
<Card
  className="group relative transition-all duration-300 hover:shadow-xl overflow-hidden rounded-2xl"
>
  <PathCardHeader
    ...
    className={cn(isNotStarted && 'opacity-60 grayscale')}  // desaturate header only
  />
```

And dim the action area separately rather than the whole card. This preserves text contrast while still signaling the "not started" state visually.

`autofix_class: gated_auto`

---

### High Priority — Should Fix Before Next Release

---

**H-1: `window.location.href` in "path not found" fallback breaks SPA navigation**  
**File:** `src/app/pages/LearningPathDetail.tsx:635`  
**Category:** Correctness / UX

```tsx
onAction={() => {
  window.location.href = '/learning-paths'  // ← full page reload
}}
```

**Impact:** Hard-navigating to `/learning-paths` causes a full page reload, losing all in-memory state (IndexedDB Dexie connections, React state, etc.). Should use the React Router `navigate` function.

**Fix:**
```tsx
const navigate = useNavigate() // already declared at line 273
...
onAction={() => navigate('/learning-paths')}
```

`autofix_class: safe_auto`

---

**H-2: `EmptyState` incorrectly uses `role="status"`**  
**File:** `src/app/components/EmptyState.tsx:47`  
**Category:** Accessibility — ARIA Semantics

```tsx
<motion.div
  role="status"    // ← live region role on static content
  variants={fadeUp}
  ...
>
```

`role="status"` is an implicit live region (`aria-live="polite"`) designed for dynamic updates. On a static empty state, this causes screen readers to re-announce the content on every page re-render. Given `EmptyState` is used on the Learning Paths page in multiple conditional branches, this will announce incorrectly whenever the branch re-evaluates.

**Fix:** Remove `role="status"`. If announcement on first mount is desired, use a `role="region"` with `aria-label` instead:

```tsx
<motion.div
  role="region"
  aria-label="Empty state"
  variants={fadeUp}
>
```

`autofix_class: safe_auto`

---

**H-3: TrailMap SVG has no accessible semantics for screen readers**  
**File:** `src/app/components/figma/TrailMap.tsx`  
**Category:** Accessibility — Screen Reader

The entire Trail Map SVG renders as decorative (no `role`, no `aria-label`, no text descriptions of waypoints). Screen reader users navigating the path detail page receive no feedback about the visual progress journey.

**Fix:** Already outlined in B-2 — add `role="img"` and `aria-label` to the `<svg>`. Additionally, hide it from accessibility tree if the nearby text stats (`0/3 courses done`) already convey the information:

```tsx
<svg aria-hidden="true" ...>  // if text stats nearby fully describe progress
// OR
<svg role="img" aria-label={`Journey progress: ${completedCount} completed, ${totalCourses - completedCount} remaining`} ...>
```

`autofix_class: manual`

---

**H-4: Delete path (detail page) has no confirmation dialog**  
**File:** `src/app/pages/LearningPathDetail.tsx:508–513, 737–743`  
**Category:** Interaction Design — Destructive Action

```tsx
<Button
  variant="ghost"
  size="icon"
  className="text-muted-foreground hover:text-destructive"
  onClick={handleDeletePath}   // immediate delete, no confirm
  aria-label="Delete learning path"
>
```

`deletePathWithUndo` presumably fires an undo toast, but the action is instant. A ghost icon button adjacent to the large completion percentage in the detail header is visually subtle and easy to accidentally trigger, especially on mobile.

**Fix:** Either (a) show a confirmation `AlertDialog` before deletion, or (b) use a prominent `variant="destructive"` button label ("Delete Path") placed at the bottom of the page rather than the header. The undo toast alone is insufficient for a high-investment artifact like a learning path.

`autofix_class: manual`

---

**H-5: Icon inside `brand-soft` circle has insufficient contrast (dark mode)**  
**File:** `src/app/components/EmptyState.tsx:55–58`  
**Category:** Accessibility — Color Contrast (Dark Mode)

```tsx
<div className="size-16 rounded-full bg-brand-soft flex items-center justify-center mb-4">
  <Icon className="size-8 text-brand-muted" ... />
```

In dark mode, `--brand-soft` = `#2a2c48` (dark navy) and `--brand-muted` = `#3a3c60` (slightly lighter navy). The contrast ratio between these two colors is approximately **1.6:1** — far below the 3:1 minimum for UI components.

**Fix:** Use `text-brand-soft-foreground` instead of `text-brand-muted` for the icon. In dark mode, `--brand-soft-foreground` = `#a0a8eb` which achieves approximately **4.2:1** against `#2a2c48`.

```tsx
<Icon className="size-8 text-brand-soft-foreground" aria-hidden="true" />
```

`autofix_class: safe_auto`

---

**H-6: Overflow menu button touch target is below 44px minimum**  
**File:** `src/app/pages/LearningPaths.tsx:172–179`  
**Category:** Accessibility — Touch Target Size

```tsx
<Button
  variant="ghost"
  size="icon"
  className="size-8 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white rounded-full"
  // size-8 = 32px × 32px — below the 44px minimum for touch targets
```

**Fix:** Increase to `size-10` (40px) minimum, ideally `size-11` (44px), with padding adjusting the visible icon size:

```tsx
className="size-11 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white rounded-full"
```

`autofix_class: gated_auto`

---

### Medium Priority — Fix When Possible

---

**M-1: Card gap inconsistency between path cards and template cards**  
**File:** `src/app/pages/LearningPaths.tsx:624, 663`  
**Category:** Visual Consistency

Path cards use `gap-8` (32px) while template cards below use `gap-5` (20px). There is no visual or hierarchical reason for this difference.

**Recommendation:** Unify to `gap-6` (24px) for both sections. This also helps with the user's request for slightly smaller/denser cards.

`autofix_class: gated_auto`

---

**M-2: "Not started" path card shows no affordance for clicking/navigation**  
**File:** `src/app/pages/LearningPaths.tsx:298–303`  
**Category:** Interaction Design

When a path has no footer action and is not "not started," an `<ArrowRight>` icon with `aria-hidden="true"` is shown. For paths that are started (>0%) but lack a `footerAction` due to edge cases, this is the only visual hint that the card is interactive. The icon carries no semantic weight.

**Recommendation:** Always render the path link as a focusable element (fixing B-1 solves this). As a secondary improvement, consider replacing the bare arrow with a small `variant="ghost" size="sm"` button ("View Path") for states where the footer action is not computed.

`autofix_class: manual`

---

**M-3: `InlineEditableField` has no persistent editability indicator**  
**File:** `src/app/components/figma/InlineEditableField.tsx:140–159`  
**Category:** Interaction Design — Discoverability

The field only reveals its editability via `cursor-text` and a hover `bg-muted/50` background. First-time users won't know the path title and description are clickable-to-edit without hovering over them. This pattern (used heavily on both the card and the detail page) is central to the UX, so discoverability matters.

**Recommendation:** Add a small pencil icon (`Pencil className="size-3"`) that fades in on hover next to the text, or show a subtle dashed underline on hover. Example:

```tsx
<span className="group/edit cursor-text ...">
  {value}
  <Pencil className="ml-1.5 size-3 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity inline-block" aria-hidden="true" />
</span>
```

`autofix_class: manual`

---

**M-4: `InlineEditableField` missing character count feedback**  
**File:** `src/app/components/figma/InlineEditableField.tsx`  
**Category:** UX — Form Feedback

Both the path name (100-char limit) and description (500-char limit) use `maxLength` props but never surface the character count or limit to the user. A user can be silently truncated without feedback.

**Recommendation:** When `isEditing`, show a character count below the input:

```tsx
{isEditing && maxLength && (
  <span className="text-xs text-muted-foreground" aria-live="polite">
    {draftValue.length}/{maxLength}
  </span>
)}
```

`autofix_class: manual`

---

**M-5: Completed courses horizontal scroll strip is not discoverable**  
**File:** `src/app/pages/LearningPathDetail.tsx:885–920`  
**Category:** Interaction Design — Mobile UX

```tsx
<div className="flex overflow-x-auto gap-4 pb-4 scrollbar-thin">
```

A horizontal scroll container inside a vertical-scroll page requires the user to discover a scroll axis they didn't expect. On touch devices this often goes unnoticed. There's no visual "fade" hint at the edges indicating more content.

**Recommendation:** Add a right-edge gradient fade indicating more cards:

```tsx
<div className="relative">
  <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-thin">
    {/* cards */}
  </div>
  <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
</div>
```

Or switch to a 2-column grid with a "Show all completed" expand toggle for better mobile predictability.

`autofix_class: gated_auto`

---

**M-6: AI goal textarea missing `aria-label` and `id` pairing**  
**File:** `src/app/pages/LearningPaths.tsx:75–80`  
**Category:** Accessibility — Form Labels

```tsx
<Textarea
  value={goalText}
  onChange={e => onGoalTextChange(e.target.value)}
  placeholder="e.g., I want to become a full-stack web developer in 6 months..."
  rows={3}
  maxLength={500}
  // No aria-label, no associated <label>
/>
```

The textarea has no `<label>` element and no `aria-label`. Placeholder text is not an accessible label.

**Fix:**
```tsx
<label htmlFor="ai-goal-input" className="text-sm font-medium">
  Your learning goal
</label>
<Textarea
  id="ai-goal-input"
  aria-label="Describe your learning goal"
  ...
/>
```

`autofix_class: safe_auto`

---

**M-7: `CollapsibleTrigger` for "Discover more paths" missing `aria-controls`**  
**File:** `src/app/pages/LearningPaths.tsx:652–661`  
**Category:** Accessibility — ARIA

The Radix `Collapsible` automatically provides `aria-expanded` on the trigger, but the collapsible content panel lacks an `id` that the trigger's `aria-controls` can reference. Without `aria-controls`, screen readers announce the button's expanded state but cannot navigate to the controlled region.

**Fix:** Add matching `id`/`aria-controls`:
```tsx
<CollapsibleTrigger
  aria-controls="discover-paths-panel"
  className="..."
>

<CollapsibleContent id="discover-paths-panel" className="pt-4">
```

`autofix_class: safe_auto`

---

### Nitpicks — Optional Polish

---

**N-1: Title font weight uses `font-extrabold` but h1 on detail page uses `font-extrabold md:text-5xl`**

At `text-5xl font-extrabold` (48px extra-bold), path names that are 20+ characters on desktop will be extremely large. Recommend capping at `text-4xl` (36px) or using a `line-clamp-2` in the `InlineEditableField` display mode.

---

**N-2: Completion percentage display uses hardcoded `text-5xl font-black`**  
**File:** `src/app/pages/LearningPathDetail.tsx:747`

The `5xl font-black` percentage (`47%`) renders at 48px bold. This is impactful for a learning motivator, but the size may conflict with the inline-editable path title directly to its left at the same visual weight. Consider using `text-4xl` and reserving the extra weight for completion milestones (100%).

---

**N-3: Skeleton for progress ring doesn't match actual size**  
**File:** `src/app/pages/LearningPaths.tsx:320`

```tsx
<Skeleton className="absolute -top-10 left-6 size-[72px] rounded-full" />
```

The actual progress ring (PathProgressRing size="md") is 72px, but the card body has a `-top-10` (40px) offset from the top. `size-[72px]` skeleton is correct dimensionally but appears to float in slightly the wrong position compared to the ring's visual placement at render (with the `bg-card rounded-full p-1.5` wrapper adding ~12px). Minor visual mismatch during loading.

---

**N-4: Template cards use border-brand-soft but user path cards use standard card border**

Template cards (`TemplateCard`) use `border-2 border-brand-soft/50` while user path cards use the default `Card` border. In light mode this creates a subtle visual hierarchy distinction (templates feel slightly "special"). In dark mode, `brand-soft/50` is very subtle. Consider a uniform approach or make the distinction more intentional.

---

**N-5: "Discover more paths" section has no heading level in accessible tree**  
**File:** `src/app/pages/LearningPaths.tsx:654`

```tsx
<span className="text-lg font-semibold flex-1">Discover more paths</span>
```

Using `<span>` instead of an `<h2>` means this section has no landmark in the heading hierarchy. Screen readers won't surface it in the "headings" navigation mode. Replace with `<h2>`.

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|---|---|---|
| **Mobile 375px** | Partial Pass | Empty state is clear and well-structured. Both action buttons (Create Path, Import Course) are full-width stacked, which is correct. The AI section below the empty state is visible but its vertical stacking means ~3 scrolls to reach it — consider moving AI generation above or into the empty state. |
| **Tablet 768px** | Code Pass | `md:grid-cols-2` grid for path cards is correct per design principles. Header switches to `flex-row` via `md:flex-row`. Appropriate. |
| **Sidebar Collapse 1024px** | Code Pass | `lg:grid-cols-3` for cards activates. The `lg:col-span-8 / lg:col-span-4` split in the detail page creates the content/sidebar layout. |
| **Desktop 1440px** | Code Pass | 3-column card grid, sidebar detail layout active. The `max-w-3xl` constraint on the detail page loading skeleton may cause the loaded page to feel very wide without a matching `max-w` on the page container. |

**Note:** Browser viewport resize was constrained by the IDE browser panel dimensions during this review. Mobile viewport was confirmed via screenshot; tablet and desktop layouts are assessed via code.

---

## Accessibility Checklist

| Check | Status | Notes |
|---|---|---|
| Text contrast ≥4.5:1 (light) | Pass | Primary text on warm off-white background passes |
| Text contrast ≥4.5:1 (dark) | **Fail** | EmptyState icon: ~1.6:1 (see H-5). `opacity-70` on not-started cards reduces contrast (see B-3) |
| Keyboard navigation | **Fail** | Primary card link removed from tab order (see B-1) |
| Focus indicators visible | Pass | `focus-visible:ring-2 ring-brand` applied consistently |
| Heading hierarchy | Partial | H1 present, H2 for sections. "Discover more paths" uses `<span>` not `<h2>` (N-5) |
| ARIA labels on icon buttons | Pass | All icon-only buttons have `aria-label` |
| Semantic HTML | Partial | EmptyState uses wrong `role="status"` (H-2); TrailMap SVG has no role (H-3) |
| Form labels associated | **Fail** | AI goal textarea has no label (M-6) |
| `prefers-reduced-motion` | **Fail** | TrailMap SVG `<animate>` ignores system preference (B-2) |
| `aria-live` on dynamic content | Pass | Search result count announced; sonner toasts provide feedback |
| `aria-expanded` on collapsibles | Pass | Radix Collapsible provides this automatically |
| `aria-controls` on triggers | Partial | "Discover more paths" collapsible missing (M-7) |
| Drag-and-drop keyboard equivalent | Pass | MoveUpDownButtons + KeyboardSensor configured |
| Touch targets ≥44px | **Fail** | Overflow menu button is 32×32px (H-6) |
| Destructive action confirmation | **Fail** | Delete path in detail has no confirmation dialog (H-4) |

---

## Card Size and Density Recommendations

The user requested **slightly smaller cards**. Here is a concrete, staged reduction:

### Current Card Dimensions (approximate)
- Gradient header: `h-32` = **128px**  
- Progress ring: `size="md"` = 72px, overlapping by `-top-10` = 40px  
- Body padding: `px-6 pb-6 pt-1` + `mt-10` for ring offset  
- Total minimum card height: **~340–380px** depending on description length

### Recommended Changes

**Stage 1: Header + Ring reduction (–40px, minimal visual impact)**

In `PathCardHeader.tsx`:
```tsx
<div className={cn('relative h-24 bg-gradient-to-br overflow-hidden', gradient, className)}>
// h-32 → h-24
```

In `PathCard` (LearningPaths.tsx:202):
```tsx
<PathProgressRing percentage={completionPct} size="sm">
// size="md" (72px) → size="sm" (48px)
```

And adjust the ring offset:
```tsx
<div className="absolute -top-6 left-6">   // was -top-10
  <div className="bg-card rounded-full p-1 shadow-lg">   // was p-1.5
```

In `CardContent`:
```tsx
className="px-4 pb-4 pt-1 relative"   // px-6→px-4, pb-6→pb-4
...
<Link className="block ... mt-7">  // mt-10→mt-7
```

**Stage 2: Description clamping (prevents card height variability)**
```tsx
<InlineEditableField
  ...
  className="text-sm text-muted-foreground leading-relaxed line-clamp-2"
/>
```

**Result:** Cards reduce from ~360px to ~280px average height — approximately 20% smaller — while maintaining all information hierarchy.

---

## Interaction Design: Search / Create / Import Flows

| Flow | Status | Notes |
|---|---|---|
| **Search** | Good | Appears only when paths exist (correct). Live region announces results. No "clear" button — consider adding `×` to dismiss filter when text is entered. |
| **Create Path** (`CurriculumComposer`) | Not reviewed | Dialog opens correctly. Content of the composer is out of scope. |
| **Import Course** | Good | Singleton guard pattern via `useImportWizardTrigger` prevents double-open. Both header and card overflow menu trigger it correctly. |
| **Edit (title/desc)** | Good | `InlineEditableField` handles Enter/Escape/blur with visual feedback. Missing discoverability (M-3). |
| **Overflow actions** | Partial | Only "Import Course" and "Delete" in menu. No "Edit Path Settings" or "Change Cover" — the overflow menu feels sparse relative to its position. |
| **Progress display** | Good | `PathProgressRing` with ring + % text is clear. Color coding (brand=in-progress, success=complete, muted=not started) is effective. |
| **Footer CTA button** | Good | "Continue / Start / Review" label dynamically set from `useNextBestCourse`. Correctly truncates long course names. |

---

## Cover Image Feature: UX Flow Recommendations

The user asked specifically for UI placement and UX flow options for allowing users to change the learning path cover image (currently programmatic gradients from `PathCardHeader`).

### Option A: Overflow Menu Item (Recommended — lowest risk)

Add "Change Cover" to the existing `DropdownMenu` on the path card:

```tsx
<DropdownMenuItem onSelect={() => setCoverDialogOpen(true)}>
  <ImageIcon className="mr-2 size-4" aria-hidden="true" />
  Change Cover
</DropdownMenuItem>
```

**Dialog contents:**
1. **Gradient presets grid** (8 existing gradients as swatches, selected gradient highlighted)
2. **Upload custom image** — `<input type="file" accept="image/*">` with preview
3. **Remove custom image** (if one is set) — returns to gradient

This approach is the most discoverable (overflow menu is already the "edit options" surface) and requires minimal UI real estate.

**Data model change needed:**  
Add `coverImageUrl?: string` and `gradientPreset?: number` to `LearningPath` type. In `PathCardHeader`, check `coverImageUrl` first:

```tsx
{coverImageUrl ? (
  <img src={coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
) : (
  /* existing gradient */ 
)}
```

---

### Option B: Hover Overlay on Card Header (Power User)

Add a translucent overlay on the gradient header that appears on hover:

```tsx
<div className="relative h-32 bg-gradient-to-br ...">
  {/* existing content */}
  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
    <button
      onClick={e => { e.stopPropagation(); onChangeCover(path.id) }}
      className="flex items-center gap-2 text-white text-sm font-medium bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full"
      aria-label={`Change cover for ${path.name}`}
    >
      <Camera className="size-4" aria-hidden="true" />
      Change Cover
    </button>
  </div>
```

**Pros:** Immediately obvious when hovering; doesn't clutter the overflow menu.  
**Cons:** Not discoverable without hover; needs focus-keyboard equivalent for accessibility.

---

### Option C: Edit Panel on Detail Page (Most Comprehensive)

On `/learning-paths/:id`, add a "Path Settings" section in the right sidebar between the "Add Course" button and the "Suggest Order" panel. This would include cover image, estimated duration, difficulty label, and other path metadata.

This is the right long-term home for all path-level configuration but is higher scope than Options A or B.

---

### Recommendation

Implement **Option A first** (overflow menu item) as it's a small, safe addition with immediate user value. Add **Option B** as a UI enhancement once the data layer is in place. Reserve **Option C** for when more path metadata fields (difficulty, estimated hours, tags) need a home.

---

## Detailed Finding Index

| ID | Severity | File | Line | Issue | autofix_class |
|---|---|---|---|---|---|
| B-1 | Blocker | LearningPaths.tsx | 214 | Card link `tabIndex={-1}` — keyboard inaccessible | manual |
| B-2 | Blocker | TrailMap.tsx | 114 | SVG animation ignores `prefers-reduced-motion` | manual |
| B-3 | Blocker | LearningPaths.tsx | 156 | `opacity-70` on not-started cards breaks contrast | gated_auto |
| H-1 | High | LearningPathDetail.tsx | 635 | `window.location.href` instead of `navigate()` | safe_auto |
| H-2 | High | EmptyState.tsx | 47 | `role="status"` on static content | safe_auto |
| H-3 | High | TrailMap.tsx | 74 | SVG has no accessible description | manual |
| H-4 | High | LearningPathDetail.tsx | 508 | Delete path has no confirmation dialog | manual |
| H-5 | High | EmptyState.tsx | 55 | Icon contrast ~1.6:1 in dark mode | safe_auto |
| H-6 | High | LearningPaths.tsx | 172 | Overflow button 32px — below 44px touch target | gated_auto |
| M-1 | Medium | LearningPaths.tsx | 624,663 | Card gap inconsistency (gap-8 vs gap-5) | gated_auto |
| M-2 | Medium | LearningPaths.tsx | 298 | No keyboard-reachable target for empty-course paths | manual |
| M-3 | Medium | InlineEditableField.tsx | 133 | No persistent editability indicator | manual |
| M-4 | Medium | InlineEditableField.tsx | — | No character count feedback during editing | manual |
| M-5 | Medium | LearningPathDetail.tsx | 885 | Horizontal completed-courses scroll not discoverable | gated_auto |
| M-6 | Medium | LearningPaths.tsx | 75 | AI textarea missing `<label>` | safe_auto |
| M-7 | Medium | LearningPaths.tsx | 652 | Collapsible trigger missing `aria-controls` | safe_auto |
| N-1 | Nitpick | LearningPathDetail.tsx | 707 | Title `text-5xl` may overflow for long names | advisory |
| N-2 | Nitpick | LearningPathDetail.tsx | 747 | `5xl font-black` completion % may compete with title | advisory |
| N-3 | Nitpick | LearningPaths.tsx | 320 | Skeleton ring position slightly mismatched | advisory |
| N-4 | Nitpick | TemplateCard.tsx | 21 | Template vs user card border style inconsistency | advisory |
| N-5 | Nitpick | LearningPaths.tsx | 654 | "Discover more paths" uses `<span>` not `<h2>` | safe_auto |

---

## Prioritized Recommendations

1. **Fix keyboard access** (B-1) — Remove `tabIndex={-1}` from the card link and add proper focus-visible ring. This is a one-line fix with high accessibility impact.

2. **Fix dark mode empty state icon contrast** (H-5) — Change `text-brand-muted` → `text-brand-soft-foreground` in `EmptyState.tsx`. Another one-liner.

3. **Add `prefers-reduced-motion` to TrailMap** (B-2) — Import `useReducedMotion` from `motion/react` and conditionally skip `<animate>` elements.

4. **Fix `opacity-70` strategy** (B-3) — Apply opacity to the header only, not the whole card.

5. **Implement cover image UX** — Start with Option A (overflow menu → cover dialog). Data model change + `PathCardHeader` fallback = ~100 lines of new code.

6. **Reduce card density** — Apply the Stage 1 header/ring reduction for immediately smaller cards.

7. **Fix 3–4 safe_auto items** in batch: `window.location.href` (H-1), EmptyState role (H-2), AI textarea label (M-6), collapsible `aria-controls` (M-7), EmptyState icon (H-5).
