---
story_id: E60-S04
story_name: "Smart Triggers Preferences Panel"
status: ready-for-dev
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 60.4: Smart Triggers Preferences Panel

## Story

As a learner,
I want to individually enable or disable each smart trigger notification type,
So that I only receive the proactive notifications I find useful.

## Acceptance Criteria

**AC1: Three new toggles under "Smart Triggers" section**
**Given** a user navigates to Settings > Notification Preferences
**When** the panel loads
**Then** three new toggles appear under a "Smart Triggers" section header, visually separated from existing notification toggles
**And** the toggles are: "Knowledge Decay Alerts" (Brain icon), "Content Recommendations" (Lightbulb icon), "Milestone Progress" (Target icon)
**And** each toggle shows a descriptive subtitle

**AC2: Toggle persistence**
**Given** all three smart trigger types are enabled by default
**When** the user toggles off "Milestone Progress"
**Then** the preference is persisted to IndexedDB
**And** reloading the page shows "Milestone Progress" still toggled off

**AC3: End-to-end preference suppression**
**Given** the user toggles off "Knowledge Decay Alerts" in preferences
**When** the app starts and `checkKnowledgeDecayOnStartup()` finds weak topics
**Then** no knowledge decay notifications are created (preference suppression works end-to-end)

**AC4: Accessibility**
**Given** the notification preferences panel is rendered
**When** assistive technology reads the panel
**Then** each toggle has an accessible label matching its notification type name
**And** the "Smart Triggers" section heading is properly structured for screen readers

## Tasks / Subtasks

- [ ] Task 1: Add "Smart Triggers" section with separator and heading (AC: 1, 4)
  - [ ] 1.1 In `src/app/components/settings/NotificationPreferencesPanel.tsx`, after the existing `NOTIFICATION_TOGGLES` map and before the `<Separator />` + Quiet Hours section, add a new `<Separator />` and a section heading "Smart Triggers"
  - [ ] 1.2 Use `<h3>` for the section heading with appropriate styling (`text-sm font-semibold text-muted-foreground uppercase tracking-wide`)

- [ ] Task 2: Add three smart trigger toggle definitions (AC: 1)
  - [ ] 2.1 Import `Brain`, `Lightbulb`, `Target` from `lucide-react`
  - [ ] 2.2 Create `SMART_TRIGGER_TOGGLES: ToggleDefinition[]` array with:
    - `{ type: 'knowledge-decay', label: 'Knowledge Decay Alerts', description: 'When a topic retention drops below threshold', icon: Brain }`
    - `{ type: 'recommendation-match', label: 'Content Recommendations', description: 'When new content matches your weak areas', icon: Lightbulb }`
    - `{ type: 'milestone-approaching', label: 'Milestone Progress', description: 'When you are close to finishing a course', icon: Target }`

- [ ] Task 3: Render smart trigger toggles (AC: 1, 2, 4)
  - [ ] 3.1 Render `SMART_TRIGGER_TOGGLES` using the same pattern as existing toggles (map over array, same layout with icon + label + description + Switch)
  - [ ] 3.2 Ensure each Switch has `aria-label` matching the label text
  - [ ] 3.3 Use `data-testid="smart-trigger-{type}"` on each toggle row for E2E targeting

- [ ] Task 4: Verify toggle persistence via existing store (AC: 2)
  - [ ] 4.1 No new code needed -- the existing `setTypeEnabled()` call on `onCheckedChange` + `isTypeEnabled()` for `checked` prop already works because S01-S03 wired the `TYPE_TO_FIELD` mappings

## Design Guidance

### Layout Structure

```
[Existing notification toggles]
──────── Separator ────────
Smart Triggers (section heading)
  [Brain icon] Knowledge Decay Alerts        [Switch]
               When a topic retention drops...
  [Lightbulb]  Content Recommendations        [Switch]
               When new content matches...
  [Target]     Milestone Progress             [Switch]
               When you are close to...
──────── Separator ────────
[Quiet Hours section]
```

### Design Token Usage

- Section heading: `text-muted-foreground` (not hardcoded gray)
- Icons: `text-muted-foreground` (matches existing toggle icons)
- Toggle rows: same `min-h-[44px]` for touch targets (existing pattern)
- Use `bg-brand-soft` / `text-brand` only if adding an accent -- but match existing toggle style (no accent)

### Responsive

- Toggles already work at all breakpoints (flex layout with justify-between)
- No additional responsive work needed

### Accessibility

- `<h3>` or `role="heading"` for "Smart Triggers" section
- Each Switch gets `aria-label="{label} notifications"` (matches existing pattern)
- Toggle group wrapped in `role="group"` with `aria-label="Smart trigger notification toggles"`

## Implementation Notes

### Architecture Compliance

The `NotificationPreferencesPanel.tsx` already exists at `src/app/components/settings/NotificationPreferencesPanel.tsx`. This story only adds UI elements -- all backend wiring (type system, preference store, Dexie migration) is done in S01-S03.

**Existing Pattern to Follow**: The component already maps over `NOTIFICATION_TOGGLES` array and renders each toggle. Create a separate `SMART_TRIGGER_TOGGLES` array and render it in a new section with the same pattern.

### Key Files to Modify

| File | Change |
|------|--------|
| `src/app/components/settings/NotificationPreferencesPanel.tsx` | Add Smart Triggers section with 3 new toggles |

### Critical Guardrails

- **Do NOT duplicate the toggle rendering logic** -- extract a shared `ToggleRow` component or reuse the same map pattern
- **Use design tokens only** -- no hardcoded colors (`bg-blue-600`, `text-gray-500` etc.)
- **Icons from lucide-react** -- `Brain`, `Lightbulb`, `Target` (verify these exist in the installed version)
- **The `ToggleDefinition` interface and `isTypeEnabled`/`setTypeEnabled` already support the new types** via S01-S03 wiring
- **Add `data-testid` attributes** for E2E test targeting (S05 needs them)

### Previous Story Intelligence

S01-S03 must be completed first for the type system and preference store to recognize the new notification types. The UI will show the toggles but they won't function without the underlying `TYPE_TO_FIELD` mappings.

## Testing Notes

E2E testing is covered by E60-S05. During implementation:
- Verify all three toggles render in the Settings page
- Verify toggling off persists across page reload
- Run `npm run build` to ensure no import errors
- Check console for any warnings

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No hardcoded colors -- all styling uses design tokens
- [ ] Touch targets >= 44x44px (min-h-[44px] on toggle rows)
- [ ] Accessible labels on all Switch components
- [ ] Section heading uses semantic HTML (h3)
- [ ] data-testid attributes on toggle rows for E2E
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference

## Design Review Feedback

[Populated by /review-story -- Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story -- adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
