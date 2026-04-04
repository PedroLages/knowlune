## External Code Review: E50-S05 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-04
**Story**: E50-S05

### Findings

#### Blockers
- **[src/app/components/figma/StudyScheduleEditor.tsx:53 (confidence: 90)]**: **No form reset when creating multiple schedules.** The `useEffect` that populates form defaults depends on `existing`, but when creating new schedules, `existing` is always `undefined`. After the first creation, the dependency values don't change, so `open` transitions from `true → false → true` don't re-trigger the effect. The old field values (title, days, time, etc.) silently persist into the next "create" invocation.

  The `courseId` dependency partially masks this *only* if a different `courseId` is passed each time. When opening from CalendarSettingsSection (no `courseId` prop), the same `undefined` → no re-trigger, stale form.

  Fix: Replace the dependency on `existing` with `scheduleId` (which changes identity each time), or add a counter/key that increments on every `open → true` transition:
  ```ts
  useEffect(() => {
    if (!open) return
    // Reset logic...
  }, [open, scheduleId, courseId, importedCourses])
  ```
  Or more robustly, gate on `open` becoming true with a ref tracking the previous value.

#### High Priority
- **[src/app/components/figma/StudyScheduleEditor.tsx:225 (confidence: 90)]**: **Stale closure: `handleSave` may read outdated state.** `handleSave` depends on the `validate` callback, which itself depends on `title` and `days`. `validate` is wrapped in `useCallback` with `[title, days]` deps. `handleSave` lists `validate` in *its* deps, but React's linter would actually flag `title` and `days` as missing from `handleSave`'s dependency array. If the user modifies the title or days *after* `handleSave` is memoized but before clicking Save, validation checks the stale `title`/`days`, while the save body reads the current `title`/`days` from closure via the correct deps. This mismatch means validation can pass for stale data while saving different data, or reject valid current data.

  Fix: Add `title` and `days` to `handleSave`'s dependency array, or remove individual memoization of `validate` and inline it:
  ```ts
  const handleSave = useCallback(async () => {
    const newErrors: Record<string, string> = {}
    if (!title.trim()) newErrors.title = 'Title is required.'
    if (days.length === 0) newErrors.days = 'Select at least one day.'
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return
    // ... rest of save logic
  }, [title, selectedCourseId, days, startTime, durationMinutes, reminderMinutes, isEdit, scheduleId, updateSchedule, addSchedule, onOpenChange])
  ```

#### Medium
- **[src/app/components/figma/TimePicker.tsx:39 (confidence: 85)]**: **`formatTimeLocale` produces "6:00 AM" but hour `<Select>` value is `"06"`.** When `value` is `"06:00"`, `value.split(':')` yields `["06", "00"]`. `formatTimeLocale` parses `h=6` via `Number("06")` → `6`, producing `"6:00 AM"`. The hour `<Select>` uses `value="06"` and items have `value="06"` through `"22"`. This works for display. However, if `onChange` is called with `${h}:${minute}` where `h` comes from `onValueChange`, the values are the padded strings `"06"`–`"22"`. If the component ever receives an unpadded value like `"6:00"` (e.g., from a schedule that was stored without padding), the hour `<Select>` won't match any item and will appear empty/unselected.

  Fix: Normalize the `value` prop on entry, or ensure the hour `<Select>` handles both `"6"` and `"06"`:
  ```ts
  const [hour, minute] = value.split(':')
  const normalizedHour = hour.padStart(2, '0')
  // Use normalizedHour for Select value and in onChange
  ```

- **[src/app/components/figma/StudyScheduleEditor.tsx:42 (confidence: 70)]**: **Derived value `existing` recomputes on every render and causes unnecessary effect re-runs.** `existing` is derived via `schedules.find(...)` on every render. This object reference changes identity each time `schedules` array updates, even if the target schedule hasn't changed — triggering the reset `useEffect`, which would clear `errors` and potentially reset form fields while the user is actively editing.

  Fix: Memoize `existing` with `useMemo`:
  ```ts
  const existing = useMemo(
    () => (isEdit ? schedules.find(s => s.id === scheduleId) : undefined),
    [schedules, scheduleId, isEdit]
  )
  ```
  Better yet, remove `existing` from the dependency array entirely and use `scheduleId` + `schedules` as the deps, reading `existing` inside the effect.

#### Nits
- **[src/app/components/figma/StudyScheduleEditor.tsx:175 (confidence: 60)]**: The `errors.days` element uses `aria-live="assertive"` which immediately interrupts screen readers when the validation error appears. Since this fires on Save attempt (user-initiated), `aria-live="polite"` would be more appropriate — assertive should be reserved for critical/urgent alerts. Not a functional bug, but an a11y best-practice concern.

---
Issues found: 5 | Blockers: 1 | High: 1 | Medium: 2 | Nits: 1
