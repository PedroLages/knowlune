---
date: "2026-04-28"
topic: "library-page-organization"
focus: "information architecture and organization for the Library page"
recovered: true
recovery_note: "Recreated by agent after accidental deletion; content may not match original verbatim."
---

# Ideation: Library Page — Organization & Information Architecture

## Goal

Make the Library page easier to navigate as the collection grows by clarifying:

- **Primary navigation** (what are the top-level ways to browse?)
- **Secondary organization** (filters, sorting, groupings)
- **Progress + intent** (what am I reading now vs later vs done?)

## Current pain (hypotheses)

- Too many entry points (grid/list/collections/shelves) without a clear “default” mental model
- “What should I do next?” is not obvious from the Library landing experience
- Filters are powerful but feel like a separate mode, not part of browsing

## Proposed top-level structure (one clear default)

### 1) Continue (default view)

The “you probably came here to do this” section:

- Continue Reading / Listening
- Reading Queue
- Recently opened
- In-progress grouped by **format** (Books vs Audiobooks) only if it materially reduces clutter

### 2) Browse

Exploration without committing:

- All items (grid/list)
- Quick filters (format, status, tags, author)
- Sort controls (recent, title, author, progress, rating)

### 3) Collections

Curated groupings:

- Collections / shelves (user-defined)
- Smart shelves (rules-based) if they exist

### 4) History / Insights (optional)

If already supported by data:

- Finished items
- Streak / time spent reading
- Recently added

## Status model (make it explicit)

Standardize a simple set of statuses the UI always reflects:

- **In progress**
- **Queued / Want to read**
- **Finished**
- **Paused / DNF** (only if it exists in data model)

Every UI grouping should map to these statuses rather than inventing ad-hoc buckets.

## Filter & sort UX principles

- **Filters are always visible** (or one click away), but never feel like a modal “power user” feature.
- **Chips for active filters** at the top of results; one-click remove.
- **Persist last-used view** (Continue vs Browse) per user, not per session, unless there’s a strong reason not to.

## Library page layout sketch

1. Header: search + quick actions (import/add)
2. Segmented control: **Continue | Browse | Collections | History**
3. For Browse:
   - Left: filters
   - Top: sort + view mode (grid/list)
   - Main: results
4. For Continue:
   - Cards optimized for resuming (progress, next chapter, last listened)

## “Next best action” (lightweight)

Use simple heuristics, no heavy AI:

- If there’s an in-progress item: promote it
- Else if queue has items: promote top of queue
- Else: show “Recently added” as the default browsing seed

## Open questions

- Should **Collections** be first-class navigation or a Browse filter?
- Should **format** (Book vs Audiobook) be a top-level split or a filter?
- Do we want “Library” to be a **single page** or a **mini-hub** with 3–4 stable tabs?

