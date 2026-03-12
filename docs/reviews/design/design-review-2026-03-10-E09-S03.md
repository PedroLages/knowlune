# Design Review: E09-S03 — Embedding Pipeline and Vector Store

**Date:** 2026-03-10
**Branch:** feature/e09-s03-embedding-pipeline-and-vector-store
**Reviewer:** design-review agent (Playwright MCP)
**URL Tested:** http://localhost:5173/notes
**Viewports:** 375px (mobile), 768px (tablet), 1440px (desktop)

---

## UI Changes Reviewed

- Semantic search toggle added to the Notes page search bar
- Similarity score badges shown on search results when semantic search is active
- Info tooltip shown when semantic toggle is disabled (no embeddings)

---

## Findings

### Blocker

**[BLOCKER] src/app/pages/Notes.tsx — Info icon not keyboard-reachable (confidence: 92)**
The info icon used as the tooltip trigger is rendered as a plain `<svg>` (or non-interactive element) with no `button` wrapper and no `tabindex`. It is unreachable via keyboard navigation, violating WCAG 2.1 AA (SC 2.1.1 Keyboard, SC 4.1.2 Name, Role, Value).
Fix: Wrap the info icon in `<button>` or add `role="button" tabIndex={0}` with `onKeyDown` handler, and add `aria-label="Semantic search unavailable: no embeddings yet"`.

### High Priority

**[HIGH] src/app/pages/Notes.tsx:305,451 — Hardcoded `bg-blue-600` colors (confidence: 88)**
The semantic toggle active state uses `bg-blue-600` instead of the `bg-brand` design token. This bypasses the theme system and is inconsistent with how other interactive elements in the app handle active states.
Fix: Replace `bg-blue-600`/`hover:bg-blue-700` with `bg-brand`/`hover:bg-brand-hover`.

**[HIGH] src/app/pages/Notes.tsx — Info icon touch target 14×14px (confidence: 85)**
The info icon (tooltip trigger) is approximately 14×14px, well below the 44×44px minimum touch target required for mobile (WCAG 2.5.5). At 375px viewport this is especially problematic.
Fix: Wrap in a `<button>` with `p-2` padding to reach a 30×30px minimum clickable area (or add `min-w-[44px] min-h-[44px]` for full compliance).

### Medium

**[MEDIUM] Mobile 375px — Search input squeezed by toggle addition (confidence: 75)**
At 375px, the search row contains the input + semantic toggle side-by-side. The input shrinks to approximately 180px, making it awkward to type longer queries. The toggle label "Semantic" also truncates.
Fix: On mobile, stack the toggle below the search input, or abbreviate to an icon-only toggle with a tooltip at narrow widths.

**[MEDIUM] Disabled label opacity inconsistency (confidence: 70)**
When the toggle is disabled (no embeddings), the "Semantic" label text is not visually dimmed to match the disabled toggle. Other disabled elements in the app use `opacity-50` consistently.
Fix: Apply `opacity-50` to the entire toggle + label container when `!semanticSearchAvailable`.

### Nits

- **[NIT]** Tooltip message "No embeddings available" is technically accurate but gives no action guidance. Consider "Index some notes first to enable semantic search" or similar affordance text.
- **[NIT]** Similarity badge uses `ml-auto` for right-alignment, which is layout-order sensitive. If note card content changes order, the badge may mis-align. Consider `flex justify-between` on the card row instead.

---

## Summary

| Severity | Count |
|----------|-------|
| Blocker  | 1     |
| High     | 2     |
| Medium   | 2     |
| Nit      | 2     |
| **Total**| **7** |

**Critical path:** Fix the keyboard-inaccessible info icon (Blocker), then the hardcoded color tokens (High, also flagged by code review). The Blocker and both Highs are on the same element — fixing with a proper `<button>` wrapper resolves all three simultaneously.
