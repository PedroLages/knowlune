# Product Brief: AI-Powered Study Recommendations

## 1. Who is the primary target audience for this feature?

The primary audience is **self-directed solo learners** who use Knowlune to manage imported course libraries (video, PDF) and need guidance on what to study next. Based on the existing user personas defined in Epic 20 and Epic 21:

- **Directional Learners** (highest priority): Users who complete one course and don't know what to tackle next. Epic 20 explicitly identifies this as a key pain point: "I don't know what to learn next after completing a course." These users have multiple courses imported but lack a personalized study plan.

- **Returning Learners**: Users who have been away from the platform and need help re-engaging. They have stale progress across several courses and benefit from AI prioritizing which courses to resume based on decay, knowledge gaps, and momentum.

- **Cross-demographic coverage**: Knowlune targets Gen Z (16-25), Millennial (26-40), and Boomer (55+) learners per Epic 21. AI recommendations must be surfaced in an age-appropriate way -- concise cards for younger users, clear explanations for older users, all following the existing minimalist design foundation.

The feature is squarely in the **Premium tier** per the open-core strategy (`docs/planning-artifacts/open-core-strategy.md`), which places all AI-powered features behind the subscription paywall while ensuring the core platform (momentum scores, manual recommendations) remains free.

## 2. What problem does this solve that existing features don't?

Knowlune already has several recommendation-adjacent features, but each has a clear gap that AI recommendations would fill:

### Existing features and their limitations

| Feature | What it does | What it misses |
|---------|-------------|----------------|
| **Recommended Next** (`src/lib/recommendations.ts`) | Rule-based composite score: 40% recency + 40% completion proximity + 20% frequency. Surfaces top 3 in-progress courses. | Only considers in-progress courses. Cannot suggest new courses to start. No understanding of content relationships or skill prerequisites. |
| **AI Learning Path** (`src/ai/learningPath/generatePath.ts`) | LLM-generated course sequencing based on titles/tags. User-initiated (click "Generate"). | One-time generation, not adaptive. Requires manual trigger. Does not factor in user progress, quiz performance, or knowledge gaps. |
| **Knowledge Gap Detection** (`src/ai/knowledgeGaps/detectGaps.ts`) | Identifies under-noted and skipped content by analyzing note-to-video ratios and watch percentages. | Reports gaps but does not translate them into actionable study recommendations. No connection to the recommendation pipeline. |
| **Career Paths** (Epic 20) | Curated multi-course journeys with prerequisites. | Static, manually curated. Limited to 3-5 paths. Cannot personalize based on individual learning patterns. |
| **Momentum Score** (Epic 7) | Per-course engagement metric combining recency, velocity, and consistency. | Measures engagement but doesn't prescribe what to do about declining momentum. |
| **Spaced Review System** (Epic 11) | ts-fsrs-based scheduling for flashcard review. | Only covers flashcard review timing, not course-level study planning. |

### The gap AI study recommendations fills

The core problem is **fragmented intelligence**: Knowlune has rich data (progress, momentum, quiz scores, knowledge gaps, session history, spaced repetition schedules, note density) spread across independent subsystems, but no single feature synthesizes all signals into a unified, proactive "here's what you should study right now and why" recommendation.

Specific unmet needs:
- **Proactive daily study plan**: "You have 45 minutes today. Here's your optimal session." No existing feature does this.
- **Cross-signal reasoning**: Combining quiz performance (Epic 12-18 data) + knowledge gaps + momentum decay + spaced repetition schedules into a single prioritized recommendation.
- **New course suggestions**: The current `getRecommendedCourses` function explicitly filters out courses with 0 completed lessons. There is no mechanism to recommend starting a new course based on skill gaps or career path alignment.
- **Adaptive re-prioritization**: When a user fails a quiz or skips lessons, recommendations should shift dynamically. Current systems are static between manual refreshes.

## 3. What's the MVP scope vs full vision?

### MVP (4-6 stories, ~30 hours)

Focus: A single "Today's Study Plan" widget on the Overview dashboard that synthesizes existing data into 3-5 prioritized recommendations with explanations.

| Story | Description | Effort |
|-------|-------------|--------|
| **S01: Recommendation Engine Core** | Create `src/ai/recommendations/engine.ts` that aggregates signals from progress, momentum, quiz scores, knowledge gaps, and spaced review schedules into a unified priority score. Rule-based first pass (no LLM needed). | 8h |
| **S02: Today's Study Plan Widget** | Dashboard component showing top 3-5 recommendations with reason labels ("Resume -- 85% complete", "Review -- quiz score dropped", "Gap detected -- low note coverage"). Replaces or augments existing RecommendedNext. | 6h |
| **S03: Time-Aware Recommendations** | Factor in user's study goal (from Epic 5) and available time. "You have a 30-min goal today. Here's what fits." | 4h |
| **S04: AI Explanation Enrichment** | Optional LLM pass to generate natural-language explanations for each recommendation ("You struggled with recursion in Lesson 5. Reviewing this before moving to dynamic programming will strengthen your foundation."). Premium-gated. | 6h |
| **S05: Feedback Loop** | Track which recommendations users act on (click-through) vs. dismiss. Store in IndexedDB for future model improvement. | 4h |

**MVP does NOT include**: ML model training, collaborative filtering, content-based similarity, cross-user patterns, or external API calls beyond the existing Ollama/AI provider setup.

### Full Vision (12-15 stories, ~80 hours)

| Phase | Features |
|-------|----------|
| **Phase 2: Content Intelligence** | Embedding-based course similarity using existing vector store (`src/ai/vector-store.ts`). Recommend new courses based on semantic similarity to completed content. "You liked React Fundamentals -- try this Advanced React Patterns course." |
| **Phase 3: Adaptive Scheduling** | AI-generated weekly study schedules that adapt based on actual behavior. Integrates with study reminders (Epic 11) and calendar widget. Spaced repetition principles applied at the course level, not just flashcards. |
| **Phase 4: Quiz-Driven Remediation** | When quiz performance drops, automatically generate a remediation path: re-watch specific lessons, review specific notes, attempt practice problems. Leverages item difficulty (Epic 17) and discrimination indices. |
| **Phase 5: Learning Style Adaptation** | Detect preferred learning patterns (video-heavy vs. note-heavy vs. quiz-driven) and weight recommendations accordingly. Use session data to infer optimal study duration and time-of-day preferences. |
| **Phase 6: Goal-Aligned Pathways** | Connect recommendations to career paths (Epic 20). "To complete the Web Development path by June, you need to study 45 min/day and prioritize these 3 courses." |

### Architecture note

The MVP should be built as a **rule-based aggregation engine** with a clean interface that the LLM enrichment layer (S04) and future ML features (Phase 2+) can plug into. This matches the existing pattern in Knowlune where rule-based logic always runs first and AI enrichment is optional (see `detectGaps` in `src/ai/knowledgeGaps/detectGaps.ts` which does exactly this).

## 4. How should we measure success?

### Primary Metrics (measure within 2 epics of launch)

| Metric | Baseline | Target | How to Measure |
|--------|----------|--------|----------------|
| **Recommendation click-through rate** | N/A (new feature) | >40% of displayed recommendations acted on | Track in IndexedDB via S05 feedback loop. Event: `recommendation_clicked` with recommendation ID and type. |
| **Daily active study sessions** | Current average from session store | +15% increase in sessions/week | Compare `useSessionStore` session counts 4 weeks before vs. 4 weeks after launch. |
| **Course completion rate** | Current completion % from progress data | +10% increase in courses reaching 100% | Track via existing `getAllProgress()` -- compare cohort completion rates. |
| **Time to next session** | Average gap between sessions (from study log) | -20% reduction in days between sessions | Measure from `getActionsPerDay()` in `src/lib/studyLog.ts`. |

### Secondary Metrics (measure over 3+ months)

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Knowledge gap reduction** | 25% fewer "critical" gaps detected per user | Run `detectGaps()` monthly, compare severity distributions over time. |
| **Streak maintenance** | +10% improvement in 7-day streak retention | Existing streak data in Epic 5 infrastructure. |
| **Quiz score improvement** | Users who follow recommendations show higher normalized gain (Hake's formula, Epic 16) | Compare quiz improvement trajectories for users who follow vs. ignore recommendations. |
| **Feature engagement retention** | >60% of users who try the feature still using it after 30 days | Track `recommendation_displayed` vs. `recommendation_clicked` events over 30-day cohorts. |

### Anti-Metrics (watch for negative signals)

| Anti-Metric | Threshold | Action |
|-------------|-----------|--------|
| **Recommendation fatigue** | Click-through drops below 20% after initial adoption | Reduce recommendation frequency, improve relevance scoring. |
| **Decision paralysis** | Average time-on-overview-page increases >30% | Reduce number of displayed recommendations from 5 to 3. |
| **AI explanation dismissal** | >50% of users collapse/hide AI explanations | Make explanations opt-in rather than default. |

### Measurement Infrastructure

All metrics can be collected using existing Knowlune infrastructure:
- **IndexedDB** (Dexie): Store recommendation events (displayed, clicked, dismissed) alongside existing session and progress data.
- **Reports page** (Epic 8/27): Add a "Recommendation Effectiveness" tab showing click-through rates and correlation with study outcomes.
- **AI Feature Analytics** (Epic 9B-S06): Existing AI usage tracking can be extended to cover recommendation features.

No external analytics services are needed, consistent with the local-first architecture and privacy-conscious design principles.
