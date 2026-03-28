---
story_id: E51-S01
story_name: "Settings Infrastructure & Display Section Shell"
status: done
started: 2026-03-28
completed: 2026-03-28
reviewed: true
review_started: 2026-03-28
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, performance-benchmark, security-review, exploratory-qa]
review_scope: full
burn_in_validated: false
---

# Story 51.1: Settings Infrastructure & Display Section Shell

## Story

As a learner,
I want a "Display & Accessibility" section on the Settings page with reset-to-defaults,
so that I have a dedicated place to control how content looks and moves.

## Acceptance Criteria

**Given** a user on the Settings page
**When** they scroll past the Age Range section
**Then** they see a "Display & Accessibility" section with Eye icon, title "Display & Accessibility", and description "Customize how content looks and moves"

**Given** the Display & Accessibility section is visible
**When** the user clicks "Reset display settings to defaults"
**Then** an AlertDialog appears with title "Reset display settings?" and description "This will reset accessibility font, spacious mode, and motion preference to their default values."

**Given** the reset confirmation dialog is open
**When** the user clicks "Reset"
**Then** accessibilityFont reverts to false, contentDensity to 'default', reduceMotion to 'system'
**And** a toast confirms "Display settings reset to defaults"

**Given** a fresh app with no saved settings
**When** getSettings() is called
**Then** accessibilityFont is false, contentDensity is 'default', and reduceMotion is 'system'

**Given** the section on mobile (<640px)
**When** viewed
**Then** all controls have minimum 44x44px touch targets and the reset button is full-width

## Tasks / Subtasks

- [ ] Task 1: Install `@fontsource/atkinson-hyperlegible` npm dependency (AC: 4)
  - [ ] 1.1 Run `npm install @fontsource/atkinson-hyperlegible`
  - [ ] 1.2 Verify package appears in `package.json` dependencies
  - [ ] 1.3 Do NOT add static import to `src/styles/fonts.css` -- this package is loaded dynamically only when the font toggle is enabled

- [ ] Task 2: Extend AppSettings interface in `src/lib/settings.ts` (AC: 4)
  - [ ] 2.1 Add `accessibilityFont: boolean` to the `AppSettings` interface
  - [ ] 2.2 Add `contentDensity: 'default' | 'spacious'` to the `AppSettings` interface
  - [ ] 2.3 Add `reduceMotion: 'system' | 'on' | 'off'` to the `AppSettings` interface
  - [ ] 2.4 Export type aliases: `type ContentDensity = 'default' | 'spacious'` and `type ReduceMotion = 'system' | 'on' | 'off'`
  - [ ] 2.5 Add defaults: `accessibilityFont: false`, `contentDensity: 'default'`, `reduceMotion: 'system'`
  - [ ] 2.6 Add Zod validation for persisted settings: validate localStorage values on read, fallback to defaults if corrupted (e.g., `reduceMotion: 'invalid'` → `'system'`). Prevents crashes from manually edited or corrupted localStorage. (Edge case review HIGH #4)

- [ ] Task 3: Create `DisplayAccessibilitySection` component shell (AC: 1, 2, 3)
  - [ ] 3.1 Create `src/app/components/settings/DisplayAccessibilitySection.tsx`
  - [ ] 3.2 Follow AgeRangeSection pattern: Card + CardHeader (Eye icon in `rounded-full bg-brand-soft p-2`) + CardContent
  - [ ] 3.3 Title: "Display & Accessibility", Description: "Customize how content looks and moves"
  - [ ] 3.4 Add placeholder subsections for Font, Density, and Motion separated by `<Separator />`
  - [ ] 3.5 Add Reset to Defaults button with `RotateCcw` icon (ghost variant, `min-h-[44px]`, `w-full sm:w-auto`)
  - [ ] 3.6 Add AlertDialog confirmation for reset: title "Reset display settings?", description listing what resets
  - [ ] 3.7 Reset handler: set `accessibilityFont: false, contentDensity: 'default', reduceMotion: 'system'`
  - [ ] 3.8 Props: `settings: AppSettings`, `onSettingsChange: (updates: Partial<AppSettings>) => void`

- [ ] Task 4: Integrate section into Settings page (AC: 1, 5)
  - [ ] 4.1 Import `DisplayAccessibilitySection` in `src/app/pages/Settings.tsx`
  - [ ] 4.2 Place between AgeRangeSection (line ~913) and EngagementPreferences (line ~916)
  - [ ] 4.3 Pass `settings` state and an `onSettingsChange` handler that calls `saveSettings()` + dispatches `settingsUpdated` event
  - [ ] 4.4 Verify mobile responsiveness: controls stack on <640px, reset button full-width

## Design Guidance

- **Section pattern:** Follow AgeRangeSection at `src/app/pages/Settings.tsx:85-150` exactly
- **Icon badge:** `<div className="rounded-full bg-brand-soft p-2"><Eye className="h-5 w-5 text-brand" /></div>`
- **Header background:** `border-b border-border/50 bg-surface-sunken/30`
- **Card content padding:** `p-6`
- **Subsection layout:** Label + description on left, control on right via `flex justify-between items-center`
- **Mobile:** `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`
- **Reset button:** `<Button variant="ghost" className="min-h-[44px] w-full sm:w-auto">` with RotateCcw icon
- **AlertDialog actions:** Cancel (outline) + Reset (brand variant)
- **All colors must use design tokens** -- no hardcoded Tailwind colors

## Implementation Notes

- **Settings persistence pattern:** `src/lib/settings.ts` uses `getSettings()` / `saveSettings()` with localStorage. New fields extend `AppSettings` interface with defaults in the `defaults` object. Settings page calls `saveSettings(updated)` then `window.dispatchEvent(new Event('settingsUpdated'))`.
- **Insertion point:** Between AgeRangeSection (~line 913) and EngagementPreferences (~line 916) in Settings.tsx
- **Existing components used:** Card, CardHeader, CardContent, Button, AlertDialog, Separator, Label, Switch, RadioGroup -- all from `@/app/components/ui/`
- **No new routes needed** -- inline section within existing Settings page
- **Placeholder subsections:** Font, Density, and Motion subsections should show label + description + disabled control (Switch for Font/Density, RadioGroup for Motion). S02-S04 will wire them up.

## Testing Notes

- **Unit test:** `getSettings()` returns correct defaults for new fields when no saved settings exist
- **Unit test:** `saveSettings()` persists new fields to localStorage
- **Unit test:** DisplayAccessibilitySection renders with correct title, description, and icon
- **Unit test:** Reset button triggers AlertDialog; confirming resets all 3 fields to defaults
- **E2E test:** `tests/e51-s01-settings-infrastructure.spec.ts`
  - Verify section appears on Settings page between Age Range and Engagement Preferences
  - Verify reset flow: click reset -> dialog appears -> confirm -> fields reset -> toast shown
  - Verify mobile layout: controls stack, reset button full-width at 375px viewport

## Implementation Plan

See [plan](../plans/e51-s01-settings-infrastructure-display-section-shell.md) for implementation approach.

## Dependencies

- **Depends on:** None (foundation story)
- **Enables:** E51-S02, E51-S03, E51-S04 (all depend on AppSettings fields + section shell)

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

- **M1**: AlertDialog "Reset" button uses default variant instead of `brand` — spec says "Reset (brand variant)". Fix: add `className="bg-brand text-brand-foreground hover:bg-brand-hover"` on AlertDialogAction.
- **M2**: Switch controls missing `aria-describedby` — defer to S02/S03 when wired up.
- **N1**: `toastSuccess.saved` could use `toastSuccess.reset` (more idiomatic).
- **N2**: Motion Preference row renders text instead of disabled RadioGroup stub — minor visual inconsistency with Switch rows above.
- Zero console errors, correct heading hierarchy, exact pattern adherence confirmed via computed styles.

## Code Review Feedback

- **HIGH [Consensus: 2 agents]**: No unit tests for validation/sanitization logic in `getSettings()` (settings.ts:69-77). Task 2.6 added enum validation but no tests exercise corrupted values. Fix: add tests for `reduceMotion: 'invalid'`, `contentDensity: 'garbage'`, `accessibilityFont: 'yes'`.
- **HIGH [Consensus: 3 agents]**: AC4 E2E test has dead code — `defaults` variable assigned but never asserted. AC4 covered by unit tests but E2E test is misleading.
- **HIGH [Consensus: 2 agents]**: Reset AlertDialogAction missing brand variant (spec divergence).
- **HIGH**: Stale closure in `onSettingsChange` — captures `settings` from render closure. Safe now (only reset calls it) but risky for S02-S04 live toggles. Fix: use `setSettings(prev => ...)`.
- **MEDIUM**: Hardcoded reset defaults in component — should import from shared constant.
- **MEDIUM**: `text-brand` on `bg-brand-soft` — pre-existing project-wide inconsistency, not a regression.
- Security review: clean (0 findings). Performance: /settings FCP 336ms (budget 1800ms). Exploratory QA: 96/100 health.

## Challenges and Lessons Learned

- **Unit test brittleness with `toEqual`:** Extending `AppSettings` with 3 new required fields (`accessibilityFont`, `contentDensity`, `reduceMotion`) broke 3 unit tests that used `toEqual` with exact object shapes. Tests asserting individual properties were unaffected. Lesson: prefer `toHaveProperty` or field-level assertions for objects likely to grow.
- **Zod validation for localStorage resilience:** Added `VALID_CONTENT_DENSITY` and `VALID_REDUCE_MOTION` arrays with fallback-to-default validation in `getSettings()`. This prevents crashes from corrupted/manually-edited localStorage values — a defensive pattern worth replicating for any enum-like persisted settings.
- **Existing AgeRangeSection as component pattern:** Following the established Card + CardHeader + CardContent pattern from AgeRangeSection made the new DisplayAccessibilitySection consistent. The `rounded-full bg-brand-soft p-2` icon badge, `border-b border-border/50 bg-surface-sunken/30` header background, and `p-6` content padding are reusable patterns for any new Settings section.
- **AlertDialog for destructive reset actions:** Used shadcn/ui AlertDialog (not Dialog) for the reset confirmation since it's a destructive action. AlertDialog focuses the cancel button by default, reducing accidental data loss — matches the existing pattern used elsewhere in Settings.
- **Placeholder subsections for future stories:** Rendering disabled Switch/RadioGroup controls as placeholders allows E51-S02 through S04 to wire them up incrementally without restructuring the component. Each placeholder has its label and description ready, minimizing future story scope.
