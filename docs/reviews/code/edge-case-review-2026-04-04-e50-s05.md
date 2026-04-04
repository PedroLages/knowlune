## Edge Case Review — E50-S05 (2026-04-04)

### Unhandled Edge Cases

**[StudyScheduleEditor.tsx:73]** — `existing` when `scheduleId` provided but schedule deleted
> Consequence: `existing` is `undefined`, form enters create mode silently instead of showing error
> Guard: `if (scheduleId && !existing && isLoaded) toast.error('Schedule not found'); onOpenChange(false)`

**[StudyScheduleEditor.tsx:99]** — `courseId` provided but course not in `importedCourses`
> Consequence: Course selector shows wrong default, title auto-generation fails silently, selector shows `FREE_STUDY` even though `courseId` was set
> Guard: Check `course` existence before setting `selectedCourseId`, show fallback if course not found

**[TimePicker.tsx:39]** — `value` prop with hour > 22 or < 6
> Consequence: Hour `<Select>` shows blank/unselected, user cannot see or change time
> Guard: Clamp to 6–22 range on entry, or extend HOURS array

**[StudyScheduleEditor.tsx:152]** — `recurrence: 'weekly'` hardcoded
> Consequence: No way to create one-time study blocks — all schedules are always recurring weekly
> Guard: Not necessarily a bug (per spec), but worth documenting as a constraint

---
**Total:** 4 edge cases found
