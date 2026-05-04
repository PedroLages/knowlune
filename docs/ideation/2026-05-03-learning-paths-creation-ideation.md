---
date: 2026-05-03
topic: learning-paths-creation
focus: better ways to achieve the creation of courses paths
---

# Ideation: Learning Paths Creation

## Codebase Context

Knowlune is a React 19 + TypeScript + Tailwind v4 personal learning platform. The learning paths feature lets users create curated sequences of courses with progress tracking, AI-suggested ordering, and drag-and-drop reordering.

**Current creation flows (4 separate surfaces):**
- **Flow A (Manual):** `CreatePathDialog` (name + description) → empty path → redirect to `LearningPathDetail` → add courses one at a time via `CoursePickerDialog` modal → drag-reorder or AI suggest order
- **Flow B (AI-Generated):** Premium-gated `/ai-learning-path` page — AI analyzes all imported courses → streams results
- **Flow C (During Import):** `ImportWizardDialog` step 3 — AI suggests path placement, or user manually picks/creates/skips
- **Flow D (AI Order Suggestion):** Detail page sidebar button — AI reorders existing path entries with justification

**Key files:** `src/app/pages/LearningPaths.tsx` (767 lines), `src/app/pages/LearningPathDetail.tsx` (1174 lines), `src/app/pages/AILearningPath.tsx` (395 lines), `src/stores/useLearningPathStore.ts`, `src/app/components/figma/ImportWizardDialog.tsx`, `src/ai/learningPath/` (generatePath, suggestOrder, suggestPlacement)

**Key gaps:** No inline curriculum builder, empty-path state is common first impression, multi-stage progression model from Epic 20 never built, standalone `learning-path-create/` at repo root never integrated, 8 Stitch design prototypes exist in `docs/design-references/stitch-apple-style/`

**Reusable primitives:** `MoveUpDownButtons` (WCAG 2.5.7), `PathCardHeader`, `PathProgressRing`, `TrailMap` SVG, Library tabbed IA pattern, stale async result prevention pattern (2026-05-03)

## Ranked Ideas

### 1. Curriculum Composer — unified creation with inline course selection

**Description:** Replace the three-step flow (CreatePathDialog → redirect → CoursePickerDialog) with a single creation experience. The "Create Path" dialog includes an inline course picker directly in the dialog body — searchable, multi-select, with AI-ranked "Suggested Next" recommendations. A path is never persisted until it has at least one course. The inline picker also replaces the modal `CoursePickerDialog` on the detail page, using the same component. Includes an "Import new course" action inline so users can bring in new content without leaving the creation flow (see Idea #7).

**Rationale:** Eliminates the empty-path dead-end that's every new user's first impression. Composes existing primitives (`addCourseToPath`, `CoursePickerDialog`'s search logic) into a single flow. The `CoursePickerDialog` already computes `availableCourses` from `useCourseImportStore` and `useAuthorStore` — moving that logic inline removes a modal and its state management.

**Downsides:** Combining name/description/course-selection into one dialog risks feeling crowded on mobile. Multi-select with checkboxes is new UI that needs MoveUpDownButtons for accessible reorder of the selected set.

**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored

### 2. AI-First Path Building — goals, auto-placement, and feedback

**Description:** Three connected improvements: (a) Goal-to-path — accept free-text goal and generate path structure with gap analysis; (b) Auto-placement on add — AI suggests insertion position automatically when courses are added; (c) Personalization loop — feed `isManuallyOrdered` history back into AI prompts so the system learns user preferences over time.

**Rationale:** The AI pipeline is already mature (3 tested functions with hallucination guards, test mocking, timeout handling) but used as a bolt-on. Weaving it into creation makes AI the default experience rather than a premium-gated side feature. The generation counter pattern handles stale async results.

**Downsides:** Goal-to-path is the riskiest sub-idea — AI quality for free-text goals is unproven. Auto-placement could feel intrusive if the AI is wrong too often. Personalization requires storing preference vectors across paths.

**Confidence:** 70%
**Complexity:** High
**Status:** Unexplored

### 3. Path Templates & Discovery — zero to value instantly

**Description:** Pre-seed 3-5 curated template paths via Supabase ("Full-Stack Developer", "Data Science Foundations", "iOS Development") with complete course sequences and AI justifications. The `hydrateFromRemote` pipeline handles delivery with zero frontend code changes. Add a "Use Template" button on the empty list page. Each template includes a syllabus view showing topic coverage, estimated hours, and difficulty curve.

**Rationale:** Activates the entire hydration pipeline that already exists for sync. Templates demonstrate what paths can do better than any onboarding text. The syllabus view (aggregated from existing `tags`, `videoCount`, and `justification` data) helps users evaluate paths before committing.

**Downsides:** Templates require ongoing curation. The syllabus view needs new UI but uses existing data. Templates without matching imported courses are just aspirational — pair with import-from-path (Idea #7) so users can fill gaps immediately.

**Confidence:** 80%
**Complexity:** Low
**Status:** Explored

### 4. Inline Editing & Dialog Reduction — simplify the management surface

**Description:** Replace RenameDialog and EditDescriptionDialog with click-to-edit inline fields directly on path cards. Replace DeleteConfirmDialog with an immediate-delete + undo toast (5-second timer). The only remaining dialog is CreatePathDialog, which gets replaced by the Curriculum Composer (Idea 1).

**Rationale:** Removes two complete dialog components and their state management (`useEffect` sync, open/close state, separate form submission). The undo-toast pattern for delete eliminates a confirmation step without risk. PathCard already renders name and description as read-only text — making them editable is a small markup change.

**Downsides:** Inline editing needs careful focus management (Enter to save, Escape to cancel). Undo-toast for delete requires keeping the deleted path in memory for 5 seconds — edge case if the user navigates away.

**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 5. Smart Resume — the path-to-learning bridge

**Description:** Add a `useNextBestCourse(pathId)` hook that finds the earliest in-progress or next-unstarted course. Surface it as a one-click "Continue" button on the Overview dashboard and path list cards. After course completion in the player, suggest the next course in the same path. The `usePathProgress` hook already computes all the data needed.

**Rationale:** Transforms paths from a management destination into a navigation primitive. The data pipeline (`useMultiPathProgress`, `LearningPathEntry.position`, per-course `completionPct`) already exists. The detail page's "Now Learning" hero already renders a current-course card — this just promotes that signal to higher-traffic surfaces.

**Downsides:** The "next best" heuristic needs tuning — position-order vs. progress-based vs. time-estimate-based ranking. Cross-path ranking (which path to resume across all paths) is harder than single-path.

**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

### 6. Path as Study Plan — scheduling, milestones, and analytics

**Description:** Three connections between existing systems: (a) Plan My Week — button on path detail reads `usePathProgress.estimatedRemainingHours` and pre-fills the schedule form; (b) Path milestones as Challenges — new `pathMilestone` challenge type fires at 25/50/75/100% completion; (c) Path analytics in Reports — new tab consuming `useMultiPathProgress` data with existing chart components.

**Rationale:** Composes three existing, tested systems (StudySchedule, Challenges, Reports) with path progress data. All the data computation exists in `usePathProgress` and `useMultiPathProgress`. The `learningPathId` FK was designed for exactly this connection. Each sub-idea is independently shippable.

**Downsides:** Plan My Week needs schedule creation UX, which is non-trivial. Path milestones are the lowest-risk sub-idea but also the lowest impact. Reports tab needs design work but chart infrastructure is proven.

**Confidence:** 65%
**Complexity:** Medium-High
**Status:** Unexplored

### 7. Import-from-Path — close the import↔path loop

**Description:** Today import→path works (`ImportWizardDialog` step 3 can create or assign a path during import), but path→import does not exist — the `CoursePickerDialog` only shows already-imported courses, and `LearningPaths.tsx` has no import capability at all. Add an "Import Course" action on the path list page and path detail page that opens the import wizard. When invoked from a path context: (a) the wizard knows the target path, so step 3 (path placement) can be skipped or simplified to a confirmation; (b) the `usePathPlacementSuggestion` AI hook already knows the target path context and can focus on suggesting position rather than destination; (c) after import completes, the course appears immediately in the path. This is especially powerful paired with templates — a user forks a "Full-Stack Developer" template, sees gaps (courses they don't have), and imports them without leaving the path.

**Rationale:** The import wizard and path system were designed to connect (Flow C already works in one direction) but the reverse path was never built. The import wizard's 3-step flow is a proven UX pattern — reusing it from a path entry point with a pre-filled target path is a small parameterization change. The `LearningPaths.tsx` page has zero import capability today, which means path creation and content acquisition live in separate worlds.

**Downsides:** The import wizard is a heavy component — invoking it from a third entry point (Courses page, path list, path detail) needs consistent behavior. Step 3 skipping is a UX shortcut that might confuse users who want to place the imported course in a *different* path.

**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Emergent paths (study first, paths form from behavior) | Too radical — requires fundamental redesign; Smart Resume captures 80% of value |
| 2 | Paths as a DAG (prerequisite graph, not list) | High value but ripples through sync, store, UI, AI prompts; better as brainstorm topic |
| 3 | Multi-perspective paths (fastest/deepest/broadest) | Premature — basic creation UX still has gaps before adding dimension switching |
| 4 | Temp/disposable paths | Unclear demand; most users haven't exhausted permanent paths |
| 5 | Path as a calendar view | Overlaps with Plan My Week + Schedule bridge; standalone calendar UI is large investment |
| 6 | Kill detail page → single scrollable timeline | Specific design choice; should be explored in brainstorming, not ranked here |
| 7 | Remove premium gate on AI generation | Business decision, not engineering improvement |
| 8 | Auto-derive paths from import folders | Narrow — only applies to folder-organized imports; Curriculum Composer is broader |
| 9 | Path diagnostics engine (warn on contradictory sequences) | Low urgency — no user evidence of contradictory sequence problems |
| 10 | Cross-path visibility (where each course lives across paths) | Low urgency — users rarely have enough overlapping paths for this to matter |
| 11 | Forkable template paths (community/curated) | Requires community/social infrastructure that doesn't exist yet |
| 12 | Consumption-first (paths as invisible infrastructure) | Duplicates Smart Resume's value with 10x the implementation cost |
| 13 | Merge AILearningPath.tsx into LearningPathDetail.tsx | Absorbed into Curriculum Composer and AI-First Path Building |
| 14 | Eliminate empty-path state (paths always created with courses) | Absorbed into Curriculum Composer |
| 15 | Remove CoursePickerDialog (inline picker instead) | Absorbed into Curriculum Composer |
| 16 | Remove isAIGenerated path-level flag | Absorbed into AI-First Path Building |
| 17 | Remove Suggest Order confirmation dialog (undo pattern) | Absorbed into Inline Editing & Dialog Reduction |
| 18 | Make import wizard the unified creation experience | Absorbed into Curriculum Composer |
| 19 | Multi-select + batch course addition | Absorbed into Curriculum Composer |
| 20 | AI-ranked "What should I add next?" in CoursePicker | Absorbed into Curriculum Composer |
| 21 | Visual reorder diff (show AI changes before accepting) | Absorbed into AI-First Path Building |
| 22 | Auto-placement on course add (optimal order as default) | Absorbed into AI-First Path Building |
| 23 | isManuallyOrdered as personalization feedback loop | Absorbed into AI-First Path Building |
| 24 | Generative path from single-sentence goal | Absorbed into AI-First Path Building |
| 25 | Interactive TrailMap as creation/navigation canvas | Absorbed into Smart Resume |
| 26 | Path engagement scoring (surface stagnating paths) | Absorbed into Smart Resume |
| 27 | Path progress as Reports dimension | Absorbed into Path as Study Plan |
| 28 | Path milestones as Challenge type | Absorbed into Path as Study Plan |
| 29 | Plan My Week (compose path progress with StudySchedule) | Absorbed into Path as Study Plan |
| 30 | Path pre-study syllabus view | Absorbed into Path Templates & Discovery |
| 31 | Path-gated course unlocking (prerequisites with teeth) | Interesting but needs prerequisite data model; better explored with DAG idea |

## Session Log

- 2026-05-03: Initial ideation — 37 raw candidates generated across 4 frames (user pain, inversion/automation, assumption-breaking, leverage/compounding), merged to 31 after dedup, 6 survivors after adversarial filtering
- 2026-05-03: Idea #3 (Path Templates & Discovery) selected for brainstorming
- 2026-05-03: Added Idea #7 (Import-from-Path) — closes the import↔path loop; cross-referenced from Ideas #1 and #3
