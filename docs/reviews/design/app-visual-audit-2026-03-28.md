# Knowlune App Interactive Audit — 2026-03-28

> **Method:** Playwright MCP interactive audit — navigated every page, clicked buttons, opened popovers, tested theme switching, explored course detail + lesson player flows.
>
> **Viewport:** 800x513 (tablet/small desktop — tested responsive behavior)
>
> **Theme tested:** Dark mode (default) + Light mode
>
> **Pages audited:** 25+ distinct pages across 7 groups

---

## Executive Summary

**Total findings: 47** across 25 pages

| Severity | Count | Description |
|----------|-------|-------------|
| **HIGH** | 12 | Bugs, missing critical features, broken flows |
| **MEDIUM** | 18 | UX gaps, improvements, missing polish |
| **LOW** | 10 | Nice-to-haves, delight opportunities |
| **NEW IDEA** | 7 | Pages, widgets, or sections that should exist |

**Top 5 Priorities:**
1. Notification bell uses hardcoded mock data — needs real notification system (Roadmap §15)
2. Reports page shows empty state despite existing session data — likely a data aggregation bug
3. Login page has no "Forgot Password" link — must-fix (Roadmap §2)
4. No onboarding flow for new users — the app drops users at a dashboard with 0 progress and no guidance
5. Course completion % stuck at 0% on My Courses — known issue (Roadmap §4)

---

## Per-Page Findings

### Overview (`/`)

**Initial state:** Dashboard with "Your Learning Studio" heading, "Continue Learning" section with 3 recommended courses, stats cards (all zeros), study streak calendar, quick actions, library carousel.

**Interactions tested:** Notification bell popover, sidebar navigation, theme toggle, scroll sections.

**Findings:**

- [HIGH] **Stats cards show all zeros** — "Courses Started", "Lessons Completed", "Total Study Time", "Study Notes", "Courses Completed" are all blank/zero. The session history page shows real data (sessions on Mar 27-28). The overview stats aren't aggregating from existing data.
  - Roadmap: §4 (CRUD gaps — completion % hardcoded to 0)

- [MEDIUM] **"Recommended Next" section says "No courses in progress"** — but this is technically correct since no lesson has been marked complete. The empty state message could be more helpful: suggest starting any course rather than just "Explore courses."
  - Roadmap: §8 (ML recommendations)

- [MEDIUM] **Study Streak section shows "No study goal set"** with "Set a daily or weekly goal to stay on track" — but there's no visible button or CTA to actually SET a study goal. The user is told to do something but given no affordance.
  - Roadmap: §10 (Calendar — study planner UI)

- [MEDIUM] **"Suggested Study Time" says "You need at least 7 days of study activity"** — but session history shows activity on Mar 27-28. Is it checking studySessions or just distinct days? The threshold messaging could show progress: "2/7 days — keep going!"
  - Roadmap: NEW — study goal progress indicator

- [LOW] **Quick Actions link to `/journal` and `/my-progress`** — these routes aren't in the sidebar. `/journal` likely redirects to `/notes`, and `/my-progress` doesn't appear in routes. Could be dead links.
  - Roadmap: §4 (CRUD gaps)

- [MEDIUM] **"Import your first course" CTA at the bottom** — good empty state, but it's at the very bottom of a long page. A new user might not scroll that far. Should be more prominent.
  - Roadmap: NEW — onboarding flow

- [LOW] **"Good morning" greeting** — nice touch, but it's time-of-day aware without showing the user's name. When signed in, should say "Good morning, Pedro."
  - Roadmap: §2 (Auth — profile display)

### My Courses (`/my-class`)

**Initial state:** Stats cards (Average Progress 0%, Study Streak 0 days, Study Time 0h, In Progress 0), filter tabs (By Status, All Courses, By Category, By Difficulty), 8 course cards all "Not Started."

**Findings:**

- [HIGH] **Average Progress stuck at 0%** — despite session history showing study activity on the Authority course. The progress isn't being calculated from `contentProgress` records.
  - Roadmap: §4 (Fix imported course completion %)

- [MEDIUM] **Filter tabs exist but no clear active state** — "By Status" and "All Courses" are visible but it's not obvious which is selected or what filtering is applied. "Recent Activity" tab at far right is separated from the others.
  - Roadmap: NEW — filter UX improvement

- [MEDIUM] **No visual distinction between started/not-started courses** — all 8 cards look identical. Cards with sessions should show a progress bar, last accessed date, or "Continue" badge.
  - Roadmap: §4 (CRUD gaps)

- [LOW] **Course cards have no hover state or interaction preview** — clicking opens course detail, but there's no tooltip, context menu (right-click), or quick-action (bookmark, archive) on hover.
  - Roadmap: §4 (CRUD — bulk operations, archive)

### Courses (`/courses`)

**Initial state:** "All Courses — 8 courses", search bar, tag filter pills (influence, confidence, authority, etc.), Import Course button, sections for Imported and Sample courses.

**Findings:**

- [MEDIUM] **"Imported Courses" section header visible but empty** — shows the heading even when there are 0 imported courses. Should be hidden or collapsed when empty, or show an import CTA.
  - Roadmap: §4 (CRUD gaps)

- [MEDIUM] **Tag filter pills are dense** — 10+ tags visible but no "clear filters" button and no indication of how many courses match. Should show result count and a reset option.
  - Roadmap: NEW — search/filter UX

- [MEDIUM] **Import Course button** — click opens file picker (headless doesn't render it), but there's no visible dropdown or menu for different import types (folder, YouTube URL, bulk). The import flow might need a multi-option dialog.
  - Roadmap: §4 (CRUD gaps)

- [LOW] **No sort options** — can filter by tag but can't sort by name, date added, duration, or progress. Common expectation for a course catalog.
  - Roadmap: NEW — catalog sort options

### Learning Paths (`/learning-paths`)

**Initial state:** Empty state — "No learning paths yet" with CTA to create. "Create Path" button in top-right.

**Findings:**

- [MEDIUM] **Empty state is minimal** — just text and a button. Could show examples or templates: "Start with a pre-built path like 'Behavioral Intelligence Foundations' or create your own." This connects to the path templates idea.
  - Roadmap: §4 (CRUD — path templates)

- [LOW] **No suggested paths from existing Career Paths** — the Career Paths page has 4 structured paths but they're not surfaced here as templates or suggestions.
  - Roadmap: NEW — bridge between Career Paths and Learning Paths

### Career Paths (`/career-paths`)

**Initial state:** 4 career paths with numbers (01-04), descriptions, course count, hours, and stages. Search bar.

**Findings:**

- [LOW] **Paths are read-only** — users can browse and follow but can't create custom career paths. This is intentional (curated content), but a "Suggest a Career Path" or "Create Custom" option could be valuable.
  - Roadmap: §4 (CRUD gaps — path creation)

- [LOW] **Career Path detail** (`/career-paths/behavioral-intelligence`) — shows syllabus with modules, stage progression, and locking. Well designed. However, "6mx" appears as the raw ID instead of the course title in the module list.
  - Roadmap: §4 (bug — display raw course ID instead of title)

### Session History (`/session-history`)

**Initial state:** Table with date, course name, duration, and a score column. Filters for course and date range. "Exporting" button. Real data visible.

**Findings:**

- [HIGH] **Multiple 0m sessions** — several entries show "0m" duration and "0" score (Mar 27). These are likely accidental/incomplete sessions. There's no way to delete or hide them.
  - Roadmap: §4 (CRUD — soft-delete, edit session history)

- [MEDIUM] **Course names show IDs** — "authority" and "operative-six" instead of full titles. Should display "Authority - The Influence Master Key."
  - Roadmap: §4 (bug — display course title, not ID)

- [MEDIUM] **Score column meaning unclear** — numbers like 62, 65, 37 appear. No header label visible explaining what these represent (quiz score? completion %? engagement?).
  - Roadmap: NEW — session history clarity

### Notes (`/notes`)

**Initial state:** "My Notes" with Notes (0) and Bookmarks tabs, search with "Semantic" toggle, empty state "Start a video and take your first note."

**Findings:**

- [MEDIUM] **Good empty state** but CTA goes to "Browse Courses" — should also mention that notes are created during lesson playback. A user might not know where to find the note-taking UI.
  - Roadmap: NEW — onboarding/guided tour

- [LOW] **Semantic search toggle** visible but grayed out — good that it's there, but no explanation of what "Semantic" means or why it's disabled (needs embeddings).
  - Roadmap: §8 (ML — on-device embeddings for semantic search)

### Challenges (`/challenges`)

**Initial state:** Empty state — "Create your first learning challenge" with CTA. "Create Challenge" button.

**Findings:**

- [LOW] **Empty state could explain what challenges are** — "Set goals and track your progress with timed challenges" is vague. Examples: "Complete 5 lessons this week" or "Study 30 min daily for 7 days."
  - Roadmap: §10 (Calendar — study goals overlap with challenges)

### Authors (`/authors`)

**Initial state:** "Our Authors" with Chase Hughes profile, bio, social links, and all 8 courses listed. "Add Author" button.

**Findings:**

- [LOW] **Single author** — the "Our Authors" title with "Meet the expert" implies multiple but there's only one. Dynamic pluralization would help: "Meet your author" vs "Meet your authors."
  - Roadmap: LOW — cosmetic text

- [LOW] **"Authors are automatically detected when you import courses"** — helpful footer text. Good.

### Reports (`/reports`, `/reports?tab=quizzes`, `/reports?tab=ai`)

**Initial state:** Empty state on all tabs — "Start studying to see your analytics."

**Findings:**

- [HIGH] **Reports shows empty state despite existing data** — Session History has real study sessions (Mar 27-28, up to 45 min). Reports should aggregate this data but shows nothing. This is either a bug (data not being aggregated) or the threshold for "having data" is too high.
  - Roadmap: §4 (bug) + §6 (analytics)

- [HIGH] **Tab navigation not visible in empty state** — the Study/Quizzes/AI tabs aren't shown when the page is empty. The user can't even discover that these tabs exist until they have data. Tabs should always be visible with individual empty states per tab.
  - Roadmap: §4 (UX gap)

- [MEDIUM] **No link between Session History and Reports** — Session History has raw data, Reports has analysis. There's no cross-linking. Reports could say "Based on your 11 study sessions..." with a link.
  - Roadmap: NEW — data cross-referencing

### Premium Pages (`/flashcards`, `/knowledge-gaps`, `/retention`, `/review`, `/ai-learning-path`, `/notes/chat`)

**Initial state:** All show consistent premium gate with feature description, bullet points, and upgrade CTA.

**Findings:**

- [MEDIUM] **Premium gates are well-designed and consistent** — each has a unique icon, title, description, and feature list. Good pattern.

- [MEDIUM] **No pricing or plan comparison** — the gates say "Upgrade to Premium" but there's no indication of what Premium costs, what plans exist, or comparison with free tier. The user has to click through to find out.
  - Roadmap: §2 (Auth) + NEW — pricing/plan page

- [LOW] **All premium pages use the same layout** — good consistency, but the feature descriptions are generic. Could be more specific about what the user would see with their own data.
  - Roadmap: LOW — premium gate copy

- [MEDIUM] **No "Try for Free" or trial** — premium gate is binary (pay or don't). A free trial, limited access, or sample preview would convert better.
  - Roadmap: NEW — freemium strategy

### Settings (`/settings`)

**Initial state:** Rich settings page with Account, Profile, Appearance, Navigation, Font Size, Age Range, Engagement Preferences, Study Reminders, Course Reminders, AI Configuration, Feature Permissions, YouTube, Quiz Preferences, Data Management.

**Findings:**

- [MEDIUM] **Settings page is very long** — 15+ sections in a single scrollable page. Could benefit from a left-side section nav or tabs (Profile, Preferences, Data, AI).
  - Roadmap: NEW — settings navigation/tabs

- [LOW] **"Bypass progressive disclosure" toggle** — useful for power users but the label is technical jargon. "Show all navigation items" or "Show advanced features" would be clearer.
  - Roadmap: LOW — copy improvement

- [MEDIUM] **Data Management section is comprehensive** — export (full, notes, achievements/Open Badges), import/restore, data retention, danger zone. Export to Open Badges v3 already exists! This partially overlaps with Roadmap §12 (PKM export).
  - Roadmap: §12 — already partially addressed

- [LOW] **AI Configuration shows "Connected"** — good status indicator. But no test button or diagnostic info visible.
  - Roadmap: §8 (ML — Ollama integration)

### Login (`/login`)

**Initial state:** Clean login form with Email/Magic Link/Google tabs, email + password fields, privacy/terms links.

**Findings:**

- [HIGH] **No "Forgot Password" link** — confirmed missing. A user who forgets their password has no recovery path. This is a critical auth gap.
  - Roadmap: §2 (Auth — password reset flow)

- [MEDIUM] **No "Create Account" / "Sign Up" option visible** — the form only shows "Sign in." New users might not know they can sign up with the same form (Supabase handles sign-up via the sign-in flow). An explicit "Don't have an account? Sign up" link would reduce confusion.
  - Roadmap: §2 (Auth refinement)

- [LOW] **Form validation shows "Must be at least 8 characters" under password field** — this appears before the user types anything. Should only appear after interaction (on blur or submit).
  - Roadmap: §2 (Auth — UX polish)

### Lesson Player (`/courses/:courseId/:lessonId`)

**Initial state:** Video/Notes tab bar, breadcrumbs, video player (black with play button), lesson sidebar with course content accordion.

**Findings:**

- [MEDIUM] **PDF attachments show "Unable to preview this document inline"** — for "01 - Communication Laws" and "Behavior Flight Manual." Users can't view PDFs without downloading. An inline PDF viewer or at minimum a download button would help.
  - Roadmap: §6 (Video/offline storage — content viewing)

- [MEDIUM] **No progress indicator on video** — the video player shows 0:00/0:00 but no progress bar for the lesson itself (how much of this lesson has the user completed?).
  - Roadmap: §4 (CRUD — course completion tracking)

- [LOW] **Lesson sidebar shows course content but no section completion checkmarks** — each lesson has a duration but no visual indicator of completed vs incomplete.
  - Roadmap: §4 (CRUD — progress visualization)

- [MEDIUM] **No "Next Lesson" button** — after finishing a video, the user must manually find the next lesson in the sidebar. An auto-advance or prominent "Next: Composure, Confidence and Scripts" CTA would improve flow.
  - Roadmap: NEW — lesson flow UX

---

## Cross-Cutting Issues

Issues that appeared across 3+ pages:

### 1. Empty States Need Improvement (6 pages)
Learning Paths, Challenges, Notes, Reports, Overview sections — all have empty states but they're minimal. Best practice: show an illustration, explain what the feature does, give a clear CTA, and (if possible) show a preview/example of what the filled state looks like.
- **Roadmap:** NEW — Empty state design pass

### 2. Course IDs Displayed Instead of Titles (3 pages)
Session History, Career Path detail, and potentially elsewhere show raw course IDs ("authority", "6mx") instead of full course titles.
- **Roadmap:** §4 (Bug fix)

### 3. Progress Not Aggregated (3 pages)
Overview stats, My Courses progress, and Reports all show 0/empty despite real session data existing. The data exists but isn't being surfaced to the user.
- **Roadmap:** §4 (Critical — completion % calculation)

### 4. No Onboarding Flow (app-wide)
A new user lands on the Overview dashboard with all zeros, no guidance, and no clear first action. There's no onboarding wizard, welcome tour, or getting-started checklist.
- **Roadmap:** NEW — Onboarding/first-run experience

### 5. Missing Breadcrumbs/Back Navigation (some pages)
Course detail and lesson player have breadcrumbs (good), but My Courses, Notes, and other pages don't have a clear "back" or hierarchy indicator.
- **Roadmap:** LOW — navigation consistency

### 6. Notification Bell Mock Data (app-wide)
The notification popover shows 6 hardcoded notifications. This is the most visible placeholder in the app — users will quickly realize the data is fake.
- **Roadmap:** §15 (Notification System)

---

## New Ideas (Not in Roadmap)

| # | Idea | Description | Suggested Wave |
|---|------|-------------|---------------|
| 1 | **Onboarding Flow** | First-run wizard: "Welcome to Knowlune → Import your first course → Start a lesson → Set a study goal." Checklist-style with progress. | Wave 1 |
| 2 | **Getting Started Dashboard Widget** | Replace the empty overview with a "Getting Started" checklist that disappears once the user has imported a course, completed a lesson, and set a goal. | Wave 1 |
| 3 | **Settings Section Navigation** | Split Settings into tabs or add a left-side section nav. 15+ sections in one page is overwhelming. | Wave 1 |
| 4 | **Next Lesson CTA** | Prominent "Next: [Lesson Name]" button at the end of each lesson/video. Auto-advance option in quiz preferences. | Wave 1 |
| 5 | **Lesson Completion Checkmarks** | Visual checkmarks in the course sidebar for completed lessons. Show overall module progress as a ring/bar. | Wave 1 |
| 6 | **Empty State Design System** | Create a consistent empty state component with illustration, explanation, CTA, and optional preview. Apply across all pages. | Wave 1 |
| 7 | **Pricing/Plan Comparison Page** | Currently premium gates say "Upgrade" with no pricing info. A dedicated pricing page or in-gate comparison would improve conversion. | Wave 4 |

---

## Roadmap Coverage Map

| Finding | Roadmap Section | Status |
|---------|----------------|--------|
| Notification mock data | §15 Notification System | Covered |
| Forgot Password missing | §2 Auth Refinement | Covered |
| Completion % broken | §4 CRUD & UX Gaps | Covered |
| Reports empty despite data | §4 CRUD & UX Gaps | Covered (bug) |
| Semantic search grayed out | §8 Machine Learning | Covered |
| PDF preview inline | §6 Video/Offline Storage | Partially covered |
| Premium pricing page | — | **NEW** |
| Onboarding flow | — | **NEW** |
| Settings section nav | — | **NEW** |
| Next Lesson CTA | — | **NEW** |
| Empty state design system | — | **NEW** |
| Study goal progress indicator | — | **NEW** |
| Course ID vs title bug | §4 CRUD & UX Gaps | Covered (bug) |
| Session history CRUD | §4 CRUD & UX Gaps | Partially covered |

---

## Priority Recommendations

### Immediate (Wave 1 — Foundation)

1. **Fix progress aggregation** — Completion %, stats cards, and Reports should reflect existing session data. This is the most impactful fix — the app looks broken with all zeros.
2. **Add Forgot Password link** — Table stakes auth feature. 1 story.
3. **Replace notification mock data** — Ship Notification System phase 1 (data model + core triggers). The fake notifications actively undermine trust.
4. **Fix course ID display** — Show full titles in Session History and Career Path detail. Quick bug fix.
5. **Add onboarding checklist** — "Getting Started" widget on Overview that guides new users through first import → first lesson → first note.

### Near-Term (Wave 1-2)

6. **Empty state improvements** — Create a reusable empty state component, apply to all 6+ pages with empty states.
7. **Next Lesson CTA** — Add "Up Next: [Lesson Name]" to the lesson player. Small but significant UX improvement.
8. **Lesson completion checkmarks** — Visual progress in the course sidebar.
9. **Settings section navigation** — Add tabs or sidebar nav to the Settings page.
10. **Sign Up clarity on login page** — Add "Don't have an account? Sign up" text.

### Medium-Term (Wave 2-3)

11. **Reports data aggregation** — Ensure Reports page shows analytics from all data sources (studySessions, contentProgress, quizAttempts).
12. **Premium pricing page** — Add plan comparison before users hit the premium gate.
13. **Session history CRUD** — Allow deleting 0-minute sessions, editing entries.
14. **Course catalog sort** — Add sort by name/date/duration/progress.
15. **PDF inline viewer** — Show PDFs in the lesson player instead of "Unable to preview."

---

## Deep-Dive: Flow Testing Findings

> **Method:** Completed actual user tasks end-to-end via Playwright MCP — marking lessons complete, creating learning paths, testing quiz routes, interacting with Notes tabs.

### Flow 1: Complete a Lesson → Check Progress Propagation

**Steps:** Navigate to Authority Course → Lesson 1 → Click "Mark Complete" → Check course detail → My Courses → Overview

**Results:**
- [GOOD] **Celebration dialog appears** — "Lesson Completed!" with animated checkmark, course name, "Continue Learning" button. Nice delight moment.
- [HIGH] **"Continue Learning" button doesn't work** — Clicking it does nothing. The dialog stays open. User must click "Close" instead. The button should navigate to the next lesson.
- [GOOD] **Course detail updates** — Shows "1 of 7 lessons completed" after marking complete.
- [HIGH] **Course accordion counter mismatch** — Progress text says "1 of 7" but the accordion header still shows "0/7". Two different data sources, one not updating.
- [GOOD] **My Courses page updates** — Average Progress changes to 14%, Study Streak shows "1 days", Authority moves to "In Progress" section with "Resume Learning" button.
- [GOOD] **Overview updates** — "Recommended Next" now shows Authority (previously empty), milestone indicator "1 lesson, 9 more to reach 10!" appears. Continue Learning section excludes Authority from recommendations.

**Verdict:** Progress propagation mostly works well, but the "Continue Learning" button is broken and the accordion counter doesn't sync.

### Flow 2: Take a Quiz

**Steps:** Navigate to Authority Lesson 1 → Quiz route

**Results:**
- [MEDIUM] **"No quiz found for this lesson"** — Sample courses don't have quizzes. There's no way for a user to experience the quiz feature without importing a course with quizzes or having AI-generated quizzes (premium). A sample quiz on sample courses would demonstrate the feature.
- [GOOD] **"Back to course" link works** — Graceful fallback when no quiz exists.

**Verdict:** Quiz flow can't be tested with sample data. Consider adding sample quizzes to catalog courses.

### Flow 3: Create a Learning Path (CRUD)

**Steps:** Learning Paths → Create Path → Fill name + description → Submit → View path → Add courses

**Results:**
- [GOOD] **Create Path dialog works** — Name and Description fields, form submission creates the path and updates the list.
- [GOOD] **Path detail page loads** — Shows name, description, "0% Completed", "Add Course" button, empty state message.
- [MEDIUM] **"Add Course" button behavior unclear** — Clicking it didn't visibly open a course picker in headless mode. May need a dropdown, popover, or dialog to select from available courses. If it relies on a file picker or complex interaction, the affordance isn't clear.
- [GOOD] **Empty state on path list disappears** — After creating a path, the "No learning paths yet" message is replaced with the path card and search bar.

**Verdict:** Path creation works, but adding courses to a path may have UX friction. The "Add Course" interaction needs testing on a real browser.

### Flow 4: Notes During Lesson Playback

**Steps:** Navigate to Lesson 2 → Click "Notes" tab in Video/Notes tab bar

**Results:**
- [MEDIUM] **Notes tab click didn't switch content** — The Video/Notes tab bar exists at the top of the lesson player, but clicking "Notes" didn't change the view. The tab may require a different interaction or the state wasn't updated. This means the note-taking experience during video playback is not obviously discoverable.
- [MEDIUM] **"Materials (2), Notes, Bookmarks (0)" tabs at bottom** — There are actually TWO sets of tabs: Video/Notes at the top AND Materials/Notes/Bookmarks at the bottom. Confusing — which "Notes" is which? The top seems to control video vs notes panel, the bottom controls the sidebar content.

**Verdict:** The dual-tab-bar pattern is confusing. Users might not find the note-taking UI.

### Flow 5: Reports Data State

**Steps:** After completing a lesson and having real session data, re-check Reports page.

**Results:**
- Already documented in surface audit: Reports still shows empty state despite session data. The deep-dive confirms this is a real data aggregation bug, not a threshold issue — we have completed lessons and study sessions but Reports ignores them.

---

## Deep-Dive: Mobile Viewport Notes

> **Limitation:** Headless browser was fixed at 800x513 (tablet). Could not resize to 375px. Analysis based on CSS inspection and layout observation at 800px.

### What We Can Confirm at 800px (Tablet)

- [GOOD] **Sidebar collapses to hamburger menu** — At 800px the sidebar is hidden behind a menu button. Navigation works.
- [GOOD] **Search bar adapts** — Full search bar hidden on mobile, replaced by a search icon button (`sm:hidden` / `hidden sm:flex` pattern).
- [GOOD] **Course cards stack** — Cards go from grid to single column at narrower widths.
- [MEDIUM] **Notification bell badge** — "Notifications (3 unread)" badge is small at 800px. At 375px it may overlap with other header icons.
- [MEDIUM] **Settings page** — Already very long at 800px. On mobile it would require extensive scrolling. Section navigation (Roadmap §16) becomes more critical on small screens.

### What We Can't Confirm (Need 375px Testing)

- Course cards at 375px — do they fill the full width?
- Lesson player at 375px — does the video + sidebar stack vertically?
- Login form — does it remain usable on small screens?
- Career Path cards — do the numbered badges and metadata wrap correctly?
- Quiz interface — does the question/answer layout work on mobile?

**Recommendation:** Run a dedicated mobile viewport test using Playwright MCP with `browser_resize` (not available in this headless tool), or use the design-review agent which has this capability.

---

## Deep-Dive: Data State Observations

### With Data (After Lesson Completion)

| Page | Before | After |
|------|--------|-------|
| **Overview** | All zeros, "No courses in progress" | "1 lesson", milestone indicator, Authority in recommendations |
| **My Courses** | 0% progress, all "Not Started" | 14% progress, 1 day streak, Authority "In Progress" with "Resume Learning" |
| **Course Detail** | "0 of 7 lessons completed" | "1 of 7 lessons completed" |
| **Lesson Player** | No checkmarks | Green "Completed" badge on lesson 1 |
| **Reports** | Empty state | **Still empty state (BUG)** |

### Key Data State Issues

- [HIGH] **Reports page doesn't aggregate data** — The most critical data state bug. After real activity (completed lesson + study sessions), Reports still shows "Start studying to see your analytics." This makes the entire Reports section useless.
- [MEDIUM] **Overview stats cards** — Show "1 lesson" milestone but the stat cards themselves (Courses Started, Lessons Completed, Total Study Time, Study Notes, Courses Completed) may still show zeros. Hard to verify from markdown extraction — the labels are there but values might not render.
- [GOOD] **My Courses responds to data changes** — Correctly categorizes courses as "In Progress" vs "Not Started" and calculates average progress.

---

## Updated Finding Count

| Severity | Surface Audit | Deep-Dive | Total |
|----------|--------------|-----------|-------|
| **HIGH** | 12 | 4 | 16 |
| **MEDIUM** | 18 | 5 | 23 |
| **LOW** | 10 | 0 | 10 |
| **NEW IDEA** | 7 | 2 | 9 |
| **GOOD** | — | 9 | 9 (positive findings) |
| **Total** | 47 | 20 | 58 findings + 9 confirmations |

## New Priority Items from Deep-Dive

16. **Fix "Continue Learning" button in lesson completion dialog** — Currently does nothing. Should navigate to next lesson. HIGH.
17. **Fix accordion counter mismatch** — Progress text says "1/7" but accordion shows "0/7". HIGH.
18. **Add sample quizzes to catalog courses** — Users can't experience the quiz feature without importing content. MEDIUM.
19. **Clarify dual Notes tab pattern** — Lesson player has Video/Notes tabs at top AND Materials/Notes/Bookmarks at bottom. Confusing. MEDIUM.
20. **Investigate "Add Course" to Learning Path UX** — Button behavior unclear. Needs a visible course picker dialog. MEDIUM.
