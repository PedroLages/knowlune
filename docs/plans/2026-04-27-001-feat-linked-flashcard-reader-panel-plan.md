---
title: Add Linked Flashcard Reader Panel
type: feat
status: completed
date: 2026-04-27
origin: docs/brainstorms/2026-04-27-linked-flashcard-reader-panel-requirements.md
---

# Add Linked Flashcard Reader Panel

## Overview

Add an in-reader detail panel for highlights that already have a linked flashcard. Clicking the stack icon should inspect the exact card in place, while highlights without a linked card continue to open the existing cloze creator.

---

## Problem Frame

The stack icon is contextual to a highlighted passage, so sending readers to the general flashcards page would break reading flow and fail to show the exact linked card. The reader should stay in place, show front/back content for the linked card, and handle stale links gracefully (see origin: `docs/brainstorms/2026-04-27-linked-flashcard-reader-panel-requirements.md`).

---

## Requirements Trace

- R1. Linked highlight stack action opens an in-reader panel for the exact flashcard.
- R2. The panel shows flashcard front and back content.
- R3. Closing the panel preserves reader position and context.
- R4. Missing linked cards show an explicit recoverable unavailable state.
- R5. Unlinked highlights keep the existing create-flashcard flow.
- R6. Stack icon labels distinguish create vs view states.

**Origin actors:** A1 Reader, A2 Flashcard system
**Origin flows:** F1 View linked flashcard from reader, F2 Create flashcard from reader
**Origin acceptance examples:** AE1 linked card panel, AE2 missing card state, AE3 unlinked card creation

---

## Scope Boundaries

- Do not build or start a full flashcard review session inside the reader.
- Do not change FSRS scheduling, review queue ordering, or flashcard persistence schema.
- Do not route linked highlight clicks to `/flashcards`.
- Do not replace the existing `ClozeFlashcardCreator` create flow.
- Editing or unlinking a stale flashcard relationship is deferred unless implementation finds a near-zero-cost affordance.

---

## Context & Research

### Relevant Code and Patterns

- `src/app/components/reader/HighlightMiniPopover.tsx` already switches the stack icon between create and view states based on `BookHighlight.flashcardId`.
- `src/app/components/reader/HighlightLayer.tsx` wires highlight annotation callbacks, mini-popover actions, and currently owns the unimplemented `onViewFlashcard` behavior.
- `src/app/pages/BookReader.tsx` owns reader-level sheets such as `ClozeFlashcardCreator`; this is the natural place for linked-card panel state if the panel needs book-level context.
- `src/app/components/reader/ClozeFlashcardCreator.tsx` creates book-sourced flashcards and links them back to highlights via `flashcardId`.
- `src/app/pages/Flashcards.tsx` already supports source back-navigation from flashcard review to reader, but it is review-session oriented and not a good exact-card inspection destination.
- `src/data/types.ts` defines `Flashcard.sourceHighlightId` and `BookHighlight.flashcardId`; direct lookup by `flashcardId` avoids adding indexes.

### Institutional Learnings

- `docs/implementation-artifacts/stories/E85-S04.md` frames book flashcards as normal flashcards with source metadata, not a separate table.
- `docs/implementation-artifacts/stories/E85-S05.md` emphasizes non-fatal handling for missing source records and optional source fields.
- `docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md` cautions against stale async state updates after awaits.
- `docs/solutions/best-practices/wcag-target-size-audit-2026-04-25.md` reinforces accessible labels and reliable tap targets for interactive controls.

---

## Key Technical Decisions

- Use a reader-local panel/sheet rather than route navigation: preserves reading position and satisfies F1/AE1.
- Resolve linked cards by `BookHighlight.flashcardId`: no new schema/index is needed and it directly identifies the exact card.
- Keep v1 panel read-only: front/back, optional source context, close action, and missing-card state cover the user need without review-flow complexity.
- Do not reuse the full review card component: review cards include rating/session behavior that is outside scope.

---

## Open Questions

### Resolved During Planning

- Destination for linked card: in-reader detail panel, not `/flashcards` or review queue.

### Deferred to Implementation

- Exact panel placement: implementer may choose bottom sheet or side panel based on existing reader sheet patterns and viewport behavior.
- Missing-card copy and optional action: implementer should choose concise wording; unlink/recreate action remains optional only if trivial and safe.

---

## Implementation Units

- [x] U1. **Add linked flashcard detail panel**

**Goal:** Provide a small read-only reader panel that can show a linked flashcard or a missing-card state.

**Requirements:** R1, R2, R3, R4, R6; F1; AE1, AE2

**Dependencies:** None

**Files:**
- Create: `src/app/components/reader/LinkedFlashcardPanel.tsx`
- Test: `src/app/components/reader/__tests__/LinkedFlashcardPanel.test.tsx`

**Approach:**
- Use existing reader UI primitives (`Sheet`, `Button`, typography/util classes) to present front/back content.
- Accept enough state to render loading, found, and not-found states without reaching into global stores internally unless that proves simpler during implementation.
- Keep controls accessible with explicit labels and touch-friendly targets.

**Patterns to follow:**
- Reader bottom sheet pattern in `src/app/components/reader/ClozeFlashcardCreator.tsx`
- Flashcard front/back presentation cues from flashcard review UI, but without rating controls.

**Test scenarios:**
- Happy path: given a flashcard with front/back, panel renders both and exposes a close control.
- Error path: given missing linked card state, panel shows unavailable copy and a close control.
- Accessibility: close action has an accessible label and invokes the provided close callback.

**Verification:**
- The panel can display linked card content without navigation or review controls.

---

- [x] U2. **Wire linked-card lookup from reader highlight actions**

**Goal:** Clicking the stack icon for a linked highlight loads the exact flashcard and opens the new panel.

**Requirements:** R1, R3, R4, R5, R6; F1, F2; AE1, AE2, AE3

**Dependencies:** U1

**Files:**
- Modify: `src/app/pages/BookReader.tsx`
- Modify: `src/app/components/reader/HighlightLayer.tsx`
- Modify: `src/app/components/reader/HighlightMiniPopover.tsx`
- Test: `src/app/components/reader/__tests__/HighlightMiniPopover.test.tsx`
- Test: existing or new focused reader wiring test if current test harness supports it

**Approach:**
- Preserve `onCreateFlashcard` for unlinked highlights.
- Change `onViewFlashcard` from a stub to a callback that receives the linked highlight/card identity and opens reader-local panel state.
- Lookup the card by `flashcardId` through existing local storage access patterns; handle `undefined` as the missing-card state.
- Keep the reader route and URL unchanged.

**Execution note:** Add/adjust interaction tests before or alongside wiring so the stack icon no longer silently no-ops.

**Patterns to follow:**
- `BookReader` owns `ClozeFlashcardCreator` state and passes callbacks into `HighlightLayer`.
- `BookReader` already reads Dexie for `sourceHighlightId` resolution.
- `HighlightMiniPopover` already exposes `mini-popover-view-flashcard` and `mini-popover-create-flashcard` test ids.

**Test scenarios:**
- Covers AE1. Happy path: linked highlight stack icon calls view behavior and opens the linked-card panel.
- Covers AE2. Error path: linked highlight whose `flashcardId` lookup returns no card opens the missing-card state instead of doing nothing.
- Covers AE3. Happy path: unlinked highlight stack icon still opens the cloze creator path.
- Integration: closing the linked-card panel leaves reader state in place and does not navigate.

**Verification:**
- Stack icon always has visible behavior: create for unlinked, inspect for linked, unavailable state for stale links.

---

- [x] U3. **Clarify labels and hover affordances for toolbar actions**

**Goal:** Ensure stack, note, vocabulary, delete, and close controls communicate interactivity and state.

**Requirements:** R3, R6

**Dependencies:** U2

**Files:**
- Modify: `src/app/components/reader/HighlightPopover.tsx`
- Modify: `src/app/components/reader/HighlightMiniPopover.tsx`
- Test: `src/app/components/reader/__tests__/HighlightPopover.test.tsx`
- Test: `src/app/components/reader/__tests__/HighlightMiniPopover.test.tsx`

**Approach:**
- Keep explicit `cursor-pointer`, accessible labels, and hover/focus states for toolbar controls.
- Ensure stack icon label reflects whether it creates or views a card.
- Preserve delete confirmation behavior.

**Patterns to follow:**
- Existing toolbar tests for click handlers and pointer styling in reader toolbar tests.

**Test scenarios:**
- Happy path: action icons call their handlers when clicked.
- Accessibility: linked-card stack button is labeled “View linked flashcard”; unlinked stack button is labeled “Create flashcard from highlight”.
- Safety: delete still requires confirmation before destructive action.

**Verification:**
- Mouse hover communicates clickable state and right-side icons do not appear inert.

---

## System-Wide Impact

- **Interaction graph:** Reader highlight toolbar -> `HighlightLayer` -> `BookReader` panel state -> local flashcard data.
- **Error propagation:** Missing cards should render panel state, not throw or silently close.
- **State lifecycle risks:** Async card lookup can complete after toolbar state changes; implementation should guard against stale updates.
- **API surface parity:** Unlinked create flow and existing `/flashcards` source back-navigation remain unchanged.
- **Integration coverage:** Tests should prove click-through behavior across toolbar callbacks and panel rendering, not just isolated component rendering.
- **Unchanged invariants:** Flashcard scheduling fields, highlight persistence, and source-highlight back-navigation stay unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Reusing review UI accidentally starts review behavior in the reader | Use a read-only panel component rather than full review card controls |
| Stale `flashcardId` causes a no-op | Add explicit missing-card state |
| Reader position is lost | Keep panel state local; avoid route navigation |
| Async lookup races with closing toolbar | Guard state updates after async lookup |

---

## Documentation / Operational Notes

- No user-facing docs are required for v1.
- If the missing-card state adds unlink/recreate behavior later, document the data integrity decision in `docs/solutions/`.

---

## Sources & References

- **Origin document:** `docs/brainstorms/2026-04-27-linked-flashcard-reader-panel-requirements.md`
- Related code: `src/app/components/reader/HighlightMiniPopover.tsx`
- Related code: `src/app/components/reader/HighlightLayer.tsx`
- Related code: `src/app/pages/BookReader.tsx`
- Related code: `src/app/components/reader/ClozeFlashcardCreator.tsx`
- Related code: `src/app/pages/Flashcards.tsx`
