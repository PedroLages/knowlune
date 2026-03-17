# Web Design Guidelines Review: E11-S06

**Story:** Per-Course Study Reminders
**Date:** 2026-03-16
**Reviewer:** Claude (Web Interface Guidelines audit)
**Files reviewed:**
- `src/app/components/figma/CourseReminderSettings.tsx`
- `src/app/components/figma/CourseReminderRow.tsx`
- `src/app/components/figma/DaySelector.tsx`
- `src/app/pages/Settings.tsx` (integration)

---

## Summary

The E11-S06 implementation is well-crafted and follows web interface best practices closely. The components demonstrate strong attention to accessibility, consistent design token usage, and sensible interaction patterns. Two minor warnings around keyboard feedback and missing loading/saving indicators prevent a clean sweep, but neither is a blocker.

**Overall: PASS (with 2 minor warnings)**

---

## Findings by Category

### 1. Interaction Feedback — PASS

Buttons and toggles provide immediate visual feedback:
- **Switch toggle** (`CourseReminderRow.tsx:144-148`): Uses shadcn `Switch` which has built-in checked/unchecked visual states.
- **DaySelector pills** (`DaySelector.tsx:48-55`): Selected state uses `bg-brand text-brand-foreground`, unselected uses `bg-background border border-border`. The `transition-colors duration-150` ensures a smooth color change on click.
- **Add Reminder button** (`CourseReminderSettings.tsx:329-337`): Full-width outline button with icon, clear affordance.
- **Status dot** (`CourseReminderRow.tsx:129-133`): Green (`bg-success`) when enabled, muted (`bg-muted`) when disabled -- immediate visual indicator of reminder state.
- **Save button disabled state** (`CourseReminderSettings.tsx:313`): Properly disabled when no course or days selected, preventing invalid saves.

### 2. Keyboard Navigation — WARN

Most elements are keyboard-accessible, but one gap exists:

- **DaySelector buttons** (`DaySelector.tsx:40-58`): Uses native `<button>` elements with `role="checkbox"` and `aria-checked` -- fully tabbable and keyboard-activatable via Space/Enter. The `focus-visible:ring-2 focus-visible:ring-brand` provides a visible focus ring.
- **Switch, Select, Button**: All shadcn/ui primitives with built-in keyboard support.
- **Time input** (`CourseReminderSettings.tsx:298-305`): Native `<input type="time">` with `focus-visible:ring-2` styling.

**Warning:** The DaySelector `role="group"` container (`DaySelector.tsx:31-33`) does not implement arrow-key navigation between pills. Per WAI-ARIA checkbox group patterns, Tab moves between the group and other elements, but within the group users must Tab through each pill individually (7 tabs). This is acceptable but not ideal for a 7-item group. Consider `role="listbox"` with arrow keys for an improved experience.

**Severity:** LOW -- functional but could be more ergonomic.

### 3. Loading States — WARN

- **No loading indicator** when reminders are being fetched from IndexedDB (`CourseReminderSettings.tsx:40-47`). The `loadReminders` async call has no pending state -- the component renders an empty state briefly before data appears.
- **No saving indicator** on `handleSaveNew` (`CourseReminderSettings.tsx:120-140`) or `handleSaveEdit` (`CourseReminderRow.tsx:56-65`). The form closes immediately after save, which acts as implicit feedback, but there is no spinner or "Saving..." state.
- **Toggle has no optimistic UI rollback** (`CourseReminderSettings.tsx:142-144`): `handleToggle` is async but the Switch visually toggles immediately via React state (through the event listener pattern). This is actually good -- optimistic update.

**Warning:** The initial data load has no skeleton or loading state. For IndexedDB this is typically fast enough to be imperceptible, but on slower devices there could be a brief flash of the empty state before reminders appear.

**Severity:** LOW -- IndexedDB operations are sub-millisecond locally, making this unlikely to be user-visible.

### 4. Error States — PASS

- **Permission denied** (`CourseReminderSettings.tsx:197-225`): Clear warning banner with `AlertTriangle` icon, `role="alert"`, and `aria-live="polite"`. Explains the situation and provides a "Continue without notifications" escape hatch.
- **Permission prompt** (`CourseReminderSettings.tsx:170-194`): Friendly prompt with `Bell` icon explaining why notifications are needed, with an explicit "Enable Notifications" action.
- **Persistent denied indicator** (`CourseReminderSettings.tsx:338-342`): When reminders exist but notifications are blocked, a subtle warning appears below the Add button.
- **All courses taken** (`CourseReminderSettings.tsx:278-281`): When all courses already have reminders, the Select dropdown shows "All courses already have reminders" -- prevents a confusing empty dropdown.
- **Console error logging** (`CourseReminderSettings.tsx:45, 54`): Errors from async operations are caught and logged, preventing unhandled promise rejections.

### 5. Animations — PASS

Transitions are smooth and purposeful:
- **Form reveal** (`CourseReminderSettings.tsx:256`): `animate-in fade-in-0 slide-in-from-top-1 duration-300` -- gentle slide-down with fade, matching existing Settings page patterns.
- **Permission banners** (`CourseReminderSettings.tsx:175, 202`): Same `animate-in fade-in-0 slide-in-from-top-1 duration-300` animation.
- **Reminder rows** (`CourseReminderRow.tsx:124`): `animate-in fade-in-0 slide-in-from-top-1 duration-300` for view mode, `animate-in fade-in-0 duration-200` for edit mode (faster, since it's an in-place transition).
- **Row hover** (`CourseReminderRow.tsx:124`): `hover:bg-surface-elevated/80 transition-colors` -- subtle background change on hover.
- **Day pills** (`DaySelector.tsx:50`): `transition-colors duration-150` -- fast, responsive color transitions.

All animations use the same library (`animate-in`) and duration patterns as the rest of the Settings page (e.g., `ReminderSettings.tsx:115`).

### 6. Touch Targets — PASS

All interactive elements meet the 44x44px minimum:
- **Buttons**: `min-h-[44px]` explicitly set on all buttons (`CourseReminderSettings.tsx:186, 218, 268, 314, 319, 332`; `CourseReminderRow.tsx:79, 107, 113, 153`).
- **Day pills**: `min-h-[44px] min-w-[44px]` (`DaySelector.tsx:49`) -- both height and width enforced.
- **Time input**: `h-11` = 44px (`CourseReminderSettings.tsx:304`; `CourseReminderRow.tsx:98`).
- **Switch**: shadcn Switch has a built-in 44px touch target area via its label association.
- **Edit/Cancel icon buttons**: `min-h-[44px] min-w-[44px]` (`CourseReminderRow.tsx:79, 153`).

### 7. Visual Hierarchy — PASS

Clear information architecture:
- **Card-level header** (`CourseReminderSettings.tsx:155-167`): Icon + title + subtitle pattern matching Data Management card (`Settings.tsx:566-578`). Uses `bg-surface-sunken/30` header background.
- **Section title** "Course Reminders" with `text-lg font-display` matches "Data Management" heading style.
- **Reminder rows** have a clear structure: status dot (left) -> course name + schedule (center) -> toggle + edit (right).
- **Course name** is `text-sm font-medium`, schedule is `text-xs text-muted-foreground` -- clear primary/secondary hierarchy.
- **Empty state** (`CourseReminderSettings.tsx:243-252`): Large muted icon (12x12) with centered text, visually distinct from active content.
- **Add form** distinguished by `border-brand/30 bg-brand-soft/30` background, clearly separating it from existing rows.

### 8. Consistency — PASS

The new UI matches existing Settings page patterns precisely:
- **Card structure**: Uses same `Card > CardHeader > CardContent` pattern as Profile, Appearance, ReminderSettings, Data Management cards.
- **Header style**: Icon-in-circle + title + subtitle pattern identical to Data Management card (`Settings.tsx:566-578` vs `CourseReminderSettings.tsx:155-167`).
- **Row style**: `rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors` -- matches Data Management export rows (e.g., `Settings.tsx:585`).
- **Animation classes**: Same `animate-in fade-in-0 slide-in-from-top-1 duration-300` used in ReminderSettings sub-toggles (`ReminderSettings.tsx:115`).
- **Time input styling**: Identical CSS classes as ReminderSettings time picker (`ReminderSettings.tsx:133-138` vs `CourseReminderRow.tsx:92-98`).
- **Button sizing**: All buttons use `min-h-[44px]` matching existing Settings buttons.
- **Design tokens**: All colors use tokens (`bg-brand`, `text-muted-foreground`, `bg-success`, `text-warning`, etc.) -- no hardcoded colors.
- **Placement**: Positioned between ReminderSettings and AIConfigurationSettings (`Settings.tsx:558-559`), logically grouping reminder functionality.

### 9. Empty States — PASS

- **No reminders** (`CourseReminderSettings.tsx:242-252`): Large muted `CalendarClock` icon with "No course reminders yet" heading and "Add a reminder to stay on track with specific courses" guidance. Actionable -- the Add Reminder button is visible directly below.
- **No available courses** (`CourseReminderSettings.tsx:278-281`): "All courses already have reminders" message in the Select dropdown, preventing confusion.
- Both states provide clear guidance on what to do next.

### 10. Accessibility — PASS

Strong accessibility implementation:
- **ARIA roles**: `role="group"` on DaySelector (`DaySelector.tsx:32`), `role="checkbox"` + `aria-checked` on day pills (`DaySelector.tsx:43-44`), `role="alert"` + `aria-live="polite"` on permission banners (`CourseReminderSettings.tsx:173-174, 200-201`).
- **ARIA labels**: All icon-only buttons have descriptive `aria-label` attributes: "Cancel editing" (`CourseReminderRow.tsx:80`), "Edit {courseName} reminder" (`CourseReminderRow.tsx:154`), "Enable {courseName} reminder" (`CourseReminderRow.tsx:147`), "Save reminder" (`CourseReminderSettings.tsx:315`), "Add course reminder" (`CourseReminderSettings.tsx:333`).
- **Decorative icons**: All non-interactive icons have `aria-hidden="true"` (`CourseReminderSettings.tsx:158, 177, 204, 244`; `CourseReminderRow.tsx:133`).
- **Label associations**: `htmlFor`/`id` pairs on Course select (`CourseReminderSettings.tsx:261, 266`), time inputs (`CourseReminderSettings.tsx:295, 298`; `CourseReminderRow.tsx:89, 94`).
- **Semantic HTML**: Uses `<h4>` for section headings, `<p>` for descriptions, `<button>` for interactive elements (not `<div>`).
- **Truncation**: Long course names use `truncate` class (`CourseReminderRow.tsx:136`) preventing layout breakage while preserving the full name for screen readers.

---

## Verdict

**PASS** -- The implementation is production-ready with high-quality UI patterns.

### Actionable Items (non-blocking)

| # | Severity | Category | Finding | File:Line |
|---|----------|----------|---------|-----------|
| 1 | LOW | Keyboard | DaySelector group requires 7 Tab presses to traverse; consider arrow-key navigation for checkbox group pattern | `DaySelector.tsx:31-61` |
| 2 | LOW | Loading | No skeleton/loading state during initial IndexedDB fetch; brief empty-state flash possible on slow devices | `CourseReminderSettings.tsx:40-47` |

Neither item blocks shipping. The implementation demonstrates consistent design token usage, proper accessibility markup, appropriate touch targets, smooth animations, and strong visual hierarchy that matches the existing Settings page patterns.
