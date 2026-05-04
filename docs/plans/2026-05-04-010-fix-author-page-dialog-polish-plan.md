---
title: fix: Author page dialog polish and card consistency
type: fix
status: active
date: 2026-05-04
---

# fix: Author page dialog polish and card consistency

## Overview

Polish remaining UI/UX issues on the Authors page after the structural fixes from plans 008 (modal viewport + silent reload) and 009 (specialty overflow + course count) landed. Addresses edit dialog form quality, backdrop depth, card name color consistency, and field layout inside the dialog.

## Problem Frame

Plans 008 and 009 fixed the critical structural issues (dialog clipping, skeleton flashes during sync, specialty overflow, course count mismatch). This plan targets the remaining surface-level polish gaps reported by the user:

1. **Name color inconsistency on author cards** — All names use `group-hover:text-brand` which shifts to brand color on card hover/focus. If one card retains focus state (e.g. browser focus-visible after keyboard nav), its name stays brand-colored while the other renders at default text color. The visual result reads as inconsistent styling.

2. **Edit dialog backdrop too subtle** — The default Radix overlay (`bg-black/50`) doesn't create enough depth separation. Users perceive the page content behind the dialog as still visible and competing for attention. `DialogContent` already supports an `overlayClassName` prop for customizing the overlay.

3. **Edit dialog form field boundaries weak** — In dark mode, input borders blend into the dark panel background, making field edges hard to see and hit targets unclear. The base `Input` component border contrast may need strengthening within the dialog context.

4. **Edit dialog field grouping absent** — 13 fields in a flat list without visual sections. Fields like "Years of Experience", "Avatar URL", and social links all feel equally weighted, increasing cognitive load.

5. **Edit dialog field widths uniform** — Short fields (Years of Experience, a 3-digit number) use the same full width as multi-paragraph Bio and long URLs. This wastes horizontal space and looks imbalanced.

6. **Edit dialog URL fields hard to use** — Long URLs (avatar, website, LinkedIn, Twitter) render in a single proportional line. No wrapping, no monospace, making it hard to verify or edit long URLs.

## Requirements Trace

- **R1.** Author card names must use a single consistent base color regardless of hover/focus state; hover should be a subtle enhancement, not the only differentiator.
- **R2.** Edit dialog backdrop must clearly separate the modal from page content (stronger dimming or blur).
- **R3.** Form inputs inside the dialog must have clearly visible boundaries in both light and dark modes.
- **R4.** Form fields must be organized into labeled visual sections (Profile, Links, Quote).
- **R5.** Short fields (numeric, short text) must use narrower widths than full-text fields inside the dialog.
- **R6.** URL inputs must support readability — wrapping or monospace styling — without changing the Input component globally.
- **R7.** Existing fixes from plans 008/009 (silent reload, dialog scrolling, specialty normalization, course count, badge truncation) must continue to work.
- **R8.** Confirm that the page/dialog reload issue is fully resolved; if any source of visible churn remains (e.g. store subscription causing unnecessary re-renders, focus loss during sync), mitigate it.
- **R9.** Form input borders must be clearly visible against the dialog background in both light and dark modes (currently inputs blend into the dark panel).

## Scope Boundaries

- **In scope:** `AuthorFormDialog` form organization, field widths, URL input styling, backdrop strength, author card name color consistency.
- **Non-goals:** Redesigning the entire dialog system, changing the global `Input` component defaults, adding new form fields, changing author data model.
- **Deferred:** Global dialog backdrop standardization across all app dialogs (separate design-system task).

## Context & Research

### Relevant Code and Patterns

- **`src/app/components/authors/AuthorFormDialog.tsx`** — Edit/create form. Already has viewport-safe flex shell, isDirty guard, tag-style specialties input, social links section with a `Separator` and `h3` heading (partial grouping — only social links).
- **`src/app/components/ui/dialog.tsx`** — `DialogContent` accepts `overlayClassName` prop (line 43), already pipes it to `DialogOverlay`. No base component changes needed.
- **`src/app/pages/Authors.tsx`** — `AuthorCard` uses `group-hover:text-brand transition-colors` on the name `h2` (line 284). All cards share identical styling — the inconsistency is state-driven (hover/focus), not code-driven.
- **`src/app/components/ui/input.tsx`** — shadcn Input with `border-input` class.
- **`src/styles/theme.css`** — Design tokens for borders, backgrounds, and text colors.

### Institutional Learnings

- `docs/solutions/developer-experience/authors-sync-silent-reload-modal-layout-vitest-sonner-2026-05-04.md` — Dialog flex shell pattern, isDirty guard, silent reload. All in place.
- `docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md` — `bg-foreground/60` pattern for overlays (inverts correctly in dark mode). Corner control z-stacking.

### External References

- None required — local patterns suffice.

## Key Technical Decisions

- **Decision — Name color: add a persistent brand tint instead of hover-only brand shift.** Give all author card names a subtle base color (e.g. `text-foreground` with `group-hover:text-brand` as a slight enhancement, not the primary difference). Since the current code already uses this pattern and the user sees inconsistency, the fix is likely to ensure focus/hover state is visually subtle (e.g. `group-hover:text-brand/80` or `group-hover:underline decoration-brand/30`) rather than a full color flip that reads as a different style entirely.

- **Decision — Backdrop: use `overlayClassName` prop on `DialogContent`.** Pass `overlayClassName="bg-black/60 backdrop-blur-sm"` (or `bg-background/80 backdrop-blur-sm` for light mode compatibility). No changes to `dialog.tsx` needed — the prop already exists.

- **Decision — Field groups: add section headers with `Separator` between groups.** Group as: **Profile** (Name, Title, Short Bio, Bio, Specialties, Years of Experience, Education), **Media** (Avatar URL), **Links** (Website, LinkedIn, Twitter — already has a header), **Quote** (Featured Quote). Use `text-xs font-semibold uppercase tracking-wider text-muted-foreground` section labels.

- **Decision — Narrow fields: constrain with `max-w-[12rem]`.** Apply to Years of Experience, and optionally Education. Keep textareas and URL inputs full-width since they contain variable-length content.

- **Decision — URL inputs: add `className="font-mono text-xs truncate"` override.** Applied only to the four URL fields in this dialog, not globally. The monospace styling helps with URL readability without an `Input` component change.

## Implementation Units

- [ ] **Unit 1: Fix author card name color consistency**

**Goal:** Eliminate the visual inconsistency where one card's name appears white and another's appears brand-colored.

**Requirements:** R1, R7

**Dependencies:** None

**Files:**
- Modify: `src/app/pages/Authors.tsx`
- Test: `src/app/pages/__tests__/Authors.test.tsx`

**Approach:**
- Change name `h2` styling from `group-hover:text-brand` to a more subtle hover treatment — e.g. keep base `text-foreground` (or `font-semibold` default) and add `group-hover:text-brand/80 transition-colors` so the shift is gentler and doesn't read as a different style when focused.
- Ensure consistent rendering regardless of `:focus-visible` or `:hover` state retention.

**Patterns to follow:** Existing card hover patterns on `Avatar` ring (`ring-border/50 group-hover:ring-brand/30` — subtle shift, not full flip).

**Test scenarios:**
- **Happy path:** Both cards in a 2-author grid render names with the same base text color (snapshot or computed style assertion).
- **Edge case:** Keyboard-focus one card — name color shift is subtle (opacity-based), not a full brand-to-white inversion.
- **Edge case:** Hover one card — transition is smooth and both cards still read as belonging to the same visual system.

**Verification:** Visual check on `/authors` — names are consistent across all cards irrespective of focus/hover/focus-visible state.

---

- [ ] **Unit 2: Strengthen edit dialog backdrop**

**Goal:** Clear depth separation between modal and page content.

**Requirements:** R2, R7

**Dependencies:** None

**Files:**
- Modify: `src/app/components/authors/AuthorFormDialog.tsx`

**Approach:**
- Pass `overlayClassName="bg-black/60 backdrop-blur-sm"` to `DialogContent`.
- The `overlayClassName` prop already exists on `DialogContent` (line 43 of `dialog.tsx`) — no component changes needed.

**Patterns to follow:** `docs/solutions/best-practices/unified-course-card-shared-shell-pattern-2026-04-20.md` — overlay token pattern (though here a direct value is appropriate since Radix overlay is a fixed backdrop, not a card overlay).

**Test scenarios:**
- **Integration expectation:** Visual verification only. Backdrop visibly dims and blurs the Authors page content behind an open edit dialog. No automated test needed for visual effect.

**Verification:** Open edit dialog — page behind is clearly separated, not competing for attention.

---

- [ ] **Unit 3: Organize form fields into labeled sections**

**Goal:** Reduce cognitive load by grouping 13 fields into 4 logical sections.

**Requirements:** R4, R7

**Dependencies:** None (can parallelize with Units 1-2)

**Files:**
- Modify: `src/app/components/authors/AuthorFormDialog.tsx`

**Approach:**
- Add `border-2 border-border` (or `border-input`) on all `Input` and `Textarea` components within the dialog to ensure visible field boundaries in both light and dark modes. The default shadcn `Input` border may be too subtle against the dark dialog background.
- Insert section headers between field groups, each followed by a thin `Separator`:
  - **Profile** (no separator above — first group): Name, Title, Short Bio, Bio, Specialties, Years of Experience, Education
  - **Media**: Avatar URL
  - **Links**: Website, LinkedIn, Twitter (already has `Separator` + `h3` — make consistent with other sections)
  - **Quote**: Featured Quote
- Section label style: `text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2`
- Each section gets `space-y-3` internally; sections separated by `Separator` + label.

**Test scenarios:**
- **Happy path:** Open edit dialog — four clearly labeled sections visible in scroll order.
- **Edge case:** Create mode (no pre-filled data) — sections still render with empty fields.
- **Accessibility:** Section labels use semantic heading level or `aria-label` so screen readers can navigate by section.

**Verification:** Form reads as organized into Profile / Media / Links / Quote groups rather than one flat list.

---

- [ ] **Unit 4: Narrow short fields and improve URL readability**

**Goal:** Years of Experience doesn't stretch full-width; URL fields are easier to scan and edit.

**Requirements:** R5, R6, R7

**Dependencies:** Unit 3 (section grouping may shift field DOM order slightly — safer to sequence after)

**Files:**
- Modify: `src/app/components/authors/AuthorFormDialog.tsx`

**Approach:**
- **Years of Experience input:** Add `className="max-w-[10rem]"` (or wrap in a `div` with that class).
- **Education input:** Optionally `max-w-[16rem]` since it's typically a short string like "PhD Computer Science, MIT".
- **URL inputs (Avatar, Website, LinkedIn, Twitter):** Add `className="font-mono text-xs"` for monospace readability. The `truncate` utility won't work on `<input>` — instead rely on native input scrolling or add `dir="auto"` for RTL URL safety.
- All other text inputs and the Bio textarea remain full-width.

**Patterns to follow:** Existing `Input` component accepts `className` overrides; no global changes.

**Test scenarios:**
- **Happy path:** Years of Experience renders at `max-w-[10rem]` while Bio textarea remains full dialog width.
- **Happy path:** URL inputs use monospace font, making URL structure more legible.
- **Edge case:** Very long URL (> dialog width) — input scrolls horizontally within its bounds, does not expand the dialog.

**Verification:** Visual check — narrow fields feel proportional to their content; URLs are distinguishable from prose text at a glance.

---

- [ ] **Unit 5: Verify reload fix and mitigate remaining churn**

**Goal:** Confirm the silent reload fix (plan 008) eliminates visible page/form churn during sync; identify and fix any remaining sources.

**Requirements:** R8

**Dependencies:** None (verification can happen independently)

**Files:**
- Investigate: `src/app/pages/Authors.tsx`, `src/stores/useAuthorStore.ts`, `src/app/pages/AuthorProfile.tsx`
- Potentially modify: `src/app/pages/Authors.tsx` (if store subscription needs narrowing)

**Approach:**
- Verify that `loadAuthors({ silent: true })` fires from the sync lifecycle and does NOT clear `isLoaded` — confirmed by code review (line 138-140 of `useSyncLifecycle.ts`).
- Check whether the `Authors` component's Zustand subscription causes visible churn. The component uses `useAuthorStore()` with full-store destructuring — any `authors` array change triggers re-render. This is normal React behavior but may cause layout recalculation during sync.
- If churn is problematic: narrow the store subscription with selectors, or use `useShallow` to prevent re-renders when the array content is structurally identical.
- Verify the `isDirty` guard in `AuthorFormDialog` correctly prevents form field reset during sync. The guard is set on `onInput` — ensure the window between dialog open and first keystroke is handled (either by setting `isDirty` on dialog open in edit mode, or accepting the narrow race window with 30s sync interval).
- Check `AuthorProfile.tsx` for the same `isLoading && !isLoaded` pattern — confirm it also stays mounted during sync refreshes.

**Test scenarios:**
- **Integration:** Open edit dialog, wait 35+ seconds for at least one sync nudge — form fields remain unchanged, dialog stays open, no skeleton flash.
- **Edge case:** Open edit dialog but don't type anything — wait for sync — form should still show the author's current data (not reset to blanks).

**Verification:** Manual: keep edit dialog open through 2+ sync nudge windows; form stays responsive and data doesn't shift.

---

## System-Wide Impact

- **Interaction graph:** `AuthorFormDialog` only — no impact on other dialogs, stores, or routing.
- **Unchanged invariants:** Form validation, submit behavior, isDirty guard, specialties tag input, silent sync reload, specialty normalization, course count computation.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Section grouping changes scroll height, potentially re-introducing clipping | Unit 3's sections add minor vertical space (headers + separators). The viewport-safe flex shell from plan 008 already handles overflow — verify after grouping. |
| Monospace font on URL inputs looks jarring next to proportional text | Use `text-xs` to reduce visual weight; if it reads poorly, drop monospace and use only `text-xs truncate` |
| `max-w-[10rem]` on Years of Experience too narrow for some locales | The field accepts a number — even large values (e.g., "100") fit in ~3ch. 10rem ≈ 10 characters at default font size, which is ample. |

## Sources & References

- **Prior plans:** `docs/plans/2026-05-04-008-fix-author-edit-modal-viewport-refresh-plan.md`, `docs/plans/2026-05-04-009-fix-authors-page-layout-course-count-plan.md`
- **Solutions doc:** `docs/solutions/developer-experience/authors-sync-silent-reload-modal-layout-vitest-sonner-2026-05-04.md`
- **Related code:** `src/app/components/authors/AuthorFormDialog.tsx`, `src/app/components/ui/dialog.tsx`, `src/app/pages/Authors.tsx`
