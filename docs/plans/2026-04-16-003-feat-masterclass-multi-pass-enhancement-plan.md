---
title: "feat: Masterclass multi-pass enhancement with self-critique"
type: feat
status: active
date: 2026-04-16
origin: docs/brainstorms/2026-04-16-masterclass-multi-pass-enhancement-requirements.md
target: ~/.claude/skills/masterclass/SKILL.md
---

# feat: Masterclass Multi-Pass Enhancement with Self-Critique

> **Target file:** `~/.claude/skills/masterclass/SKILL.md` — this plan modifies a user-global Claude Code skill, not application source code. All file paths below are relative to `~/` unless otherwise noted.

## Overview

Refactor the `/masterclass` skill's monolithic Stage 3 enhancement (12 layers in one LLM pass) into four sequential enhancement passes plus an advisory critique pass. Each pass has a narrow job, receives the previous pass's output as input, and logs its word count before proceeding. A fifth critique pass re-reads the original transcript and the fully enhanced text to check faithfulness and layer coverage.

## Problem Frame

Asking Claude to execute 12 pedagogical layers simultaneously in a single pass causes quality degradation — particularly on dense or long content. The model's attention distributes across competing concerns (structure, examples, engagement, bookends), producing shallow application of each layer. Splitting into focused passes narrows each call's objective, making quality failures diagnosable and layer compliance verifiable.

(see origin: `docs/brainstorms/2026-04-16-masterclass-multi-pass-enhancement-requirements.md`)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Stage 3 — Multi-Pass Enhancement (replaces current monolithic Stage 3)

                    ┌─────────────────────────────────────────────────┐
                    │  Phase 1: Analysis (unchanged)                  │
                    │  → Produces: Analysis Note (thesis, key         │
                    │    concepts, frameworks, emotional climax lines, │
                    │    section count, word count estimate)          │
                    └────────────────────┬────────────────────────────┘
                                         │ Analysis Note threaded into all passes
                                         ▼
  Input (cleaned transcript)
         │
         ▼
  ┌─────────────────────────────────┐
  │ Pass 1 — Structure (L1-2)       │  full + light
  │ Paragraph breaks, signposts     │
  └──────────────┬──────────────────┘
                 │ log word count, check ≥95% of input
                 ▼
  ┌─────────────────────────────────┐
  │ Pass 2 — Pedagogy (L3-5)        │  full only
  │ Examples, micro-recaps,         │
  │ step labels                     │
  └──────────────┬──────────────────┘
                 │ log word count, check ≥95% of input
                 ▼
  ┌─────────────────────────────────┐
  │ Pass 3 — Engagement (L8, L9-12) │  full only
  │ Mnemonic first, then reflection,│
  │ practice, cross-refs, emphasis  │
  └──────────────┬──────────────────┘
                 │ log word count, check ≥95% of input
                 ▼
  ┌─────────────────────────────────┐
  │ Pass 4 — Bookends (L6-7)        │  full + light
  │ Opening preview, closing recap  │
  │ (depends on complete text)      │
  └──────────────┬──────────────────┘
                 │ log word count, check ≥95% of input
                 ▼
  ┌─────────────────────────────────┐
  │ Pass 5 — Critique               │  full only
  │ Re-reads original + enhanced    │
  │ Flags faithfulness issues +     │
  │ missing/thin layers             │
  └──────────────┬──────────────────┘
                 │ prints critique report or "Critique: OK"
                 ▼
           {slug}_masterclass.txt
           → Stage 4 (TTS, unchanged)
```

**Mode summary:**

| Mode | Passes run | Layers covered |
|------|-----------|----------------|
| `full` | 1 → 2 → 3 → 4 → 5 (critique) | All 12 |
| `light` | 1 → 4 | L1-2, L6-7 |
| `simple` | None | None (unchanged) |

**Analysis Note threading:** Phase 1 Analysis produces a short structured block (8-10 lines max) written inline before Pass 1 begins. Every subsequent pass prompt includes this block as leading context so Pass 4 can reference the emotional climax lines verbatim without re-reading the original transcript.

## Requirements Trace

- R1. Layers split across four sequential passes in order: Structure (L1-2) → Pedagogy (L3-5) → Engagement (L8, L9-12) → Bookends (L6-7). Each pass receives prior pass output as input.
- R2. L6-7 applied in a dedicated final pass (Pass 4) — depends on complete enhanced text.
- R3. No pass re-reads the raw original transcript. Analysis Note (not full transcript) is threaded as context. Exception: critique pass (R6) re-reads original.
- R4. `light` mode: Passes 1 and 4 only. Passes 2, 3, and 5 (critique) are skipped.
- R5. `simple` mode: no passes run.
- R6. Critique pass re-reads original + enhanced text; checks layer presence, faithfulness, thinness.
- R7. Critique outputs a short terminal report. Does not modify text.
- R8. No issues → "Critique: OK".
- R9. Critique is advisory — does not block Stage 4 TTS.
- R10. Each pass only adds content. If output word count is ≥5% shorter than input, save last successful pass output to `/tmp/masterclass/{slug}_passN.txt` and halt with warning.
- R11. After each pass: log `"Pass [N] complete — [word count] words."` to terminal.

## Scope Boundaries

- Stage 1 (yt-dlp extraction), Stage 2 (transcription), and Stage 4 (TTS/MimikaStudio) are unchanged.
- Critique pass flags issues only — no auto-fix, no re-run trigger.
- No new user-facing flags or mode keywords. `simple`, `light`, `full` are unchanged.
- Content-adaptive layer selection (idea #3 from ideation) is a separate future improvement.
- Pipeline checkpoint/resume (idea #6) is not introduced here — halt saves the last pass file as a manual recovery aid.

## Context & Research

### Relevant Code and Patterns

- **Source file:** `.claude/skills/masterclass/SKILL.md` (389 lines, staged pipeline with Phase 1 Analysis + Phases 2-5 currently inline)
- **Conditional skip pattern:** Blockquote directives used throughout existing skill — `> **Full mode only. Skip entirely in light mode.**` — continue this convention for pass-level gating.
- **Phase naming convention:** Current skill uses `### Phase N: Name` for Stage 3 sub-sections. New passes become `### Pass N — Name` to distinguish from the existing Phase 1 Analysis.
- **Progress reporting pattern:** `review-story` uses TodoWrite to track pipeline state; `epic-orchestrator` uses banner separators between steps. For this skill, a lightweight inline log line per pass is sufficient (no TodoWrite needed — passes are fast).
- **Post-step reporting gate:** Existing Phase 1 Analysis ends with "Report these findings briefly before proceeding." Apply the same pattern after each pass: emit a one-line summary before starting the next.
- **Quality checklist pattern:** The skill already has a mode-scoped checkbox checklist at the end. This section is extended, not replaced.
- **Word count gate:** Stage 2 already has a word count auto-downgrade gate. The new per-pass gate uses the same conceptual pattern but halts instead of downgrading.

### Institutional Learnings

- No relevant `docs/solutions/` entries for multi-pass LLM pipelines. This is net-new.
- From research: keep each pass prompt single-purpose; thread stable context (Analysis Note) explicitly rather than relying on implicit attention; validate word count programmatically via bash `wc -w`, not LLM self-report.

## Key Technical Decisions

- **Analysis Note over full transcript re-reads:** Phase 1 Analysis produces a short structured note (thesis, key concepts, frameworks, emotional climax lines, section count). This note is written inline at the top of the Stage 3 section and referenced in every pass prompt. This avoids R3 violations while giving Pass 4 the data it needs for verbatim closings.
- **Layer 8 first within Pass 3:** Mnemonic (L8) runs before Layers 9-12 within Pass 3. L11 (cross-references) uses "Remember the [Concept]?" callbacks — if the mnemonic is created in the same pass, L8 must precede L11 so the reference is coherent.
- **Halt saves, does not discard:** On a 5% shrinkage warning, save the last successful pass to `/tmp/masterclass/{slug}_passN.txt` before halting. Silent discard on a long-running job is unacceptable.
- **Critique skipped in light mode:** Light mode is a fast structural pass; faithfulness critique is overhead only justified for full-mode runs. Mode table corrects the requirements doc ambiguity — critique runs in full mode only.
- **Word count measured by bash `wc -w`:** LLM self-reported word counts are unreliable. The pass log line and shrinkage guard both use `wc -w` on the saved pass file, not Claude's estimate.

## Open Questions

### Resolved During Planning

- **Light mode critique (R4 contradiction):** Critique is skipped in light mode. Narrative in R4 was correct; the mode table in the requirements doc had an error. Plan reflects corrected behavior.
- **Halt behavior (R10):** Save last successful pass to `/tmp/masterclass/{slug}_passN.txt`, report path, halt. No silent discard.
- **Analysis Note threading:** Phase 1 outputs a structured note written to the skill's running context and prefixed into each pass prompt. Pass 4 uses it to retrieve emotional climax lines without re-reading the original.
- **Layer 8 ordering within Pass 3:** L8 (mnemonic) runs before L9-12 within Pass 3.
- **Text file baseline for shrinkage check:** For text file inputs where Stage 2 is skipped, baseline is the word count of the input file measured with `wc -w` before Pass 1.
- **Log verbosity:** Word count only per R11. "Pass N complete — N words." No per-layer breakdown in the log line.

### Deferred to Implementation

- **Critique pass layer markers:** What specific textual markers indicate each layer is present vs. thin? The implementer should design the critique prompt heuristics — likely a list of expected patterns per layer (e.g., "Layer 2 present if text contains ≥N phrases matching 'Let's look at' / 'Now here is where'"). See R6 deferred question in origin doc.
- **Analysis Note format:** The exact structure of the Analysis Note (prose vs. YAML-style key-value) is an implementation decision. It should be concise (8-10 lines) and scannable by subsequent pass prompts.

---

## Implementation Units

- [x] **Unit 1: Restructure Stage 3 — introduce pass scaffolding and Analysis Note**

  **Goal:** Replace the current monolithic Stage 3 instruction block with the new multi-pass structure. Phase 1 Analysis is preserved and extended to produce an explicit Analysis Note.

  **Requirements:** R1, R3, R11

  **Dependencies:** None — this is the foundational change all other units build on.

  **Files:**
  - Modify: `.claude/skills/masterclass/SKILL.md` (Stage 3 section — lines ~176–270)

  **Approach:**
  - Keep Phase 1 Analysis instructions intact. Add an output step: "Write the Analysis Note — a short structured block capturing: main thesis, key concepts list, frameworks, emotional climax lines (verbatim), section count, estimated word count." This note is written to the response and referenced in all subsequent passes.
  - Add a new `### Pass N — Name` header for each of the four enhancement passes, placed sequentially after Phase 1.
  - Each pass header includes: its layer scope, its skip directive (blockquote), the instruction to receive prior pass output as input, and the explicit instruction: "Prefix the Analysis Note written in Phase 1 as context before executing this pass."
  - Remove the existing Phase 2-5 headers and inline their layer instructions under the appropriate new pass header (no layer instructions change — only grouping changes).
  - Remove the existing top-level Stage 3 skip directive (currently at line 178: `> **Skip entirely in simple mode. In light mode, execute only Phase 1 (Analysis), Phase 2 (Layers 1-2), and Layers 6-7 from Phase 4. Skip Phases 3, 5, and Layer 8.**`) — this will be replaced by individual per-pass blockquote directives in each Pass header.
  - Add a word count log instruction at the end of each pass: "Print: Pass N complete — [wc -w output] words."

  **Patterns to follow:**
  - Existing blockquote skip directives: `> **Full mode only. Skip entirely in light mode.**`
  - Existing Phase 1 Analysis "Report these findings briefly before proceeding" gate
  - `.claude/skills/review-story/SKILL.md` for progress log format examples

  **Test scenarios:**
  - Test expectation: none — this unit rewrites skill instructions, not executable code. Verification is by inspection of the skill file structure.

  **Verification:**
  - Stage 3 section has exactly four `### Pass N` headers plus the existing Phase 1 Analysis header.
  - The old top-level Stage 3 skip directive (line 178 in original) is removed — no conflicting single-directive remains.
  - Phase 1 Analysis ends with an instruction to produce the Analysis Note.
  - Each pass header has the correct blockquote skip directive matching the mode table.
  - Each pass header explicitly instructs the agent to prefix the Analysis Note as context.
  - No layer instructions were dropped (compare against original Layer 1-12 definitions).

---

- [x] **Unit 2: Add per-pass word count gate and halt behavior**

  **Goal:** After each pass's execution instruction, add the word count check: measure output with `wc -w`, compare to previous pass input word count, halt with save if output is ≥5% shorter.

  **Requirements:** R10, R11

  **Dependencies:** Unit 1 (pass structure must exist)

  **Files:**
  - Modify: `.claude/skills/masterclass/SKILL.md` (end of each Pass N section)

  **Approach:**
  - After each pass's layer instructions, add a standardized "Pass Gate" block:
    1. Save pass output to `/tmp/masterclass/{slug}_passN.txt`
    2. Run `wc -w` on the saved file and compare to the prior pass file's word count
    3. If output is ≥5% shorter: print warning, save the last successful pass file path, halt — do not proceed to the next pass or to TTS
    4. If output passes: print `"Pass N complete — [word count] words."` and continue
  - For Pass 1, the baseline is the cleaned transcript word count (already computed in Stage 2's word count gate) or, for text file inputs, `wc -w` of the input file.
  - The halt message should specify: which pass failed, the word counts (expected vs. actual), and the path of the last saved pass file.

  **Patterns to follow:**
  - Stage 2's existing word count gate (auto-downgrade logic) for the pattern of measuring and comparing word counts
  - Existing bash block style with inline comments for gotchas

  **Test scenarios:**
  - Test expectation: none — skill instruction change, not code. Verification by inspection.

  **Verification:**
  - Each of the four pass sections ends with a Pass Gate block.
  - Pass 1's baseline is computed by running `wc -w /tmp/masterclass/{slug}.txt` immediately before Pass 1 begins (covers both audio/YouTube inputs where Stage 2 already produced that file, and text file inputs by copying/staging the input file to that path first).
  - Halt message includes pass number, word counts (baseline vs. actual), and saved file path.
  - Pass Gate uses `wc -w` (bash), not Claude's self-reported word count.

---

- [x] **Unit 3: Add Pass 5 — Critique pass**

  **Goal:** Add the critique pass after Pass 4, including instructions for what to check, what to output, and what not to do.

  **Requirements:** R6, R7, R8, R9

  **Dependencies:** Unit 1 (pass structure), Unit 2 (pass files saved to `/tmp/masterclass/`)

  **Files:**
  - Modify: `.claude/skills/masterclass/SKILL.md` (new section after Pass 4)

  **Approach:**
  - Add `### Pass 5 — Critique` with blockquote: `> **Full mode only. Skip in light and simple modes.**`
  - Instructions: re-read `/tmp/masterclass/{slug}.txt` (original cleaned transcript) and the fully enhanced text from Pass 4.
  - Check three things: (a) are all expected layers present for the mode — see the quality checklist below for what markers indicate each layer; (b) does the enhanced text faithfully represent the source — no hallucinated claims, no distorted arguments; (c) were any layers skipped or thin (a layer that appears present but added fewer than 2 substantive elements).
  - Output: a short bulleted list of findings, or if none: `"Critique: OK"`.
  - Explicitly state: "Do not modify the enhanced text. Do not re-run any pass. This is a read-only reporting step."
  - The critique report is printed to terminal and does not block Stage 4 TTS.

  **Patterns to follow:**
  - Phase 1 Analysis "read and identify" structure for the critique instructions
  - Existing quality checklist (end of SKILL.md) as the reference for "what markers indicate each layer" — link to it from the critique instructions

  **Test scenarios:**
  - Test expectation: none — skill instruction change. Verification by inspection.

  **Verification:**
  - Pass 5 section exists with correct blockquote (full mode only).
  - Instructions reference `/tmp/masterclass/{slug}.txt` as the original source.
  - Three checks (layer presence, faithfulness, thinness) are explicitly listed.
  - "Do not modify" constraint is stated.
  - No language that implies blocking TTS.

---

- [x] **Unit 4: Update mode skip directives and quality checklist**

  **Goal:** Update all existing blockquote skip directives to reference the new pass structure. Update the quality checklist to add per-pass verification items and a multi-pass section.

  **Requirements:** R4, R5, and the mode table

  **Dependencies:** Units 1-3

  **Files:**
  - Modify: `.claude/skills/masterclass/SKILL.md` (mode table, blockquote directives, quality checklist)

  **Approach:**
  - Update the mode table (currently in the Usage section) to reflect the corrected pass structure:

    | Mode | Passes run | Layers covered |
    |------|-----------|----------------|
    | `full` | 1 → 2 → 3 → 4 → 5 (critique) | All 12 |
    | `light` | 1 → 4 | L1-2, L6-7 |
    | `simple` | None | None |

  - Verify each blockquote directive still accurately reflects pass/mode behavior after Unit 1's restructure. Layer-level directives (e.g., "Full mode only") remain unchanged. Add pass-level directives where needed.
  - For Unit 3 (Critique Pass, Pass 5): the critique instructions must specify the source path based on input type — for YouTube/audio inputs the original is at `/tmp/masterclass/{slug}.txt`; for text file inputs it is the original input path (since Stage 2 is skipped and no copy is made to `/tmp/`).
  - Add a `### Multi-pass verification` section to the quality checklist:
    - [ ] Phase 1 Analysis Note was written (all modes)
    - [ ] Pass 1 complete — word count logged, gate passed
    - [ ] Pass 2 complete — word count logged, gate passed (full only)
    - [ ] Pass 3 complete — word count logged, gate passed (full only)
    - [ ] Pass 4 complete — word count logged, gate passed
    - [ ] Pass 5 critique report reviewed (full only)

  **Patterns to follow:**
  - Existing mode table format in the Usage section
  - Existing quality checklist section structure and checkbox format

  **Test scenarios:**
  - Test expectation: none — documentation/structure change. Verification by inspection.

  **Verification:**
  - Mode table matches the plan's corrected version.
  - No stale skip directives reference old Phase 2-5 names.
  - The mode table retains the original `Stages`, `Word Increase`, and `Output` columns alongside the new `Passes run` and `Layers covered` columns (do not drop existing user-facing columns).
  - Quality checklist includes the multi-pass section with per-pass checkboxes.
  - Light mode checklist items don't include Passes 2, 3, or 5 items.

---

## System-Wide Impact

- **Unchanged:** Stage 1 (yt-dlp), Stage 2 (mlx-whisper + Speaches fallback + artifact stripping + word count gate), Stage 4 (MimikaStudio TTS integration). All three stages operate exactly as before.
- **Interaction graph:** The Analysis Note is a new internal artifact — it lives in Claude's running context for the duration of Stage 3, not persisted to disk. It does not affect Stage 4 or any external integration.
- **Error propagation:** A word count halt in any pass saves the last successful pass file and surfaces the path. The user can inspect the file and re-invoke `/masterclass full /tmp/masterclass/{slug}_passN.txt` to restart from that stage (manual recovery — not automated resume).
- **Unchanged invariants:** The `/tmp/masterclass/{slug}.txt` (cleaned transcript) and `/tmp/masterclass/{slug}_masterclass.txt` (final enhanced text) file paths and naming conventions are unchanged. Stage 4 still reads `{slug}_masterclass.txt`.
- **Integration coverage:** No integration tests apply — this is a skill instruction document, not executable code.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Pass 4 fails to find emotional climax lines without full original | Analysis Note carries verbatim climax lines from Phase 1; Pass 4 uses these directly |
| Word count shrinkage false positive (reformatted text, shorter by structure) | 5% threshold gives reasonable tolerance for structural reformatting; threshold is documented so user can override by re-running with `full` explicitly |
| Critique produces false positives (flags thin layers when content is naturally short) | Critique instructions define "thin" as fewer than 2 substantive elements per layer; short content may legitimately have thin layers — critique should note this, not fail |
| Enhancement time increases significantly on long content | Expected and accepted; no time ceiling. Four LLM passes on a 10,000-word document is ~2-4 min total — acceptable for the quality gain |
| Layer instructions become fragmented across pass headers (maintenance burden) | Each pass section contains its own complete layer instructions — no cross-referencing between passes. If a layer instruction changes, it changes in one place |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-16-masterclass-multi-pass-enhancement-requirements.md](docs/brainstorms/2026-04-16-masterclass-multi-pass-enhancement-requirements.md)
- **Ideation document:** [docs/ideation/2026-04-16-masterclass-skill-ideation.md](docs/ideation/2026-04-16-masterclass-skill-ideation.md) — idea #1
- **Skill conventions reference:** `.claude/skills/review-story/SKILL.md`, `.claude/skills/techdebt/SKILL.md` (pipeline/phase patterns)
