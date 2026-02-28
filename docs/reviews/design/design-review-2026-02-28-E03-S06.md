# Design Review: E03-S06 — View Course Notes Collection

**Review Date**: 2026-02-28
**Branch**: `feature/e03-s06-view-course-notes-collection`
**Routes Tested**: `/courses/operative-six`, `/courses/authority`, `/courses/confidence-reboot`
**Viewports Tested**: 1440px (desktop), 768px (tablet), 375px (mobile)

## What Works Well

- Empty state is clear and actionable with FileText icon and helpful guidance
- Sort toggle well-designed — button label updates in-place to reflect current mode
- Delete confirmation uses proper AlertDialog with destructive styling and specific copy
- Timestamp links close the loop between note-taking and review cleanly
- Background colour #FAF5EE respected, no horizontal overflow at any breakpoint
- Clean TypeScript — no `any`, all imports use `@/` aliases, no inline styles

## Findings

### Blockers

1. **Nested interactive elements** — `div[role="button"]` wrapping `<button>` in NoteCard.tsx:95-130. Two Tab stops per note card. HTML spec violation. Fix: Replace div with native `<button>`, make chevron a decorative `<span aria-hidden>`.

### High Priority

2. **Cancel-saves-note bug** — NoteEditor's force-save-on-unmount fires when Cancel is pressed. User sees "Note saved" toast despite clicking Cancel. Fix: Add equality guard in handleSave.

3. **Muted text contrast fails WCAG AA** — `text-muted-foreground` (Slate-500) against `#FAF5EE` = 4.39:1 (needs 4.5:1). Affects empty state paragraph. Fix: Wrap empty state in `bg-card` container.

4. **32x32px expand button below 44px touch target minimum** — NoteCard.tsx:127. Resolved by Blocker fix (making full row the touch target).

### Medium

5. **NoteCard rounded-2xl (16px) vs 24px card standard** — NoteCard.tsx:93. Align to `rounded-[24px]` or document the departure.

6. **Heading hierarchy skips H2** — H1→H3 in Notes tab. Pre-existing gap, compounded by new H3/H4 layers.

### Nits

7. **readOnlyEditor instantiated unconditionally** — Creates Tiptap instance for every card on mount regardless of expansion state.
8. **div[role="button"] has no aria-label** — Resolved by Blocker fix.

## Accessibility Checklist

| Check | Status |
|-------|--------|
| Text contrast ≥4.5:1 | Fail (empty state) |
| Keyboard navigation | Fail (nested interactive) |
| Focus indicators visible | Pass |
| ARIA labels on icon buttons | Pass |
| Semantic HTML | Fail (div[role="button"]) |
| prefers-reduced-motion | Pass |

## Responsive Verification

| Viewport | Status |
|----------|--------|
| Desktop (1440px) | Pass |
| Tablet (768px) | Pass |
| Mobile (375px) | Partial (touch targets) |

Issues: 8 | Blockers: 1 | High: 3 | Medium: 2 | Nits: 2
