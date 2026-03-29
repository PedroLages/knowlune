---
story_id: E75-S02
story_name: "Readwise Export Mapping Configuration"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 75.2: Readwise Export Mapping Configuration

Status: ready-for-dev

## Story

As a learner with a connected Readwise account,
I want to configure which highlights and bookmarks to export,
So that I control what appears in my Readwise library.

## Acceptance Criteria

**Given** the user has a connected Readwise integration and clicks "Configure Export"
**When** the Export Mapping dialog opens for Readwise
**Then** smart defaults are pre-selected: Highlights enabled, Bookmarks enabled, Notes disabled, Flashcards disabled
**And** the disabled entity types show a tooltip: "Notes and flashcards are better suited for Notion export"

**Given** the user toggles entity types for Readwise
**When** enabling or disabling Highlights or Bookmarks
**Then** the toggle state updates immediately
**And** the same course filter controls are available (All courses / Selected courses with searchable checkbox list)

**Given** the user configures a tag prefix
**When** entering a value in the optional "Tag prefix" field (e.g., "knowlune/")
**Then** the prefix will be prepended to all tags synced to Readwise
**And** the default value is empty (no prefix)

**Given** the user saves Readwise export mapping
**When** clicking "Save"
**Then** the configuration is persisted in Dexie
**And** a toast displays "Export mapping saved"

**Given** the source-of-truth warning is required
**When** viewing the Readwise connected card or export mapping dialog
**Then** the warning "Knowlune is the source of truth. Changes made directly in Readwise will be overwritten on the next sync." is displayed

## Tasks / Subtasks

- [ ] Task 1: Extend `ExportMappingConfig` type for Readwise-specific fields (AC: 1, 3)
  - [ ] 1.1 Add `tagPrefix` optional string field
  - [ ] 1.2 Add `disabledEntityTypes` with tooltips for Notes/Flashcards
- [ ] Task 2: Create `ReadwiseExportMappingDialog` component (AC: 1, 2, 3, 4)
  - [ ] 2.1 Entity type toggles with Switch components (Highlights, Bookmarks enabled; Notes, Flashcards disabled with tooltip)
  - [ ] 2.2 Course filter controls — "All courses" / "Selected courses" with searchable checkbox list in ScrollArea
  - [ ] 2.3 Tag prefix input field with placeholder example
  - [ ] 2.4 Save button with dirty state detection (enabled only when config differs)
  - [ ] 2.5 Persist via provider's `updateExportMapping` method on save
- [ ] Task 3: Reuse shared Export Mapping components from E74-S03 (AC: 2)
  - [ ] 3.1 Extract `CourseFilterSelector` if not already shared
  - [ ] 3.2 Extract `EntityTypeToggleRow` if not already shared
  - [ ] 3.3 Ensure independent config per provider (Notion vs Readwise)
- [ ] Task 4: Add source-of-truth warning to Readwise card and dialog (AC: 5)
  - [ ] 4.1 Warning text in `text-xs text-warning` style
- [ ] Task 5: Implement `ReadwiseProvider.updateExportMapping()` and `getExportMapping()` (AC: 4)
  - [ ] 5.1 Dexie persistence for Readwise-specific export config
  - [ ] 5.2 Default config initialization on first access
- [ ] Task 6: Wire "Configure Export" button on ReadwiseIntegrationCard to dialog (AC: 1)
- [ ] Task 7: Unit tests (AC: all)
  - [ ] 7.1 Default smart defaults (Highlights+Bookmarks on, Notes+Flashcards off)
  - [ ] 7.2 Toggle state changes and dirty detection
  - [ ] 7.3 Tag prefix persistence
  - [ ] 7.4 Course filter selection and validation (empty selection blocked)
  - [ ] 7.5 Independent config per provider
- [ ] Task 8: E2E test spec (AC: 1, 2, 3, 4)
  - [ ] 8.1 Dialog opens with correct defaults
  - [ ] 8.2 Toggle and save flow
  - [ ] 8.3 Course filter interaction
  - [ ] 8.4 Tag prefix entry and persistence

## Design Guidance

- Reuse Export Mapping dialog pattern from E74-S03 (Notion) — same layout, different defaults
- Use shadcn/ui `Dialog`, `Switch`, `ScrollArea`, `Input`, `Button` (variant="brand"), `Tooltip`
- Disabled entity types: Switch in disabled state + Tooltip on hover explaining why
- Tag prefix: `Input` with `placeholder="e.g., knowlune/"` and helper text below
- Source-of-truth warning: `text-xs text-warning` at bottom of card and dialog
- Design tokens: no hardcoded colors — use `text-muted-foreground`, `text-warning`, `bg-brand-soft`
- Accessibility: `role="group"` and `aria-label="Select courses to export"` on course list, tooltips accessible via keyboard

## Implementation Notes

- Export mapping config stored per-provider in Dexie — Readwise config independent of Notion config
- Smart defaults reflect Readwise's strength (highlights/bookmarks) vs Notion's (notes/flashcards)
- Tag prefix is stored in config and applied at sync time (E75-S03), not at config save time
- Reuse `CourseFilterSelector` and `EntityTypeToggleRow` components from E74-S03 if already extracted

## Testing Notes

- Verify defaults render correctly on first open (no prior config)
- Test that saving with empty course selection shows validation error
- Verify tag prefix is stored and retrievable
- Confirm Notion and Readwise configs are fully independent

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
