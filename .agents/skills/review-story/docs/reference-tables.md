# Reference Tables

## Route Map

| Source file pattern | Route |
|---|---|
| `pages/Overview.tsx` | `/` |
| `pages/MyClass.tsx` | `/my-class` |
| `pages/Courses.tsx` | `/courses` |
| `pages/CourseDetail.tsx` | `/courses/:courseId` |
| `pages/LessonPlayer.tsx` | `/courses/:courseId/:lessonId` |
| `pages/Library.tsx` | `/library` |
| `pages/Messages.tsx` | `/messages` |
| `pages/Instructors.tsx` | `/instructors` |
| `pages/Reports.tsx` | `/reports` |
| `pages/Settings.tsx` | `/settings` |

## When Review Agents Find Issues

Apply `receiving-code-review` principles when processing review feedback:
- Verify findings technically before implementing fixes
- Don't blindly implement every suggestion — assess whether each applies
- Apply `systematic-debugging` for complex issues: 4-phase root cause analysis before any fixes

## Recovery

- **Pre-checks fail**: Fix errors, re-run `/review-story`. Agent reviews already completed are preserved.
- **Review agent(s) fail**: Check dev server (design review) or git diff (code reviews). Re-run `/review-story`. Only the failed gate(s) re-run — `design-review`, `code-review`, and `code-review-testing` are tracked independently in `review_gates_passed`.
- **Interrupted mid-review**: Story stays `reviewed: in-progress` with `review_gates_passed` tracking progress. Re-run resumes from where it left off — pre-checks always re-run (fast), completed agent reviews are skipped.
- **Stale review after code changes**: If you fix blockers and re-run, pre-checks validate the new code. Agent reviews from the previous run are reused unless you want a fresh review — in that case, manually set `reviewed: false` and clear `review_gates_passed: []` in the story frontmatter.
