---
title: "Learning track detail hero thumbnails — path-scoped ordered URLs"
date: 2026-05-14
category: best-practices
module: learning-paths
problem_type: bug_fix
tags:
  - learning-tracks
  - thumbnails
  - PathHeroBanner
  - syllabus-order
---

# Learning track detail hero thumbnails — path-scoped ordered URLs

## Context

PR [#567](https://github.com/PedroLages/knowlune/pull/567) fixes incorrect circular covers on `/learning-tracks/:trackId`: `PathHeroBanner` previously used `Object.values(thumbnailUrls)`, which ignored path membership and syllabus order.

## Invariant

- **Never** build hero avatar URLs from unscoped map enumeration.
- **Always** walk `LearningPathEntry[]` sorted by `position`, collect `thumbnailUrls[courseId]` up to the display cap, skipping missing URLs.
- **Share** one pure helper (`getPathCourseThumbnailUrls`) between the listing grid and the detail hero so the two cannot drift.

## Call sites

- `LearningTracks.tsx` — sort filtered entries by `position`, then helper (limit 4).
- `LearningTrackDetail.tsx` — `getEntriesForPath` already sorted; memo `heroCourseThumbnails`, pass `orderedCourseThumbnails` to `PathHeroBanner`.

## Tests

- `src/lib/__tests__/learningPathThumbnails.test.ts` — collection, gaps, limit, caller order.
- `PathHeroBanner.test.tsx` — assert `<img src>` order matches prop order; back link targets `/learning-tracks`.
