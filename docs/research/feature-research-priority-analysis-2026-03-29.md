# Knowlune Feature Research & Priority Analysis

> **Purpose:** Deep research on what features Knowlune should have, graded by value, ordered by priority. Cross-referenced against existing roadmap to surface what's MISSING or undervalued.
>
> **Date:** 2026-03-29 | **Research sources:** Competitive analysis (12 platforms), learning science (10 cognitive principles), edtech market trends (2025-2026)

---

## Methodology

Each feature is rated on a **Value Score (A-F)** combining:
- **Retention Impact** — Does this bring users back? (Day-30 edu app retention = 2%)
- **Learning Effectiveness** — Evidence-based improvement in actual learning outcomes
- **Implementation Effort** — PWA feasibility, existing infrastructure leverage
- **Differentiation** — Does this make Knowlune unique vs. competitors?

**Grading Scale:**
- **A+ (9.5-10):** Must-have, proven high-impact, builds on existing infrastructure
- **A (8.5-9.4):** Very high value, strong evidence, reasonable effort
- **B+ (7.5-8.4):** High value, good evidence, moderate effort
- **B (6.5-7.4):** Solid value, worthwhile investment
- **C+ (5.5-6.4):** Nice-to-have, conditional on other features
- **C (4.5-5.4):** Low priority, speculative or high effort
- **D (below 4.5):** Skip or defer significantly

---

## Part 1: Features ALREADY in Roadmap — Revalidated Grades

These are already planned. Research confirms or adjusts their priority.

| # | Feature | Roadmap Location | Research Grade | Roadmap Priority | Notes |
|---|---------|-----------------|---------------|-----------------|-------|
| 1 | **FSRS Migration** | E59 (Batch A, #1) | **A+ (10)** | #1 | Research unanimously confirms. 20-30% fewer reviews. Every major SRS has moved to FSRS. ts-fsrs exists. **Keep as #1.** |
| 2 | **AI Quiz Generation from Notes** | E52 (Batch B) | **A (9.0)** | Batch B | Testing effect is the most robust finding in cognitive psychology. Auto-quizzes after lessons = highest-value AI feature. **Consider promoting to Batch A.** |
| 3 | **Daily Review Digest** | E60-S03 (Batch C) | **A (9.0)** | Batch C | Readwise proves consolidated daily ritual = 2-3x review completion. Microlearning (5-10 min) achieves 80% completion vs 20% long-form. **Should be higher — this is THE retention mechanic.** |
| 4 | **Streak Freeze/Shield** | E60-S01 (Batch C) | **A (8.8)** | Batch C | Duolingo's #1 anti-churn feature. Users expend 40% more effort to maintain streaks. Shield reduces anxiety. **Confirmed high value.** |
| 5 | **Lesson Flow (Auto-advance + Checkmarks)** | E54 (Batch A, #2) | **B+ (8.0)** | Batch A | Small effort, big perceived quality. Reduces friction. **Keep position.** |
| 6 | **PKM Export** | E53 (Batch A, #3) | **B+ (7.8)** | Batch A | Data portability is a trust signal. Reduces lock-in anxiety. Important but not a retention driver. **Keep position.** |
| 7 | **Inline Flashcard Creation** | E60-S02 (Batch C) | **A- (8.5)** | Batch C | RemNote's killer feature. Card creation is #1 drop-off point (Quizlet data). **Confirmed high value.** |
| 8 | **Forgetting Curve Widget** | E60-S04 (Batch C) | **B+ (8.2)** | Batch C | Loss-aversion framing drives urgency. Needs FSRS (E59). **Confirmed but depends on E59.** |
| 9 | **Knowledge Map** | E56 (Batch D) | **B+ (7.8)** | Batch D | Answers "what do I know?" but research warns: complex graphs underperform simple dashboards. Keep simple. **Position OK.** |
| 10 | **AI Tutoring (Socratic)** | E57 (Batch E) | **B+ (8.0)** | Batch E | Khanmigo grew 40K→700K users in one year. AI personalization increases engagement 60%. **Position OK.** |
| 11 | **Calendar Integration** | E50 (Batch B) | **B (7.2)** | Batch B | iCal feed is a genuine gap. People 3.2x more likely to maintain habits with scheduled time blocks. **Position OK.** |
| 12 | **Stitch UI Upgrades** | E55 (Batch C) | **B (7.0)** | Batch C | Visual polish matters but doesn't drive retention directly. **Position OK.** |
| 13 | **Smart Notification Timing** | E60-S05 (Batch C) | **B (7.0)** | Batch C | Personalized timing outperforms fixed. Back-off logic prevents uninstalls. **Position OK.** |
| 14 | **Weekly Learning Goals** | E60-S06 (Batch C) | **B- (6.8)** | Batch C | Coursera validates. Gentler than daily streaks. **Position OK.** |
| 15 | **Data Sync** | E44-E49 (Wave 3) | **B (7.0)** | Wave 3 | Critical for multi-device but massive effort (37 stories). Local-first architecture is actually a competitive MOAT — privacy-first positioning is rare and valuable. **Don't rush this.** |

### Key Revalidation Finding

**Daily Review Digest (E60-S03) is undervalued in the current roadmap.** Research across Readwise, Duolingo, and microlearning studies consistently shows that a single daily review ritual is THE #1 retention mechanic. It should be promoted from Batch C to Batch A or B. It's small scope (1-2 stories) and independent of FSRS.

---

## Part 2: NEW Features NOT in Roadmap — Graded & Prioritized

These were identified through research but are missing from the current 22-area roadmap.

### Tier 1: Must-Add (Grade A/A+)

#### NEW-01: Metacognitive Calibration System — Grade A (9.2)
**What:** Add confidence rating (1-5) before revealing flashcard/quiz answers. Track confidence vs. actual accuracy. Show calibration dashboard ("you think you know Biology 90% but your actual accuracy is 68%").

**Why it matters:**
- CHI 2025 paper: AI-driven calibration feedback **significantly** improves learning outcomes
- Learners consistently overestimate understanding (illusion of fluency)
- Calibration discrepancy predicts subsequent use of metacognitive strategies
- The data infrastructure already exists (review history, quiz scores) — just needs a confidence prompt + dashboard

**Evidence:** Metacognition research is one of the strongest findings in learning science. The gap between "I think I know this" and "I actually know this" is the #1 barrier to effective self-directed learning.

**Implementation:** LOW effort (2-3 stories)
- Story 1: Add confidence rating step to flashcard review + quiz answers
- Story 2: Calibration dashboard (confidence vs accuracy chart per topic)
- Story 3: "Overconfidence alerts" in daily review suggestions

**Depends on:** Nothing. Independent.

---

#### NEW-02: Multiple Study Modes (Quizlet Model) — Grade A (8.8)
**What:** Same flashcard content studied in different modes: standard flip cards, multiple choice, typed answer, matching game, timed challenge. Each mode activates different cognitive processes.

**Why it matters:**
- Quizlet has 800M+ study sets partly because multiple modes prevent boredom
- Different study modes activate different cognitive processes (recognition vs. recall vs. production)
- Varied question formats for the same concept is a "desirable difficulty" (Bjork & Bjork 2011) — makes learning harder in productive ways
- Prevents the "I recognize this but can't recall it" problem (recognition ≠ recall)

**Evidence:** Gamification meta-analysis (5,071 participants): effect size g = 0.822. Varied testing formats improve long-term retention.

**Implementation:** MEDIUM effort (3-4 stories)
- Story 1: Typed answer mode (free recall — stronger than MCQ)
- Story 2: Matching game mode (pair terms to definitions, timed)
- Story 3: Timed challenge mode (speed round, competitive with self)
- Story 4: MCQ mode from flashcards (auto-generate distractors via AI)

**Depends on:** Existing flashcard system.

---

#### NEW-03: Review Heatmap / Activity Calendar — Grade A (8.7)
**What:** GitHub-style heatmap showing daily review/study activity over months/years. Color intensity = volume of activity. Shows streaks, gaps, and patterns at a glance.

**Why it matters:**
- Visual accountability is a proven engagement driver
- The GitHub contribution graph is one of the most copied UX patterns in productivity tools
- Anki's Review Heatmap add-on is one of its most popular add-ons
- Different from the streak calendar (E55) — this shows VOLUME not just binary did/didn't

**Evidence:** Binary tracking maintains habits 27% longer during formation, but visual density tracking drives long-term engagement.

**Implementation:** LOW effort (1-2 stories)
- Story 1: Heatmap component (date-count from studySessions + flashcard reviews)
- Story 2: Add to Overview dashboard + Reports page

**Depends on:** Nothing. Uses existing studySessions data.

**Note:** E55 includes "Streak Calendar month-view" — this is complementary, not duplicative. Streak calendar = "did I study?" (binary). Review heatmap = "how much?" (intensity). Could be combined into one enhanced widget.

---

#### NEW-04: Study Load Forecast — Grade A- (8.5)
**What:** Show predicted review workload for the next 7/30 days. "You have 45 reviews due tomorrow. If you skip today, you'll have 78 tomorrow." Helps learners plan time and avoid the "review debt spiral."

**Why it matters:**
- Review pile-up is the #1 cause of SRS abandonment (Anki community data)
- FSRS Helper's forecast feature is one of the most requested Anki add-ons
- People 3.2x more likely to maintain habits with planned time blocks
- Loss-aversion framing ("skip = bigger pile tomorrow") drives action

**Evidence:** Predicted workload transparency directly reduces abandonment from review overload.

**Implementation:** LOW effort (1-2 stories)
- Story 1: Forecast calculation from FSRS due dates + bar chart visualization
- Story 2: "Skip cost" messaging on dashboard ("If you skip today: +33 reviews tomorrow")

**Depends on:** E59 (FSRS) for accurate forecasting. Basic version possible with SM-2.

---

### Tier 2: High Value (Grade B+)

#### NEW-05: Load Balancing / Easy Days — Grade B+ (8.2)
**What:** Redistribute due cards to prevent overwhelming days. Designate "easy days" (weekends) with fewer reviews. Vacation mode that spreads catch-up over multiple days instead of one massive pile.

**Why it matters:**
- Prevents the "review debt spiral" that causes abandonment
- FSRS Helper's load balancing is highly valued by Anki power users
- Complements streak freeze (E60-S01) — freeze prevents streak loss, load balancing prevents review burnout

**Implementation:** MEDIUM effort (2-3 stories)
- Story 1: Easy days configuration (designate light/off days)
- Story 2: Load balancing algorithm (redistribute within FSRS parameters)
- Story 3: Vacation mode (X days off, spread catch-up over 2X days)

**Depends on:** E59 (FSRS) — needs stability/retrievability data for smart redistribution.

---

#### NEW-06: AI Elaborative Interrogation Prompts — Grade B+ (8.0)
**What:** After note-taking, AI automatically generates "Why is this true?" and "How does this connect to [previously studied concept]?" prompts. Forces deeper processing of material.

**Why it matters:**
- Elaborative interrogation is rated "moderate-high utility" by Dunlosky meta-analysis
- 7% improvement on retention tests (Pressley et al.)
- Knowlune has the LLM infrastructure (Ollama/OpenAI) but only uses it reactively (user-initiated chat)
- This makes AI PROACTIVE — the most impactful shift identified by the research

**Implementation:** MEDIUM effort (2-3 stories)
- Story 1: AI "why?" prompt generation after note saving (uses RAG on course content)
- Story 2: Connection prompts ("How does this relate to [earlier topic]?") using embedding similarity
- Story 3: Integration into daily review flow (elaboration prompts mixed with flashcards)

**Depends on:** Existing AI infrastructure (LLM, RAG, embeddings).

---

#### NEW-07: Free Recall / Brain Dump Prompts — Grade B+ (7.8)
**What:** After finishing a lesson, blank screen: "Write everything you remember about what you just learned." Then compare to notes/transcript. Retrieval practice that goes beyond cued recall (flashcards).

**Why it matters:**
- Roediger & Karpicke: 80% retention after 1 week with retrieval practice vs. 36% with re-reading
- Free recall is HARDER than flashcards (no cues) = "desirable difficulty" = stronger encoding
- Variable retrieval cues lead to better learning than constant cues (PMC 2024)
- Incredibly simple to implement — text input + diff view

**Implementation:** LOW effort (1-2 stories)
- Story 1: Post-lesson recall prompt (text input + side-by-side comparison to transcript/notes)
- Story 2: Track recall quality over time (how much you captured vs. total content)

**Depends on:** Nothing. Independent.

---

#### NEW-08: Image Support in Flashcards (Dual Coding) — Grade B+ (7.8)
**What:** Allow images in flashcards — screenshot from video lesson, uploaded photo, diagram. Enable image occlusion (hide parts of a diagram, learner recalls what's hidden).

**Why it matters:**
- Dual coding (text + visual) = 2.3x better recall (Paivio, Mayer's Multimedia Principles)
- Knowlune is a VIDEO learning platform — screenshot-to-flashcard is the most natural fit imaginable
- Anki's image occlusion add-on is one of the most popular (medical students)
- Current flashcards are text-only — missing the visual channel entirely

**Implementation:** MEDIUM effort (3-4 stories)
- Story 1: Image attachment to flashcards (upload/paste, store in IndexedDB)
- Story 2: Screenshot capture from video player → auto-attach to new flashcard
- Story 3: Image occlusion mode (mask regions of image, reveal on flip)

**Depends on:** Nothing for basic image support. Video screenshot needs LessonPlayer integration.

---

#### NEW-09: Confidence-Based Repetition (Granular Rating) — Grade B+ (7.6)
**What:** Replace binary-ish hard/good/easy with a 1-5 confidence scale. Algorithm uses confidence granularity for more precise scheduling.

**Why it matters:**
- Brainscape's CBR provides more precise scheduling than binary systems
- Distinguishes "barely remembered after struggling" from "knew it instantly"
- FSRS can incorporate confidence data for better parameter estimation
- Feeds into metacognitive calibration (NEW-01) — tracks over/underconfidence

**Implementation:** LOW effort (1 story)
- Story 1: Update review UI from 3-button to 5-point scale, map to FSRS grades

**Depends on:** E59 (FSRS) for full integration. Can implement UI independently.

---

#### NEW-10: Pre-Lesson Quiz (Pretesting Effect) — Grade B+ (7.5)
**What:** Before starting a lesson, brief quiz on what the learner already knows about the topic. Even failing a pretest improves learning from the subsequent lesson.

**Why it matters:**
- Pretesting effect: even failing a pretest primes the brain to learn relevant material better
- Shows the learner what they DON'T know → sets expectations → motivates attention
- Creates a natural pre/post comparison ("you knew 30% before, 85% after")
- Research: pre-testing + lesson = significantly better retention than lesson alone

**Implementation:** LOW effort (2 stories)
- Story 1: Auto-generate 3-5 pre-questions from lesson transcript (AI)
- Story 2: Pre/post comparison display ("Your knowledge grew from 30% to 85%")

**Depends on:** AI infrastructure (existing) + lesson transcripts (existing).

---

### Tier 3: Solid Value (Grade B)

#### NEW-11: Progressive Hint System — Grade B (7.2)
**What:** When answering quiz/flashcard questions, don't show the full hint immediately. Staged reveal: attempt with no help → first hint (general direction) → second hint (more specific) → answer. Each stage forces continued retrieval.

**Why it matters:**
- Layered hints maintain desirable difficulty while preventing total frustration
- Bjork & Bjork (2011): staged difficulty is a core "desirable difficulty"
- QuestionHint component already exists — just needs staging logic

**Implementation:** LOW effort (1 story)

**Depends on:** Nothing. Enhances existing quiz/hint infrastructure.

---

#### NEW-12: XP/Points/Levels System — Grade B (7.0)
**What:** XP earned for completing lessons/reviews/quizzes. Levels unlock as XP accumulates. Different activities earn different XP (harder = more).

**Why it matters:**
- Duolingo: gamification additions grew power user representation from 20% to 30%+, curbing churn from 47% to 37%
- Meta-analysis: gamification effect size g = 0.822 (large)
- **BUT**: 2026 reports note "streak fatigue" — gamify LEARNING OUTCOMES, not just activity
- Design principle: XP should reward retrieval practice quality, not just volume

**Implementation:** MEDIUM effort (3-4 stories)
- Story 1: XP engine (activity → XP rules, store in Dexie)
- Story 2: Level system (XP thresholds → levels with names/icons)
- Story 3: XP dashboard widget + level badge display
- Story 4: Bonus XP events (weekend warrior, perfect quiz, streak milestones)

**Depends on:** Nothing. Independent.

---

#### NEW-13: Spaced Repetition for Highlights (Readwise Model) — Grade B (7.0)
**What:** Apply SRS to text highlights from notes/transcripts/bookmarks. Surface highlights for review on a decay schedule. "Your highlight from React Hooks lesson is fading — review it."

**Why it matters:**
- Readwise's entire business model proves this works
- Notes/highlights are already in Knowlune but aren't subject to SRS
- Bridges the gap between "I took notes" and "I remember my notes"

**Implementation:** MEDIUM effort (2-3 stories)
- Story 1: Flag notes/bookmarks for SRS review (toggle per item)
- Story 2: Include flagged items in daily review queue alongside flashcards
- Story 3: Decay scheduling for highlights (lighter than full FSRS — simpler tiers)

**Depends on:** E59 (FSRS) for scheduling. Basic version possible independently.

---

#### NEW-14: Bidirectional Links in Notes — Grade B (6.8)
**What:** When Note A links to Note B, Note B automatically shows a backlink to Note A. "Unlinked mentions" suggest potential connections.

**Why it matters:**
- Core feature of "tools for thought" movement (Obsidian, RemNote, Roam)
- Enables serendipitous discovery of connections between topics
- Table-stakes for serious PKM tools

**Implementation:** MEDIUM effort (3-4 stories) — requires Tiptap extension for [[wikilink]] syntax + backlink index

**Depends on:** Nothing but requires significant Tiptap customization.

---

#### NEW-15: Interleaving Session Prompts — Grade B (6.5)
**What:** After 30-45 min studying one topic, prompt: "Switch to [different topic] for better long-term retention." Based on interleaving research.

**Why it matters:**
- Interleaving outperforms blocking for long-term retention
- Knowlune already has InterleavedReview but it's opt-in, not proactive
- Simple nudge at the right time = significant learning improvement

**Implementation:** LOW effort (1 story)

**Depends on:** Nothing.

---

### Tier 4: Nice-to-Have (Grade C+)

| # | Feature | Grade | Why Lower | Effort |
|---|---------|-------|-----------|--------|
| NEW-16 | Daily Knowledge Check (gamified cross-topic quiz) | C+ (6.2) | Overlaps with daily review digest (E60-S03). If E60-S03 includes quiz items, this is redundant. | Low |
| NEW-17 | Question Generation by Learner ("write 3 questions") | C+ (6.0) | Generation effect is real but UX is awkward. AI validation adds complexity. | Medium |
| NEW-18 | Cornell Note Format | C+ (5.8) | Niche study technique. Most users won't use it. | Low |
| NEW-19 | Canvas / Infinite Whiteboard | C (5.0) | Obsidian rates it 3.5/5 for practical utility. High effort, niche use. | High |
| NEW-20 | Incremental Reading (SuperMemo model) | C (5.0) | Powerful but complex UX. SuperMemo-only feature for a reason — hard to make intuitive. | High |

---

## Part 3: Master Priority Ranking (All Features Combined)

Combining existing roadmap items with new features, ranked by research-validated value.

### Priority Band 1: Foundation (Batch A) — Do First

| Rank | Feature | Grade | Source | Stories | Dependencies |
|------|---------|-------|--------|---------|-------------|
| 1 | FSRS Migration | A+ (10) | E59 | 8 | None |
| 2 | **Daily Review Digest** | **A (9.0)** | **E60-S03 ↑PROMOTED** | **1-2** | **None** |
| 3 | **Metacognitive Calibration** | **A (9.2)** | **NEW-01** | **2-3** | **None** |
| 4 | Lesson Flow (Auto-advance) | B+ (8.0) | E54 | 3 | None |
| 5 | PKM Export | B+ (7.8) | E53 | 3 | None |

**Rationale:** FSRS is #1 unanimously. Daily Review Digest is promoted because it's THE retention mechanic (small effort, massive impact). Metacognitive calibration is the highest-value NEW feature (low effort, strong evidence, unique differentiator).

### Priority Band 2: Engagement & Intelligence (Batch B)

| Rank | Feature | Grade | Source | Stories | Dependencies |
|------|---------|-------|--------|---------|-------------|
| 6 | AI Quiz Generation | A (9.0) | E52 | 4 | AI infra (exists) |
| 7 | **Multiple Study Modes** | **A (8.8)** | **NEW-02** | **3-4** | **Flashcard system (exists)** |
| 8 | Streak Freeze/Shield | A (8.8) | E60-S01 | 1 | None |
| 9 | **Review Heatmap** | **A (8.7)** | **NEW-03** | **1-2** | **None** |
| 10 | Inline Flashcard Creation | A- (8.5) | E60-S02 | 2 | Tiptap (exists) |
| 11 | **Study Load Forecast** | **A- (8.5)** | **NEW-04** | **1-2** | **E59 (FSRS)** |
| 12 | Calendar Phase 1-2 | B (7.2) | E50 | 6 | None |

### Priority Band 3: Deepening Learning (Batch C)

| Rank | Feature | Grade | Source | Stories | Dependencies |
|------|---------|-------|--------|---------|-------------|
| 13 | Forgetting Curve Widget | B+ (8.2) | E60-S04 | 1 | E59 (FSRS) |
| 14 | **Load Balancing / Easy Days** | **B+ (8.2)** | **NEW-05** | **2-3** | **E59 (FSRS)** |
| 15 | **AI Elaborative Interrogation** | **B+ (8.0)** | **NEW-06** | **2-3** | **AI infra (exists)** |
| 16 | AI Tutoring (Socratic) | B+ (8.0) | E57 | 5 | AI infra (exists) |
| 17 | **Free Recall Prompts** | **B+ (7.8)** | **NEW-07** | **1-2** | **None** |
| 18 | **Image Flashcards (Dual Coding)** | **B+ (7.8)** | **NEW-08** | **3-4** | **None** |
| 19 | Knowledge Map | B+ (7.8) | E56 | 4 | Partial E59 |
| 20 | **Confidence-Based Rating** | **B+ (7.6)** | **NEW-09** | **1** | **E59 (FSRS)** |
| 21 | **Pre-Lesson Quiz** | **B+ (7.5)** | **NEW-10** | **2** | **AI infra (exists)** |

### Priority Band 4: Polish & Ecosystem (Batch D+)

| Rank | Feature | Grade | Source | Stories | Dependencies |
|------|---------|-------|--------|---------|-------------|
| 22 | **Progressive Hints** | B (7.2) | NEW-11 | 1 | None |
| 23 | Stitch UI Upgrades | B (7.0) | E55 | 5 | None |
| 24 | Smart Notification Timing | B (7.0) | E60-S05 | 1 | E43-S06/S07 (done) |
| 25 | **XP/Points/Levels** | **B (7.0)** | **NEW-12** | **3-4** | **None** |
| 26 | **SRS for Highlights** | **B (7.0)** | **NEW-13** | **2-3** | **E59 (FSRS)** |
| 27 | Weekly Learning Goals | B- (6.8) | E60-S06 | 1 | None |
| 28 | **Bidirectional Links** | B (6.8) | NEW-14 | 3-4 | Tiptap customization |
| 29 | **Interleaving Prompts** | B (6.5) | NEW-15 | 1 | None |
| 30 | Data Sync | B (7.0) | E44-E49 | 37 | Auth (done) |

---

## Part 4: Key Strategic Insights

### 1. The "Retention Stack" — Knowlune's Competitive Moat

The research converges on a specific combination that no single tool currently offers:

```
FSRS scheduling (what to review)
  + Daily review digest (when to review)
    + Metacognitive calibration (am I actually learning?)
      + Study load forecast (planning)
        + Loss-aversion framing (motivation)
```

This "retention stack" is Knowlune's highest-value strategic direction. It positions the app as **"the analytics-rich personal learning intelligence dashboard"** — not competing with Duolingo (language), Anki (ugly but functional), Notion (general), or Obsidian (PKM).

### 2. AI Should Be Proactive, Not Reactive

The biggest gap identified: Knowlune has full LLM/RAG/embeddings infrastructure but only uses it when the user initiates (ChatQA, AI ordering). The research strongly suggests PROACTIVE AI — elaborative "why?" prompts, auto-generated micro-quizzes, connection suggestions, calibration feedback. This shifts AI from a feature to a learning partner.

### 3. Gamification Must Reward Learning, Not Activity

2026 reports note "streak fatigue." The shift is from gamifying ACTIVITY (opened app, reviewed cards) to gamifying OUTCOMES (retention improved, knowledge grew, calibration accuracy increased). The XP system should reward quality of learning, not just volume.

### 4. Privacy-First is a Genuine Moat

Market research: local-first tools (Obsidian, Logseq, Anytype) are gaining significant traction. Most edtech is cloud-first. Knowlune's IndexedDB + optional self-hosted Supabase sync is genuinely rare. This should be a primary marketing message: "your learning data never leaves your device unless you choose."

### 5. Quick Wins Exist

Several high-value features are 1-2 stories each:
- Review heatmap (NEW-03): 1-2 stories, grade A
- Study load forecast (NEW-04): 1-2 stories, grade A-
- Confidence rating (NEW-09): 1 story, grade B+
- Progressive hints (NEW-11): 1 story, grade B
- Free recall prompts (NEW-07): 1-2 stories, grade B+
- Interleaving prompts (NEW-15): 1 story, grade B

These 7 features total ~8-10 stories and would significantly deepen the learning science foundation.

---

## Part 5: Recommended Roadmap Changes

### Promote to Batch A:
- **E60-S03 (Daily Review Digest)** — from Batch C. It's THE retention mechanic and costs only 1-2 stories.

### Add as New Epic (E61 or similar):
- **"Learning Science Foundations"** — bundle the quick wins:
  - Metacognitive calibration (confidence + dashboard) — 2-3 stories
  - Review heatmap — 1-2 stories
  - Free recall prompts — 1-2 stories
  - Progressive hints — 1 story
  - Interleaving prompts — 1 story
  - Pre-lesson quiz — 2 stories
  - **Total: ~9-11 stories, all independent, all evidence-based**

### Add Post-FSRS Epic (E62 or similar):
- **"FSRS Power Features"** — bundle features that need FSRS:
  - Study load forecast — 1-2 stories
  - Load balancing / easy days — 2-3 stories
  - Confidence-based rating — 1 story
  - SRS for highlights — 2-3 stories
  - **Total: ~7-9 stories**

### Add to Existing E52 (ML Phase 1):
- **Multiple study modes** — 3-4 stories (fits the "intelligence layer" theme)

### Add to Existing E60:
- **Image flashcards** — 3-4 stories (fits the "research-driven enhancements" theme)
- **AI elaborative interrogation** — 2-3 stories

---

## Sources

### Competitive Platform Analysis
- Duolingo retention strategy, gamification metrics, streak mechanics
- Anki FSRS algorithm, Review Heatmap add-on, FSRS Helper
- RemNote inline flashcards, knowledge graph, bidirectional links
- Readwise spaced repetition for highlights, daily review model
- Quizlet 800M+ study sets, multiple study modes, AI tools
- Brainscape confidence-based repetition
- SuperMemo incremental reading, priority queue
- Khan Academy mastery-based learning, Khanmigo AI tutor
- Brilliant interactive problem-solving
- Coursera weekly goals, peer review

### Learning Science
- Roediger & Karpicke: retrieval practice (80% vs 36% retention)
- Bjork & Bjork: desirable difficulties framework
- Dunlosky meta-analysis: elaborative interrogation (moderate-high utility)
- Paivio/Mayer: dual coding theory (2.3x recall)
- CHI 2025: AI metacognitive calibration
- Gamification meta-analysis (5,071 participants): effect size g = 0.822
- FSRS: 20-30% fewer reviews vs SM-2 (700M reviews dataset)
- Microlearning: 80% completion vs 20% long-form

### Market Trends
- Day-30 education app retention: 2%
- AI personalization: +60% engagement
- Privacy-first/local-first: growing niche, genuine moat
- Streak mechanics: 40% more effort, 2.3x daily engagement
- Self-created content: 50% better retention than AI-generated
