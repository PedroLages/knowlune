# Complete Wave Execution Guide — All Commands in Order

> **Last Updated:** 2026-03-29

## Context
Comprehensive execution guide for all 5 waves. Each step lists the exact command/prompt to run. Story execution always follows: `/start-story` → implement → `/review-story` → fix → `/finish-story`.

## Bug Found: PDF Preview Broken
- **Symptom:** "Unable to preview this document inline" on Materials tab
- **Files:** `src/app/components/figma/PdfViewer/PdfViewer.tsx:61`, `usePdfViewerState.ts:103-106`
- **Action:** Add as bug fix before Wave 1 continues

---

## Pre-Wave: Bug Fix

```
1. /bmad-quick-spec                  → "PDF materials preview broken — shows 'Unable to preview' fallback"
2. /start-story E43-BUG01            → Fix PDF preview (investigate react-pdf load error, /media route, worker config)
3. /review-story E43-BUG01
4. /finish-story E43-BUG01
```

---

## WAVE 1: Foundation

### Step 1: Close out E43
```
1. /start-story E43-S08              → Auth UX polish (already in progress)
2. /review-story E43-S08
3. /finish-story E43-S08
4. /sprint-status                    → Verify E43 fully complete
5. /testarch-trace                   → Requirements-to-tests traceability for E43
6. /retrospective E43                → Lessons learned, pattern extraction
```

### Step 2: E50 — Calendar Phase 1-2 (6 stories)
```
7.  /start-story E50-S01             → Study schedule data model
8.  /review-story E50-S01
9.  /finish-story E50-S01
10. /start-story E50-S02             → iCal feed generation endpoint
11. /review-story E50-S02
12. /finish-story E50-S02
13. /start-story E50-S03             → Feed URL management
14. /review-story E50-S03
15. /finish-story E50-S03
16. /start-story E50-S04             → Calendar Settings UI
17. /review-story E50-S04
18. /finish-story E50-S04
19. /start-story E50-S05             → Schedule editor + course integration
20. /review-story E50-S05
21. /finish-story E50-S05
22. /start-story E50-S06             → SRS events overview widget
23. /review-story E50-S06
24. /finish-story E50-S06
25. /retrospective E50
```

### Step 3: E53 — PKM Export Phase 1 (3 stories)
```
26. /start-story E53-S01             → Flashcard/bookmark Markdown export
27. /review-story E53-S01
28. /finish-story E53-S01
29. /start-story E53-S02             → Anki .apkg export
30. /review-story E53-S02
31. /finish-story E53-S02
32. /start-story E53-S03             → PKM batch export Settings UI
33. /review-story E53-S03
34. /finish-story E53-S03
35. /retrospective E53
```

### Step 4: E54 — Lesson Flow (3 stories)
```
36. /start-story E54-S01             → Wire lesson flow imported player
37. /review-story E54-S01
38. /finish-story E54-S01
39. /start-story E54-S02             → Wire lesson flow YouTube player
40. /review-story E54-S02
41. /finish-story E54-S02
42. /start-story E54-S03             → Completion checkmarks imported course detail
43. /review-story E54-S03
44. /finish-story E54-S03
45. /retrospective E54
```

### Step 5: E55 — Stitch UI Phase 1 (5 stories)
```
46. /start-story E55-S01             → Pomodoro Zustand store
47. /review-story E55-S01
48. /finish-story E55-S01
49. /start-story E55-S02             → Focus timer dashboard widget
50. /review-story E55-S02
51. /finish-story E55-S02
52. /start-story E55-S03             → Today's focus stats card
53. /review-story E55-S03
54. /finish-story E55-S03
55. /start-story E55-S04             → Streak calendar month view
56. /review-story E55-S04
57. /finish-story E55-S04
58. /start-story E55-S05             → Streak header upgrade
59. /review-story E55-S05
60. /finish-story E55-S05
61. /retrospective E55
```

### Wave 1 Wrap-up
```
62. /sprint-status                   → Full Wave 1 status check
63. /app-audit                       → Post-wave quality check
```

---

## WAVE 2: Intelligence

### Step 1: E52 — ML Phase 1 Hybrid (4 stories)
```
64. /start-story E52-S01             → Simplified quiz generation
65. /review-story E52-S01
66. /finish-story E52-S01
67. /start-story E52-S02             → Quiz generation UI
68. /review-story E52-S02
69. /finish-story E52-S02
70. /start-story E52-S03             → Basic quiz quality control
71. /review-story E52-S03
72. /finish-story E52-S03
73. /start-story E52-S04             → Tag-based recommendations
74. /review-story E52-S04
75. /finish-story E52-S04
76. /retrospective E52
    ── 2-WEEK VALIDATION GATE: "Did users use generated quizzes?" ──
    IF YES → plan E52 full scope (8 stories)
    IF NO  → deprioritize ML Phase 2
```

### Step 2: E56 — Knowledge Map Phase 1 (4 stories)
```
77. /start-story E56-S01             → Topic resolution service
78. /review-story E56-S01
79. /finish-story E56-S01
80. /start-story E56-S02             → Knowledge score calculation Zustand store
81. /review-story E56-S02
82. /finish-story E56-S02
83. /start-story E56-S03             → Knowledge map overview widget
84. /review-story E56-S03
85. /finish-story E56-S03
86. /start-story E56-S04             → Dedicated knowledge map page
87. /review-story E56-S04
88. /finish-story E56-S04
89. /retrospective E56
```

### Step 3: E57 — AI Tutoring Phase 1-2 (5 stories)
```
90. /start-story E57-S01             → Tutor chat UI + context injection
91. /review-story E57-S01
92. /finish-story E57-S01
93. /start-story E57-S02             → Tutor hook streaming
94. /review-story E57-S02
95. /finish-story E57-S02
96. /start-story E57-S03             → Conversation persistence
97. /review-story E57-S03
98. /finish-story E57-S03
99. /start-story E57-S04             → Socratic prompt hint ladder
100. /review-story E57-S04
101. /finish-story E57-S04
102. /start-story E57-S05            → RAG-grounded answers
103. /review-story E57-S05
104. /finish-story E57-S05
105. /retrospective E57
     ── VALIDATION GATE: "Is Socratic better than direct explanation?" ──
```

### Step 4: Plan items that need epics
```
106. /bmad-technical-research        → FSRS algorithm, ts-fsrs library, SM-2 migration
107. /bmad-create-architecture       → FSRS schema changes, migration strategy
108. /bmad-review-edge-case-hunter   → Spaced repetition migration edge cases
109. /bmad-create-epics-and-stories  → FSRS epic + stories
110. /bmad-create-story E##-S##      → Create each FSRS story file (repeat per story)

111. /bmad-quick-spec                → Calendar SRS reminders in iCal (small, connects FSRS to E50)
112. /bmad-create-story E##-S##      → 1-2 stories

113. /bmad-brainstorming             → PKM phases 2-3 Obsidian vault (review existing brainstorm)
114. /bmad-create-ux-design          → Obsidian export UI, folder picker
115. /bmad-create-epics-and-stories  → PKM phase 2-3 epic
116. /bmad-create-story E##-S##      → Create each story file

117. /bmad-quick-spec                → Notifications phase 3 (SRS reminders — add trigger to existing bus)
118. /bmad-create-story E##-S##      → 1-2 stories

119. /bmad-create-ux-design          → Notifications phase 4 preferences UI (per-type toggles, quiet hours)
120. /bmad-quick-spec                → Wire preferences UI to notification store
121. /bmad-create-story E##-S##      → 2-3 stories

122. /bmad-create-ux-design          → Stitch UI phase 2 (reference existing HTML designs in docs/plans/stitch-designs/focus/)
123. /bmad-create-epics-and-stories  → Stitch phase 2 epic
124. /bmad-create-story E##-S##      → Create each story file
```

### Step 5: Execute newly created stories
```
125-onwards: /start-story → /review-story → /finish-story for each new story
             /retrospective for each completed epic
```

### Wave 2 Wrap-up
```
/sprint-status                       → Full Wave 2 status check
/app-audit                           → Post-wave quality check
```

---

## WAVE 3: Sync

### Step 1: Create missing story files for E45-E49
```
/bmad-create-story E44-S05           → Data import/restore (new story added to E44)
/bmad-create-story E45-S01           → Create from epics-sync.md specs
/bmad-create-story E45-S02           → (repeat for all E45 stories)
... E45-S03 through E45-S06
/bmad-create-story E46-S01           → (repeat for all E46 stories)
... E46-S02 through E46-S08
```

### Step 2: E44 — Sync Pre-Requisites (4+1 stories)
```
/start-story E44-S01                 → Export v2
/review-story E44-S01
/finish-story E44-S01
/start-story E44-S02                 → Import compat
/review-story E44-S02
/finish-story E44-S02
/start-story E44-S03                 → Multi-user scoping
/review-story E44-S03
/finish-story E44-S03
/start-story E44-S04                 → ESLint rule
/review-story E44-S04
/finish-story E44-S04
/start-story E44-S05                 → Data import/restore (.knowlune bundle)
/review-story E44-S05
/finish-story E44-S05
/retrospective E44
```

### Step 3: E45 — Sync Infrastructure (6 stories)
```
/start-story E45-S01 through E45-S06 → (same pattern: start → review → finish)
/retrospective E45
```

### Step 4: E46 — P0 Sync Live (8 stories)
```
/start-story E46-S01 through E46-S08 → (same pattern)
/retrospective E46
── VALIDATION GATE: "Does P0 sync work reliably?" ──
IF YES → continue to Phase 2
IF NO  → fix issues first
```

### Step 5: Create story files for E47-E49
```
/bmad-create-story E47-S01 through all E47 stories
/bmad-create-story E48-S01 through all E48 stories
/bmad-create-story E49-S01 through all E49 stories
```

### Step 6: E47, E48, E49 — Sync Phase 2
```
/start-story → /review-story → /finish-story for each story in E47, E48, E49
/retrospective E47
/retrospective E48
/retrospective E49
```

### Step 7: Plan "unlocked by sync" items
```
/bmad-technical-research             → Google Calendar API, OAuth 2.0, Supabase token storage
/bmad-create-architecture            → Calendar phase 3 OAuth flow, event sync, conflict resolution
/bmad-create-ux-design               → Connected accounts UI, permission flow
/bmad-review-edge-case-hunter        → Timezone edge cases, token refresh, rate limits
/bmad-create-epics-and-stories       → Calendar phase 3 epic
/bmad-create-story E##-S##           → Create each story file

/bmad-quick-spec                     → Notifications phase 5 (smart triggers — decay alerts, recs)
/bmad-create-story E##-S##           → 2-3 stories

/bmad-technical-research             → Service Worker push API, browser permissions
/bmad-create-architecture            → Notifications phase 6 push subscription flow
/bmad-create-epics-and-stories       → Push notifications epic
/bmad-create-story E##-S##           → Create each story file
```

### Step 8: Plan "unlocked by Wave 2" items
```
/bmad-quick-spec                     → Knowledge Map phase 3 (decay predictions — connect FSRS to scores)
/bmad-create-story E##-S##           → 1-2 stories

/bmad-quick-spec                     → AI Tutoring phase 4 (learner profile injection)
/bmad-create-story E##-S##           → 1-2 stories

/app-audit --accessibility           → Accessibility phase 3 screen reader audit
→ Triage findings → create fix stories
/bmad-create-story E##-S##           → Stories from audit findings
```

### Step 9: Execute all newly created stories
```
/start-story → /review-story → /finish-story for each
/retrospective for each completed epic
```

### Wave 3 Wrap-up
```
/sprint-status
/app-audit                           → Post-wave quality check
/testarch-nfr                        → NFR validation (sync reliability, offline behavior)
```

---

## WAVE 4: Pre-Launch Polish

### Step 1: Audit first (findings drive fix stories)
```
/app-audit                           → Full multi-agent audit (design, code, accessibility, testing)
→ Triage findings by severity (BLOCKER → HIGH → MEDIUM)
/bmad-create-epics-and-stories       → Create fix epic from BLOCKER/HIGH findings
/bmad-create-story E##-S##           → Create each fix story
/start-story → /review-story → /finish-story for each fix
```

### Step 2: Performance Optimization (Section 21)
```
/bmad-technical-research             → Bundle analysis, Core Web Vitals baseline, profiling tools
/bmad-create-prd                     → Performance targets (LCP < 2.5s, bundle < 500KB, etc.)
/bmad-create-architecture            → Code splitting strategy, lazy loading, tree shaking
/bmad-create-epics-and-stories       → Performance epic
/bmad-create-story E##-S##           → Create each story
/start-story → /review-story → /finish-story for each
/retrospective
```

### Step 3: Accessibility Phases 4-5
```
/bmad-brainstorming                  → Reading mode UX, focus mode behavior
/bmad-create-ux-design               → Reading mode layout, focus mode overlay
/bmad-technical-research             → WCAG 2.2 delta from 2.1 AA (new criteria)
/bmad-create-epics-and-stories       → Accessibility phases 4-5 epic
/bmad-create-story E##-S##           → Create each story
/start-story → /review-story → /finish-story for each
/retrospective
```

### Step 4: Repo Split
```
/bmad-technical-research             → Monorepo split strategies, npm workspaces vs git submodules
/bmad-create-architecture            → Package boundaries, shared types, CI/CD for two repos
/bmad-review-adversarial-general     → Risk review — breaking changes, contributor workflow
/bmad-create-epics-and-stories       → Repo split epic
/bmad-create-story E##-S##           → Create each story
/start-story → /review-story → /finish-story for each
/retrospective
```

### Step 5: Bulk Operations
```
/bmad-create-ux-design               → Multi-select UI, action toolbar, confirmation dialogs
/bmad-quick-spec                     → Wire selection state + Dexie batch operations
/bmad-create-epics-and-stories       → Bulk operations epic
/bmad-create-story E##-S##           → Create each story
/start-story → /review-story → /finish-story for each
/retrospective
```

### Step 6: On-Device Embeddings
```
/bmad-technical-research             → Transformers.js models, Web Worker performance, model size vs quality
/bmad-create-architecture            → Model loading strategy, fallback to API, migration from OpenAI
/bmad-review-edge-case-hunter        → Memory limits, slow devices, model download failures
/bmad-create-epics-and-stories       → Embeddings epic
/bmad-create-story E##-S##           → Create each story
/start-story → /review-story → /finish-story for each
/retrospective
```

### Step 7: Offline UX — Storage Dashboard
```
/bmad-create-ux-design               → Storage breakdown UI, quota warnings, cleanup actions
/bmad-quick-spec                     → IndexedDB usage API, per-table size calculation
/bmad-create-story E##-S##           → 2-3 stories
/start-story → /review-story → /finish-story for each
```

### Step 8: Calendar Phase 4 (requires Waves 1+3)
```
/bmad-brainstorming                  → "Find time" UX, ML approach for slot suggestions
/bmad-create-architecture            → Free/busy parsing, scoring algorithm, suggestion ranking
/bmad-create-ux-design               → Schedule suggestion UI, time picker
/bmad-create-epics-and-stories       → Calendar phase 4 epic
/bmad-create-story E##-S##           → Create each story
/start-story → /review-story → /finish-story for each
/retrospective
```

### Step 9: Knowledge Map Phase 4
```
/bmad-quick-spec                     → Connect knowledge scores to actionable recommendations
/bmad-create-ux-design               → Suggestion cards, "review now" CTAs
/bmad-create-story E##-S##           → 2-3 stories
/start-story → /review-story → /finish-story for each
```

### Step 10: AI Tutoring Phases 5-6
```
/bmad-brainstorming                  → Conversation memory strategy, mode definitions (ELI5, Quiz Me, Debug)
/bmad-create-architecture            → Memory persistence, mode switching, prompt templates per mode
/bmad-create-ux-design               → Mode selector UI, conversation history
/bmad-create-epics-and-stories       → AI Tutoring phases 5-6 epic
/bmad-create-story E##-S##           → Create each story
/start-story → /review-story → /finish-story for each
/retrospective
```

### Step 11: PKM Phases 4-5 (Notion + Readwise)
```
/bmad-technical-research             → Notion API, Readwise API, OAuth flows, rate limits
/bmad-create-architecture            → API integration layer, token storage, sync strategy
/bmad-create-ux-design               → Connected accounts UI, export mapping config
/bmad-review-edge-case-hunter        → API failures, large exports, rate limiting
/bmad-create-epics-and-stories       → PKM phases 4-5 epic
/bmad-create-story E##-S##           → Create each story
/start-story → /review-story → /finish-story for each
/retrospective
```

### Step 12: Notifications Phase 7 — Email Digest (requires Wave 3)
```
/bmad-technical-research             → Supabase Edge Functions, email templates, MJML/React Email
/bmad-create-architecture            → Edge Function triggers, digest aggregation, unsubscribe flow
/bmad-create-ux-design               → Email template design, frequency settings
/bmad-create-epics-and-stories       → Email digest epic
/bmad-create-story E##-S##           → Create each story
/start-story → /review-story → /finish-story for each
/retrospective
```

### Step 13: Google Drive Integration (requires Wave 3)
```
/bmad-technical-research             → Google Drive API v3, OAuth 2.0 scopes, file format strategy
/bmad-create-prd                     → Full PRD — scope, premium gating, backup/restore flow
/bmad-create-architecture            → OAuth flow, file structure in Drive, incremental backup
/bmad-create-ux-design               → Backup/restore UI, connected account, storage usage
/bmad-review-adversarial-general     → Security review — OAuth token handling, data exposure
/bmad-check-implementation-readiness → Validate all docs complete
/bmad-create-epics-and-stories       → Google Drive epic
/bmad-create-story E##-S##           → Create each story
/start-story → /review-story → /finish-story for each
/retrospective
```

### Wave 4 Wrap-up
```
/sprint-status
/app-audit                           → Pre-launch full audit
/testarch-nfr                        → NFR validation
/review-adversarial                  → Final cynical review before launch
```

---

## WAVE 5: Post-Launch Growth

### Step 1: API & Plugin System (3-5 epics)
```
/bmad-brainstorming                  → API scope, plugin architecture, extensibility model
/bmad-technical-research             → REST vs GraphQL, plugin sandboxing, API versioning
/bmad-create-product-brief           → New product area — needs brief
/bmad-create-prd                     → Full PRD with API contracts, plugin lifecycle
/bmad-create-architecture            → API gateway, auth, rate limiting, plugin registry
/bmad-create-ux-design               → API key management UI, plugin marketplace
/bmad-review-adversarial-general     → Security + architecture review
/bmad-check-implementation-readiness → Validate completeness
/bmad-create-epics-and-stories       → Break into 3-5 epics
/bmad-create-story E##-S##           → Create each story file
/start-story → /review-story → /finish-story for each story
/retrospective for each epic
```

### Step 2: Books & Audiobooks Library (5-8 epics)
```
/bmad-brainstorming                  → EPUB reader tech, audiobook player, highlights UX
/bmad-technical-research             → epub.js vs readium, Web Audio API, highlight storage
/bmad-create-product-brief           → New product area — needs brief
/bmad-create-prd                     → Full PRD with reader features, audiobook controls, library mgmt
/bmad-create-architecture            → File parsing, storage strategy, reader component arch
/bmad-create-ux-design               → Reader UI, audiobook player, library shelves, highlights
/bmad-review-adversarial-general     → Scope review — is this too large?
/bmad-check-implementation-readiness → Validate completeness
/bmad-create-epics-and-stories       → Break into 5-8 epics
/bmad-create-story E##-S##           → Create each story file
/start-story → /review-story → /finish-story for each story
/retrospective for each epic
```

### Wave 5 Wrap-up
```
/sprint-status
/app-audit                           → Post-wave quality check
```
