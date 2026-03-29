# Implementation Readiness Report: Course Unification + AI Model Selection Epics

**Date:** 2026-03-29
**Reviewer:** Claude (BMad QA/Validation Agent)
**Artifacts Reviewed:** Brainstorming doc, Domain research, Architecture doc, 2 PRDs, 2 Epic files
**Source Files Spot-Checked:** `types.ts`, `routes.tsx`, `useCourseStore.ts`, `aiConfiguration.ts`

---

## Executive Summary

**Overall Readiness Score: READY WITH CAVEATS**

Both epics are well-researched, architecturally sound, and story-decomposed with testable acceptance criteria. The pipeline artifacts are consistent with the actual codebase state. However, there is one **blocking issue** (Epic ID collision) and several moderate concerns (missing stories, AC gaps, effort estimates) that should be resolved before sprint planning.

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Story Completeness | 8/10 | 2 missing stories identified |
| AC Quality | 8/10 | 2 vague ACs flagged |
| Dependency Chain | 9/10 | Clean, no circular deps |
| Architecture Alignment | 9/10 | Strong codebase validation |
| Risk Coverage | 8/10 | 1 risk not covered by stories |
| Epic ID Conflicts | BLOCKER | Both epics use E89 |
| Effort Estimates | 7/10 | 2 stories likely under-estimated |

---

## 1. Story Completeness — PRD Functional Requirements vs. Stories

### Epic A: Course Experience Unification

| PRD FR | Story Coverage | Status |
|--------|---------------|--------|
| FR-1: Dead Code Removal | E89-S01 | COVERED |
| FR-2: Course Adapter Layer | E89-S02 | COVERED |
| FR-3: Route Consolidation with Redirects | E89-S03 | COVERED |
| FR-4: Notes Panel in Video Player | E89-S07 | COVERED |
| FR-5: Prev/Next Video Navigation | E89-S08 | COVERED |
| FR-6: Breadcrumbs | E89-S08 | COVERED (combined with nav) |
| FR-7: Video Reorder Dialog Folder Grouping | E89-S10 | COVERED |
| FR-8: Quiz Wiring to Unified Course IDs | E89-S09 | COVERED |
| FR-9: PDF Viewer in Unified Player | E89-S06 | COVERED |
| NFR-2: Migration Safety (unit tests) | E89-S01 AC4 | COVERED |
| NFR-3.3: E2E tests pass after migration | E89-S03 AC6, S11 AC5 | COVERED |

**Gaps:** None. All 9 FRs and key NFRs are covered by at least one story.

### Epic B: AI Model Selection Per Feature

| PRD FR | Story Coverage | Status |
|--------|---------------|--------|
| FR-1: Centralized Model Resolution | E89-S01, E89-S02 | COVERED |
| FR-2: Per-Feature Configuration Type | E89-S01 | COVERED |
| FR-3: Multi-Provider BYOK Key Storage | E89-S03 | COVERED |
| FR-4: Model Discovery | E89-S04 | COVERED |
| FR-5: Provider Model Picker Component | E89-S05 | COVERED |
| FR-6: Per-Feature Override UI | E89-S06 | COVERED |
| FR-7: OpenRouter Integration | E89-S09 | COVERED |
| FR-8: LLM Client Factory Refactor | E89-S02, E89-S08 | COVERED |

**Gaps:** None for functional requirements. See Section 6 for missing supporting stories.

---

## 2. Acceptance Criteria Quality

### Well-Written ACs (Examples)

- **Epic A, S01 AC4** (Dexie migration): Specific table name, version number, data survival list. Fully testable.
- **Epic B, S02 AC1-AC4** (Three-tier resolution): Each tier tested independently. Clear input/output expectations.
- **Epic A, S03 AC3** (Link update grep): Zero-occurrence check is deterministic and automatable.

### Flagged ACs — Vague or Untestable

| Story | AC | Issue | Suggested Fix |
|-------|----|-------|---------------|
| Epic A, S04 AC7 | "all functionality from ImportedCourseDetail and YouTubeCourseDetail is preserved" | Too broad. What is "all functionality"? Parenthetical list is a start but not exhaustive. | Replace with a numbered checklist: file status badges, search/filter, permissions re-grant, delete course, edit title, edit tags, thumbnail display, video count display, folder grouping. |
| Epic A, S05 AC5 | "starts a study session and tracks idle/active states (reusing useSessionStore and useIdleDetection)" | Testable in principle but depends on timing-sensitive idle detection. | Add explicit assertion: "Given a user watches >30 seconds, when checking IndexedDB, then a StudySession record exists with duration > 0." |

### Minor AC Issues

- **Epic B, S05 AC8**: "selecting a model updates `PROVIDER_DEFAULTS` override in config" — technically it should update a per-provider `selectedModel` field, not `PROVIDER_DEFAULTS` (which is a code constant). Clarify whether this means a runtime config override or an actual constant update.
- **Epic A, S08 AC4**: Auto-advance reuses existing `AutoAdvanceCountdown` but doesn't specify what triggers "lesson completion" (video `ended` event? 90% progress?). This should reference the existing trigger mechanism.

---

## 3. Dependency Chain

### Epic A Dependency Graph

```
S01 (dead code removal)
 └─ S02 (adapter layer)
     └─ S03 (route consolidation)
         ├─ S04 (unified detail page)
         │   └─ S10 (reorder dialog)
         ├─ S05 (unified player - video)
         │   ├─ S06 (PDF viewer)
         │   ├─ S07 (notes panel)
         │   ├─ S08 (nav + breadcrumbs)
         │   └─ S09 (quiz wiring) ← also depends on S03
         └─ S11 (cleanup) ← depends on S04-S10
```

**Assessment:** Clean linear chain in Phase 1 (S01 -> S02 -> S03). Phase 2 and 3 correctly fan out from S03/S05. No circular dependencies. S04 and S05 can run in parallel after S03 (both only depend on S03).

### Epic B Dependency Graph

```
S01 (types + constants)
 ├─ S02 (model resolver + factory)
 │   ├─ S06 (per-feature UI) ← also depends on S05
 │   │   └─ S07 (temperature/tokens)
 │   └─ S08 (wire all consumers)
 └─ S03 (multi-provider BYOK)
     ├─ S04 (model discovery)
     │   ├─ S05 (global model picker UI)
     │   └─ S09 (OpenRouter) ← also depends on S03
     └─ S09 (OpenRouter)
```

**Assessment:** Clean. S01 is the only root. S02 and S03 can run in parallel (both only depend on S01). No circular dependencies.

### Can Phase 1 Stories Be Done Independently?

**Epic A Phase 1:** S01 has no dependencies (correct). S02 depends on S01 (correct — needs dead code gone first). S03 depends on S02 (correct — needs adapters before route consolidation).

**Epic B Phase 1:** S01 has no dependencies (correct). S02 depends on S01 (correct). S03 depends on S01 (correct — needs new type fields).

**Verdict:** Dependency ordering is correct and well-justified.

---

## 4. Architecture-Story Alignment

### Codebase Spot-Check Results

| Architecture Claim | Actual Codebase | Match? |
|---|---|---|
| `Course` type at types.ts lines 92-109 | Confirmed: lines 92-109, 18-field interface | YES |
| `CourseSource = 'local' \| 'youtube'` at line 148 | Confirmed: line 148 | YES |
| `ImportedCourse` with `source?: CourseSource` | Confirmed: line 167, optional with backward compat | YES |
| `useCourseStore` is read-only, no add method | Confirmed: only `loadCourses()`, reads from `db.courses` | YES |
| 3 route families in `routes.tsx` | Confirmed: `/courses/*` (lines 197-243), `/imported-courses/*` (lines 245-275), `/youtube-courses/*` (lines 261-275) | YES |
| `AIConfigurationSettings` has no `featureModels` field | Confirmed: no `featureModels` or `providerKeys` field exists | YES |
| `AIProviderId` = 6 providers, no `openrouter` | Confirmed: `'openai' \| 'anthropic' \| 'groq' \| 'glm' \| 'gemini' \| 'ollama'` | YES |
| Dead routes at `/courses/:courseId/overview`, `/courses/:courseId`, `/courses/:courseId/:lessonId` | Confirmed: lines 197-219 render `CourseOverview`, `CourseDetail`, `LessonPlayer` (dead components) | YES |
| Quiz routes already exist under `/courses/:courseId/lessons/...` | Confirmed: lines 221-243 | YES |

**Verdict:** Architecture claims are accurate. All 9 spot-checks pass. The brainstorming doc's line-number references are precise.

### Story-Architecture Contradictions

**One minor discrepancy found:**

- Architecture doc says quiz routes are "dead routes (deleted immediately, no redirects)" but then also says "Quiz routes are kept but re-parented under the new `/courses/` tree." This is self-contradictory. The stories (S01 AC5, S09) correctly keep quiz routes and wire them — the "deleted immediately" list in the architecture doc should NOT include quiz routes. This is a documentation issue, not a code issue; the stories are correct.

---

## 5. Risk Coverage

### Epic A: Top Risks vs. Story Coverage

| Risk (from PRD) | Covered By | Assessment |
|---|---|---|
| R1: Bookmark/URL breakage | S03 (redirect layer) + E2E tests | COVERED |
| R2: Feature regression in unified player | S11 AC5 (full E2E pass), S05 AC7 (error states) | COVERED |
| R3: Adapter abstraction leaks | S02 AC6 ("never check course.source directly") | COVERED |
| R4: YouTube-specific edge cases | S02 AC5 (YouTube embed URL), S05 AC2 (iframe embed) | COVERED |
| R5: Dexie v30 migration failure | S01 AC4 (migration test) | COVERED |
| R6: FileSystemDirectoryHandle loss | NOT covered by any specific AC | GAP — see below |
| R7: Large unified player (>300 lines) | S04 AC8, S05 AC8 (300-line cap) | COVERED |
| R8: Internal links missed | S03 AC3 (grep for zero occurrences) | COVERED |

**Gap: R6 (FileSystemDirectoryHandle permission loss)** — The PRD acknowledges this as a pre-existing issue and says "Document as known limitation. Handle re-permission prompts gracefully in the adapter." However, no story AC explicitly validates this behavior in the unified player. S05 AC7 mentions "permission denied" error UI but does not validate the re-grant flow.

**Recommendation:** Add an AC to S05 or S02: "Given a local course whose directory handle permissions have been revoked, when the unified player loads, then a re-grant permission prompt renders with a button that triggers `requestPermission()` on the handle."

### Epic B: Top Risks vs. Story Coverage

| Risk (from PRD) | Covered By | Assessment |
|---|---|---|
| R1: Model list staleness | S04 AC8 (static fallback), S05 AC6 (custom model ID) | COVERED |
| R2: Invalid model selection | S08 AC5 (zero-override backward compat) | PARTIAL — no AC for runtime validation of user-selected model |
| R3: Cost surprise | S05 AC4 (cost tier badges) | COVERED |
| R4: Refactoring breaks AI features | S08 AC5-AC6 (backward compat + E2E) | COVERED |
| R5: Settings page overwhelming | S06 AC1 (progressive disclosure) | COVERED |
| R8: Server/client model divergence | S01 AC3, S08 AC4 (shared constants) | COVERED |

**Gap: R2 (Invalid model selection)** — No AC validates what happens when a user selects a model their API key does not have access to. The PRD says "Validate model on first use. Fall back to default with toast warning." No story implements this runtime validation. Recommend adding an AC to S08: "Given a user configures a model their API key cannot access, when the feature triggers, then the system falls back to the provider default and shows a toast error."

---

## 6. Missing Stories

### Epic A: Missing Stories

| Missing Story | Rationale | Recommended Placement |
|---|---|---|
| **E2E Test Story** | S11 says "full E2E validation pass" but no story creates the new E2E tests for unified player features (notes in player, prev/next, breadcrumbs, PDF viewer). S03 AC6 updates existing tests, but new features need new tests. | Add S12: "Write E2E tests for unified player features" (3 points, after S08-S10). Alternatively, embed test-writing ACs into each feature story (S06-S10). |

**Note:** Individual stories do mention "E2E tests" in their ACs (S01 AC7, S03 AC6, S11 AC5), but none create tests for the NEW features (notes panel in player, breadcrumbs, prev/next nav). The existing E2E tests only cover the old imported/YouTube player behavior.

### Epic B: Missing Stories

| Missing Story | Rationale | Recommended Placement |
|---|---|---|
| **E2E Test Story for Model Selection** | S09 in the PRD release plan mentions "E2E tests for model selection flows, multi-provider configuration, and zero-override backward compatibility" but Epic B's S09 is the OpenRouter story. The dedicated E2E test story from the PRD got replaced. | Add S10: "E2E tests for model selection flows" (2 points, after S08). |
| **Multi-Provider API Key UI Story** | PRD Phase 2 lists S05 as "Add multi-provider BYOK UI — per-provider API key entry with accordion in Settings" but Epic B's S05 is the model picker UI. The BYOK UI story was absorbed into S03 (backend) without a dedicated UI story. | The UI for entering multiple API keys needs a story. S03 only adds the storage layer. Add S10 or extend S05/S06 ACs to include per-provider key entry UI. |

---

## 7. Epic ID Conflicts — BLOCKER

**Both epics use E89 for all story IDs.**

- Epic A (Course Unification): E89-S01 through E89-S11
- Epic B (AI Model Selection): E89-S01 through E89-S09

This creates 20 stories with overlapping IDs (e.g., both have E89-S01, E89-S02, etc.). This will cause confusion in sprint tracking, story files, branch names, and the `sprint-status.yaml` workflow.

### Recommended Resolution

| Epic | Current ID | Proposed ID | Rationale |
|------|-----------|-------------|-----------|
| Course Experience Unification (Epic A) | E89 | **E89** (keep) | Ships first per brainstorming recommendation |
| AI Model Selection Per Feature (Epic B) | E89 | **E90** | Next available sequential ID |

**Action Required:** Renumber all story IDs in `epic-ai-model-selection-per-feature.md` from E89-S## to E90-S##. Update the cross-references in the PRD's release plan section.

---

## 8. Effort Estimates

### Epic A (Total: 35 points across 11 stories)

| Story | Points | Assessment | Notes |
|-------|--------|------------|-------|
| S01: Dead code removal | 3 | Fair | Deletion is straightforward, but Dexie v30 migration + extraction notes add complexity |
| S02: Adapter layer | 3 | Fair | Interface + 2 implementations + hook + unit tests |
| S03: Route consolidation | 2 | **UNDER-ESTIMATED** | Grep-and-replace across ~15-20 .tsx files + all E2E .spec.ts files is significant. Recommend **3 points**. |
| S04: Unified CourseDetail | 5 | Fair | Replacing 2 complex pages (~1,023 lines combined) |
| S05: Unified LessonPlayer | 5 | Fair | Replacing 2 players (~671 lines combined) with adapter integration |
| S06: PDF viewer | 3 | Fair | New component with potential library dependency (react-pdf) |
| S07: Notes panel | 3 | Fair | Integration story, reusing existing NoteEditor |
| S08: Nav + Breadcrumbs | 3 | Fair | Two features combined, but both are relatively simple |
| S09: Quiz wiring | 2 | Fair | Mostly verification + button addition |
| S10: Reorder dialog | 3 | Fair | DnD across groups is non-trivial |
| S11: Cleanup | 2 | Fair | Deletion + validation |

### Epic B (Total: 22 points across 9 stories)

| Story | Points | Assessment | Notes |
|-------|--------|------------|-------|
| S01: Types + constants | 2 | Fair | Type definitions + shared module extraction |
| S02: Resolver + factory | 3 | Fair | Core logic with unit tests |
| S03: Multi-provider BYOK | 2 | Fair | Storage layer with backward compat |
| S04: Model discovery | 3 | Fair | Multiple provider APIs + caching + server proxy routes |
| S05: Global model picker UI | 3 | Fair | New component + OllamaModelPicker refactor |
| S06: Per-feature override UI | 3 | Fair | Progressive disclosure with auto-save |
| S07: Temperature/tokens | 2 | Fair | Extending existing override panel |
| S08: Wire all consumers | 3 | **UNDER-ESTIMATED** | High-risk story touching 5+ files with different client construction patterns. Migration must preserve exact model behavior. Recommend **5 points**. |
| S09: OpenRouter | 3 | Fair | New provider + server proxy + model discovery extension |

### Summary

| Epic | Current Total | Adjusted Total | Delta |
|------|--------------|----------------|-------|
| A | 35 pts | 36 pts | +1 (S03) |
| B | 22 pts | 24 pts | +2 (S08) |

---

## 9. Cross-Epic Dependencies

### Can the epics run in parallel?

**Not recommended.** The brainstorming doc correctly identifies three coupling points:

1. **AI Summary in Player** — Epic A builds the unified player; Epic B changes how models are resolved for summaries displayed in that player. Parallel development creates merge conflicts in the player's AI panel.
2. **Auto-Analysis on Import** — Both epics touch AI consumer files (`aiSummary.ts`, `noteQA.ts`).
3. **Simpler wiring** — After Epic A, there is one player, one detail page. Epic B's S08 (wire all consumers) touches fewer files.

### Recommended Sequencing

```
Epic A (E89, ~36 pts, ~11 stories)
  → then →
Epic B (E90, ~24 pts, ~9 stories)
```

**Hard dependencies:** None. Epic B CAN technically start before Epic A finishes.

**Soft dependencies:** Epic B's S08 (wire consumers) is simpler after Epic A's S05 (unified player) merges, since there is only one player to wire instead of three.

**Optimization:** Epic B's Phase 1 (S01-S03: types, resolver, BYOK storage) is purely backend/config work with zero overlap with Epic A. These 3 stories (~7 points) could start in parallel with Epic A's later stories (S07-S11) if velocity demands it.

---

## 10. Additional Observations

### Strengths of the Pipeline

1. **Codebase accuracy** — Line numbers, file paths, and type definitions in the artifacts match the actual source code precisely. This is rare and valuable.
2. **Research grounding** — Domain research cites 30+ sources with actionable patterns. Anti-patterns section ("What NOT To Do") prevents common mistakes.
3. **Progressive approach** — Both epics use phased delivery. Epic A's adapter-now-rewrite-later (A4 hybrid) is pragmatic. Epic B's progressive disclosure UI respects casual users.
4. **Dead code identified precisely** — The dependency graph in A3 is verified correct by codebase spot-check.

### Concerns

1. **Epic A S01 creates a reference document** (`docs/plans/lesson-player-extraction-notes.md`) — This is process overhead. The architecture doc A4 section already captures extraction patterns. Consider whether S01 AC6 adds value beyond what already exists.
2. **Epic B PRD mentions `analytics` in ConsentSettings** but `AIFeatureId` (S01 AC1) does not include `analytics`. Either `analytics` should be added to `AIFeatureId` or explicitly noted as out-of-scope for per-feature model assignment.
3. **Quiz routes pre-exist under `/courses/:courseId/lessons/...`** — These currently render against the dead Course system. Epic A S01 plans to remove them (AC5), but S09 needs them. The ordering S01 -> ... -> S09 means quiz routes are dead for stories S01-S08. Confirm that no E2E tests exercise quiz routes during that window, or keep them alive in S01 and only delete the dead page bindings (not the route paths).

---

## Checklist for Sprint Planning

- [ ] **BLOCKER: Renumber Epic B from E89 to E90** (or next available)
- [ ] Add AC for FileSystemDirectoryHandle re-grant flow (Epic A, S05 or S02)
- [ ] Add AC for invalid model runtime fallback (Epic B, S08)
- [ ] Bump S03 (route consolidation) from 2 to 3 points
- [ ] Bump S08 (wire consumers, Epic B) from 3 to 5 points
- [ ] Add missing E2E test story for Epic B (model selection flows)
- [ ] Clarify multi-provider BYOK UI ownership (Epic B — S03 is backend only)
- [ ] Clarify quiz route lifecycle during Epic A (S01 deletes routes, S09 needs them)
- [ ] Resolve `analytics` vs `AIFeatureId` enumeration gap in Epic B
- [ ] Review whether S01 AC6 (extraction reference doc) is redundant with architecture doc A4
