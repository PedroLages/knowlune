# Sub-agent prompt templates

Authoritative templates for every Task-dispatched sub-agent. Loaded on-demand from SKILL.md. Every template follows these rules:

1. Starts with a one-line role statement so the sub-agent knows its scope.
2. States exactly what inputs are passed and what structured output to return.
3. Explicitly forbids reading back content the coordinator doesn't need.
4. **Ends with `/auto-answer autopilot`** — prevents sub-agents blocking on inferable Q&A.
5. Dispatched via `Task(..., run_in_background: true, model: <from sub-agent-models.md>)`.

## Index

| Section | Sub-agent | Model | Unit |
|---|---|---|---|
| 1 | `ce-brainstorm-dispatcher` | opus | 2 |
| 2 | `ce-plan-dispatcher` | opus | 2 |
| 3 | **`plan-summarizer`** | haiku | **3** |
| 4 | **`ce-plan-deepener`** | opus | **3** |
| 5 | `ce-work-dispatcher` | opus | 2 |
| 6 | `pre-checks-runner` | haiku | 4 |
| 7 | `ce-review-dispatcher` | opus | 4 |
| 8 | `review-fixer` | sonnet | 4 |
| 9 | `demo-reel-classifier` | haiku | 5 |
| 10 | `ce-demo-reel-dispatcher` | sonnet | 5 |
| 11 | `ce-git-commit-push-pr-dispatcher` | sonnet | 5 |
| 12 | `story-to-brief` | sonnet | 2 (v2) |
| 13 | **`episodic-memory-searcher`** | haiku | **7 (v3)** |
| 14 | **`techdebt-dedup-dispatcher`** | sonnet | **7 (v3)** |
| 15 | **`design-review-dispatcher`** | opus | **7 (v3)** |
| 16 | **`checkpoint-dispatcher`** | haiku | **7 (v3)** |
| 17 | **`ce-debug-dispatcher`** | opus | **7 (v3)** |

Sections marked with the Unit that introduced them. Earlier Units leave stubs; later Units fill them in.

---

## 3. `plan-summarizer` (Unit 3)

**Role:** Read a plan file and emit a lean digest for the coordinator to show at the plan-approval gate. Never returns raw plan content.

**Model:** haiku

**Inputs:** `planPath` (repo-relative or absolute)

**Prompt template:**

```text
You are the plan-summarizer for the CE orchestrator's plan-approval gate.

Plan file: <planPath>

Read the plan using the Read tool. Produce a single markdown digest — strictly ≤300 words — with these four sections, in this order:

### Goal
One sentence. Repeat the plan's stated outcome. Do not editorialize.

### Implementation units
Bulleted list. Unit name + one-phrase purpose (≤10 words each). Do not paraphrase the plan's approach blocks.

### Key risks
Top 3 risks from the plan's Risks & Dependencies table (or equivalent). One line each. If the plan lists none, state "Risks: plan did not enumerate — flag for reviewer."

### Terminal deliverable
One sentence. What the user has when the pipeline finishes (PR? merged code? solution doc?).

Constraints:
- Never include code blocks, diagrams, or full section text.
- Never add commentary about your own opinion.
- Never fetch anything outside the plan file.
- If the plan file is unreadable, return `ERROR: <reason>` as the sole output.

Return ONLY the markdown digest. No preamble, no suffix.

/auto-answer autopilot
```

**Coordinator consumes:** the returned markdown verbatim — displays it as the body of the AskUserQuestion preamble. Do not re-summarize.

**Error handling:**

- If returned text starts with `ERROR:`, surface the reason to the user, halt, tracking stage = `halted-at-summarizer`.
- If returned text exceeds ~500 words (bloat signal), still show it but log a soft warning for v2 eval refinement.

---

## 4. `ce-plan-deepener` (Unit 3)

**Role:** Re-invoke `ce:plan` in deepen mode with user change-request notes. Returns the same `{planPath}` (plan is edited in place by the deepen pass).

**Model:** opus

**Inputs:** `planPath`, `userNotes` (free-text from the `Request changes` branch of the gate)

**Prompt template:**

```text
You are dispatching ce:plan in deepen mode to integrate user feedback into an existing plan.

Plan file: <planPath>
User notes (change request from plan-approval gate):
<<<
<userNotes>
>>>

Steps:
1. Use the Skill tool to invoke ce:plan.
2. In the prompt to ce:plan, say EXACTLY: "Deepen this plan: <planPath>. Integrate the following user notes. Prioritize sections the notes explicitly reference; otherwise run a normal deepening pass. User notes: <userNotes>"
3. ce:plan detects the "deepen" keyword + plan path and enters its Phase 5.3 interactive deepening fast path. It will review findings with the user and integrate accepted ones.
4. When ce:plan completes, return ONLY: `{"planPath": "<same path>", "deepenedAt": "<ISO timestamp ce:plan stamped in frontmatter, or null if not stamped>"}`.
5. If ce:plan errors or refuses (e.g., plan lacks frontmatter): `{"error": "<reason>"}`.

Do not paraphrase the user's notes. Do not read the plan back to the coordinator. Do not add commentary.

/auto-answer autopilot
```

**Coordinator consumes:** `{planPath, deepenedAt}` — re-dispatches `plan-summarizer` against the updated plan to show the fresh summary.

**Error handling:**

- If `{error}` returned: surface to user via AskUserQuestion with `Retry`/`Proceed with original plan`/`Abort` options (v1 simple path).
- If `deepenedAt` is null and content appears unchanged (coordinator has no way to verify without reading — trust the deepener's report), re-show the fresh summary; user can decide whether it materially changed.

---

## Plan-approval gate flow (Phase 1.3 full spec)

```text
1. Dispatch plan-summarizer → get digest
2. Display digest to user in terminal
3. AskUserQuestion:
     Question: "Approve this plan and proceed to /ce:work?"
     Options:
       - Approve (Recommended)
       - Request changes
       - Abort
4. Branch:
   - Approve → Phase 2.1
   - Abort    → mark tracking.status = "aborted", clean exit
   - Request changes → deepen loop (step 5)

5. Deepen loop (max 2 iterations — round index 1 or 2):
   a. AskUserQuestion (free-text via Other option):
        Question: "What should change? (Round <N>/2)"
        Options:
          - Describe changes (use Other for free-text input)
          - Cancel — restore previous plan and abort run
   b. userNotes = captured text
   c. Dispatch ce-plan-deepener with {planPath, userNotes}
   d. Dispatch plan-summarizer again on the (in-place) updated plan
   e. Show new digest
   f. AskUserQuestion:
        Question: "Approve the updated plan?"
        Options:
          - Approve
          - Request more changes (only if N < 2)
          - Abort
   g. Branch:
      - Approve → Phase 2.1
      - Abort   → tracking.status = "aborted", clean exit
      - Request more changes:
          if N < 2: N += 1, goto step 5a
          else: go to step 6

6. Max rounds exhausted (N == 2, still not approved):
     AskUserQuestion:
       Question: "2 refinement rounds exhausted. How to proceed?"
       Options:
         - Proceed with unresolved notes (appended to plan frontmatter as `unresolvedNotes:`)
         - Abort
     If Proceed: coordinator dispatches a `plan-annotator` (haiku, ~30-line prompt — stub for v2) to append `unresolvedNotes: |` section to plan YAML, then continues to Phase 2.1.
     If Abort: clean exit.
```

**Why 2 refinement rounds and not 3:** 3 rounds would push the plan-approval cost above the plan generation itself. If a plan needs 3+ rounds of refinement, the original requirements were probably wrong — better to abort and re-brainstorm than to force a bad plan through.

**Why AskUserQuestion (not raw AskUserQuestion loop):** The tool's blocking UX matches every.to's "silence is not approval" principle. Default button is Approve and must be **clicked** — can't timeout-approve.

**Headless mode (v2):** this whole gate becomes an assertion — if plan confidence score from ce:plan < 85, abort run with `{status: "aborted", reason: "plan-confidence-too-low"}`. Never silently proceed.

**Autopilot flag (v3):** `--autopilot` does NOT skip this gate. It only suppresses cosmetic choices (demo-reel tier, etc.).

---

## 1. `input-classifier` (Unit 2 — v2 adaptive)

**Role:** Detect which entry stage the user's input maps to. Fast classification, no code reading, no external calls beyond filesystem checks.

**Model:** haiku

**Inputs:** `$ARGUMENTS` string + repo root (`/Volumes/SSD/Dev/Apps/Knowlune`)

**Prompt template:**

```text
You are the input-classifier for the CE orchestrator.

User input:
<<<
<$ARGUMENTS>
>>>

Repo root: /Volumes/SSD/Dev/Apps/Knowlune

Classify the input into ONE of these stages. Check in order; first match wins:

1. If input is empty or whitespace only → `ERROR`
2. If input matches regex `^docs/ideation/.+-\d{4}-\d{2}-\d{2}\.md$` AND the file exists → `brainstorm-from-ideation`
3. If input matches regex `^docs/brainstorms/\d{4}-\d{2}-\d{2}-.+-requirements\.md$` AND the file exists → `plan`
4. If input matches regex `^docs/plans/\d{4}-\d{2}-\d{2}-\d{3}-.+-plan\.md$` AND the file exists → `plan-approval`
5. If input matches regex `^docs/implementation-artifacts/stories/E\d+-S\d+.*\.md$` AND the file exists → `story-to-brief`
6. If input is a non-path string AND matches any of these bug-signal heuristics:
   - Contains keywords (case-insensitive): bug, error, broken, fails, crashes, regression, reset, leak
   - Starts with verb: fix, debug, diagnose, investigate
   Then → `debug`
7. Otherwise (any non-empty non-path string) → `brainstorm`

Confidence:
- `high`: rule 2-5 matched (path + file exists — unambiguous) OR rule 7 fallthrough on clearly descriptive idea (>20 chars, no bug keywords)
- `medium`: rule 6 matched (bug heuristic) OR rule 7 fallthrough on short/ambiguous idea
- `low`: input is path-shaped but file doesn't exist, OR input has mixed signals (e.g., contains both "bug" and "new feature")

Return ONLY:
```json
{
  "stage": "<one of: brainstorm | brainstorm-from-ideation | plan | plan-approval | story-to-brief | debug | ERROR>",
  "resumeArtifact": "<path if rules 2-5 matched, else null>",
  "rationale": "<one sentence: which rule fired and why>",
  "confidence": "<high | medium | low>"
}
```

Do not read file contents (just existence). Do not run git commands.

/auto-answer autopilot
```

**Coordinator consumes:** the JSON verbatim. Branches on `stage`. On `low` confidence, surfaces to user via AskUserQuestion with top-2 alternatives.

**Error handling:**

- `stage: ERROR` (empty input) → exit with message `"Input required. Pass an idea string or one of: docs/ideation/*, docs/brainstorms/*, docs/plans/*, docs/implementation-artifacts/stories/E##-S##*.md"`.
- Classifier returns malformed JSON → fallback to v1 minimal classifier (plan-path or bare idea); log warning for Unit 8 eval refinement.

---

## 1a. `ce-brainstorm-dispatcher` (Unit 2 — inline in SKILL.md §1.1)

Full template lives in SKILL.md Phase 1.1. Pending move here if SKILL.md body exceeds 500 lines.

## 2. `ce-plan-dispatcher` (Unit 2 — inline in SKILL.md §1.2)

Full template lives in SKILL.md Phase 1.2.

## 12. `story-to-brief` (Unit 2 full — v2)

**Role:** Translate a BMAD story file into a CE-shaped requirements brief. Strategic source of truth (the story file) is never modified — this is a one-way bridge into the CE pipeline.

**Model:** sonnet

**Inputs:** `storyPath` (e.g., `docs/implementation-artifacts/stories/E92-S03.md`)

**Prompt template:**

````text
You are the story-to-brief bridge for the CE orchestrator.

BMAD story: <storyPath>

Read the story with the Read tool. Extract:
1. **Title** — story title
2. **Story ID** — e.g., "E92-S03"
3. **Problem / user value** — what the story solves, for whom
4. **Acceptance criteria** — verbatim AC list
5. **Out of scope** — explicit non-goals from the story
6. **Dependencies** — prerequisites, blocked-by
7. **Context** — any technical notes, links to prior art

Write a requirements doc at `docs/brainstorms/YYYY-MM-DD-<storyId-lowercase>-<kebab-slug>-requirements.md` using today's date. Use the CE brainstorm format:

```markdown
---
title: "<Story title>"
type: requirements
status: active
date: YYYY-MM-DD
origin: <storyPath>
bmad_story_id: <storyId>
---

# <Title>

## Problem frame

<problem + user value>

## Scope

### In scope
<AC bullet list — verbatim>

### Out of scope
<verbatim non-goals + "anything not listed in AC">

## Key decisions

<any architectural notes from the story — leave empty if none>

## Dependencies

<dependencies list>

## Open questions

*None yet — surface in ce:plan if any emerge.*

## Sources

- Origin: [<storyPath>](<storyPath>)
```

Rules:
- Never modify the original story file.
- Never paraphrase ACs — copy them verbatim. Reviewers of the generated plan need to see the exact contract.
- If the story has `Status: done` in its frontmatter, stop with `{"error": "story already done — cannot bridge"}`.
- If the story has `status: draft` or missing AC, stop with `{"error": "story incomplete — fill AC section before running ce-orchestrator"}`.

Return ONLY:
```json
{
  "requirementsPath": "<the brainstorm doc path>",
  "storyId": "<e.g., E92-S03>"
}
```

Or on error: `{"error": "<reason>"}`.

/auto-answer autopilot
````

**Coordinator consumes:** `{requirementsPath, storyId}`. Feeds `requirementsPath` into `ce-plan-dispatcher` as its normal input. `storyId` goes into tracking-file frontmatter for cross-reference.

**Error handling:**

- `{error: "story already done"}` → surface to user, halt. They likely meant to reopen/clone the story.
- `{error: "story incomplete"}` → surface to user with guidance to fill AC, halt.
- Requirements doc write fails (disk full, permissions) → surface error, halt. No retry — coordinator is not stateful enough to safely retry file writes.

**Why sonnet and not opus:** translation from one structured doc format to another is mechanical with small judgment calls (which context bullet is technical note vs. AC dependency). Opus would be overkill; haiku might flatten nuance. Sonnet hits the sweet spot.

**Why preserve the original story:** BMAD stories are the strategic layer (sprint status, epic tracking, retros). If `ce-orchestrator` mutated them, a run would change sprint state in surprising ways. Keeping the story read-only means the CE pipeline is additive — story still exists, now there's a brainstorm doc pointing back at it.

---

## 5. `ce-work-dispatcher` (Unit 2 — inline in SKILL.md §2.1)

Full template lives in SKILL.md Phase 2.1.

## 6. `pre-checks-runner` (Unit 4 — inline in SKILL.md §2.2)

Full template lives in SKILL.md Phase 2.2. Unit 4 to expand with `references/review-loop.md`.

## 7. `ce-review-dispatcher` (Unit 4 — inline in SKILL.md §2.3)

Full template lives in SKILL.md Phase 2.3.

## 8. `review-fixer` (Unit 4)

**Role:** Apply BLOCKER + HIGH + MEDIUM findings from `/ce:review`. Mechanical fixes with small judgment calls. Never commits — coordinator commits after fixer returns.

**Model:** sonnet

**Inputs:** `findings` (array, filtered to BLOCKER/HIGH/MEDIUM only), `round` (1–3), `planPath`

**Prompt template:**

```text
You are the review-fixer for the CE orchestrator's review loop.

Round: <round> of 3
Plan (for context on intent, not to modify): <planPath>

Findings to fix (BLOCKER + HIGH + MEDIUM only):
<<<
<JSON array of findings, each with {id, severity, file, line, description, suggestedFix, autofixClass}>
>>>

Rules:
1. For each finding, apply the suggestedFix using the Edit tool when the fix is mechanical and low-risk.
2. When suggestedFix requires judgment (e.g., "refactor this", "choose naming"), read the surrounding code with Read, then make the smallest change that resolves the finding. Never invent new abstractions or refactor beyond the finding's scope.
3. **Do NOT commit.** Do not run `git add` or `git commit`. The coordinator commits after you return.
4. **Do NOT modify the plan file** or any file under `docs/`, `.claude/`, or `.context/`.
5. **Do NOT add tests** unless a finding explicitly says "add test for X". Coordinator's pre-checks cover test presence.
6. After each fix, briefly verify it compiles/lints using a targeted check (e.g., `npx tsc --noEmit <file>` if available). Do not run the full build — too slow, coordinator does that in pre-checks on the next round.
7. If a finding cannot be fixed (unclear, out of scope, conflicts with another finding), skip it and record the reason.

Return ONLY:
```json
{
  "fixedCount": <number>,
  "skippedCount": <number>,
  "skippedReasons": [
    {"findingId": "<id>", "reason": "<one line>"}
  ],
  "filesChanged": ["<path>", "<path>"]
}
```

Do not return a narrative summary. Do not read back code changes. Do not commit.

/auto-answer autopilot
```

**Coordinator consumes:** `{fixedCount, skippedCount, skippedReasons, filesChanged}`.

After this returns, coordinator:
1. Runs `git status --porcelain` to verify files changed.
2. Runs `git add -A && git commit -m "fix(ce-review-R<round>): apply review-fixer changes"`.
3. Re-dispatches `ce-review-dispatcher` for next round.

**Error handling:**

- `fixedCount == 0 && skippedCount > 0` on any round: either all findings need human judgment, or the fixer is stuck. Not fatal on R1/R2 — just re-dispatch review (some findings may resolve themselves via `/ce:review`'s `safe_auto`). On R3 with zero fixes → failure-recovery gate with skip reasons surfaced in banner.
- `filesChanged` empty after `git status` check: fixer hallucinated or lied. Halt, tracking stage `fixer-no-op`. Never loop — rerunning won't fix a behaving fixer.
- Edit tool fails (file not found, etc.): fixer's own error. Record in `skippedReasons`, coordinator continues to next round normally.

## 9. `demo-reel-classifier` (Unit 5 — inline in SKILL.md §2.4)

Full template lives in SKILL.md Phase 2.4.

## 10. `ce-demo-reel-dispatcher` (Unit 5 — inline in SKILL.md §2.4)

Full template lives in SKILL.md Phase 2.4.

## 11. `ce-git-commit-push-pr-dispatcher` (Unit 5 — inline in SKILL.md §2.5)

Full template lives in SKILL.md Phase 2.5.

---

---

## 13. `episodic-memory-searcher` (Unit 7 — v3)

**Role:** Surface prior Claude Code sessions on the same topic so Phase 1 (brainstorm/plan) starts warm.

**Model:** haiku

**Inputs:** `userInput` (raw string from $ARGUMENTS), `slug` (computed in Phase 0)

**Prompt template:**

```text
You are the episodic-memory-searcher for the CE orchestrator.

Topic (user input): "<userInput>"
Slug: <slug>

Steps:
1. Use the Skill tool to invoke `episodic-memory:search-conversations` with the topic string.
2. Filter results to conversations from the last 180 days where the topic clearly relates (same feature name, same bug, same subsystem).
3. For each match, produce one line: "<YYYY-MM-DD>: <one-sentence summary of what that session produced or learned>".
4. Cap at 3 most-relevant matches.

Return ONLY:
```json
{
  "relatedSessions": [
    {"date": "YYYY-MM-DD", "summary": "<line>", "relevance": "high|medium|low"}
  ],
  "topMatch": "<the single most relevant one-line summary, or null if none>"
}
```

If the episodic-memory tool is unavailable or returns no results: `{"relatedSessions": [], "topMatch": null}`.
If the tool errors: `{"error": "<reason>", "relatedSessions": []}` — still return the empty array so the coordinator can treat it as "no context" and proceed.

Do not read back full conversation transcripts. Do not quote more than one line per session.

/auto-answer autopilot
```

**Coordinator consumes:** `{relatedSessions, topMatch}`. Appends to tracking `supportingSkills.episodicMemory`. Passes `topMatch` (if non-null) as a 1-line context hint in the `ce-brainstorm-dispatcher` or `ce-plan-dispatcher` prompt body.

**Failure behavior:** `{error}` or empty array → log warning, proceed. Never halts.

---

## 14. `techdebt-dedup-dispatcher` (Unit 7 — v3)

**Role:** Run `/techdebt` Phase 1–2 against the diff produced by `/ce:work` to catch duplication before review agents do.

**Model:** sonnet

**Inputs:** `lastGreenSha`, `autopilot` (bool)

**Prompt template:**

```text
You are the techdebt-dedup-dispatcher for the CE orchestrator.

Baseline: <lastGreenSha>
Autopilot mode: <true|false>

Steps:
1. Use the Skill tool to invoke `techdebt` with argument: "scan diff from <lastGreenSha> to HEAD for duplicates. Report only — do not extract in this pass."
2. Parse its Phase 1–2 output (duplicate detection phase; ignore Phase 3+ which would extract).
3. Determine extraction recommendation:
   - If `techdebt` flagged any duplicate as `safety: unsafe` → `extractRecommendation: "skip"`.
   - Else if autopilot == true → `extractRecommendation: "auto-extract"`, then invoke `techdebt` again in auto-extract mode limited to safe duplicates.
   - Else → `extractRecommendation: "ask-user"`.
4. If auto-extract ran: capture `filesChanged` (from git status --porcelain) and return them. Do NOT commit — coordinator commits.

Return ONLY:
```json
{
  "duplicatesFound": <int>,
  "summary": ["<one-line per duplicate, max 5>"],
  "extractRecommendation": "skip|ask-user|auto-extract",
  "autoExtracted": <bool>,
  "filesChanged": ["<path>"]
}
```

On error (techdebt unavailable, invalid diff): `{"error": "<reason>", "duplicatesFound": 0}`.

Do not read back refactored code. Do not commit. Do not touch files outside src/.

/auto-answer autopilot
```

**Coordinator consumes:** Branches on `duplicatesFound` and `extractRecommendation`. On `ask-user` path: AskUserQuestion `Extract | Skip | Abort`. On `auto-extract` with `filesChanged` non-empty: coordinator runs `git add -A && git commit -m "chore(ce-techdebt): extract <N> duplicates"` before proceeding.

**Failure behavior:** `{error}` → log warning, proceed to pre-checks. Never halts.

---

## 15. `design-review-dispatcher` (Unit 7 — v3)

**Role:** Parallel dispatch of Knowlune's `/design-review` agent during Round 1 of the review loop, for UI diffs.

**Model:** opus (UI judgment + accessibility reasoning)

**Inputs:** `modifiedFiles`, `lastGreenSha`, `planPath`

**Precondition enforced by coordinator:** only dispatch if `modifiedFiles` contains any `src/**/*.tsx`, `src/**/*.css`, `src/app/pages/**`, or `src/app/components/**`.

**Prompt template:**

```text
You are the design-review-dispatcher for the CE orchestrator.

Plan context: <planPath>
Modified UI files:
<<<
<list of matching files>
>>>
Baseline SHA: <lastGreenSha>

Steps:
1. Use the Skill tool to invoke `design-review` with the diff scope <lastGreenSha>..HEAD.
2. Let it open Playwright, navigate the affected routes, test responsive breakpoints (mobile 375px, tablet 768px, desktop 1440px), check accessibility (keyboard nav, contrast, ARIA).
3. When it emits `docs/reviews/design/*.md`, capture the path.
4. Parse its severity counts.

Return ONLY:
```json
{
  "reportPath": "<path>",
  "findingsCount": {"blocker": <n>, "high": <n>, "medium": <n>, "low": <n>},
  "findings": [
    {"id": "...", "severity": "...", "file": "...", "description": "...", "suggestedFix": "..."}
  ]
}
```

On error (Playwright MCP unavailable, dev server won't start, browser crash):
  `{"error": "<reason>", "reportPath": null, "findingsCount": {...zeros...}, "findings": []}`.

Do not halt the pipeline on error — return empty findings array.
Do not re-run `/ce:review` or other review skills; that's the coordinator's job.

/auto-answer autopilot
```

**Coordinator consumes:** Merges `findings` array into the Round 1 fixer input (union with `/ce:review` findings). Appends `reportPath` to tracking `supportingSkills.designReview`.

**Failure behavior:** `{error}` → log warning, continue with `/ce:review` findings only. Never halts.

**Why opus:** design findings often require judgment ("is this contrast failure actually failing because of the token or because of the page background?"). Sonnet misses nuance; haiku hallucinates.

---

## 16. `checkpoint-dispatcher` (Unit 7 — v3)

**Role:** Fire-and-forget checkpoint at phase boundaries. Redundant with tracking file; belt-and-suspenders for multi-day runs.

**Model:** haiku

**Inputs:** `phase` (e.g., `post-plan-approval`), `trackingPath`, `slug`

**Prompt template:**

```text
You are the checkpoint-dispatcher for the CE orchestrator.

Phase: <phase>
Tracking: <trackingPath>
Slug: <slug>

Steps:
1. Use the Skill tool to invoke `checkpoint`.
2. Pass it a brief context note: "CE orchestrator phase boundary: <phase> for run <slug>. See tracking: <trackingPath>".
3. Let checkpoint save its standard context snapshot.

Return ONLY: `{"checkpointPath": "<path>"}` or `{"error": "<reason>"}`.

Do not read back the checkpoint contents. Do not wait for user confirmation.

/auto-answer autopilot
```

**Coordinator consumes:** Dispatches via `Task(..., run_in_background: true)` and **does not await the response**. Continues to next phase immediately. If response eventually arrives, append `{phase, path}` to `supportingSkills.checkpoints` in tracking file.

**Failure behavior:** Silent. Tracking file already has state; checkpoint is additive.

---

## 17. `ce-debug-dispatcher` (Unit 7 — v3)

**Role:** Bug-input entry point. Invokes `superpowers:systematic-debugging` first, emits a CE-shaped requirements doc, then hands off to `/ce:plan`.

**Model:** opus

**Inputs:** `bugDescription` (raw user input), `slug`

**Prompt template:**

```text
You are the ce-debug-dispatcher for the CE orchestrator.

Bug description:
<<<
<bugDescription>
>>>

Slug: <slug>

Steps:
1. Use the Skill tool to invoke `superpowers:systematic-debugging` with the bug description.
2. Let it perform: reproduction attempt, observation, hypothesis generation, minimal test, root-cause isolation.
3. Synthesize findings into a CE requirements brief at `docs/brainstorms/YYYY-MM-DD-debug-<slug>-requirements.md` with this structure:

```markdown
---
title: "fix: <bug one-liner>"
type: requirements
status: active
date: YYYY-MM-DD
origin: systematic-debugging
---

# fix: <bug one-liner>

## Problem frame
<hypothesized root cause, not the symptom>

## Scope

### In scope
- <reproduction steps as AC>
- <verification steps as AC>
- <minimal-change fix at <file:line>>

### Out of scope
- Any refactoring beyond the root-cause fix
- Unrelated bugs surfaced during investigation

## Key decisions
- Root cause: <one-line from systematic-debugging>
- Chosen fix approach: <one-line>
- Rejected alternatives: <bullet, with why>

## Dependencies
<if any — else "none">

## Sources
- Bug report: <original description, verbatim, in blockquote>
- Systematic-debugging skill output: <inline summary>
```

4. Fall-back: if `superpowers:systematic-debugging` is unavailable, fall back to `/ce:debug` directly and synthesize the brief from its output. Log this fallback in tracking.

Return ONLY:
```json
{
  "requirementsPath": "<path>",
  "rootCause": "<one line>",
  "usedFallback": <true|false>
}
```

Or on error: `{"error": "<reason>"}`.

Rules:
- Never propose more than one fix approach per brief.
- Never scope-creep: if the investigation reveals unrelated bugs, note them in an appendix, do NOT add them to AC.
- Never skip the reproduction step — if the bug cannot be reproduced, return `{"error": "cannot-reproduce"}` and let the user decide.

/auto-answer autopilot
```

**Coordinator consumes:** `{requirementsPath, rootCause, usedFallback}`. Feeds `requirementsPath` into `ce-plan-dispatcher` — same mechanical flow as `story-to-brief`. Surfaces `rootCause` in the Phase 1 banner.

**Failure behavior:**

- `{error: "cannot-reproduce"}` → AskUserQuestion: `Proceed with unreproduced bug (risky)` / `Abort and gather more info`. Hard gate; never autopilot-skipped.
- `{error}` other → halt, tracking stage `halted-at-debug`.

**Why opus:** root cause analysis is deep-reasoning work. Sonnet will often fixate on the first hypothesis; opus genuinely compares alternatives.

---

## Invariants across all templates

- **Never pass free-form user input to a sub-agent without delimiters.** User notes go inside `<<< ... >>>` blocks to prevent prompt-injection confusion.
- **Never ask the sub-agent to return markdown when JSON is needed for control flow.** If the coordinator branches on the return value, it must be JSON (or a short structured text envelope).
- **Never include the coordinator's reasoning or prior steps.** Sub-agents start cold — they only need inputs + task + output spec.
- **Never dispatch without `/auto-answer autopilot` tail.** Any sub-agent that might ask a clarifying question will block the pipeline without it.
