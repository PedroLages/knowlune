## Edge Case Review — E07-S07 (2026-03-19)

### Unhandled Edge Cases

**src/lib/momentum.ts:23-27** — `Session array element is null or undefined (e.g., sparse array from corrupted IDB)`
> Consequence: TypeError: Cannot read properties of null (reading 'courseId')
> Guard: `function isValidSession(s: StudySession): boolean { if (!s || typeof s !== 'object') return false; ... }`

**src/lib/momentum.ts:35** — `input.sessions is null or undefined`
> Consequence: TypeError: Cannot read properties of undefined (reading 'filter')
> Guard: `const validSessions = (sessions ?? []).filter(isValidSession)`

**src/app/pages/Courses.tsx:71** — `rawSessions contains null/undefined entries from corrupted IndexedDB`
> Consequence: TypeError on property access of null array element
> Guard: `const sessions = rawSessions.filter(s => s != null && typeof s.courseId === 'string' && s.courseId)`

**src/app/components/StudyScheduleWidget.tsx:40** — `sessions array contains null/undefined entries`
> Consequence: TypeError on property access of null array element
> Guard: `const courseSessions = sessions.filter(s => s != null && typeof s.courseId === 'string' && s.courseId === course.id)`

---
**Total:** 4 unhandled edge cases found.
