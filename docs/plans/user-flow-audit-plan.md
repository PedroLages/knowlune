# Plan: User Flow Documentation + Live Design Audit for All 33 Pages

> **Action:** Save this plan to `docs/plans/user-flow-audit-plan.md` and add as Section 18 in the product roadmap. No implementation now — scheduled for later.

## Context

Knowlune has 33 user-facing pages but no documented user flows. The app has 100+ E2E test specs covering individual features, but no cross-page journey documentation or live-verified style compliance. This plan creates flows that serve four purposes:

1. **Manual QA testing reference** — step-by-step "click X, expect Y, see Z" for each page
2. **E2E test specs** — inform Playwright test scenarios for journey-level coverage
3. **Living product documentation** — onboard contributors to how the app works
4. **Style & design compliance audit** — verify each page follows design tokens, WCAG, responsive design, and styling.md conventions

## What to Create

**File:** `docs/user-flows/` directory with one markdown file per page + cross-page journey files

### Structure per page flow

```markdown
# [Page Name] — User Flows

> **Route:** `/path`
> **File:** `src/app/pages/PageName.tsx`
> **Premium:** Yes/No
> **Nav Group:** Library / Study / Track

## Page Purpose
One-line description of what this page does.

## Entry Points
How users reach this page (sidebar nav, deep link, redirect from another page).

## Pre-conditions
What state must exist for the page to function (courses imported, logged in, etc.).

## Flows

### Flow 1: [Primary action]
| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to /path | Page loads, shows [content] |
| 2 | Click [element] | [Result] |
| ... | ... | ... |

### Flow 2: [Secondary action]
...

## Empty States
What the user sees when there's no data.

## Error States
What happens on failures (network, missing data, permission denied).

## Accessibility
Keyboard navigation, screen reader behavior, focus management.

## Style & Design Compliance
Checked via live browser inspection against .claude/rules/styling.md:
- [ ] Design tokens only (no hardcoded colors like bg-blue-600)
- [ ] Correct border radius (rounded-[24px] cards, rounded-xl buttons)
- [ ] 8px spacing grid (multiples of 0.5rem)
- [ ] Touch targets ≥44x44px on mobile
- [ ] Text contrast ≥4.5:1 (WCAG AA)
- [ ] Responsive: mobile (<640px), tablet (640-1024px), desktop (>1024px)
- [ ] Brand button variants used correctly (variant="brand" not className="bg-brand")
- [ ] Semantic HTML (nav, main, button vs div)
- [ ] Dark mode renders correctly

### Issues Found
| Issue | Severity | Element | Screenshot |
|-------|----------|---------|------------|
| (filled during live review) | | | |

## E2E Test Mapping
Which existing test files cover this page, and what gaps remain.
```

### Page inventory (33 pages)

**Library Group (5):**
1. Overview (`/`) — Dashboard with stats, achievements, continue learning, study goals
2. Courses (`/courses`) — Browse/search/filter/import courses
3. Learning Paths (`/learning-paths`) — Browse/create/manage learning paths
4. Career Paths (`/career-paths`) — Browse career development paths
5. Authors (`/authors`) — Author list, create/edit/delete custom authors

**Course Detail Group (8):**
6. Course Detail (`/courses/:courseId`) — Single course with modules/lessons
7. Course Overview (`/courses/:courseId/overview`) — Course summary
8. Lesson Player (`/courses/:courseId/:lessonId`) — Video/PDF player, notes, transcripts
9. Quiz (`/courses/:courseId/lessons/:lessonId/quiz`) — Quiz taking
10. Quiz Results (`.../quiz/results`) — Quiz completion results
11. Quiz Review (`.../quiz/review/:attemptId`) — Past quiz answer review
12. Imported Course Detail (`/imported-courses/:courseId`)
13. YouTube Course Detail (`/youtube-courses/:courseId`)

**Study Group (7):**
14. My Courses (`/my-class`) — Enrolled courses with progress
15. Notes (`/notes`) — Note library with search/filter/export
16. Chat Q&A (`/notes/chat`) — AI-powered Q&A (premium)
17. Flashcards (`/flashcards`) — Flashcard review dashboard (premium)
18. Review Queue (`/review`) — Spaced repetition review (premium)
19. Interleaved Review (`/review/interleaved`) — Interleaved SRS (premium)
20. AI Learning Path (`/ai-learning-path`) — AI-generated paths (premium)

**Track Group (5):**
21. Challenges (`/challenges`) — User-created challenges with progress
22. Knowledge Gaps (`/knowledge-gaps`) — AI gap analysis (premium)
23. Retention Dashboard (`/retention`) — Retention metrics (premium)
24. Session History (`/session-history`) — Past study sessions timeline
25. Reports (`/reports`) — Multi-tab analytics (study, quizzes, AI)

**Settings & Auth (4):**
26. Settings (`/settings`) — Display, profile, data, account settings
27. Login (`/login`) — Auth (email, magic link, Google OAuth)
28. Learning Path Detail (`/learning-paths/:pathId`) — Path customization
29. Author Profile (`/authors/:authorId`) — Author detail

**Utility (4):**
30. Imported Lesson Player (`/imported-courses/:courseId/lessons/:lessonId`)
31. YouTube Lesson Player (`/youtube-courses/:courseId/lessons/:lessonId`)
32. Career Path Detail (`/career-paths/:pathId`)
33. Not Found (`*`) — 404 page

### Cross-page journeys (8-10)

After per-page flows, create journey files that chain pages together:

1. **First-time user journey** — Login → Overview (empty) → Import course → Watch first lesson → Complete session
2. **Daily study loop** — Overview → Continue learning → Lesson Player → Notes → Session Complete → Overview (updated)
3. **Quiz cycle** — Lesson Player → Generate/Take Quiz → Results → Review → Knowledge Gaps
4. **Flashcard review cycle** — Flashcards dashboard → Review session → Summary → Retention Dashboard
5. **Course management** — Courses → Import (folder/YouTube/bulk) → Course Detail → Edit → Delete
6. **Learning path creation** — Learning Paths → Create → Add courses → Reorder → AI order → Study
7. **Note-taking workflow** — Lesson Player → Create note → Notes page → Search → Export → Chat Q&A
8. **Progress tracking loop** — Session History → Reports → Challenges → Overview stats
9. **Settings & account** — Login → Settings → Theme → Profile → Export data → Sign out
10. **Premium upgrade flow** — Free feature → Premium gate → Upgrade → Access premium feature

### File structure

```
docs/user-flows/
├── README.md                          # Index of all flows + how to use them
├── pages/
│   ├── 01-overview.md
│   ├── 02-courses.md
│   ├── 03-learning-paths.md
│   ├── ...
│   └── 33-not-found.md
└── journeys/
    ├── 01-first-time-user.md
    ├── 02-daily-study-loop.md
    ├── ...
    └── 10-premium-upgrade.md
```

## How to Create

This is a **live audit + documentation** task. Each batch has two phases:

1. **Code reading** — Read page components to understand expected flows
2. **Live browser testing** — Navigate the actual running app via Playwright MCP, click through each flow, verify behavior, take screenshots, check style compliance

**Pre-requisite:** Start the dev server before each session:
```bash
npm run dev   # http://localhost:5173
```

**Recommended approach:** Run in new Claude sessions, batched by page group. Each batch uses this sequence:

### Per-batch execution sequence

**Step 1 — Read code + write draft flows**
Read all page components in the batch, cross-reference E2E tests, write the flow documents with expected behavior.

**Step 2 — Live browser verification**
Use the Playwright MCP or design-review agent to navigate each page:
- Click through every flow step documented in Step 1
- Take screenshots at key states (loaded, empty, error, mobile, dark mode)
- Verify actual behavior matches documented expectations
- Fill in the "Style & Design Compliance" checklist per page
- Log any issues found in the "Issues Found" table

**Step 3 — Fix or flag**
- Minor fixes (text overlap, spacing, missing ARIA) → fix immediately
- Medium issues (hardcoded colors, broken responsive) → create bug entries in docs/known-issues.yaml
- Major issues (broken flows, missing features) → flag for story creation

This is similar to what `/review-story` does — but applied to every page, not just new stories.

### Batching strategy

33 pages in 4 batches, each run in a separate Claude session:

### Batch 1 — Library + Course Detail (13 pages)
```
Create user flow documentation with live browser verification for Knowlune pages 1-13.

IMPORTANT: The dev server is running at http://localhost:5173. You MUST use Playwright MCP to navigate each page, click through flows, and verify behavior visually. Do NOT just read code — act as a real user.

## Phase 1: Read code + draft flows

Read each component file and create a flow document per page at docs/user-flows/pages/ using the template in this plan.

Pages:
1. Overview — src/app/pages/Overview.tsx (route: /)
2. Courses — src/app/pages/Courses.tsx (route: /courses)
3. Learning Paths — src/app/pages/LearningPaths.tsx (route: /learning-paths)
4. Career Paths — src/app/pages/CareerPaths.tsx (route: /career-paths)
5. Authors — src/app/pages/Authors.tsx (route: /authors)
6. Course Detail — src/app/pages/CourseDetail.tsx (route: /courses/:courseId)
7. Course Overview — src/app/pages/CourseOverview.tsx (route: /courses/:courseId/overview)
8. Lesson Player — src/app/pages/LessonPlayer.tsx (route: /courses/:courseId/:lessonId)
9. Quiz — src/app/pages/Quiz.tsx (route: /courses/:courseId/lessons/:lessonId/quiz)
10. Quiz Results — src/app/pages/QuizResults.tsx
11. Quiz Review — src/app/pages/QuizReview.tsx
12. Imported Course Detail — src/app/pages/ImportedCourseDetail.tsx
13. YouTube Course Detail — src/app/pages/YouTubeCourseDetail.tsx

## Phase 2: Live browser verification

For EACH page, use Playwright MCP to:
1. Navigate to the page at http://localhost:5173{route}
2. Take a screenshot (desktop viewport)
3. Click through every documented flow step — verify actual behavior matches expected
4. Resize to mobile (<640px) — take screenshot, verify responsive layout
5. Toggle dark mode — verify dark mode renders correctly
6. Check the Style & Design Compliance checklist:
   - Design tokens only (no hardcoded colors)?
   - Correct border radius, spacing grid?
   - Touch targets ≥44x44px on mobile?
   - Text contrast ≥4.5:1?
   - Brand button variants used correctly?
   - Semantic HTML?
7. Log any issues in the "Issues Found" table with severity

## Phase 3: Fix or flag

- Minor fixes (text overlap, spacing, missing ARIA label) → fix immediately, note in flow doc
- Medium/major issues → add to docs/known-issues.yaml with KI-### number

Also create docs/user-flows/README.md as the index file.
Cross-reference existing E2E tests in tests/e2e/.

Style guide reference: .claude/rules/styling.md
Design tokens: src/styles/theme.css
```

### Batch 2 — Study + Track groups (12 pages)
```
Create user flow documentation with live browser verification for Knowlune pages 14-25.

IMPORTANT: The dev server is running at http://localhost:5173. You MUST use Playwright MCP to navigate each page, click through flows, and verify behavior visually.

## Phase 1: Read code + draft flows

Pages:
14. My Courses — src/app/pages/MyClass.tsx (route: /my-class)
15. Notes — src/app/pages/Notes.tsx (route: /notes)
16. Chat Q&A — src/app/pages/ChatQA.tsx (route: /notes/chat) [PREMIUM]
17. Flashcards — src/app/pages/Flashcards.tsx (route: /flashcards) [PREMIUM]
18. Review Queue — src/app/pages/ReviewQueue.tsx (route: /review) [PREMIUM]
19. Interleaved Review — src/app/pages/InterleavedReview.tsx (route: /review/interleaved) [PREMIUM]
20. AI Learning Path — src/app/pages/AILearningPath.tsx (route: /ai-learning-path) [PREMIUM]
21. Challenges — src/app/pages/Challenges.tsx (route: /challenges)
22. Knowledge Gaps — src/app/pages/KnowledgeGaps.tsx (route: /knowledge-gaps) [PREMIUM]
23. Retention Dashboard — src/app/pages/RetentionDashboard.tsx (route: /retention) [PREMIUM]
24. Session History — src/app/pages/SessionHistory.tsx (route: /session-history)
25. Reports — src/app/pages/Reports.tsx (route: /reports)

## Phase 2: Live browser verification

Same process as Batch 1 — navigate, screenshot, click flows, check responsive, dark mode, style compliance.

For PREMIUM pages, verify BOTH:
- Free/unauthenticated view: the premium gate screen (PremiumFeaturePage wrapper)
- Premium view: the actual feature (if testable — may need premium flag in localStorage)

## Phase 3: Fix or flag
Same as Batch 1.

Style guide: .claude/rules/styling.md | Design tokens: src/styles/theme.css
```

### Batch 3 — Settings, Auth, Remaining + Lesson Players (8 pages)
```
Create user flow documentation with live browser verification for Knowlune pages 26-33.

IMPORTANT: The dev server is running at http://localhost:5173. You MUST use Playwright MCP to navigate each page, click through flows, and verify behavior visually.

## Phase 1: Read code + draft flows

Pages:
26. Settings — src/app/pages/Settings.tsx (route: /settings)
27. Login — src/app/pages/Login.tsx (route: /login)
28. Learning Path Detail — src/app/pages/LearningPathDetail.tsx (route: /learning-paths/:pathId)
29. Author Profile — src/app/pages/AuthorProfile.tsx (route: /authors/:authorId)
30. Imported Lesson Player — src/app/pages/ImportedLessonPlayer.tsx
31. YouTube Lesson Player — src/app/pages/YouTubeLessonPlayer.tsx
32. Career Path Detail — src/app/pages/CareerPathDetail.tsx
33. Not Found — src/app/pages/NotFound.tsx

For Settings: document each section (Display, Profile, Data, Account) as separate sub-flows.
For Login: document all auth methods (email/password, magic link, Google OAuth, sign up vs sign in).

## Phase 2: Live browser verification

Same process as Batch 1 — navigate, screenshot, click flows, responsive, dark mode, style compliance.

Special attention:
- Settings: verify every toggle/input actually persists (reload page, check localStorage)
- Login: test each auth method flow (may need Supabase running for full verification)
- 404 page: navigate to a non-existent route, verify graceful handling

## Phase 3: Fix or flag
Same as Batch 1.

Style guide: .claude/rules/styling.md | Design tokens: src/styles/theme.css
```

### Batch 4 — Cross-page journeys (10 journeys) — LIVE TESTING ONLY
```
Create 10 cross-page journey files at docs/user-flows/journeys/ by ACTUALLY walking through each journey in the live app.

IMPORTANT: The dev server is running at http://localhost:5173. For this batch, Playwright MCP is the PRIMARY tool — you are a user clicking through the app, not just reading code.

## Process per journey

1. Start at the journey's entry point in the browser
2. Click through every step in the flow
3. Take screenshots at each page transition
4. Verify data carries between pages (e.g., course imported → appears in My Courses → shows in Overview)
5. Document ACTUAL behavior (which may differ from expected)
6. Note any broken transitions, missing links, or data inconsistencies
7. Check style compliance at each page visited (same checklist as per-page flows)

## Journeys to walk through

1. First-time user — Login → Overview (empty) → Import course → Watch lesson → Session complete
2. Daily study loop — Overview → Continue → Lesson Player → Notes → Session Complete → Overview
3. Quiz cycle — Lesson → Quiz → Results → Review → Knowledge Gaps
4. Flashcard review — Dashboard → Review → Summary → Retention
5. Course management — Courses → Import wizard → Course Detail → Edit → Delete
6. Learning path creation — Paths → Create → Add courses → Reorder → AI → Study
7. Note-taking workflow — Lesson Player → Note → Notes page → Search → Export → Chat Q&A
8. Progress tracking — Session History → Reports → Challenges → Overview
9. Settings & account — Login → Settings → Theme → Profile → Export → Sign out
10. Premium upgrade — Free feature → Gate → Upgrade path → Premium feature access

## For each journey document

- Pre-conditions (what data/state must exist)
- Step-by-step with page transitions highlighted
- Screenshots at key transitions
- Expected vs actual behavior (flag discrepancies)
- Data consistency checks (did the data from page A show up on page B?)
- Style compliance at each page visited
- Bugs/issues found → add to docs/known-issues.yaml
- E2E test coverage status (which steps have existing tests?)
- E2E test gaps → recommend new test specs

Style guide: .claude/rules/styling.md | Design tokens: src/styles/theme.css
```

## After All 4 Batches Complete

1. **Update product roadmap** — add reference to user flows in Section 16 (Onboarding & UX Polish)
2. **Triage new known issues** — all issues found during live testing should be in docs/known-issues.yaml with severity
3. **E2E test gap report** — compile list of flows with no corresponding test spec → candidates for new E2E tests
4. **Style compliance report** — summarize how many pages pass all style checks vs. how many have issues
5. **Fix backlog** — minor fixes done during batches, medium/major issues become stories for next sprint

## Deliverables Summary

| Deliverable | Count | Location |
|-------------|-------|----------|
| Per-page flow docs | 33 | `docs/user-flows/pages/` |
| Cross-page journey docs | 10 | `docs/user-flows/journeys/` |
| Index | 1 | `docs/user-flows/README.md` |
| Style compliance checklists | 33 | Embedded in each page flow doc |
| Screenshots | ~100+ | Referenced in flow docs |
| New known issues | TBD | `docs/known-issues.yaml` |
| Minor fixes applied | TBD | Committed during batches |

## Verification

- Every page in `src/app/pages/` has a corresponding flow document
- Every flow was verified via live browser testing (not just code reading)
- Every flow step references a real UI element (verified by clicking it)
- Cross-page journeys cover the 10 core workflows
- Style compliance checklist completed for all 33 pages
- README.md index links to all flow files
- Premium flows document both gate and feature behavior
- All issues found are tracked in docs/known-issues.yaml
