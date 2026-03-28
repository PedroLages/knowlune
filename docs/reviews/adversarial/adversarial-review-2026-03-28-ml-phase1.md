# Adversarial Review: ML Phase 1 (E52) — Auto-Quiz Generation & Content-Based Recommendations

**Date:** 2026-03-28
**Reviewer:** Claude (adversarial-general skill, cynical mode)
**Scope:** Architecture, PRD, Epic breakdown, 8 stories, edge case review
**Verdict:** OVER-ENGINEERED. Ship a spike, not an epic.

---

## Executive Cynicism

This is a 33-FR PRD, 8-story epic, 637-line architecture document, and a 41-issue edge case review... for a feature that one person will use on ~10 courses. The planning-to-implementation ratio is grotesque. The documents read like they were designed to impress a review board, not to ship a feature for Pedro's personal learning dashboard.

The core thesis — "existing infrastructure supports high-value AI features with minimal new code" — is undermined by the very scope of the planning. If it is truly minimal new code, why does it need 33 functional requirements, 18 non-functional requirements, 4 user journeys, and a 4-stage pipeline? Because the planning expanded to fill the available process, not because the problem demands it.

---

## Assumption Challenges

### 1. "Auto-quiz from transcripts is high value"

**Challenge: Auto-generated quizzes are a novelty, not a learning tool.**

The PRD claims quizzes "transform passive content consumption into active learning." This is true for well-crafted quizzes. It is not automatically true for LLM-generated quizzes. The educational research literature is clear: **retrieval practice works, but question quality matters enormously.** A badly-worded question that tests surface recall is worse than no question because it gives the illusion of learning.

The edge case review's EC-11 (LLM marks wrong answer as correct) is the most damning finding: **the system cannot verify factual correctness.** An educational tool that teaches incorrect information is actively harmful. The PRD's mitigation — an "AI-generated" badge and thumbs-down button — is a disclaimer, not a solution. It shifts the burden of quality control to the learner, who is by definition the person who does not yet know the material.

The PRD targets ">75% positive thumbs-up on generated questions." But the user cannot reliably judge question quality on material they are still learning. They will thumbs-up questions they get right (confirmation bias) and thumbs-down questions they get wrong (regardless of whether the question was valid).

**Honest assessment:** The first few auto-generated quizzes will feel magical. By quiz #10, Pedro will notice the quality inconsistency and stop trusting them. The feature becomes a checkbox on the roadmap, not a daily tool.

**What the research actually says:** Active recall is effective. But the most effective technique is **self-generated questions** — the act of formulating a question forces deeper processing than answering a pre-made one. An "AI-generated quiz" skips the cognitively valuable part and delivers the low-value part.

### 2. "Content-based recommendations work with small catalogs"

**Challenge: Embedding similarity on 5-10 courses is statistical noise.**

The architecture specifies cosine similarity on 384-dimensional embeddings of course metadata (title + description + tags). With a catalog of 10 courses, this is computing similarity between 10 vectors in 384-dimensional space. The curse of dimensionality means distances between random 384-dim vectors converge — everything looks equally similar or dissimilar.

The threshold filter (0.40-0.85) will either pass everything or nothing. The MMR reranking with lambda=0.5 is mathematically well-defined but practically meaningless when you are reranking 3-5 candidates from a pool of 10.

**The cold start fallback cascade is the honest feature.** Tag-based matching + recently imported is what will actually run for any realistic catalog size. The embedding-based recommendation engine is an elaborate facade that degrades to the fallback for any catalog small enough to belong to a single learner.

**The PRD knows this:** Journey 2 describes Pedro with 5 completed courses seeing 4 recommendations. If 5 of his 10 courses are completed, there are only 5 candidates. After excluding completed courses, every non-completed course is a "recommendation." The algorithm is selecting all of them and sorting by a noisy similarity score.

The recommendation engine becomes meaningful at ~50+ courses. Pedro currently has ~10. Building this now is building infrastructure for a catalog size that may never arrive.

### 3. "Cosine similarity on average embeddings is good enough"

**Challenge: Course metadata embeddings are the wrong granularity.**

The architecture computes course embeddings from `title + " " + description + " " + tags.join(", ")`. This is typically 20-50 words. The information density of a 20-word embedding is extremely low — the model is encoding genre-level similarity, not content-level similarity.

"React Fundamentals" and "Advanced React Patterns" will have high similarity based on the word "React" in both titles. "React Fundamentals" and "TypeScript Fundamentals" will have high similarity based on "Fundamentals." This is keyword matching with extra steps.

The architecture mentions "weighted embedding combination (transcript + metadata + tags)" as a Phase 2 improvement. This admission that metadata-only embeddings are insufficient for content-level similarity should have been a red flag for Phase 1 viability. If the embeddings are known to be too coarse, why ship a recommendation engine built on them?

**The honest alternative:** Sort courses by tag overlap. Same result, zero embedding infrastructure, one function, five lines of code.

### 4. "1 epic is enough"

**Challenge: The edge case review answers this definitively — no.**

41 edge cases. 9 HIGH severity. The edge case review itself identifies these as "blocking implementation" items that must be addressed before or during implementation. Several are design bugs (EC-25: cache key missing Bloom's level), not edge cases.

The prompt engineering alone for Bloom's Taxonomy-aligned quiz generation is underestimated. The PRD specifies 2 few-shot examples per level, 3 question types, transcript grounding, and topic relevance. Getting this prompt to produce consistently good output across different transcript styles (lecture vs. tutorial vs. interview) will require iterative refinement.

The architecture says "15-40 seconds" for quiz generation on Ollama. That is per lesson. A course with 30 lessons means 7-20 minutes of generation time for a full course quiz set. The PRD does not mention bulk generation or any way to pre-generate quizzes — it is all on-demand. This means the user sits through a 30-second loading skeleton every time they want a quiz for a new lesson.

Realistic estimate: 2 epics minimum. One for the core pipeline + basic UI (spike quality). One for the QC, error handling, edge cases, and polish that makes it actually reliable.

### 5. "Existing AI proxy handles this"

**Challenge: The proxy was designed for 10-second tagging requests, not 60-second structured generation.**

`callOllamaChat` in `courseTagger.ts` uses a 10-second timeout (`TAGGER_TIMEOUT_MS = 10_000`). Quiz generation needs 60+ seconds. The architecture acknowledges this but the story tasks do not explicitly address it.

More critically, `callOllamaChat` returns `string | null` — the raw content string. For quiz generation, this string must be a valid JSON object with a specific schema. The function does not parse JSON; it returns the raw string. The quiz generation service must parse it, validate it with Zod, and handle parse failures. This is new code, not reuse.

The function is also not exported — it is a private function inside `courseTagger.ts`. To reuse it, the quiz generation service either (a) duplicates it, (b) refactors it into a shared module, or (c) imports it from courseTagger. Option (b) is the right answer but is not acknowledged as a task in any story. The architecture says "Reuse `callOllamaChat` from `courseTagger.ts`" without noting that the function is not reusable in its current form.

The Express proxy also has a default timeout. If Ollama takes 45 seconds to generate a quiz and the proxy times out at 30 seconds, the response is lost. EC-07 in the edge case review identifies this. No story addresses configuring the proxy timeout for quiz generation requests.

### 6. "Users want auto-quizzes"

**Challenge: This has not been validated. At all.**

The PRD has 4 user journeys — all written by the architect, not derived from user research. The success metric is ">70% of quizzes are AI-generated within 2 months of launch." This measures adoption, not value. If auto-generated quizzes are the only quiz creation method with a button, of course >70% will be auto-generated. That does not mean they are useful.

The simpler test: **Does Pedro currently create manual quizzes?** If he does, auto-generation addresses a real friction point. If he does not, adding an AI-powered version of a feature he does not use is a solution looking for a problem.

The PRD does not answer this question. There is no baseline metric for current quiz creation frequency. There is no statement like "Pedro creates 2 manual quizzes per week and finds it tedious." The user journey starts from "Pedro has just finished watching a video" and assumes he wants a quiz. Maybe he does not. Maybe he takes notes. Maybe he just moves to the next video.

**The simpler alternative that was not considered:** A "quiz template" feature where Pedro fills in question stems and the system auto-generates distractors (wrong answers). This preserves the cognitively valuable part (formulating the question) while eliminating the tedious part (inventing plausible wrong answers). It requires no pipeline, no chunking, no QC, and one LLM call per question.

---

## Additional Assessments

### Is there a simpler 80/20 approach?

**Yes, and it is dramatically simpler.**

**Quiz generation as a single-story spike:**
1. Add a "Generate Quiz" button on the lesson page.
2. Send the full transcript (or first 2000 words) to `callOllamaChat` with a simple prompt: "Generate 5 multiple-choice questions from this transcript. Return JSON."
3. Parse the response. If it validates, save it. If not, show an error.
4. No chunking. No Bloom's Taxonomy. No QC pipeline. No duplicate detection. No transcript grounding. No few-shot examples. No retry logic.
5. Ship it. See if Pedro uses it more than twice.

This spike is 1 story, ~200 lines of code, 1-2 days of work. It answers the fundamental question: **does Pedro actually want AI-generated quizzes?** If yes, invest in the full pipeline. If no, the spike cost almost nothing.

The full E52 epic is 8 stories, ~8 new files, ~2000 lines of new code, Dexie migration, and weeks of work. It answers the same question but at 10x the cost, and most of the investment is in infrastructure (chunking, QC, caching) that only matters if the feature is valuable.

**Recommendation engine as tag sorting:**
```typescript
function getRecommendations(completedCourseIds: string[]): string[] {
  const completedTags = getTagsForCourses(completedCourseIds)
  return allCourses
    .filter(c => !completedCourseIds.includes(c.id))
    .sort((a, b) => tagOverlap(b.tags, completedTags) - tagOverlap(a.tags, completedTags))
    .slice(0, 5)
}
```

This is 10 lines of code. It produces identical results to the embedding-based engine at the current catalog scale. It requires no Dexie migration, no embedding generation, no `BruteForceVectorStore`, no MMR reranking, and no cold start cascade (it naturally handles all catalog sizes).

### Is the recommendation engine premature?

**Yes.** Unambiguously, unconditionally yes.

The recommendation engine is architecturally premature (small catalog), algorithmically premature (metadata embeddings are too coarse), and motivationally premature (no evidence the user wants recommendations).

The PRD justifies recommendations with "learners currently have no systematic way to discover related content without manual effort." Pedro has 10 courses. He can see all of them on one screen. There is nothing to discover. Discovery is a problem at scale — 100+ courses, multiple topics, forgotten imports. At 10 courses, the user's own memory is the best recommendation engine.

The recommendation engine should be deferred until (a) the catalog exceeds 30 courses, or (b) Pedro explicitly requests it because he is losing track of what he has imported.

### Are we over-engineering the pipeline?

**The 4-stage pipeline (Chunk, Generate, Validate, Store) is 3 stages too many for a spike.**

- **Chunk:** Unnecessary for an MVP. Send the whole transcript (truncated to 2000 words if needed). Chapter-based chunking is an optimization for long transcripts, not a core requirement. If the transcript is short enough, one chunk is fine. If it is too long, truncate. The 5-minute fallback window is a second chunking strategy for a feature that has not proven it needs the first one.

- **Generate:** This is the only necessary stage. Call the LLM. Get questions.

- **Validate:** The QC pipeline (duplicate detection via embedding similarity, answer uniqueness, transcript grounding) is a second ML system built to validate the output of the first ML system. EC-04 (semantically invalid but structurally valid output) shows that Zod validation is insufficient and the QC pipeline is the real validation. But the QC pipeline itself has limitations (cannot verify factual correctness, EC-11). This is an arms race with diminishing returns.

- **Store:** Saving to Dexie is fine. But the generate-once caching with `transcriptHash` + `bloomsLevel` cache key, the SHA-256 computation, the Dexie v28 migration for quiz metadata fields — this is caching infrastructure for a feature that generates one quiz per lesson. The cache hit rate will be ~95% (user generates once, then always hits cache). A simpler "check if a quiz exists for this lesson" boolean is sufficient.

### Does the edge case review indicate a fragile design?

**41 issues (9 HIGH) is a design smell, not just an implementation checklist.**

When an edge case review finds 9 HIGH severity issues in a design that has not been implemented yet, the design has gaps. Specifically:

- **EC-25 (cache key missing Bloom's level)** is a design bug. The cache key `lessonId + transcriptHash` was specified in the architecture and propagated to the PRD and story AC. Every document is wrong. This is not an edge case; it is a fundamental design error.

- **EC-11 (LLM marks wrong answer as correct)** is an unsolvable problem within the current architecture. The review says "fundamentally unsolvable without a second LLM call or human review." The architecture's response is a disclaimer badge. For an educational tool, this is a critical gap that no amount of engineering can close within Phase 1.

- **EC-01 (garbage transcript quality)** is a data quality issue that propagates through the entire pipeline. Auto-generated YouTube captions (the common case) have 10-30% word error rates. The pipeline has no quality gate for input data — it assumes transcripts are accurate. This means 10-30% of quiz questions will contain garbled terminology.

- **EC-12 (fill-in-blank scoring ambiguity)** is a product design issue. Fill-in-blank questions with exact string matching on auto-generated answers will frustrate users. The edge case review suggests dropping fill-in-blank for auto-generation — which means one of the three specified question types should be removed from the architecture.

The pattern: the architecture specifies a feature, the edge case review identifies a fundamental problem with that feature, and the suggested mitigation is "document as known limitation" or "defer to Phase 2." This is a design that knows its own weaknesses but ships them anyway.

---

## Findings Summary

### BLOCKER: Ship a spike, not an epic

1. **No user validation.** Zero evidence that Pedro wants, needs, or will use auto-generated quizzes. The entire epic is based on the assumption that the feature is valuable, with no baseline measurement of current quiz creation behavior. **Recommendation:** Build a 1-story spike (200 lines, no pipeline) and measure actual usage before committing to 8 stories.

2. **Recommendation engine is premature.** With ~10 courses, embedding-based recommendations are indistinguishable from tag sorting. The cold start fallback (tag matching + recently imported) is what will actually execute. **Recommendation:** Ship the 10-line tag-sorting function. Revisit embeddings at 30+ courses.

3. **The pipeline is over-engineered.** 4 stages, 33 FRs, 18 NFRs, 8 stories for a personal app feature. The planning cost already exceeds the implementation cost of a simpler approach. **Recommendation:** Flatten to 1 stage (call LLM, save result). Add stages only when measured quality problems demand them.

### HIGH: Design bugs and unsolvable problems

4. **Cache key design bug (EC-25).** The `lessonId + transcriptHash` cache key is wrong — it must include `bloomsLevel`. This error is in the architecture, PRD, and story AC. Every downstream document inherited the bug.

5. **Factual correctness is unsolvable (EC-11).** The system cannot verify that LLM-generated answers are correct. The "AI-generated" badge is a disclaimer, not a solution. For an educational tool, this is the highest-risk failure mode. **Recommendation:** At minimum, display the source transcript excerpt alongside each question's explanation so the user can verify.

6. **Fill-in-blank scoring is broken (EC-12).** Auto-generated fill-in-blank questions with exact string matching will mark correct answers wrong. **Recommendation:** Drop fill-in-blank from auto-generation. Limit to multiple-choice and true/false.

7. **`callOllamaChat` is not reusable.** The function is private to `courseTagger.ts`, has a 10-second timeout, returns raw strings, and does not parse JSON. Reusing it requires extracting it to a shared module, changing the timeout, and adding JSON parsing. This refactoring is not in any story's task list.

8. **Express proxy timeout not configured.** Quiz generation takes 15-60 seconds. The proxy has a default timeout. No story addresses configuring the proxy timeout for long-running requests.

### MEDIUM: Questionable value propositions

9. **Bloom's Taxonomy adds complexity without validated benefit.** Three cognitive levels, parameterized prompts, few-shot examples per level, level selection UI. This is an elaborate pedagogical framework for a feature that has not proven basic utility. **Recommendation:** Default to one level ("mixed") for the spike. Add Bloom's levels after validating that users want quizzes at all.

10. **MMR diversity reranking is over-engineering for 5 candidates.** MMR is meaningful when reranking 100+ candidates to avoid monotony. Reranking 5 candidates from a pool of 10 courses is adding algorithmic sophistication to a problem that does not exist at this scale.

11. **33 functional requirements for a personal feature.** The PRD has more FRs than the average enterprise SaaS product. FR-25 specifies a similarity threshold range (0.40-0.85). FR-19 specifies MMR lambda. These are tuning parameters that should be discovered through experimentation, not pre-specified in a requirements document.

12. **Duplicate detection via embedding cosine similarity is a second ML system.** Computing embeddings of generated questions and comparing them to detect duplicates is using ML to validate ML. For a personal app generating 5 questions per chunk, visual inspection by the user is faster and more reliable.

13. **The auto-story batch workflow will struggle with prompt iteration.** Quiz generation quality depends heavily on prompt engineering. The prompt templates (system prompt, few-shot examples, Bloom's instructions) will need iterative refinement based on actual LLM outputs. This iteration cycle does not fit cleanly into the story workflow — it is exploratory, not plannable.

### LOW: Missed simplifications

14. **SHA-256 transcript hashing is over-specified.** A simple `transcript.length + transcript.slice(0, 100)` fingerprint is sufficient for cache invalidation on a personal app. SHA-256 is cryptographic-grade hashing for a cache key.

15. **Dexie v28 migration for quiz metadata.** The new fields (`source`, `transcriptHash`, `bloomsLevel`, `generatedAt`, `modelId`) could be stored as a JSON blob in an existing field rather than requiring a schema migration. Dexie does not enforce field-level schemas for non-indexed properties.

16. **`courseEmbeddings` as a separate table.** Course embeddings could be stored as a property on the existing `importedCourses` records. A separate table adds a join for every recommendation query.

17. **The PRD targets ">60% quiz completion rate" as a success metric.** This measures whether users finish quizzes they start, not whether quizzes improve learning. A user who starts a quiz out of curiosity and quits because the questions are bad still counts toward the denominator.

---

## Recommended Alternative: The 2-Story Spike

Instead of E52 (8 stories, weeks of work), ship this:

**Story A: Quick Quiz Generation (1 story, 2 days)**
- "Generate Quiz" button on lesson page
- Send first 2000 words of transcript to `callOllamaChat` (extract to shared module first)
- Simple prompt: "Generate 5 multiple-choice questions. Return JSON."
- Zod validate. Save to existing `quizzes` table with `source: 'auto-generated'`
- Loading skeleton during generation. Toast on error. "AI-generated" badge.
- No chunking. No Bloom's. No QC pipeline. No retry. No embedding-based duplicate detection.

**Story B: Tag-Based Recommendations (1 story, 1 day)**
- "Recommended for You" widget on Overview dashboard
- Sort non-completed courses by tag overlap with completed courses
- "Because you completed [X]" label
- Empty state for 0 completions

**Measure for 2 weeks:**
- Does Pedro generate quizzes regularly?
- Does he click recommended courses?
- What is the actual quality of generated questions?

**If validated:** Plan E52-v2 with the full pipeline, QC, Bloom's, embeddings. The spike gives you real data to scope it properly.

**If not validated:** You saved weeks of work and have a lightweight feature that cost 3 days.

---

## Conclusion

The ML Phase 1 planning is thorough, well-researched, and architecturally sound. It is also massively over-scoped for a personal learning platform with one user and 10 courses. The documents confuse "can we build this?" (yes) with "should we build this at this scale?" (no).

The core insight — that Knowlune's existing AI infrastructure can support quiz generation and recommendations — is correct. But the correct response to that insight is a spike, not an epic. Prove value first. Engineer quality second. The current plan does both simultaneously, which means if the feature is not valuable, all the quality engineering is wasted.

Build the 2-story spike. Measure. Then decide.
