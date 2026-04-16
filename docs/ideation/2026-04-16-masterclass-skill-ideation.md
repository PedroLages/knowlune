---
date: 2026-04-16
topic: masterclass-skill-improvements
focus: enhancement text quality, output formats, pipeline reliability
---

# Ideation: Masterclass Skill Improvements

## Codebase Context

The `/masterclass` skill is a Claude Code skill that converts YouTube URLs, audio files, or text files into enhanced educational audiobooks. Pipeline: yt-dlp -> mlx-whisper (M2) -> 12-layer pedagogical enhancement -> Kokoro TTS (MimikaStudio). Three modes: simple (transcript only), light (structural), full (all 12 layers). Output: MP3 to `/Volumes/SSD/MimikaStudio/outputs/`. Working dir: `/tmp/masterclass/` (volatile). Skill file: 389 lines. Used successfully once (2026-04-14, "Shame as a Survival System").

**Key learnings from prior work:**
- MimikaStudio job API unreliable (log-tailing workaround is correct but fragile)
- MP3->M4B conversion must match original bitrate via ffprobe (user preference)
- Whisper numba namespace collision fix may need reapplication after upgrades
- Transcriptions in /tmp/ are lost on reboot — missed opportunity for universal library search

## Ranked Ideas

### 1. Multi-Pass Enhancement with Self-Critique
**Description:** Split the monolithic 12-layer enhancement into 2-3 focused sequential passes (structure -> pedagogy -> engagement), with a final critique pass that checks faithfulness to the source and flags distortions before TTS. Each pass has a focused prompt and builds on the previous output.
**Rationale:** The single biggest quality lever. Asking Claude to execute 12 layers simultaneously degrades all of them. Focused passes produce measurably better results per layer. The critique pass catches hallucinations before the expensive TTS step.
**Downsides:** Increases enhancement time 2-3x (multiple LLM calls). Risk of passes contradicting each other. Needs clear input/output contracts between passes.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored

### 2. M4B Output with Chapter Markers
**Description:** After TTS generates MP3, use ffmpeg to embed chapter metadata (one per section boundary from the enhancement structure) and convert to M4B. Match source bitrate via ffprobe per user preference. Include cover art (YouTube thumbnail or generated).
**Rationale:** Transforms output from "raw audio file" to "proper audiobook." Chapters make long content navigable. M4B is the standard for Apple Books, Audiobookshelf, and every audiobook player. The section structure already provides natural chapter boundaries — harvesting existing data.
**Downsides:** Requires ffmpeg chapter metadata format knowledge. Cover art sourcing needs a fallback. Adds post-processing time.
**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored

### 3. Content-Adaptive Layer Selection
**Description:** Instead of fixed modes (full=12, light=4), analyze the source content type and select the layers that actually fit. A technical tutorial gets step labels and practice exercises but skips mnemonics. A philosophical lecture gets examples and reflection prompts but skips step labels. The analysis phase (already Phase 1) drives layer selection.
**Rationale:** The 12 layers aren't universal — forcing mnemonics onto a meditation talk or step labels onto a narrative essay produces awkward output. Content-aware selection improves quality by applying only what fits.
**Downsides:** Adds decision complexity to the enhancement phase. Layer selection logic needs validation across content types. Risk of under-enhancing if the classifier is too conservative.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 4. TTS-Optimized Writing Pass
**Description:** Add a final pass that rewrites the enhanced text for spoken clarity: shorter sentences at paragraph boundaries, explicit pauses (periods instead of semicolons), spelled-out abbreviations, phonetic hints for unusual words, avoiding long parentheticals and em-dashes that Kokoro handles poorly.
**Rationale:** The gap between "reads well" and "Kokoro renders it well" is currently unaddressed. TTS engines stumble on constructions that look fine in text — numbered lists without pause markers, acronyms, nested clauses. A dedicated pass bridges this gap.
**Downsides:** Requires knowledge of Kokoro's specific rendering quirks. May slightly reduce text readability for the companion text output. Low risk overall.
**Confidence:** 78%
**Complexity:** Low-Medium
**Status:** Unexplored

### 5. Opinionated Reorganization + Distill Mode
**Description:** A `distill` mode that reorganizes for pedagogical flow rather than preserving the speaker's stream-of-consciousness order. Front-loads thesis, groups related concepts, cuts tangents and repetition, compresses filler. Pedagogical scaffolding is still added but the net result is shorter and better-structured than the original.
**Rationale:** Many YouTube lectures are 2-3x longer than needed. The "never delete original content" guideline prevents the most impactful transformation: making content tighter. Challenges the additive-only assumption.
**Downsides:** Subtractive editing risks losing nuance the speaker intended. Harder to validate quality ("did we cut the right things?"). Bold departure from current philosophy.
**Confidence:** 72%
**Complexity:** Medium-High
**Status:** Unexplored

### 6. Pipeline Checkpoint and Resume
**Description:** Save pipeline state after each major stage (download -> transcribe -> enhance -> TTS). On failure or re-invocation with the same source, detect existing checkpoints and offer to resume from the last successful stage instead of restarting from scratch.
**Rationale:** Eliminates the "start from scratch" failure mode. Particularly valuable when TTS fails (the slowest step) — re-transcribing and re-enhancing just because MimikaStudio crashed wastes 30+ minutes.
**Downsides:** State management adds complexity. Stale checkpoints need expiry or manual cleanup. Needs durable storage (not /tmp/).
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 7. Multi-Voice Narration
**Description:** Assign different Kokoro voices to different content roles — primary narrator for original content, a second voice for added scaffolding (examples, recaps, transitions), optionally a third for exercises. Enhancement layer emits voice-switch markers that map to MimikaStudio voice IDs.
**Rationale:** Single-voice narration of mixed content makes it impossible to distinguish the author's words from added enhancement. Voice differentiation is a free cognitive cue that improves comprehension and reduces fatigue.
**Downsides:** MimikaStudio API may not support mid-file voice switching — may need to generate segments separately and concatenate with ffmpeg. Voice pairing requires taste. Highest complexity item.
**Confidence:** 70%
**Complexity:** High
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Kill slug duplication | Too small — a code fix, not an ideation-level improvement |
| 2 | Progress/time estimates | Unreliable estimates for variable-duration stages, low value |
| 3 | Eliminate modes / adaptive single mode | Risky — three modes serve real use cases |
| 4 | Whisper hallucination scoring | No ground truth data, partially covered by artifact stripping |
| 5 | Multilingual pipeline | Too expensive for personal tool; narrow use case |
| 6 | Non-educational templates / template library | Premature — skill used once; templating before establishing core |
| 7 | Anki exercise extraction | Disconnected feature, not a masterclass improvement |
| 8 | Full-text search index | Belongs in universal library search, not this skill |
| 9 | Multi-source synthesis | Different product entirely — cross-document reasoning |
| 10 | Ollama quality scoring | Subsumed by multi-pass enhancement |
| 11 | Whisper fallback routing | Already exists in skill (Speaches fallback documented) |
| 12 | Batch queue mode | Low leverage vs. per-item quality improvement |
| 13 | MimikaStudio polling fix | Tactical bug fix — just do it, not ideation-level |
| 14 | Skill file decomposition | Enabler for other ideas, not standalone feature |
| 15 | Automated quality gate / diff view | Good hygiene but low novelty — straightforward to add |
| 16 | Density-aware enhancement | Too vague — "information density" not reliably measurable |
| 17 | Audience-level calibration | Low leverage for personal tool with one user |
| 18 | Concept extraction as metadata | Belongs in Knowlune library features |
| 19 | Persistent transcription cache | Deferred — valuable but infrastructure, not text quality |
| 20 | Study guide companion output | Deferred — good idea, revisit after core text quality improves |
| 21 | Spaced repetition interleaving | Deferred — strong pedagogical basis, revisit after multi-pass lands |

## Session Log
- 2026-04-16: Initial ideation — 35 raw candidates across 4 frames, 22 after dedupe, 7 survivors. Refined with text-quality-focused second round (8 additional candidates, 4 kept). User selected final 7 excluding cache, study guide, and spaced repetition (deferred, not rejected).
