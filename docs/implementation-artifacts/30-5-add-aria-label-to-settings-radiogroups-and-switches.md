---
story_id: E30-S05
story_name: "Add aria-label to Settings RadioGroups and Switches"
status: done
started: 2026-03-27
completed: 2026-03-27
reviewed: true
review_started: 2026-03-27
review_gates_passed: [build, lint, type-check, format, unit-tests, e2e-tests, design-review, code-review, test-coverage-review]
burn_in_validated: false
---

# Story 30.5: Add aria-label to Settings RadioGroups and Switches

## Story

As a screen reader user,
I want radio groups and toggle switches in Settings to announce their purpose,
So that I understand what preference I'm changing.

## Acceptance Criteria

**Given** the Theme RadioGroup in Settings
**When** a screen reader enters the group
**Then** it announces "Theme" as the group label via `aria-label` or `<fieldset>`/`<legend>`

**Given** the Color scheme RadioGroup in Settings
**When** a screen reader enters the group
**Then** it announces "Color scheme" as the group label

**Given** the EngagementPreferences RadioGroup
**When** a screen reader enters the group
**Then** it announces its purpose via `aria-label`

**Given** Switches in QuizPreferences and Reminders
**When** a screen reader focuses the switch
**Then** it announces the setting name (e.g., "Enable quiz timer", "Daily study reminder")

## Tasks / Subtasks

- [ ] Task 1: Add aria-label to Theme RadioGroup (AC: 1)
  - [ ] 1.1 Locate Theme RadioGroup in `Settings.tsx`
  - [ ] 1.2 Add `aria-label="Theme"` to the `<RadioGroup>` component
  - [ ] 1.3 Alternatively, wrap in `<fieldset>` with `<legend className="sr-only">Theme</legend>`
- [ ] Task 2: Add aria-label to Color scheme RadioGroup (AC: 2)
  - [ ] 2.1 Locate Color scheme RadioGroup in `Settings.tsx`
  - [ ] 2.2 Add `aria-label="Color scheme"` to the `<RadioGroup>` component
- [ ] Task 3: Add aria-label to EngagementPreferences RadioGroup (AC: 3)
  - [ ] 3.1 Open `EngagementPreferences.tsx` and locate RadioGroup around line 95
  - [ ] 3.2 Add appropriate `aria-label` (e.g., "Engagement frequency" or match the visible heading)
- [ ] Task 4: Add aria-labels to QuizPreferences Switches (AC: 4)
  - [ ] 4.1 Locate Switch components in QuizPreferences subcomponent
  - [ ] 4.2 For each Switch, add `aria-label` matching the setting name
  - [ ] 4.3 If a visible `<Label>` already exists with `htmlFor`, verify it's properly associated (may not need aria-label)
  - [ ] 4.4 If using Radix Switch, verify the `<Label>` is associated via `htmlFor` matching the Switch `id`
- [ ] Task 5: Add aria-labels to Reminders Switches (AC: 4)
  - [ ] 5.1 Locate Switch components in Reminders subcomponent
  - [ ] 5.2 For each Switch, add `aria-label` matching the setting name
  - [ ] 5.3 Verify Label-Switch association
- [ ] Task 6: Verify all Settings form controls have accessible names
  - [ ] 6.1 Run axe-core on the full Settings page
  - [ ] 6.2 Fix any additional "form elements must have labels" violations

## Implementation Notes

- **WCAG Reference:** WCAG 1.3.1 (Info and Relationships), WCAG 4.1.2 (Name, Role, Value) — form controls must have accessible names
- **Audit Findings:** H17 (`Settings.tsx`, `EngagementPreferences.tsx:95`), H18 (Settings subcomponents)
- **Radix RadioGroup:** Supports `aria-label` prop directly on `<RadioGroup>`:
  ```tsx
  <RadioGroup aria-label="Theme" value={theme} onValueChange={setTheme}>
    <RadioGroupItem value="light" id="theme-light" />
    <Label htmlFor="theme-light">Light</Label>
    ...
  </RadioGroup>
  ```
- **Radix Switch:** Best practice is to associate with a `<Label>`:
  ```tsx
  <div className="flex items-center gap-2">
    <Switch id="quiz-timer" aria-label="Enable quiz timer" />
    <Label htmlFor="quiz-timer">Enable quiz timer</Label>
  </div>
  ```
  If the Label is already present and properly associated via `htmlFor`/`id`, then `aria-label` is redundant (but harmless). Check each case.
- **Preference order:** `<Label htmlFor>` association > `aria-labelledby` > `aria-label`. Use whichever is most appropriate for each case.

## Testing Notes

- **Screen reader verification (VoiceOver):**
  - Navigate to Settings page
  - Tab into Theme section — VoiceOver should announce "Theme, radio group" when entering the group
  - Tab into Color scheme section — should announce "Color scheme, radio group"
  - Tab to each Switch — should announce the setting name and current state ("Enable quiz timer, on/off, switch")
- **axe-core audit:** Run on Settings page — expect zero "form elements must have labels" violations
- **E2E assertions:**
  ```typescript
  // RadioGroup accessible names
  await expect(page.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Color scheme' })).toBeVisible();

  // Switch accessible names
  await expect(page.getByRole('switch', { name: /quiz timer/i })).toBeVisible();
  await expect(page.getByRole('switch', { name: /study reminder/i })).toBeVisible();
  ```
- **Regression:** Verify radio selection and switch toggling still work correctly after adding ARIA attributes

## Pre-Review Checklist

Before requesting `/review-story`, verify:
- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions
- [ ] No optimistic UI updates before persistence
- [ ] Type guards on all dynamic lookups
- [ ] E2E afterEach cleanup uses `await`
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story]

## Code Review Feedback

[Populated by /review-story]

## Challenges and Lessons Learned

- **Many controls already labelled**: Age range RadioGroup, EngagementPreferences switches, and "Show all menu items" switch already had aria-labels from prior work
- **Belt-and-suspenders**: Added explicit aria-label even when htmlFor/Label associations existed, ensuring screen readers always announce purpose
- **Duplicate removed**: Found and removed an accidental duplicate aria-label on Age range RadioGroup in Settings.tsx
