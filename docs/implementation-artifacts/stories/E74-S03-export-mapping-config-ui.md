---
story_id: E74-S03
story_name: "Export Mapping Configuration UI"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 74.3: Export Mapping Configuration UI

## Story

As a learner with a connected Notion account,
I want to configure which types of learning data to export and from which courses,
so that I only sync the content I actually want in my Notion workspace without cluttering it with unwanted data.

## Acceptance Criteria

**Given** the user has a connected Notion integration and clicks "Configure Export"
**When** the Export Mapping dialog opens
**Then** smart defaults are pre-selected: Notes enabled, Flashcards enabled, Bookmarks disabled, Highlights disabled
**And** each entity type row shows a Switch toggle with the entity type name and a brief description

**Given** the user views entity type toggles
**When** toggling an entity type on or off
**Then** the toggle immediately reflects the change in the dialog state
**And** the "Save" button is enabled when the configuration differs from the current saved state

**Given** the user wants to export from specific courses only
**When** the user changes the course filter from "All courses" to "Selected courses" for an entity type
**Then** a searchable checkbox list of all courses appears within a ScrollArea
**And** "Select all" and "Deselect all" controls are available
**And** each checkbox is properly labeled with `role="group"` and `aria-label="Select courses to export"`
**And** if the user selects "Selected courses" but leaves the list empty, a validation error prevents saving: "Select at least one course to sync"

**Given** the user saves the export mapping configuration
**When** the user clicks "Save"
**Then** the `ExportMappingConfig` is persisted in Dexie via the provider's `updateExportMapping` method
**And** a toast displays "Export mapping saved"
**And** the dialog closes

**Given** the user is connected to both Notion and Readwise
**When** configuring export mapping for each service
**Then** each service has its own independent export mapping configuration
**And** the same entity type can be enabled for both services simultaneously

**Given** the source-of-truth warning needs to be visible
**When** the user views any connected integration card or the export mapping dialog
**Then** the warning text "Knowlune is the source of truth. Changes made directly in Notion will be overwritten on the next sync." is displayed in `text-xs text-warning`

## Tasks / Subtasks

- [ ] Task 1: Create ExportMappingDialog component (AC: 1, 2)
  - [ ] 1.1 Create `src/app/components/settings/ExportMappingDialog.tsx` with Dialog shell, header ("Export Configuration -- {ServiceName}"), and footer (Cancel + Save)
  - [ ] 1.2 Implement entity type rows with Switch toggles: Notes, Flashcards, Bookmarks, Highlights
  - [ ] 1.3 Add brief description per entity type (e.g., "Notes -> Knowlune Notes database")
  - [ ] 1.4 Implement smart defaults per provider: Notion (Notes ON, Flashcards ON, Bookmarks OFF, Highlights OFF)
  - [ ] 1.5 Track dirty state: enable Save button only when config differs from saved state

- [ ] Task 2: Implement course filter (AC: 3)
  - [ ] 2.1 Add RadioGroup: "All courses" / "Selected courses only"
  - [ ] 2.2 Implement searchable checkbox list within ScrollArea (max-h-48)
  - [ ] 2.3 Add "Select all" / "Deselect all" controls
  - [ ] 2.4 Wire course list to Dexie courses query
  - [ ] 2.5 Add validation: prevent save if "Selected courses" chosen but none selected

- [ ] Task 3: Implement persistence (AC: 4)
  - [ ] 3.1 Wire Save button to provider's `updateExportMapping()` method (persists to Dexie)
  - [ ] 3.2 Load existing config on dialog open via provider's `getExportMapping()`
  - [ ] 3.3 Show toast on save success, close dialog

- [ ] Task 4: Support independent per-service configs (AC: 5)
  - [ ] 4.1 ExportMappingDialog accepts `providerId` prop to scope configuration
  - [ ] 4.2 Each provider stores its own `ExportMappingConfig` keyed by provider in Dexie

- [ ] Task 5: Source-of-truth warning (AC: 6)
  - [ ] 5.1 Add warning Alert at bottom of dialog: "Knowlune is the source of truth. Changes made directly in {ServiceName} will be overwritten on the next sync."
  - [ ] 5.2 Ensure warning also appears on connected IntegrationCard (from E74-S02)

- [ ] Task 6: Accessibility (AC: 3)
  - [ ] 6.1 `role="group"` and `aria-label="Select courses to export"` on course checkbox group
  - [ ] 6.2 Proper label associations for all switches and checkboxes
  - [ ] 6.3 Focus trap in dialog (built into Radix UI Dialog)
  - [ ] 6.4 Keyboard navigation through all form controls

- [ ] Task 7: Tests (AC: all)
  - [ ] 7.1 Unit tests: smart defaults per provider, dirty state tracking, validation (empty course selection)
  - [ ] 7.2 E2E tests: open dialog, toggle entity types, search courses, save config, verify toast

## Design Guidance

**Layout:** Dialog (size="lg") with sections: "What to export" (Switch rows), separator, "Which courses" (RadioGroup + conditional course list), separator, source-of-truth warning.

**Components:** Dialog, DialogHeader, DialogContent, DialogFooter, Switch, RadioGroup, Checkbox, ScrollArea, Input (search), Button (brand for Save, ghost for Cancel), Alert (warning variant), Separator, Label

**Responsive:** On mobile (< 640px), dialog opens as Sheet (bottom drawer) instead of centered Dialog. Course list takes full width.

**Design tokens:** `text-warning` for source-of-truth warning, `text-muted-foreground` for entity descriptions, `variant="brand"` for Save button.

**Typography:** Section headers `text-sm font-semibold`, entity descriptions `text-xs text-muted-foreground`, warning text `text-xs text-warning`.

## Implementation Notes

- ExportMappingDialog is shared between Notion and Readwise (E75 will reuse it with different smart defaults).
- Course list comes from existing Dexie courses table.
- `ExportMappingConfig` type defined in E74-S01 (`src/services/integrations/types.ts`).

## Testing Notes

E2E tests should verify: dialog opens from "Configure Export" button, smart defaults are correct, toggling switches works, course search filters the list, validation prevents empty course selection, save persists and closes dialog.

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing -- catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence -- state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md CSP Configuration)

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
