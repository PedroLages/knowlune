# CE Plan: Fix Curriculum Grouping — Section-Scoped Prefix

**Status**: Ready for approval
**Created**: 2026-07-09
**Based on**: ChatGPT Deep Research Round 2 analysis

---

## Summary

The `lessonBasedCurriculum.ts` groups lessons by **numeric prefix globally** before building sections. This means `001` from Section 1 collides with `001` from Section 3 — causing scrambled or missing lessons in multi-section courses.

## Root Cause

```typescript
// CURRENT (broken): groups by prefix globally
const prefixMap = new Map<string, LessonGroupBuilder>()
// key = "001" — Section 1's "001" collides with Section 3's "001"
```

When a course has reset numbering per folder (most real courses), the collision causes:
- Primary video overwritten (second "001" replaces first)
- Lessons from different sections merged into one group
- Section assignment happens too late (after groups are built)

## The Fix

Restructure the pipeline from:
```
1. Group globally by numeric prefix
2. Resolve lesson groups
3. Build sections (too late!)
```

To:
```
1. Collect all assets
2. Group by section (folder path)
3. Within each section, group by numeric prefix
4. Resolve lesson groups per section
5. Build CourseSection[] with correct lessons
```

### Concrete change in `buildLessonBasedCurriculum`:

Instead of one global `prefixMap`, use section-scoped maps:

```typescript
// NEW: section-scoped grouping
const sectionBuckets = new Map<string, Map<string, LessonGroupBuilder>>()
// outer key = section path (e.g., "01 - Overview")
// inner key = numeric prefix (e.g., "001")

for (const video of videos) {
  const sectionKey = getSectionName(video.path) || '__root__'
  const { prefix } = parseNumericPrefix(video.filename)
  if (!prefix) continue

  if (!sectionBuckets.has(sectionKey)) {
    sectionBuckets.set(sectionKey, new Map())
  }
  const prefixMap = sectionBuckets.get(sectionKey)!
  // ... rest of grouping logic
}
```

Then build sections with their own lesson groups:
```typescript
for (const [sectionPath, prefixMap] of sectionBuckets) {
  const sectionGroups: LessonGroup[] = []
  for (const [, builder] of prefixMap) {
    const group = resolveLessonGroup(builder)
    if (group) sectionGroups.push(group)
  }
  sectionGroups.sort(/* by numeric prefix */)
  // add to sections
}
```

### Fix video overwrite bug:

```typescript
// CURRENT (broken): overwrites primary on second video
if (!entry.video) {
  entry.video = { ...video, isMaterial: false }
} else {
  entry.video = { ...video, isMaterial: true }  // BUG: overwrites!
  entry.other.push(createItemFromVideo(video, true))
}

// FIXED: preserve first video as primary, push extras to other
if (!entry.video) {
  entry.video = { ...video, isMaterial: false }
} else {
  // Additional video at same prefix — keep as material, don't replace primary
  entry.other.push(createItemFromVideo(video, true))
}
```

## Files to Change

| File | Change |
|------|--------|
| `src/lib/lessonBasedCurriculum.ts` | Restructure `buildLessonBasedCurriculum` — section-scoped prefixMap, fix video overwrite |
| `src/lib/__tests__/lessonBasedCurriculum.test.ts` | Add test: two sections with same numeric prefixes don't collide |

## Verification

1. `npm run build` — green
2. `npm run lint` — green
3. `npm run test:unit -- src/lib/__tests__/lessonBasedCurriculum.test.ts` — tests pass
4. Manual: re-import Linux course, verify all 4 sections have correct lesson counts

## Scope

Only `lessonBasedCurriculum.ts`. No sidebar UI changes. No import pipeline changes. Pure data model fix.

## Risk

Low — only changes internal grouping logic. The public API (`CourseSection[]`) remains the same shape (we already removed `startIndex`). `LessonsTab` reads from `CourseSection[]` which is unchanged.
