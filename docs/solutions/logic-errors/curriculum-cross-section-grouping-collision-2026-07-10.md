---
module: curriculum
date: 2026-07-10
problem_type: logic_error
component: database
severity: high
symptoms:
  - "Course sidebar shows scrambled or missing lessons — '001 Introduction' from Section 1 and '001 Getting Started' from Section 3 collide"
  - "Primary PDFs like '001 Linux Distros.pdf' disappear from standalone PDF list, becoming attachments to videos in wrong sections"
  - "A second video with the same prefix silently overwrites the first as the primary video"
  - "Rollup build fails with 'import and export may only appear at the top level' from missing closing braces"
root_cause: logic_error
resolution_type: code_fix
tags:
  - curriculum
  - lesson-grouping
  - section-scoping
  - build-error
  - data-structure
---

# Cross-Section Curriculum Grouping Collision

## Problem

The `buildLessonBasedCurriculum` function in `src/lib/lessonBasedCurriculum.ts` used a global `Map<prefix, LessonGroupBuilder>` to group lessons by numeric prefix, causing lessons with the same prefix from different sections to collide. A Linux Administration Bootcamp course showed only 15 of 74 lessons in the sidebar, sorted alphabetically with no section grouping. Additionally, aggressive scan-time material classification was misclassifying primary PDFs as supplementary materials attached to videos in the wrong section.

## Symptoms

- Course sidebar shows scrambled or missing lessons — `"001 Introduction"` from Section 1 and `"001 Getting Started"` from Section 3 collide, one overwriting the other
- 80% data loss: Linux Administration Bootcamp showed 15 out of 74 lessons (session history: discovered via browser investigation)
- Primary PDFs like `"001 Linux Distros.pdf"` are misclassified as materials and disappear from standalone PDF list, appearing only as attachments to videos in the wrong section
- A second video with the same prefix silently overwrites the first as the primary video — both videos exist on disk, but the first's data in the curriculum tree is lost
- Rollup bundling fails with `'import' and 'export' may only appear at the top level` after a refactoring script dropped closing braces

## What Didn't Work

1. **Global `Map<prefix, LessonGroupBuilder>`**: All lessons were grouped into a single flat map keyed by numeric prefix like `"001"`. Since multiple sections each have their own `"001"`, lessons from different sections with the same prefix merged into one group, causing scramble and silent data loss. (session history: root cause identified during browser testing of the DevOps platform engineer track)

2. **Overwriting `entry.video` on duplicate prefix**: When two videos had the same prefix within the same section, the code did `entry.video = { ...video, isMaterial: true }`, overwriting the first video entirely instead of preserving it as primary and pushing extras as materials.

3. **Scan-time `isMaterialFilename()` classification in `scanCourseFolderFromServer`**: The scan function eagerly classified PDFs as materials by matching filename patterns and prefix-stem matching against videos, then set `materialOf` on `ScannedPdf` records. During persist, `pdfs.filter(p => !p.materialOf)` excluded material-classified PDFs from standalone records, effectively deleting them from the course. The pattern-based matcher was too aggressive for server-sourced filenames. (session history: earlier approach using a global Map caused cross-section material contamination)

4. **Node.js replace script dropped closing braces**: The automated refactoring that rewrote `buildLessonBasedCurriculum` for section-scoped grouping inadvertently dropped closing braces at function boundaries, producing syntactically invalid TypeScript. Two follow-up commits (`9096528c`, `f638961f`/`0b0509d3`) were needed to restore them. (session history: noted as mechanical error from the replacement script, not a logic bug)

## Solution

### Fix 6: Section-scoped prefix grouping (05794264)

Restructured from a global `Map<prefix, LessonGroupBuilder>` to section-scoped `Map<sectionPath, Map<prefix, LessonGroupBuilder>>`:

```typescript
// Before: global prefix map — all sections share one flat namespace
const prefixMap = new Map<string, LessonGroupBuilder>()
for (const video of videos) {
  const { prefix } = parseNumericPrefix(video.filename)
  if (!prefix) continue
  if (!prefixMap.has(prefix)) {
    prefixMap.set(prefix, { prefix, video: null, pdfs: [], txts: [], other: [], path: video.path })
  }
  const entry = prefixMap.get(prefix)!
  if (!entry.video) {
    entry.video = { ...video, isMaterial: false }
  } else {
    entry.video = { ...video, isMaterial: true } // OVERWRITES first video!
    entry.other.push(createItemFromVideo(video, true))
  }
}

// After: section-scoped — each section's "001" is independent
const sectionBuckets = new Map() // Map<sectionPath, Map<prefix, LessonGroupBuilder>>

function getSectionMap(sectionKey) { /* creates Map per section */ }
function getBuilder(sectionKey, prefix, fallbackPath) { /* creates builder per section+prefix */ }

for (const video of videos) {
  const { prefix } = parseNumericPrefix(video.filename)
  if (!prefix) continue
  const sectionKey = getSectionName(video.path) || ''
  const builder = getBuilder(sectionKey, prefix, video.path)

  if (!builder.video) {
    builder.video = { ...video, isMaterial: false }
  } else {
    // Preserve primary video, push extras to materials — no overwrite
    builder.other.push(createItemFromVideo(video, true))
  }
}
```

Sections are built independently per section path:
```typescript
for (const [sectionPath, prefixMap] of sectionBuckets) {
  const sectionGroups = []
  for (const [, builder] of prefixMap) {
    const group = resolveLessonGroup(builder)
    if (group) sectionGroups.push(group)
  }
  sectionGroups.sort((a, b) =>
    a.numericPrefix.localeCompare(b.numericPrefix, undefined, { numeric: true }))
  if (sectionGroups.length > 0) {
    sections.push({
      numericPrefix: parseSectionPrefix(sectionPath),
      title: cleanSectionTitle(sectionPath),
      lessons: sectionGroups,
    })
  }
}
```

### Fix 7: Remove aggressive scan-time material classification (d5f823ba)

Classification is now deferred to render-time via `lessonBasedCurriculum.matchMaterialsToLessons()`:

```typescript
// Before: scan-time classification with materialOf + filter
const materialPdfMap = new Map<string, string>()
for (const pdf of allPdfs) {
  if (!isMaterialFilename(pdf.name)) continue
  const pdfPrefix = pdf.name.match(/^(\d+)/)?.[1]
  if (!pdfPrefix) continue
  const matchingVideo = videos.find(v => {
    const vPrefix = v.filename.match(/^(\d+)/)?.[1]
    return vPrefix === pdfPrefix && v.moduleTitle === deriveModuleTitle(fileDirMap.get(pdf.url))
  })
  if (matchingVideo) materialPdfMap.set(pdf.name, matchingVideo.id)
}
// ... then in persistScannedCourse:
const pdfs = scanned.pdfs.filter(p => !p.materialOf) // DROPS material-classified PDFs!

// After: no scan-time classification — all PDFs are standalone at scan/persist time
const pdfs: ScannedPdf[] = allPdfs.sort(...).map(p => ({
  id: crypto.randomUUID(),
  filename: p.name,
  path: p.path,
  pageCount: 0,
  serverUrl: p.url,
  moduleTitle: deriveModuleTitle(fileDirMap.get(p.url)),
}))
// In persistScannedCourse: no filter, all PDFs are standalone
```

### Fix 8: Add missing closing braces (9096528c, f638961f/0b0509d3)

Restored closing braces dropped by the replacement script during the section-scoped restructuring. Two commits were needed — the first added them, the second removed a duplicate that was accidentally introduced.

## Why This Works

- **Fix 6**: By nesting maps under section path, each section's `"001"` is completely independent. Section boundaries come from the file path (e.g., `"01 - Overview/001 intro.mp4"` vs `"03 - Advanced/001 recap.mp4"`), which correctly separates curriculum. Preserving the first video as primary and pushing extras to materials instead of overwriting avoids silent data loss. The section-scoped approach also means sections can appear in any order and still group correctly.

- **Fix 7**: Scan-time material classification was fundamentally fragile because it relied on filename pattern matching against server-originated filenames, which don't follow the local-file naming conventions that `isMaterialFilename` expects. Deferring to render-time lets the curriculum grouping logic use the full file context (prefix, path, section membership) to make accurate classification decisions. This is a "classify late, with full context" pattern.

- **Fix 8**: The missing braces were a mechanical error from the replacement script that rewrote the function body. Without them, the syntax was invalid, causing Rollup bundling to fail. The fix was purely mechanical — no logic change, just restoring valid syntax.

## Prevention

- When restructuring function bodies with nested loops and closures, verify brace matching with a linter or formatter before committing. Running `npm run typecheck` would have caught the syntax error before the broken commits were pushed.
- Add a smoke test for `buildLessonBasedCurriculum` that uses two sections both having prefix `"001"` to catch cross-section collisions regressions
- Avoid scan-time eager classification that depends on filename pattern matching for server-sourced data — defer to render-time where full context (path, prefix, section membership) is available
- The `no-unused-vars` TypeScript strict flag will catch removed `materialOf` references and `pdfCounter` if they become unused after removing scan-time classification

## Related

- [[batch-course-import-track-creation-callback-stable-ref-patterns-2026-05-10]] — BulkImportDialog callback API patterns and stable ref guards
- [[curriculum-composer-implementation-lessons-2026-05-03]] — CurriculumComposer patterns: shared picker, import round-trip via CustomEvent, batch-add with syncableWrite
- [[implementation-lessons-deferred-issues-hardening-2026-06-28]] — deferred-issues hardening sprint (Dexie TOCTOU, concurrency guards, import pipeline state propagation)
