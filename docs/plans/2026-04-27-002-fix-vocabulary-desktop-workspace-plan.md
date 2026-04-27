---
title: "fix: Vocabulary overflow + desktop two-pane workspace"
type: fix
status: active
date: 2026-04-27
---

# fix: Vocabulary overflow + desktop two-pane workspace

## Overview

Fix long-word/long-context overflow on the Vocabulary page (`/vocabulary`) and redesign desktop layout to use available width: a two-pane study workspace (list on the left, sticky right rail on the right) while preserving the current mobile/tablet stacked flow.

---

## Problem Frame

Today, long saved phrases (e.g., a full sentence selected in the reader) can visually overflow the vocabulary row and extend beyond the viewport. Separately, the desktop layout leaves significant unused space, making the page feel sparse and less “study-workspace” oriented than it could be.

This plan addresses:
- **Layout correctness**: no text escapes the viewport in list or review modes.
- **Desktop UX**: make wide screens feel intentional: faster scanning + persistent progress and actions.

---

## Requirements Trace

- R1. Long `word`, `definition`, `context`, and `bookTitle` content never causes horizontal overflow on `/vocabulary` (list + review).
- R2. Desktop uses a responsive two-pane layout: left list + right sticky study/details panel; mobile/tablet remains stacked.
- R3. Existing interactions remain intact: review flow, filters, edit/delete actions.
- R4. UI communicates mastery status more clearly than “X/Y mastered” alone (lightweight density improvements).

---

## Scope Boundaries

- No changes to how vocabulary items are created/saved from the reader (only how they’re displayed).
- No new persistence fields or schema changes.
- No new global navigation changes; scope is `/vocabulary` only.
- No attempt to build a full spaced-repetition scheduling system beyond the existing mastery levels.
- No changes to filtering/sorting semantics, search behavior, or pagination/virtualization (layout + rendering safety only).
- No keyboard navigation / power-user shortcuts in this pass.
- No new mastery metrics or scoring; “clearer mastery” must reuse existing data and be purely presentational.
- No extraction of a reusable “two-pane workspace” layout abstraction from this work.

---

## Context & Research

### Relevant Code and Patterns

- Vocabulary page + components:
  - `src/app/pages/Vocabulary.tsx`
  - `src/app/components/vocabulary/VocabularyCard.tsx`
  - `src/app/components/vocabulary/ReviewCard.tsx`
  - `src/app/components/vocabulary/EditDialog.tsx`
- Wrapping pattern already used elsewhere:
  - `src/app/components/chat/MessageBubble.tsx` uses `whitespace-pre-wrap break-words`
- Desktop layout pattern inspiration:
  - `src/app/components/settings/layout/SettingsLayout.tsx` (focused max width + two-column structure)
  - `src/app/pages/Courses.tsx` (header/actions row pattern)

### Institutional Learnings

- None required for this change (pure UI layout + defensive text handling).

### External References

- None (existing app patterns are sufficient).

---

## Key Technical Decisions

- **Two-pane on desktop only**: use `lg:` breakpoints to introduce a right rail; keep current stacked layout for smaller screens to avoid rework and preserve touch ergonomics.
- **Defensive text wrapping at render sites**: ensure the specific text nodes (`word`, `definition`, `context`, `bookTitle`) have explicit wrapping/clamping so any future data shape still cannot overflow.
- **Selection-driven rail**: selecting a list row updates the right rail; edit/delete remain explicit actions so “selecting” doesn’t accidentally mutate state.

---

## Open Questions

### Resolved During Planning

- Q1. Desktop direction: **two-pane workspace** (user selected this direction).

### Deferred to Implementation

- Q2. Exact clamp values (e.g., line-clamp-2 vs line-clamp-3) for definition/context: defer to implementation to tune against real content density without over-truncating.
- Q3. Should selection be whole-row click, or a dedicated “details” affordance, to reduce accidental selection? Defer until affordance is chosen.

---

## Implementation Units

- [ ] U1. **Fix overflow and wrapping in `VocabularyCard`**

**Goal:** Prevent long `word` / `definition` / `context` / `bookTitle` from escaping the card bounds.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/components/vocabulary/VocabularyCard.tsx`

**Approach:**
- Ensure the text column is the only element that can shrink (`min-w-0`) and the action buttons never force overflow (`shrink-0`).
- Replace single-line `truncate` on the word with a safer multi-line clamp + wrap strategy (limit height, but never overflow horizontally).
- Apply `break-words` (and where needed `whitespace-normal`) to definition/context/book title lines; consider `line-clamp-*` to keep row height stable on dense lists.

**Patterns to follow:**
- `src/app/components/chat/MessageBubble.tsx` for `break-words` + wrapping approach.

**Test scenarios:**
- Happy path: a normal short word renders unchanged; actions remain accessible.
- Edge case: very long `item.word` (full sentence) stays within the card width (no horizontal scrollbar / no overflow beyond viewport).
- Edge case: long `definition` and long `context` wrap/clamp without pushing buttons offscreen.

**Verification:**
- On desktop width, the scenario from the screenshot stays fully within the viewport and card bounds.

---

- [ ] U2. **Desktop two-pane layout for list mode**

**Goal:** Use desktop width intentionally: list on the left, sticky right rail on the right.

**Requirements:** R2, R3

**Dependencies:** U1

**Files:**
- Modify: `src/app/pages/Vocabulary.tsx`

**Approach:**
- In list mode, wrap the list section and a new rail section in a responsive grid:
  - Mobile/tablet: stacked, current flow preserved.
  - Desktop (`lg+`): `grid-cols-[minmax(0,1fr)_320px]` and widen slightly at `xl`.
- Keep filters and top header consistent; avoid introducing a new page-level max-width unless it improves scanning without harming layout.
- Keep the rail minimal/placeholder in U2 so the layout can land independently of selection behavior.

**Test scenarios:**
- Happy path: mobile layout remains stacked and readable (no rail shown or rail stacks below).
- Integration: desktop shows two columns; right panel stays visible (sticky) while scrolling the list.

**Verification:**
- At `lg` and `xl` widths, content uses space with clear hierarchy and no awkward empty areas.

---

- [ ] U3. **Selected item details + mastery breakdown in right rail**

**Goal:** Make the page feel like a workspace with a focused item inspector (selection-driven details) without changing underlying review logic or store behavior.

**Requirements:** R2, R4

**Dependencies:** U2

**Files:**
- Modify: `src/app/pages/Vocabulary.tsx`

**Approach:**
- Introduce `selectedItemId` state (initialize to first `filteredItems[0]?.id` when available; if filters remove selection, fall back to first item or clear).
- Make selection explicit and low-risk:
  - Prefer a dedicated click target (e.g., main text area selects) rather than making the whole row (including action region) selectable.
  - Keep edit/delete as explicit buttons; ensure their click does not change selection unexpectedly.
- Right rail shows (right-sized):
  - Selected item details: word, definition, context, book title, mastery badge, quick edit/delete.
  - Optional (only if it stays truly “lightweight density”): a compact mastery breakdown that reuses existing data/visuals (no new metrics).
- Defer duplicating the “Review” CTA into the rail unless it demonstrably improves desktop workflow (otherwise it’s extra surface area to maintain/test).
- Empty state for “no selection” or “no items”.

**Test scenarios:**
- Happy path: clicking a row updates the right rail details without navigating.
- Edge case: changing filters that remove the selected item updates selection to the first available item (or clears selection if none).
- Optional integration (only if rail includes a review CTA): “Review” from right rail starts review mode exactly like the top button.

**Verification:**
- Desktop rail content is stable, readable, and improves scanning + actionability vs the current layout without adding new workflows.

---

- [ ] U4. **Review card text safety (no overflow, sane wrapping)**

**Goal:** Ensure review mode cannot overflow with long word/context/definition/note content.

**Requirements:** R1, R3

**Dependencies:** U1 (conceptually; can be implemented independently)

**Files:**
- Modify: `src/app/components/vocabulary/ReviewCard.tsx`

**Approach:**
- Apply `break-words` / wrapping to the relevant text nodes.
- Prefer wrap-first; only clamp if the vertical growth creates a real usability problem (and ensure clamped content remains accessible).
- Consider slightly widening `max-w-md` at desktop breakpoints only if needed.

**Test scenarios:**
- Edge case: extremely long word/context wraps within card bounds on desktop and mobile.
- Edge case: definition and note do not overflow horizontally; vertical layout remains usable.

**Verification:**
- Review mode remains readable for worst-case content and doesn’t create horizontal scrolling.

---

- [ ] U5. **Automated regression coverage (Playwright)**

**Goal:** Lock in the overflow regression and ensure responsive layout doesn’t regress silently.

**Requirements:** R1, R2, R3

**Dependencies:** U1–U4 (or land after the UI is stable)

**Files:**
- Create: `tests/e2e/vocabulary.spec.ts`
- (If needed) Modify: `tests/support/fixtures/local-storage-fixture.ts`

**Approach:**
- Add an e2e spec that seeds a vocabulary item with:
  - very long `word`
  - long `context`
  - long `definition`
- Visit `/vocabulary` and assert:
  - the card is visible
  - layout doesn’t create horizontal scrolling (e.g., `document.documentElement.scrollWidth === document.documentElement.clientWidth`)
  - desktop viewport shows the rail and list concurrently (rail visible)

**Right-sizing note:**
- Keep assertions focused on the reported regression (no horizontal overflow) + presence of the two-pane desktop layout. Avoid brittle pixel-perfect layout assertions.

**Test scenarios:**
- Integration: mobile viewport loads list mode without rail; no horizontal scroll.
- Integration: desktop viewport loads two-pane; no horizontal scroll; rail visible.
- Integration: entering review mode still shows a readable card for the long content.

**Verification:**
- Test passes locally and guards the exact regression reported by the screenshot.

---

## System-Wide Impact

- **Interaction graph:** confined to `/vocabulary` route and its components; no reader behavior changes.
- **State lifecycle risks:** selection state must not get “stuck” when filters change; ensure selection resets predictably.
- **Unchanged invariants:** existing store behavior (`useVocabularyStore`) and review logic remain unchanged; only presentation + local UI state are added.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Over-clamping hides useful meaning for long context/definitions | Tune clamp values during implementation; prefer wrap on details rail where space permits |
| Selection state feels like “click to edit” | Keep edit as explicit icon/button action; selection uses row click with clear affordance (selected styling) |
| Sticky rail interacts poorly with Layout scroll container | Use existing `main` scroll behavior and test at multiple viewport heights |

---

## Sources & References

- Screenshot evidence: **TBD** (not currently checked into the repo). If you add it, prefer a repo-relative path like `docs/assets/<filename>.png` so the reference resolves for all environments.
- Related code: `src/app/pages/Vocabulary.tsx`, `src/app/components/vocabulary/VocabularyCard.tsx`, `src/app/components/vocabulary/ReviewCard.tsx`

---
title: "fix: Vocabulary overflow + desktop two-pane workspace"
type: fix
status: active
date: 2026-04-27
---

# fix: Vocabulary overflow + desktop two-pane workspace

## Overview

Fix long-word/long-context overflow on the Vocabulary page (`/vocabulary`) and redesign desktop layout to use available width: a two-pane study workspace (list on the left, sticky right rail on the right) while preserving the current mobile/tablet stacked flow.

---

## Problem Frame

Today, long saved phrases (e.g., a full sentence selected in the reader) can visually overflow the vocabulary row and extend beyond the viewport. Separately, the desktop layout leaves significant unused space, making the page feel sparse and less “study-workspace” oriented than it could be.

This plan addresses:
- **Layout correctness**: no text escapes the viewport in list or review modes.
- **Desktop UX**: make wide screens feel intentional: faster scanning + persistent progress and actions.

---

## Requirements Trace

- R1. Long `word`, `definition`, `context`, and `bookTitle` content never causes horizontal overflow on `/vocabulary` (list + review).
- R2. Desktop uses a responsive two-pane layout: left list + right sticky study/details panel; mobile/tablet remains stacked.
- R3. Existing interactions remain intact: review flow, filters, edit/delete actions.
- R4. UI communicates mastery status more clearly than “X/Y mastered” alone (lightweight density improvements).

---

## Scope Boundaries

- No changes to how vocabulary items are created/saved from the reader (only how they’re displayed).
- No new persistence fields or schema changes.
- No new global navigation changes; scope is `/vocabulary` only.
- No attempt to build a full spaced-repetition scheduling system beyond the existing mastery levels.
- No changes to filtering/sorting semantics, search behavior, or pagination/virtualization (layout + rendering safety only).
- No new power-user shortcuts in this pass (but selection must remain accessible with basic keyboard interaction if rows become interactive).
- No new mastery metrics or scoring; “clearer mastery” must reuse existing data and be purely presentational.
- No extraction of a reusable “two-pane workspace” layout abstraction from this work.

---

## Context & Research

### Relevant Code and Patterns

- Vocabulary page + components:
  - `src/app/pages/Vocabulary.tsx`
  - `src/app/components/vocabulary/VocabularyCard.tsx`
  - `src/app/components/vocabulary/ReviewCard.tsx`
  - `src/app/components/vocabulary/EditDialog.tsx`
- Wrapping pattern already used elsewhere:
  - `src/app/components/chat/MessageBubble.tsx` uses `whitespace-pre-wrap break-words`
- Desktop layout pattern inspiration:
  - `src/app/components/settings/layout/SettingsLayout.tsx` (focused max width + two-column structure)
  - `src/app/pages/Courses.tsx` (header/actions row pattern)

### Institutional Learnings

- None required for this change (pure UI layout + defensive text handling).

### External References

- None (existing app patterns are sufficient).

---

## Key Technical Decisions

- **Two-pane on desktop only**: use `lg:` breakpoints to introduce a right rail; keep current stacked layout for smaller screens to avoid rework and preserve touch ergonomics.
- **Defensive text wrapping at render sites**: ensure the specific text nodes (`word`, `definition`, `context`, `bookTitle`) have explicit wrapping/clamping so any future data shape still cannot overflow.
- **Selection-driven rail**: selecting a list row updates the right rail; edit/delete remain explicit actions so “selecting” doesn’t accidentally mutate state.
- **Text safety policy by surface**:
  - **List rows**: keep rows compact; wrap reliably and clamp only when helpful for height consistency.
  - **Right rail details**: prefer full wrapping for `word` and `bookTitle`; clamp only secondary fields if needed.
  - **Review card**: always wrap (no horizontal overflow); clamp only if vertical growth becomes unusable.

---

## Open Questions

### Resolved During Planning

- Q1. Desktop direction: **two-pane workspace** (user selected this direction).

### Deferred to Implementation

- Q2. Exact clamp values (e.g., line-clamp-2 vs line-clamp-3) for definition/context: defer to implementation to tune against real content density without over-truncating.
- Q3. Should selection be whole-row click, or a dedicated “details” affordance, to reduce accidental selection? Defer until affordance is chosen.

---

## Implementation Units

- [ ] U1. **Fix overflow and wrapping in `VocabularyCard`**

**Goal:** Prevent long `word` / `definition` / `context` / `bookTitle` from escaping the card bounds.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/app/components/vocabulary/VocabularyCard.tsx`

**Approach:**
- Ensure the text column is the only element that can shrink (`min-w-0`) and the action buttons never force overflow (`shrink-0`).
- Replace single-line `truncate` on the word with a safer multi-line clamp + wrap strategy (limit height, but never overflow horizontally).
- Apply `break-words` (and where needed `whitespace-normal`) to definition/context/book title lines; consider `line-clamp-*` to keep row height stable on dense lists.
- If a truly unbroken token still overflows, use Tailwind’s arbitrary property escape hatch on the text node: `"[overflow-wrap:anywhere]"`.

**Patterns to follow:**
- `src/app/components/chat/MessageBubble.tsx` for `break-words` + wrapping approach.

**Test scenarios:**
- Happy path: a normal short word renders unchanged; actions remain accessible.
- Edge case: very long `item.word` (full sentence) stays within the card width (no horizontal scrollbar / no overflow beyond viewport).
- Edge case: long `definition` and long `context` wrap/clamp without pushing buttons offscreen.

**Verification:**
- On desktop width, the scenario from the screenshot stays fully within the viewport and card bounds.

---

- [ ] U2. **Desktop two-pane layout for list mode**

**Goal:** Use desktop width intentionally: list on the left, sticky right rail on the right.

**Requirements:** R2, R3

**Dependencies:** U1

**Files:**
- Modify: `src/app/pages/Vocabulary.tsx`

**Approach:**
- In list mode, wrap the list section and a new rail section in a responsive grid:
  - Mobile/tablet: stacked, current flow preserved.
  - Desktop (`lg+`): `grid-cols-[minmax(0,1fr)_320px]` and widen slightly at `xl`.
- Keep filters and top header consistent; avoid introducing a new page-level max-width unless it improves scanning without harming layout.
- Keep the rail minimal/placeholder in U2 so the layout can land independently of selection behavior.
- Sticky rail constraints:
  - Keep the rail inside the page scroll container and use a predictable top offset (e.g., `lg:sticky lg:top-6`).
  - Add a desktop max-height + internal scroll so the rail remains usable on short viewports (exact calc can be tuned during implementation).

**Test scenarios:**
- Happy path: mobile layout remains stacked and readable (no rail shown or rail stacks below).
- Integration: desktop shows two columns; right panel stays visible (sticky) while scrolling the list.

**Verification:**
- At `lg` and `xl` widths, content uses space with clear hierarchy and no awkward empty areas.

---

- [ ] U3. **Selected item details + mastery breakdown in right rail**

**Goal:** Make the page feel like a workspace with a focused item inspector (selection-driven details) without changing underlying review logic or store behavior.

**Requirements:** R2, R4

**Dependencies:** U2

**Files:**
- Modify: `src/app/pages/Vocabulary.tsx`

**Approach:**
- Introduce `selectedItemId` state (initialize to first `filteredItems[0]?.id` when available; if filters remove selection, fall back to first item or clear).
- Make selection explicit and low-risk:
  - Prefer a dedicated click target (e.g., main text area selects) rather than making the whole row (including action region) selectable.
  - Keep edit/delete as explicit buttons; ensure their click does not change selection unexpectedly.
- If rows become interactive elements, keep basic accessibility intact (focusable + Enter/Space activates selection) and expose selection state via ARIA (`aria-selected` or `aria-current`).
- Right rail shows (right-sized):
  - Selected item details: word, definition, context, book title, mastery badge, quick edit/delete.
  - Optional (only if it stays truly “lightweight density”): a compact mastery breakdown that reuses existing data/visuals (no new metrics).
- Defer duplicating the “Review” CTA into the rail unless it demonstrably improves desktop workflow (otherwise it’s extra surface area to maintain/test).
- Empty state for “no selection” or “no items”.

**Test scenarios:**
- Happy path: clicking a row updates the right rail details without navigating.
- Edge case: changing filters that remove the selected item updates selection to the first available item (or clears selection if none).
- Optional integration (only if rail includes a review CTA): “Review” from right rail starts review mode exactly like the top button.

**Verification:**
- Desktop rail content is stable, readable, and improves scanning + actionability vs the current layout without adding new workflows.

---

- [ ] U4. **Review card text safety (no overflow, sane wrapping)**

**Goal:** Ensure review mode cannot overflow with long word/context/definition/note content.

**Requirements:** R1, R3

**Dependencies:** U1 (conceptually; can be implemented independently)

**Files:**
- Modify: `src/app/components/vocabulary/ReviewCard.tsx`

**Approach:**
- Apply `break-words` / wrapping to the relevant text nodes.
- Prefer wrap-first; only clamp if the vertical growth creates a real usability problem (and ensure clamped content remains accessible).
- Consider slightly widening `max-w-md` at desktop breakpoints only if needed.

**Test scenarios:**
- Edge case: extremely long word/context wraps within card bounds on desktop and mobile.
- Edge case: definition and note do not overflow horizontally; vertical layout remains usable.

**Verification:**
- Review mode remains readable for worst-case content and doesn’t create horizontal scrolling.

---

- [ ] U5. **Automated regression coverage (Playwright)**

**Goal:** Lock in the overflow regression and ensure responsive layout doesn’t regress silently.

**Requirements:** R1, R2, R3

**Dependencies:** U1–U4 (or land after the UI is stable)

**Files:**
- Create: `tests/e2e/vocabulary.spec.ts`
- Reference: `tests/support/helpers/indexeddb-seed.ts` (existing `seedVocabularyItems`)
- Reference: `tests/support/helpers/navigation.ts` (existing navigation helpers)

**Approach:**
- Add an e2e spec that uses the existing IndexedDB seeding helpers (no fixture changes) to seed a vocabulary item with:
  - very long `word`
  - long `context`
  - long `definition`
- Visit `/vocabulary` and assert:
  - the card is visible
  - layout doesn’t create horizontal scrolling (e.g., `document.documentElement.scrollWidth === document.documentElement.clientWidth`)
  - desktop viewport shows the rail and list concurrently (rail visible)
- Prefer a stable selector for the rail (add `data-testid="vocabulary-rail"` during implementation) rather than matching on layout text.

**Right-sizing note:**
- Keep assertions focused on the reported regression (no horizontal overflow) + presence of the two-pane desktop layout. Avoid brittle pixel-perfect layout assertions.

**Test scenarios:**
- Integration: mobile viewport loads list mode without rail; no horizontal scroll.
- Integration: desktop viewport loads two-pane; no horizontal scroll; rail visible.
- Integration: entering review mode still shows a readable card for the long content.

**Verification:**
- Test passes locally and guards the exact regression reported by the screenshot.

---

## System-Wide Impact

- **Interaction graph:** confined to `/vocabulary` route and its components; no reader behavior changes.
- **State lifecycle risks:** selection state must not get “stuck” when filters change; ensure selection resets predictably.
- **Unchanged invariants:** existing store behavior (`useVocabularyStore`) and review logic remain unchanged; only presentation + local UI state are added.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Over-clamping hides useful meaning for long context/definitions | Tune clamp values during implementation; prefer wrap on details rail where space permits |
| Selection state feels like “click to edit” | Keep edit as explicit icon/button action; selection uses row click with clear affordance (selected styling) |
| Sticky rail interacts poorly with Layout scroll container | Use existing `main` scroll behavior and test at multiple viewport heights |

---

## Sources & References

- Screenshot evidence: **TBD** (not currently checked into the repo). If you add it, prefer a repo-relative path like `docs/assets/<filename>.png` so the reference resolves for all environments.
- Related code: `src/app/pages/Vocabulary.tsx`, `src/app/components/vocabulary/VocabularyCard.tsx`, `src/app/components/vocabulary/ReviewCard.tsx`
