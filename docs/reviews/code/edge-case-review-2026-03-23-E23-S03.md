## Edge Case Review — E23-S03 (2026-03-23)

### Unhandled Edge Cases

**src/db/schema.ts:1240-1249** — `Migration runs on DB that already has authorId (double-run or partial migration)`
> Consequence: Both `authorId` and copied `authorId` coexist silently; no data loss but `delete course.instructorId` is a no-op on already-migrated records
> Guard: `if (course.instructorId !== undefined && course.authorId === undefined) { ... }`

**src/app/pages/AuthorProfile.tsx:30** — `Route navigated to /authors/ with empty or missing :authorId param`
> Consequence: `getAuthorById(undefined!)` called with undefined, returns undefined, shows "Author Not Found" — functional but the non-null assertion masks the real issue
> Guard: `const { authorId } = useParams(); if (!authorId) return <NotFound />`

**src/app/pages/AuthorProfile.tsx:69 (and Authors.tsx, CourseCard.tsx)** — `author.name is empty string`
> Consequence: `name.split(' ').map(n => n[0])` produces `['']` and fallback shows empty string instead of meaningful initials
> Guard: `const initials = getInitials(author.name) || '?'`

**src/app/pages/AuthorProfile.tsx:143** — `author.bio is empty string`
> Consequence: `bio.split('\n\n')` returns `['']`, rendering one empty `<p>` element with no visible content
> Guard: `{author.bio && author.bio.split('\n\n').map(...)}`

**src/data/authors/index.ts:8** — `getAuthorById called with null or undefined id`
> Consequence: `allAuthors.find(i => i.id === undefined)` silently returns undefined — no crash but no explicit contract
> Guard: `if (!id) return undefined` early return before find

**src/app/components/figma/SearchCommandPalette.tsx:75** — `Keyword "instructors" removed from Authors page search entry`
> Consequence: Users searching "instructors" in command palette no longer find the Authors page
> Guard: `keywords: ['about', 'authors', 'instructors', 'info']` — keep old keyword as alias

**tests/capture-wireframe-screenshots.spec.ts:21** — `Screenshot name changed from "04-instructors" to "04-authors"`
> Consequence: First test run after rename fails baseline comparison because old screenshot file has the previous name; requires manual baseline update
> Guard: `Intentional — run npx playwright test --update-snapshots to regenerate baselines`

**src/db/schema.ts:1240-1249** — `courses table is empty when migration v19 runs`
> Consequence: `.toCollection().modify()` on empty collection completes successfully — no issue, but upgrade function runs unnecessarily
> Guard: No guard needed — Dexie handles empty collections gracefully

---
**Total:** 7 unhandled edge cases found (excluding the empty-collection non-issue).
