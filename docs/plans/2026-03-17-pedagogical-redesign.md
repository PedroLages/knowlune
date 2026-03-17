# Pedagogical Redesign: Operative Field Toolkit

## Context

LevelUp has 8 specialized courses from Chase Hughes' "The Operative Kit" covering behavioral analysis, influence, operative training, and confidence building. These courses are built around **frameworks** (Six-Axis Model, Behavior Compass, BToE, Authority Triangle) that practitioners must internalize until they become second nature.

**The core problem:** The app is currently a video player with good note-taking. Nothing happens after a learner finishes watching a lesson. There is no mechanism to verify understanding, reinforce memory, or build the automatic recall that operative skills demand.

**The goal:** Transform the app from a passive media player into an active training system that feels like an operative's field toolkit — frameworks you drill until automatic, tools you can pull up instantly.

---

## Research Foundation

This design is grounded in six evidence-based principles:

### 1. Active Recall (The Testing Effect)
Forcing the brain to retrieve information strengthens neural pathways far more than re-reading or re-watching. Students using retrieval practice score 43% higher on delayed tests vs. passive review. Both multiple-choice and short-answer quizzes enhance later exam performance. ([MIT research](https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/spaced-and-interleaved-practice), [McDermott et al. 2014](https://pdf.retrievalpractice.org/guide/McDermott_etal_2014_JEPA.pdf))

### 2. Desirable Difficulty — Delayed Retrieval Beats Immediate
**This is the most counterintuitive finding.** Immediate post-lesson quizzing feels productive but is less effective than delayed quizzing. When information is still in short-term memory, retrieval is too easy — the learning effect is weak. Delaying the first quiz by 24+ hours forces harder retrieval, creating "desirable difficulty" that builds stronger long-term retention. A physiology study found students who received homework 5 days after class outperformed day-1 counterparts. ([PMC spacing study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6842879/), [Force Science Institute](https://www.forcescience.com/2022/09/desirable-difficulties-in-training-improve-skill-retention/))

**Implication:** Don't quiz immediately after a lesson. Generate questions then, but deliver them 24+ hours later.

### 3. Spaced Repetition
Reviewing at increasing intervals exploits the spacing effect to move knowledge from short-term to long-term memory. The SM-2 algorithm (already built in the app) is the standard implementation. Target ~80% accuracy on retrieval attempts — not too easy, not too hard. ([PubMed 2025 study](https://pubmed.ncbi.nlm.nih.gov/41135423/))

### 4. Interleaving Over Blocking
Mixing problem types across review sessions (rather than blocking by topic) improves transfer by 43%. For operative skills, this means reviewing Six-Axis prompts alongside Behavior Compass prompts, not in isolation. Law enforcement research confirms: "block and silo" instruction produces the fastest skill deterioration. Blending skills in practice is critical for real-world application. ([Force Science](https://www.forcescience.com/2022/09/desirable-difficulties-in-training-improve-skill-retention/))

### 5. Perishable Skills Require Ongoing Practice
During a 2018 O'Neil study using 10,000 video recordings, it was confirmed that within months of leaving an academy, the average officer can *describe* how a technique works but can't *apply* it dynamically. Short-burst, frequent, integrated practice preserves skills; marathon training sessions don't. ([Force Science](https://www.forcescience.com/2022/09/desirable-difficulties-in-training-improve-skill-retention/), [FDLE research paper](https://www.fdle.state.fl.us/getContentAsset/534fd739-7da0-4af4-b34d-a922f387bb1a/73aabf56-e6e5-4330-95a3-5f2a270a1d2b/Leisenring-Andy-final-paper.pdf?language=en))

### 6. Matuschak's Mnemonic Medium — Lessons Learned
Andy Matuschak's experiments with embedded review prompts found that they can "feel like school" when misaligned with learner intent. His key insight: "Memory failures are often not the root problem." The critical optimization is **emotional connection** to the review session. Prompts stripped of narrative context lose their power. ([Matuschak notes](https://notes.andymatuschak.org/Mnemonic_medium))

**Implication:** Review cards must include lesson context (course name, framework, source timestamp) — not isolated facts.

### Anti-Patterns to Avoid
- **Don't quiz immediately after the lesson** — feels productive but weaker learning (desirable difficulty research)
- **Don't strip context from review cards** — show which lesson/framework each card belongs to (Matuschak)
- **Don't require deck selection** — one tap to start review (Anki's biggest UX failure)
- **Don't block by topic** — interleave across courses (Force Science)
- **Don't rely on single marathon sessions** — short daily bursts beat weekly cramming (perishable skills research)

---

## Design: Three Phases (Revised)

### Phase 1 — Daily Training Review (THE CORE)

> *This was originally Phase 2. Research on desirable difficulty moved it to Phase 1 — delayed retrieval is where actual learning happens.*

**What:** When a lesson is completed, 3-5 recall questions are AI-generated from the content and silently queued for review starting 24 hours later. A "Training Review" button on the Overview dashboard starts a 5-10 minute interleaved review session across all courses.

**Why this first:** This is the learning engine. Immediate quizzing is less effective (still in short-term memory). Delayed, interleaved retrieval is what converts "I watched this" into "I know this cold." Every other feature is decoration on top of this core loop.

**How it works:**

*Question Generation (background, after lesson completion):*
1. Learner marks lesson complete
2. AI generates 3-5 questions from lesson transcript/content (multiple choice + short answer mix)
3. Questions are cached in IndexedDB (avoid regeneration)
4. Questions enter the SR queue with 24-hour initial delay
5. Learner sees a brief "Key Concepts" summary (3 bullet points) — not a quiz

*Daily Training Review (the habit loop):*
1. Overview dashboard shows: **"Training Review (12 due) · ~4 min"** — single CTA
2. One tap → full-screen review session
3. Cards interleaved across courses (Six-Axis mixed with Authority mixed with Deception)
4. Each card shows: question + course badge + lesson name + framework tag
5. Learner rates: **Hard / Good / Easy** (SM-2 grades)
6. Wrong answers show explanation + "Re-watch" link to source video timestamp
7. Session ends when all due cards reviewed (or learner exits early)
8. Review streak counter increments

**Question types (matching course content):**
- **Factual recall**: "Name the 6 axes in the Six-Axis Model"
- **Application**: "A subject's blink rate doubles mid-conversation. What does this indicate per the BToE?"
- **Framework identification**: "Which framework would you use to assess suggestibility?"
- **Scenario-based**: "You observe someone shift from crossed arms to open palms while discussing their alibi. What behavior category does this represent?"

**Streak integration:**
- "Review streak: 7 days" on dashboard (separate from study streak)
- Push notification: "You have 8 cards due" (reuse `courseReminders` infrastructure)
- Streak ties into existing `StudyStreakCalendar` visual

**What the app already has:**
- `src/types/quiz.ts` — Full quiz type system with Zod validation
- `src/lib/spacedRepetition.ts` — SM-2 algorithm (calculateNextReview, predictRetention, isDue)
- `src/db/schema.ts` → `reviewRecords` table
- AI integration (Anthropic/OpenAI)
- `StudyStreakCalendar`, `useCourseReminders`, `qualityScore` system
- Video captions/transcripts as source material

**New to build:**
- `TrainingReview` page (full-screen review session)
- `ReviewCard` component (question + difficulty rating)
- `ReviewDashboardWidget` (due count + streak on Overview)
- `generateRecallQuestions()` AI function
- `recallQuestions` DB table (cache generated questions)
- `getReviewQueue()` function (queries due cards, interleaves)

**Key UX principles:**
- ONE tap to start. No configuration. No deck selection.
- Session length shown upfront to reduce resistance
- Cards always show narrative context (course, lesson, framework)
- Target ~80% accuracy — if too easy, AI generates harder questions
- Wrong answers are learning moments — link back to source timestamp

---

### Phase 2 — Post-Lesson Debrief + Observation Exercises

> *This was originally Phase 1. Demoted because research shows immediate quizzing is less effective. Redesigned as a debrief, not a quiz.*

**What:** After completing a lesson, a brief debrief panel shows 3 key takeaways and (for applicable lessons) an optional real-world observation exercise. No graded quiz — just reflection and a bridge to practice.

**Why:** The post-lesson moment shouldn't be wasted, but it shouldn't be a quiz either (desirable difficulty). Instead, use it for two things: (1) confirm understanding with a summary, and (2) bridge theory to real-world practice with observation prompts — which is exactly how Chase Hughes trains his NCI students (live observation + practice calls).

**How it works:**

*Key Takeaways (always shown):*
1. Lesson completes → debrief panel slides in (before "Next Lesson" button)
2. Shows 3 AI-generated key concept bullets from the lesson
3. Learner can tap each to add it as a note (optional)
4. "Next Lesson" button appears below

*Observation Exercise (for applicable lessons):*
1. For lessons teaching an observable skill (behavior profiling, deception detection, elicitation), an observation prompt appears below the takeaways:
   - "**Field Exercise:** During your next conversation, try to identify the subject's primary social need using the Six-Axis Model. Note which axis you observe most clearly."
   - "**Field Exercise:** Watch a TV interview and identify 3 baseline deviations in the subject's behavior."
2. Learner can tap "Accept Challenge" to add it to a simple checklist on the dashboard
3. No grading — this is self-directed practice

**What the app already has:**
- Lesson completion flow in `LessonPlayer.tsx`
- Note creation infrastructure
- `challenges` table in Dexie (could repurpose for observation exercises)
- AI integration for generating summaries

**New to build:**
- `LessonDebrief` component (summary + observation exercise)
- `generateLessonSummary()` AI function
- Observation exercise templates (can be hand-curated initially, AI-generated later)
- Dashboard widget showing active observation exercises

**Key UX principles:**
- Debrief is brief — under 30 seconds to read
- NOT a quiz. No grading. No friction.
- Observation exercises are optional and feel empowering, not like homework
- Bridges the gap between "watching a video" and "applying in the real world"

---

### Phase 3 — Framework Field Manual

**What:** A dedicated "Field Manual" section cataloging the core frameworks. Each framework has a visual reference card, shows which lessons teach it, links to related review cards, and tracks mastery level based on SR performance.

**Why:** An operative needs instant access to reference material. The Six-Axis Model appears in 3+ courses; a learner should see it as ONE tool they're building mastery of, not fragments scattered across courses. Chase Hughes' own training materials include reference cards (Behavior Compass Card, Course Cards, Six-Axis Quick Reference) — the Field Manual digitalizes this.

**Frameworks to catalog:**
| Framework | Courses | Type |
|-----------|---------|------|
| Six-Axis Model | 6MX, Operative Six, NCI | Profiling |
| Behavior Compass | 6MX, Operative Six, NCI | Navigation |
| Behavioral Table of Elements (BToE) | 6MX, Operative Six, NCI | Reference |
| Authority Triangle | Authority | Influence |
| Hughes Quadrant | 6MX | Assessment |
| Human Needs Map | 6MX | Profiling |
| Decision Map | NCI (20+ variants) | Analysis |
| Animal Behavior Chart | Confidence Reboot, NCI | Personality |
| Leakage Tracker | Authority | Monitoring |
| Imprinting Switch | Confidence Reboot | Technique |

**How it works:**
1. New "Field Manual" nav item in sidebar
2. Grid of framework cards: name, icon, mastery % (from SR card performance), course count
3. Tap → detail page:
   - Visual diagram (from course PDFs/images)
   - Quick-reference bullet summary
   - "Appears in" — linked lessons across courses
   - "Review Cards" — related flashcards with current SR status
   - "Mastery" — % of related cards at "Good" or better
4. Searchable from Command Palette (Cmd+K)

**New to build:**
- `FieldManual` page + `FrameworkCard` + `FrameworkDetail` components
- `frameworks` data mapping (framework → courses → lessons → cards)
- Mastery calculation from SR performance

---

## What NOT to Build

| Tempting Feature | Why Skip It |
|---|---|
| Immediate post-lesson quiz (graded) | Research shows delayed retrieval is more effective. Use debrief + delayed review instead. |
| Scenario simulator | High effort, requires hand-crafted content. Observation exercises serve the same purpose with lower cost. |
| Full gamification (XP, leaderboards) | Overkill for personal learning. Streaks alone drive habit (Duolingo: 3x daily return). |
| Visual skill trees | Course structure already implies progression. Trees are decoration. |
| Certification/badges | No external validation needed for personal learning. |
| Social/cohort features | Single-user app. NCI has its own community calls. |
| AI-powered adaptive difficulty | Premature optimization. Start with fixed question generation, tune later. |

---

## Implementation Estimate

| Phase | Scope | Effort | Delivers |
|-------|-------|--------|----------|
| **Phase 1: Training Review** | AI question generation + SR queue + review session UI + dashboard widget + streak | 1 epic (5-6 stories) | The core learning loop — delayed retrieval across all courses |
| **Phase 2: Lesson Debrief** | Key takeaways panel + observation exercises + challenge tracker | 1 epic (3-4 stories) | Post-lesson reflection + real-world practice bridge |
| **Phase 3: Field Manual** | Framework data model + manual pages + mastery tracking + Cmd+K integration | 1 epic (3-4 stories) | Instant-access reference toolkit |

**Total: ~3 epics, 11-14 stories.** Each phase delivers standalone value. Phase 1 is the only one that fundamentally changes the learning loop.

---

## Key Design Decisions Log

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| Quiz timing | Delayed (24h+) | Immediate post-lesson | Desirable difficulty research: delayed retrieval builds stronger memory |
| Card ordering | Interleaved across courses | Grouped by course/topic | Interleaving improves transfer by 43% (MIT/Force Science) |
| Post-lesson experience | Debrief summary + observation exercise | Graded quiz | Matuschak: embedded quizzes "feel like school"; debrief respects learner intent |
| Question source | AI-generated + learner-editable | Hand-curated only | Hybrid scales while maintaining quality. Learner edits improve ownership. |
| Review UX | One-tap full-screen session | Deck-based navigation | Anki's biggest failure is navigation friction. Zero-config is critical. |
| Streak type | Separate review streak | Combined with study streak | Review habit needs its own reinforcement distinct from "watched a video" |
| Feedback timing | Show explanation after answering | Delayed feedback | Research is mixed; immediate explanation reduces frustration while delayed may improve retention. Start with immediate, test delayed later. |

---

## Sources

**Learning Science:**
- [MIT: Spaced and Interleaved Practice](https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/spaced-and-interleaved-practice)
- [PubMed: Spaced repetition improves academic performance (2025)](https://pubmed.ncbi.nlm.nih.gov/41135423/)
- [PMC: Optimal spacing for homework/quiz administration](https://pmc.ncbi.nlm.nih.gov/articles/PMC6842879/)
- [Nature: Timing of feedback and retrieval practice (2024)](https://www.nature.com/articles/s41599-024-03983-6)
- [ScienceDirect: Retrieval practice on retention of complex concepts (2025)](https://www.sciencedirect.com/science/article/pii/S0959475225001434)
- [Wikipedia: Desirable difficulty](https://en.wikipedia.org/wiki/Desirable_difficulty)

**Operative/Law Enforcement Training:**
- [Force Science: Desirable Difficulties in Training](https://www.forcescience.com/2022/09/desirable-difficulties-in-training-improve-skill-retention/)
- [H2H Science: Law Enforcement Behavioral Analysis](https://h2h.science/law-enforcement/)
- [TRADOC: ThreatMinutes bite-sized military training](https://oe.tradoc.army.mil/2023/12/01/threatminutes-bite-sized-digital-learning/)
- [FDLE: Preservation of Perishable Skills](https://www.fdle.state.fl.us/getContentAsset/534fd739-7da0-4af4-b34d-a922f387bb1a/73aabf56-e6e5-4330-95a3-5f2a270a1d2b/Leisenring-Andy-final-paper.pdf?language=en)

**Chase Hughes / NCI:**
- [NCI University Roadmap](https://nci.university/roadmap)
- [NCI-2: Interactive Practice Training](https://nci.university/nci-2)
- [Chase Hughes: Six-Minute X-Ray methodology](https://www.shortform.com/blog/six-minute-x-ray/)
- [NCI Trustpilot Reviews](https://www.trustpilot.com/review/nci.university)

**Learning Product Design:**
- [Andy Matuschak: How to write good prompts](https://andymatuschak.org/prompts/)
- [Andy Matuschak: Mnemonic Medium lessons learned](https://notes.andymatuschak.org/Mnemonic_medium)
- [Orbit: Experimental spaced repetition platform](https://withorbit.com/)
- [Duolingo Gamification Case Study 2025](https://www.youngurbanproject.com/duolingo-case-study/)
- [Anki Forum: Structured learning improvements](https://forums.ankiweb.net/t/combining-spaced-repetition-with-meaningful-structured-learning-a-highly-useful-and-practical-improvement-for-anki/63780)
- [RemNote: Embedded flashcard approach](https://www.remnote.com/)
