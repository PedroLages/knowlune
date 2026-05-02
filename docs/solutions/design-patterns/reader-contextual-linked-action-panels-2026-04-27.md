---
title: "Reader contextual linked actions should inspect in place"
date: 2026-04-27
category: design-patterns
module: reader
problem_type: design_pattern
component: frontend_stimulus
severity: medium
applies_when:
  - "A reader toolbar action refers to data linked to the selected passage"
  - "The action can resolve to create, view, missing, loading, or error states"
  - "Leaving the reader would break reading context or make the action feel inert"
tags: [reader, highlights, flashcards, contextual-actions, async-state, accessibility]
related_components: [BookReader, HighlightLayer, HighlightMiniPopover, HighlightListPanel]
---

# Reader contextual linked actions should inspect in place

## Context

The reader highlight toolbar had a stack icon for flashcard actions. Creating a new flashcard worked, but when a highlight already had a linked flashcard, the “view linked flashcard” path was stubbed and simply closed the menu. That made the icon feel broken.

The fix was not to navigate to the global `/flashcards` review page. The stack icon is contextual to the highlighted passage, so the reader should keep the user in place and inspect the exact linked card inside the reader.

## Guidance

When a reader action points to data linked to the current passage, keep the interaction local to the reader unless the user explicitly asks to enter a broader workflow.

For linked flashcards, this means:

1. Use the highlight’s direct `flashcardId` to resolve the exact card.
2. Open a reader-local panel/sheet with the card’s front and back.
3. Preserve the existing create flow when no `flashcardId` exists.
4. Treat missing records and load failures as different states.
5. Expose the same linked-card behavior from every matching surface, not only the floating toolbar.

The key split is product-level:

```text
highlight has no flashcardId  -> create cloze flashcard
highlight has flashcardId     -> inspect linked card in reader
flashcardId resolves missing  -> show stale-link/missing state
lookup rejects                -> show retryable load-error state
```

Avoid wiring a contextual “view” action to a broad destination like `/flashcards`. That page is a review workspace, not an exact-card inspector, and it breaks the reading flow.

## Why This Matters

Reader toolbars need immediate feedback. If an icon closes a menu or routes somewhere generic, users perceive it as broken even when the data model is technically correct.

This pattern also prevents duplicate creation bugs. The highlight list already labeled linked cards as “View linked flashcard,” but its callback still opened the create-card flow. The label and behavior diverged, so a linked highlight could start a duplicate flashcard creation path. Every surface with the same label must share the same branch:

- linked highlight → view/inspect
- unlinked highlight → create

Async state needs the same precision. A missing linked card is a stale relationship; a rejected lookup is a temporary failure. Showing the same “not found” UI for both hides useful recovery information. Missing records can be explained; load failures should offer retry.

## When to Apply

- Adding icon-only reader toolbar actions.
- Adding linked-data actions from highlights, annotations, bookmarks, or vocabulary items.
- Reviewing a feature where a label says “View” but the callback still creates, navigates broadly, or no-ops.
- Handling local IndexedDB lookups that can resolve missing data or reject independently.

## Examples

**Before — linked action closes or starts the wrong flow:**

```tsx
onViewFlashcard={() => {
  // stub: user sees nothing happen
  setMiniPopover(null)
}}

const handleFlashcard = (highlight: BookHighlight) => {
  // wrong for linked highlights: label says "View" but this opens creation
  onFlashcardRequest?.(highlight.textAnchor, highlight.id)
}
```

**After — linked and unlinked states branch explicitly:**

```tsx
const handleFlashcard = (highlight: BookHighlight) => {
  onClose()
  if (highlight.flashcardId) {
    onLinkedFlashcardRequest?.(highlight)
    return
  }
  onFlashcardRequest?.(highlight.textAnchor, highlight.id)
}
```

**After — local reader panel resolves exact card by `flashcardId`:**

```tsx
setLinkedFlashcardOpen(true)
setLinkedFlashcardLoading(true)
setLinkedFlashcardError(false)

loadLinkedFlashcard(highlight, id => db.flashcards.get(id))
  .then(card => setLinkedFlashcard(card))
  .catch(() => setLinkedFlashcardError(true))
  .finally(() => setLinkedFlashcardLoading(false))
```

Guard async lookups with a request id or equivalent cancellation token. Invalidate pending lookups when the panel closes, the book changes, or the reader unmounts so stale results cannot update the wrong reader state.

## Related

- `docs/solutions/sync/e93-s02-notes-bookmarks-sync-wiring-2026-04-18.md` — async state and stale closure cautions.
- `docs/solutions/best-practices/wcag-target-size-audit-2026-04-25.md` — target-size expectations for small toolbar controls.
- `docs/solutions/best-practices/extract-shared-primitive-on-second-consumer-2026-04-18.md` — related caution on when to extract shared UI primitives.
