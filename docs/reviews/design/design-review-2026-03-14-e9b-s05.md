# Design Review Report — E9B-S05: AI Note Organization and Cross-Course Links

**Review Date**: 2026-03-14
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Changed Files**:
- `src/app/components/notes/OrganizeNotesButton.tsx`
- `src/app/components/notes/OrganizePreviewDialog.tsx`
- `src/app/components/notes/RelatedConceptsPanel.tsx`
- `src/app/pages/Notes.tsx` (integration)

**Affected Pages**: `/notes`

---

## Executive Summary

E9B-S05 adds three new components to the Notes page: an "Organize with AI" button, a preview dialog for reviewing AI proposals, and a Related Concepts collapsible panel in the expanded note view. The implementation is clean, uses design tokens correctly throughout, and the fallback/error path (AC6) behaves correctly when AI is unavailable. Two issues need attention before merge: a `useMemo` anti-pattern used as a side-effect and a misleading success toast when apply partially fails.

---

## What Works Well

- **Design token discipline**: Zero hardcoded color values in all three new components. Uses `text-brand`, `bg-success-soft`, `text-success`, `bg-accent-violet-muted`, `text-muted-foreground` etc. correctly throughout.
- **Background and card radius**: Body correctly computes `rgb(250, 245, 238)` and note cards have `border-radius: 24px` — both match design specifications.
- **AC6 fallback behavior**: When AI is unavailable the error is caught and surfaced as a Sonner toast with a Retry action. Zero console errors throughout the full session.
- **Semantic HTML for new components**: `OrganizeNotesButton` and `RelatedConceptsPanel` use native `<button>` elements with `type="button"` throughout — no `div[onClick]` patterns in the new code.
- **ARIA on new interactive elements**: Organize button has `aria-label="Organize notes with AI"` and `aria-busy={isProcessing}`. Semantic search info button has a fully descriptive label. Tag filter group has `role="group" aria-label="Filter by tag"`.
- **Keyboard support in RelatedConceptsPanel**: Collapsible trigger and related note buttons both have `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring` — consistent with the system ring pattern.
- **Mobile label collapse**: `hidden sm:inline` / `sm:hidden` correctly hides the button text on small screens, keeping the icon-only state without breaking the `aria-label`.
- **Feature flag integration**: `noteOrganization` flag is properly typed in `ConsentSettings`, defaults to `true`, and is surfaced in the AI Configuration Settings UI.
- **No horizontal overflow**: No horizontal scroll at any tested breakpoint (375px, 768px, 1440px).

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

**H1 — `useMemo` used as a side-effect in `OrganizePreviewDialog`**

- **Location**: `src/app/components/notes/OrganizePreviewDialog.tsx:41–43`
- **Issue**: `useMemo(() => { setAccepted(...) }, [proposals])` calls `setState` inside `useMemo`. This is a React anti-pattern — `useMemo` is a memoization primitive, not a lifecycle hook. In React Strict Mode and concurrent rendering, `useMemo` may be called multiple times with the same dependencies, causing unexpected repeated state resets.
- **Impact**: In production this may appear to work, but it can cause subtle bugs when React's scheduler re-runs memoized functions. It also misleads future maintainers about intent.
- **Suggestion**: Replace with `useEffect`:
  ```tsx
  useEffect(() => {
    setAccepted(new Set(proposals.map(p => p.noteId)))
  }, [proposals])
  ```

**H2 — Misleading success toast when `applyChanges` partially or fully fails**

- **Location**: `src/app/components/notes/OrganizePreviewDialog.tsx:93–99`
- **Issue**: Per-note `saveNote` errors are caught silently (console.error only), and the dialog always closes with `toast.success('Applied changes to X notes')`. If X is 0, learners see "Applied changes to 0 notes" as a green success toast — which is confusing and inaccurate.
- **Impact**: Learners cannot tell whether their organization was applied. This undermines trust in the AI feature, which is especially damaging for an early AI integration.
- **Suggestion**: Check the applied count before choosing toast variant:
  ```tsx
  if (appliedCount === 0) {
    toast.error('No changes could be applied. Please try again.')
  } else if (appliedCount < acceptedProposals.length) {
    toast.warning(`Applied changes to ${appliedCount} of ${acceptedProposals.length} notes`)
  } else {
    toast.success(`Applied changes to ${appliedCount} notes`)
  }
  ```

### Medium Priority (Fix when possible)

**M1 — Organize button touch target below 44px minimum on mobile and tablet**

- **Location**: `src/app/components/notes/OrganizeNotesButton.tsx:55` — `size="sm"` renders at 32px height
- **Evidence**: Computed height at 375px viewport = 32px; at 768px = 32px. Minimum per WCAG 2.5.5 and design principles is 44px.
- **Impact**: On touch devices, learners who take many notes will frequently miss the Organize button, causing frustration with a feature that requires deliberate intent to invoke.
- **Suggestion**: Apply a minimum hit-area wrapper without changing visual size, or use `size="default"` on mobile:
  ```tsx
  // Option A: padding compensation
  className="min-h-[44px] min-w-[44px] flex items-center justify-center"
  // Option B: use size="default" at sm: and below
  size={isMobile ? 'default' : 'sm'}
  ```
  The same applies to the QA Chat button alongside it.

**M2 — `div[role="button"]` note card expanders lack `aria-label`**

- **Location**: `src/app/pages/Notes.tsx` — `renderNoteCard`, the `<div className="cursor-pointer" role="button" tabIndex={0} aria-expanded={isExpanded}>`
- **Evidence**: 19 elements found in ARIA tree with `role="button"` and no `aria-label` or `aria-labelledby`. Screen readers announce "button" with no context about which note it expands.
- **Impact**: Screen reader users cannot identify notes in the list — they hear only "button, collapsed" for each card, with no title.
- **Suggestion**: This is pre-existing but the new RelatedConceptsPanel surfaces inside expanded cards, so screen reader users need to find and expand notes to reach it. Add an aria-label:
  ```tsx
  aria-label={`${item.courseName} — ${item.lessonTitle}: expand note`}
  ```
  Alternatively, convert the div to a `<button>` element (preferred for semantic correctness).

**M3 — `useMemo` side-effect doesn't reset checkbox state correctly on re-open**

- **Location**: `src/app/components/notes/OrganizePreviewDialog.tsx:38` — `useState` initializer runs only once
- **Issue**: The `useState` lazy initializer `() => new Set(proposals.map(p => p.noteId))` runs once on mount. If the dialog is closed and re-opened with new proposals (e.g., user clicks Organize again), the checkbox state from the previous session may persist until the `useMemo` fires. Fixing H1 (switching to `useEffect`) resolves this too.
- **Impact**: Learners who organize notes a second time in the same session may see stale checkbox states momentarily.

**M4 — Sort select has no accessible label**

- **Location**: `src/app/pages/Notes.tsx:452–462` — `<Select value={sortOption} ...>`
- **Evidence**: `document.querySelector('[role="combobox"]').getAttribute('aria-label')` returns `null`. The `ArrowUpDown` icon inside provides no text label.
- **Impact**: Screen reader users cannot identify what this control sorts, hearing only "combobox, Most Recent" with no context label.
- **Suggestion**: Add `aria-label="Sort notes by"` to `<SelectTrigger>`.

### Nitpicks (Optional)

**N1 — `sm:hidden` span renders empty string in both states**

- **Location**: `src/app/components/notes/OrganizeNotesButton.tsx:70`
- `<span className="sm:hidden">{isProcessing ? '' : ''}</span>` — both branches produce empty string. This span is a no-op and can be removed without any visible change.

**N2 — `OrganizePreviewDialog` dialog description count uses proposals length, not accepted count**

- **Location**: `src/app/components/notes/OrganizePreviewDialog.tsx:121`
- `{proposals.length} notes analyzed` is shown before any checkboxes are changed. After a learner deselects some, the description still says the original analyzed count. Consider `{acceptedCount} of {proposals.length} selected` once the dialog is open, or just the analyzed count as-is (current behavior is acceptable).

**N3 — RelatedConceptsPanel `role="region"` placement**

- **Location**: `src/app/components/notes/RelatedConceptsPanel.tsx:68`
- The `role="region" aria-label="Related concepts"` is on an inner `<div>` inside the `<Collapsible>`, not on the outermost element. This is correct, but the landmark only appears after the collapsible renders. Since the panel returns `null` when there are 0 results, no region is announced in the current test data — this is working as designed.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Body text `oklch(0.145 0 0)` on white cards; muted text `rgb(91,106,125)` on white is ~4.6:1 — passes AA |
| Keyboard navigation | Pass | All new `<button>` elements are natively focusable; focus reaches Organize button, tag filters, sort select |
| Focus indicators visible | Pass | Organize button and RelatedConceptsPanel buttons use `focus-visible:ring-2 focus-visible:ring-ring` — consistent with system |
| Heading hierarchy | Pass | Single H1 "My Notes (11)" — no heading hierarchy violations |
| ARIA labels on icon buttons | Pass | Organize button, semantic info button all have descriptive `aria-label` |
| Semantic HTML (new components) | Pass | All new interactive elements use native `<button>` tags |
| Form labels associated | Pass | Search input has `aria-label`; semantic toggle has `<Label htmlFor>` |
| `prefers-reduced-motion` | Not verified | No explicit `motion-reduce:` utilities observed in new components; shadcn animations inherit system preference via CSS |
| Note card expanders (`div[role="button"]`) | Fail (pre-existing) | No `aria-label` on 19 elements — affects discoverability of RelatedConceptsPanel for screen reader users (M2) |
| Sort select label | Fail | No `aria-label` on `<SelectTrigger>` (M4) |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass with caveat — single column layout correct, no horizontal overflow, mobile nav renders. Organize button shows icon-only (correct). Touch target is 32px tall — below 44px minimum (M1).
- **Tablet (768px)**: Pass with caveat — full text "Organize with AI" shows, no overflow. Button height still 32px (M1).
- **Desktop (1440px)**: Pass — sidebar visible, header row fits cleanly at 44px height, note cards at 24px border-radius, body background `rgb(250,245,238)` confirmed.

---

## Recommendations

1. **Fix H1 (useMemo → useEffect) and H2 (toast logic)** before merge — both are small targeted changes and directly affect user trust in the AI feature.
2. **Address M1 (touch target)** alongside the next notes page polish pass — the entire header action row (QA Chat, Organize, Sort) shares this issue.
3. **Address M2 (note card aria-label)** as a dedicated accessibility story — it's pre-existing but now more impactful because RelatedConceptsPanel content is only reachable after expanding a note.
4. The RelatedConceptsPanel correctly renders `null` when there are no related notes — this behavior was verified against the current seed data where most notes lack tags. The component will activate correctly once more notes share tags or embeddings are indexed.

