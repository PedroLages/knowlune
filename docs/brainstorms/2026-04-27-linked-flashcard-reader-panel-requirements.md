---
date: 2026-04-27
topic: linked-flashcard-reader-panel
---

# Linked Flashcard Reader Panel

## Problem Frame

The reader toolbar uses a stack icon for flashcard actions. When a highlight already has a linked flashcard, the icon should do more than close the menu or route vaguely to `/flashcards`; it should help the reader inspect the exact card tied to the passage without losing reading context.

---

## Actors

- A1. Reader: reviews a highlighted passage while reading and wants to understand or manage its linked flashcard.
- A2. Flashcard system: stores book-sourced flashcards with `sourceHighlightId` and review metadata.

---

## Key Flows

- F1. View linked flashcard from reader
  - **Trigger:** A reader clicks the stack icon on a highlight that has `flashcardId`.
  - **Actors:** A1, A2
  - **Steps:** Keep the user in the reader, open a contextual panel, show the linked flashcard front/back and enough metadata to recognize it, and provide a clear close path back to the book.
  - **Outcome:** The reader understands which flashcard is linked without navigating away from the passage.
  - **Covered by:** R1, R2, R3, R4

- F2. Create flashcard from reader
  - **Trigger:** A reader clicks the stack icon on a highlight without `flashcardId`.
  - **Actors:** A1, A2
  - **Steps:** Keep the existing cloze creation flow and link the created flashcard back to the source highlight.
  - **Outcome:** Existing creation behavior remains intact.
  - **Covered by:** R5

---

## Requirements

- R1. When the stack icon is clicked for a highlight with a linked flashcard, the app opens an in-reader panel or sheet for that exact flashcard instead of navigating to the general flashcards page.
- R2. The panel shows the linked flashcard’s front and back content, so the user can verify what the card asks and answers.
- R3. The panel has an obvious close action that returns the reader to the same passage and does not disturb reader position.
- R4. If the linked flashcard cannot be found, the UI explains that the linked card is missing or unavailable and does not silently fail.
- R5. When the highlight has no linked flashcard, the existing create-flashcard flow remains unchanged.
- R6. The stack icon should communicate its state with accessible labels: create when no card exists, view linked card when a card exists.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R3.** Given a highlighted passage has `flashcardId`, when the reader clicks the stack icon, a panel opens in the reader showing the linked card front/back and can be closed without leaving the book.
- AE2. **Covers R4.** Given a highlighted passage references a missing flashcard, when the reader clicks the stack icon, the app shows a recoverable “linked flashcard not found” state instead of doing nothing.
- AE3. **Covers R5.** Given a highlighted passage has no `flashcardId`, when the reader clicks the stack icon, the existing cloze creator opens.

---

## Success Criteria

- The stack icon never appears to do nothing.
- Readers can inspect a linked flashcard without losing their reading location.
- Planning does not need to invent destination behavior for linked flashcards.

---

## Scope Boundaries

- Do not build a full flashcard review session inside the reader.
- Do not change FSRS scheduling or review queue ordering.
- Do not replace the `/flashcards` page or its existing source back-navigation.
- Editing the linked flashcard can be deferred unless it is already available at low cost in the existing UI.

---

## Key Decisions

- Use an in-reader panel rather than navigation to `/flashcards`: this preserves reading flow and matches the contextual nature of the toolbar.
- Keep creation and viewing as separate states behind the same stack icon: one icon remains meaningful while behavior depends on whether a card exists.

---

## Dependencies / Assumptions

- Book-sourced flashcards already carry `sourceHighlightId`; highlights already carry `flashcardId`.
- The flashcard content needed for display is available locally through existing flashcard storage.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Technical] Decide whether the detail panel should reuse an existing flashcard card component or render a reader-specific compact view.
- [Affects R4][Technical] Decide whether missing linked flashcards should offer an unlink/recreate affordance in v1.

---

## Next Steps

-> /ce-plan for structured implementation planning.
