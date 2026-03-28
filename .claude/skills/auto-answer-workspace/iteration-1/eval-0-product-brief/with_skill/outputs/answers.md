# Product Brief: AI-Powered Study Recommendations for Knowlune

## Auto-Answer: Product Discovery Questions (Autopilot Mode)

Answers grounded in Knowlune's existing codebase, planning artifacts, open-core strategy, and completed epics (1-35).

---

## Q1: Who is the primary target audience for this feature?

**Recommendation:** Self-directed solo learners who import their own course content (video, PDF) into Knowlune and need intelligent guidance on *what to study next, when, and how intensely*.

**Why:** Knowlune's entire architecture serves the solo-learner persona -- local-first IndexedDB storage, no social features (explicitly out of scope per Epic 20 and Epic 21), and an open-core model where core features work offline. The three demographic segments already defined in Epic 21 apply here:

- **Gen Z Learners (16-25):** Most likely to have large, unstructured course libraries. Benefit from AI cutting through choice paralysis.
- **Millennial Learners (26-40):** Time-constrained professionals who need efficient study scheduling. Already the power-user segment (keyboard shortcuts, Pomodoro timer adoption).
- **Boomer Learners (55+):** Need simpler, more directive recommendations ("Study this next") rather than complex recommendation interfaces.

The common thread: learners with *multiple courses in progress* who struggle with prioritization. This is validated by Epic 7's "Recommended Next" dashboard section (E07-S02) and "At-Risk Course Detection" (E07-S04), which already surface basic heuristic recommendations. AI study recommendations would replace those heuristics with personalized, data-driven suggestions.

**Trade-offs:** We considered targeting instructors or content creators, but Knowlune has no instructor role -- it is a personal learning tool. Enterprise/team learners were also considered but rejected because the platform has no multi-user features and the open-core strategy explicitly targets individual subscriptions ($12/month).

---

## Q2: What problem does this solve that existing features don't?

**Recommendation:** It bridges the gap between *tracking* learning and *directing* learning. Today, Knowlune tells you where you are; AI recommendations would tell you where to go.

**Why -- the specific gaps in existing features:**

1. **Epic 7 (Momentum & Intelligence) is heuristic, not personalized.** The current "Recommended Next" section (E07-S02) uses a simple scoring algorithm: momentum score = f(recency, completion %, session frequency). It does not consider learning goals, knowledge gaps, optimal review timing, or cross-course skill relationships. It answers "which course is most stale?" not "which course will maximize your learning right now?"

2. **Epic 20 (Learning Pathways) is curated, not adaptive.** Career Paths are static, manually curated sequences (3-5 paths like "Web Development"). They do not adapt to individual learner behavior, pace, or knowledge gaps. A learner who is strong in CSS but weak in JavaScript still follows the same fixed path.

3. **Epic 9B (AI Features) is content-focused, not schedule-focused.** AI video summaries (9B-S01), RAG Q&A (9B-S02), and knowledge gap detection (9B-S04) analyze *content*. None of them produce actionable study schedules or session recommendations.

4. **Epic 21 (Smart Dashboard Reordering) is layout-level, not content-level.** It reorders dashboard *sections* by usage frequency. It does not recommend specific lessons, review sessions, or study durations.

**The AI study recommendations feature would unify these signals:** momentum scores + career path progress + knowledge gap data + spaced repetition schedules + session history patterns into a single, personalized "Your Study Plan for Today" experience.

**Trade-offs:** One could argue that improving Epic 7's heuristics (without AI) would be simpler. However, the open-core strategy already places AI features in the premium tier, and this feature aligns with the monetization model. The heuristic approach also cannot handle cross-course skill graph reasoning, which requires embeddings or LLM inference.

---

## Q3: What's the MVP scope vs full vision?

### MVP Scope (4-6 weeks, ~40 hours)

**Recommendation:** A "Daily Study Plan" widget on the Overview dashboard that recommends 2-3 study actions per day, powered by existing local data + a lightweight AI inference layer.

**MVP features:**

| Feature | Data Source | Complexity |
|---------|-------------|------------|
| **"Continue this lesson"** recommendation | Session history (Epic 4), momentum scores (Epic 7) | Low -- enhanced heuristic |
| **"Review this topic"** recommendation | Spaced repetition schedule (Epic 11/20), flashcard due dates | Medium -- SM-2 integration |
| **"Start this next"** recommendation | Career Path progress (Epic 20), knowledge gaps (Epic 9B-S04) | Medium -- cross-references paths + gaps |
| **Daily study time suggestion** | Weekly adherence data (Epic 5), session patterns | Low -- statistical analysis |
| **Explanation for each recommendation** | LLM inference (Ollama on Pedro's Unraid server) | Medium -- prompt engineering |

**MVP constraints:**
- Local-first: All recommendations computed client-side or via local Ollama -- no cloud dependency for core logic
- Premium-gated: Aligns with open-core strategy (AI features = premium tier)
- No new data collection: Uses only existing IndexedDB tables (sessions, courses, notes, flashcards, career paths)
- Simple UI: Single card/widget on Overview, not a separate page

### Full Vision (3-6 months beyond MVP)

| Feature | Description |
|---------|-------------|
| **Adaptive learning paths** | AI generates personalized multi-course paths (not just curated ones) -- the deferred Epic 9B-S03 |
| **Optimal study scheduling** | Time-of-day and day-of-week optimization based on retention data |
| **Cross-course skill graph** | Embeddings-based skill relationship mapping using note content and course metadata |
| **Predictive completion estimates** | "At your current pace, you'll complete this path by [date]" with confidence intervals |
| **Study session coaching** | Real-time suggestions during study: "You've been on this topic for 45 min, consider switching to X for interleaving benefits" |
| **Goal-aligned recommendations** | User sets a target ("Pass AWS certification by June") and all recommendations orient toward it |
| **Forgetting curve visualization** | Show predicted knowledge decay per topic, recommending review before it drops below threshold |

**Why this MVP/vision split:** The MVP delivers immediate value using data Knowlune already collects (10 completed epics of data infrastructure). The full vision requires new data models (skill graphs, embeddings), new UI surfaces (coaching overlay, goal wizard), and deeper AI integration -- each of which would be its own epic.

**Trade-offs:** A smaller MVP (just enhancing Epic 7 heuristics without AI explanations) would ship faster but would not justify premium pricing. A larger MVP (including skill graphs) would delay shipping by 2+ months with uncertain ROI.

---

## Q4: How should we measure success?

**Recommendation:** Measure across three dimensions: engagement, learning outcomes, and monetization.

### Primary Metrics (must-hit for feature to be considered successful)

| Metric | Target | Measurement Method | Rationale |
|--------|--------|-------------------|-----------|
| **Recommendation adoption rate** | 40%+ of daily active users follow at least 1 recommendation per week | Track click-through on recommendation cards (IndexedDB event logging, extends Epic 9B-S06 AI analytics) | If users ignore recommendations, the feature has no value |
| **Study consistency improvement** | 15%+ increase in weekly study frequency for recommendation users vs. non-users | Compare streak data (Epic 5) before/after feature launch, and premium vs. free users | The core promise is "study smarter" -- consistency is the proxy |
| **30-day retention lift** | 10%+ improvement in 30-day retention for premium users | Cohort analysis using session_history timestamps | Aligns with Epic 21's target of 25% retention increase; AI recommendations should contribute a measurable portion |

### Secondary Metrics (important but not blocking)

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Recommendation accuracy (user-rated)** | 3.5+/5 average helpfulness rating | Optional thumbs-up/down on each recommendation |
| **Course completion rate lift** | 20%+ higher completion for users who follow AI paths vs. ad-hoc | Compare career path completion rates (Epic 20 data) |
| **Time to first meaningful study session** | <2 minutes from app open to studying (down from current ~5 min browsing) | Measure time delta between app launch and first lesson play event |
| **Premium conversion contribution** | AI recommendations cited as top-3 reason for upgrading in 25%+ of conversions | Optional survey on upgrade flow |

### Anti-Metrics (things we do NOT want to optimize for)

| Anti-Metric | Why | Guard Rail |
|-------------|-----|-----------|
| **Time spent on recommendations UI** | We want users studying, not browsing suggestions | Recommendation widget should be glanceable (<10 seconds to act) |
| **Number of recommendations shown** | More recommendations = more choice paralysis | Cap at 3 per day |
| **Recommendation novelty** | Constantly suggesting new courses may distract from completion | Weight continuation of in-progress courses heavily (70/30 split: continue vs. new) |

### Measurement Infrastructure

All metrics can be tracked using existing infrastructure:
- **IndexedDB event logging** (Epic 9B-S06 `aiUsageEvents` table) for recommendation impressions and clicks
- **Session history** (Epic 4) for study frequency and retention
- **Streak data** (Epic 5) for consistency
- **Career path enrollments** (Epic 20) for completion rates

No new backend analytics needed for MVP -- all local-first measurement, consistent with the privacy-conscious architecture.

**Trade-offs:** We considered A/B testing but rejected it for MVP because Knowlune is a single-user local app (no server-side experiment framework). Instead, we use before/after cohort comparison for the same user and premium-vs-free comparison across the user base once Supabase auth (Epic 19) enables anonymized aggregate metrics.

---

## Summary

| Dimension | Key Decision |
|-----------|-------------|
| **Audience** | Solo learners with multiple courses, all age demographics |
| **Problem** | Bridges tracking-to-directing gap; unifies momentum + paths + gaps + spaced repetition |
| **MVP** | Daily Study Plan widget (3 recommendations/day, AI explanations, premium-gated) |
| **Full Vision** | Adaptive paths, skill graphs, predictive scheduling, session coaching |
| **Success** | 40% adoption, 15% consistency lift, 10% retention lift |
| **Tier** | Premium feature (aligns with open-core strategy) |
| **Timeline** | MVP: 4-6 weeks; Full vision: 3-6 months beyond MVP |
| **Dependencies** | Builds on Epics 4, 5, 7, 9B, 11, 20; requires Ollama (available on Pedro's Unraid server) |
