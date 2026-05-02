---
title: fix: Audiobook speed popover opens but options do not apply
type: fix
status: active
date: 2026-04-27
---

# fix: Audiobook speed popover opens but options do not apply

## Overview

After raising overlay z-index above the full-screen audiobook shell, the **1.0×** control opens the speed menu, but choosing another rate does not change playback speed. The UI shows focus on the first row (0.5×) while taps on other rows appear ineffective. This plan fixes selection reliability and adds a regression test.

## Problem Frame

- **Actor:** Listener on mobile or desktop using the in-app audiobook player (`BookReader` → `AudiobookRenderer`).
- **Symptom:** Speed popover is visible; tapping a speed row does not update `playbackRate` / on-screen speed label.
- **Context:** `SpeedControl` renders options as `<li role="option" tabIndex={0} onClick={...}>`. The sleep timer popover (`SleepTimer`) uses **native `<button>`** rows inside list items, which matches common touch and Radix interaction patterns.

## Requirements Trace

- R1. Tapping any listed speed in the audiobook player applies that rate immediately (store + `HTMLAudioElement.playbackRate` via existing `useAudioPlayer` wiring).
- R2. The popover should close (or clearly reflect the new rate) after a successful choice so the user gets unambiguous feedback.
- R3. Keyboard users can still change speed (Enter/Space on a focused option).
- R4. No regression for mini-player `SpeedControl` (`AudioMiniPlayer.tsx` shares the component).

## Scope Boundaries

- In scope: `SpeedControl.tsx`, tests proving option activation.
- Out of scope: Redesign of the speed list, new speeds outside `VALID_SPEEDS`, ABS sync, unrelated `BookReader` drag-to-dismiss behavior (unless verification shows the same root cause).

## Context & Research

### Relevant code and patterns

- `src/app/components/audiobook/SpeedControl.tsx` — listbox markup with **click on `<li>`** only; no inner `<button>`.
- `src/app/components/audiobook/SleepTimer.tsx` — preset rows use **`<button type="button">` inside `<li role="option">`**, which is a stronger activation target for touch and screen readers.
- `src/app/pages/BookReader.tsx` — full-screen shell `z-[100]` with pointer handlers for drag-to-dismiss; portaled popover content is generally **not** a descendant of that shell, so pointer capture on the shell is a secondary hypothesis only if reproduction shows events still hitting the shell.
- `src/app/components/audiobook/AudioMiniPlayer.tsx` — reuses `SpeedControl`; any API change to props must stay backward-compatible (default props only).

### Institutional learnings

- `docs/solutions/ui-bugs/audiobook-cover-letterbox-flex-compression-2026-04-25.md` — audiobook player layout is sensitive to flex/stacking; this task is interaction-layer, not layout, but tests should use the audiobook route or component harness used elsewhere for player UI.

## Key Technical Decisions

- **Decision:** Implement each speed row as a **native `<button type="button">`** (mirroring `SleepTimer` preset rows), with the outer `<li>` carrying `role="presentation"` or equivalent so `role="listbox"` / `role="option"` stays valid (put `role="option"` + `aria-selected` on the button, or follow the APG “listbox + option buttons” pattern consistently).
- **Rationale:** `<li onClick>` with `tabIndex={0}` is weaker on some mobile WebKit + Radix popover stacks; buttons have implicit click semantics and hit slop consistent with the rest of the player chrome.
- **Decision:** Use **controlled** `Popover` open state where needed so `handleSelect` can call `setOpen(false)` after a successful pick—avoids a stuck-open popover masking an applied rate.
- **Rationale:** Deterministic UX; matches user expectation that the sheet closes after a choice.

## Open Questions

### Deferred to implementation

- If button-based rows still fail on a specific device, capture whether `pointerdown` reaches `PopoverContent` (then investigate `onInteractOutside` / dismiss layer). Do not block the first implementation pass on this.

## Implementation Units

- [ ] U1. **Harden SpeedControl rows for pointer + keyboard**

**Goal:** Make speed selection fire reliably and close the popover after choose.

**Requirements:** R1–R4

**Dependencies:** None

**Files:**

- Modify: `src/app/components/audiobook/SpeedControl.tsx`
- Test: add or extend `src/app/components/audiobook/__tests__/SpeedControl.test.tsx` (create if missing) **or** a focused Playwright spec under `tests/e2e/` if the project already covers audiobook player flows—pick the lighter layer that can open the popover and assert `playbackRate` / label change without flaking.

**Approach:**

- Refactor each rate row to a `<button>` (or `<button>` wrapping row content) with `type="button"`, `className` carrying the current hover/focus styles, and `onClick` / `onKeyDown` calling `handleSelect(rate)`.
- Preserve `data-testid={`speed-option-${rate}`}` on the interactive element for tests.
- Add controlled `open` / `onOpenChange` on `Popover` if uncontrolled close is unreliable after the structural fix.
- Re-verify `formatSpeed` / `VALID_SPEEDS` unchanged.

**Patterns to follow:**

- Row markup in `SleepTimer.tsx` (`renderOption` / preset `<button>` list).

**Test scenarios:**

- Happy path: open speed popover → click `speed-option-1.5` (or another non-default) → `playbackRate` in `useAudioPlayerStore` matches; trigger label updates.
- Edge case: choose current rate again → popover closes, no error.
- Keyboard: focus an option, Enter selects (if test harness supports `userEvent.keyboard`).

**Verification:**

- Manual smoke: iOS Safari or WebKit if available—open popover, tap 1.25×, confirm audible/UI rate change.
- Automated test green in CI target (`vitest` and/or `playwright` as chosen above).

---

- [ ] U2. **Document the pitfall (optional, tiny)**

**Goal:** Capture “popover rows should use real buttons in touch-heavy surfaces” if no existing doc covers it.

**Requirements:** None (process)

**Dependencies:** U1

**Files:**

- Optional create: `docs/solutions/ui-bugs/audiobook-speed-popover-li-click-YYYY-MM-DD.md` **only** if the implementer confirms the root cause was `<li>` activation; otherwise skip to avoid speculative docs.

**Approach:** Single short learning with YAML frontmatter per repo convention.

**Test scenarios:** Test expectation: none — documentation only.

**Verification:** File exists only if U1 confirmed `<li>` / touch interaction as the cause.

## System-Wide Impact

- **Interaction graph:** `useAudioPlayerStore.setPlaybackRate` and `useBookStore.updateBookPlaybackSpeed` unchanged; only call sites from `handleSelect` remain.
- **Unchanged invariants:** `VALID_SPEEDS`, mini-player embedding, and z-index on `PopoverContent` stay as today unless a layering bug resurfaces during verification.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| ARIA regression on listbox | Mirror SleepTimer’s list semantics; run axe or existing a11y checks if present |
| E2E flake on audiobook route | Prefer RTL component test first; add E2E only if route coverage is already standard for player |

## Sources & References

- Related code: `src/app/components/audiobook/SpeedControl.tsx`, `src/app/components/audiobook/SleepTimer.tsx`, `src/app/pages/BookReader.tsx`
- Prior stacking fix context: `docs/plans/2026-04-27-004-fix-abs-inbound-progress-sync-plan.md` (branch carried z-index raises for sheets/popovers)
