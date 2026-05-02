---
title: "fix: Remove glass chrome around full-player progress scrubber"
type: fix
status: active
date: 2026-04-26
---

# fix: Remove glass chrome around full-player progress scrubber

## Overview

The full-screen audiobook player shows a rounded, semi-opaque panel behind the seek slider and time labels. The goal is to let the scrubber and timestamps sit directly on the existing atmospheric blurred background, without that nested “card” look.

---

## Problem Frame

Listeners see a distinct dark gray rounded rectangle around the progress track and `0:00` / duration display. It reads as an extra UI layer rather than part of the immersive player chrome and matches the wrapper that uses shared player panel tokens.

---

## Requirements Trace

- R1. Progress scrubber and time row are no longer surrounded by a visible panel (no filled rounded “box” distinct from the page atmosphere).
- R2. Layout, spacing, and touch targets for scrubbing and the duration toggle remain usable on mobile and desktop.
- R3. `data-testid="audiobook-progress-panel"` remains stable for existing E2E geometry checks.
- R4. Secondary control pill (speed, bookmarks, sleep timer, etc.) is unchanged unless explicitly expanded in a follow-up — user feedback targeted only the progress region.

---

## Scope Boundaries

- In scope: Full-player progress block in `AudiobookRenderer` (slider + time row container).
- Non-goals: Redesigning the slider track/thumb; changing the bottom secondary controls strip; changing `AudioMiniPlayer`; removing or renaming theme tokens in `theme.css` (still used by the secondary strip).

---

## Context & Research

### Relevant Code and Patterns

- Progress + timestamps live in a wrapper `div` with `data-testid="audiobook-progress-panel"` in `src/app/components/audiobook/AudiobookRenderer.tsx`. It currently applies `rounded-2xl`, `border`, `bg-[var(--surface-player-panel)]`, `backdrop-blur-xl`, and padding — this is the box visible in screenshots.
- Tokens `--surface-player-panel` and `--surface-player-panel-border` are defined in `src/styles/theme.css` for light/dark/high-contrast variants and are also used by the secondary controls cluster in the same file (~617) — do not delete tokens when fixing the progress wrapper alone.
- E2E `tests/e2e/audiobook-player-viewport-fit.spec.ts` queries `audiobook-progress-panel` for `getBoundingClientRect()` and asserts it stays within the viewport when present.

### Institutional Learnings

- Recent player layout fixes (cover letterboxing, viewport fit) live under `docs/solutions/ui-bugs/` and `tests/e2e/audiobook-*`; this change should not regress those tests.

### External References

- None required — Tailwind utility adjustment on an existing component.

---

## Key Technical Decisions

- **Strip chrome on the progress wrapper only:** Remove background, border, rounded corners, and backdrop blur from the progress `div`. Keep vertical stacking (`space-y-*`), full width, and enough horizontal padding (if needed) so the slider thumb is not clipped at viewport edges.
- **Keep test id:** Preserve `data-testid="audiobook-progress-panel"` so viewport-fit and any future tests keep a stable anchor.
- **Contrast fallback (execution-time only):** If timestamps or the track lose legibility on some atmosphere images, prefer minimal text treatment (e.g. subtle text shadow or existing `text-foreground` hierarchy) rather than reintroducing a full panel.

---

## Open Questions

### Resolved During Planning

- **Should the bottom icon pill lose its panel too?** No — user asked only about the progress bar area (R4).

### Deferred to Implementation

- **Exact padding after chrome removal:** Chosen by implementer after visual check so spacing still matches the play/skip cluster.

---

## Implementation Units

- [ ] U1. **Remove progress panel glass styling**

**Goal:** Progress scrubber and time labels render without a nested rounded panel; atmosphere shows through.

**Requirements:** R1–R3

**Dependencies:** None

**Files:**

- Modify: `src/app/components/audiobook/AudiobookRenderer.tsx`
- Test: `tests/e2e/audiobook-player-viewport-fit.spec.ts` (no file change expected if test id and layout invariants hold)

**Approach:**

- On the `div` with `data-testid="audiobook-progress-panel"`, remove classes that create the visible box: `rounded-2xl`, `border`, `border-[var(--surface-player-panel-border)]`, `bg-[var(--surface-player-panel)]`, `backdrop-blur-xl`.
- Retain `w-full`, `space-y-2`, and adjust padding only if needed for thumb edge clearance (e.g. keep or slightly tune `px-*` / `py-*` without reintroducing a card).
- Do not alter the sibling secondary-controls `div` that still uses `--surface-player-panel*`.

**Patterns to follow:**

- Match surrounding Tailwind usage and existing `Slider` `*ClassName` props; avoid new CSS variables unless contrast work requires it.

**Test scenarios:**

- **Happy path:** Open full audiobook reader at a typical desktop viewport — progress area shows no distinct rounded filled panel; slider and times remain visible and aligned.
- **Integration / regression:** Run or rely on CI for `audiobook-player-viewport-fit.spec.ts` — `progressBottom` within viewport when progress panel exists; reader and primary/secondary controls unchanged.
- **Edge case:** Dark theme + strong cover-derived atmosphere — duration toggle and current time remain readable; if not, apply the smallest text/contrast tweak scoped to the time row only (document in PR if done).

**Verification:**

- Visual confirmation on light and dark themes; E2E viewport spec still green.

---

## System-Wide Impact

- **Unchanged invariants:** `AudioMiniPlayer`, sleep timer popover chapter bar, theme token definitions, ABS sync behavior.
- **Blast radius:** Single presentational wrapper in `AudiobookRenderer`; secondary controls keep existing glass styling.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Text/track hard to read on busy backgrounds | Spot-check after change; narrow contrast tweak on labels only if needed |

---

## Sources & References

- Related code: `src/app/components/audiobook/AudiobookRenderer.tsx` (progress panel wrapper), `src/styles/theme.css` (`--surface-player-panel*`)
- Related test: `tests/e2e/audiobook-player-viewport-fit.spec.ts`
