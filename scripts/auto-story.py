#!/usr/bin/env python3
"""
auto-story.py — Automated story development cycle for Knowlune.

Reads stories from sprint-status.yaml and runs the full cycle:
  Session 1: START   — branch, story file, research, plan
  Session 2: IMPLEMENT — code the feature from the plan
  Session 3: REVIEW + FIX LOOP + FINISH — quality gates, fix blockers, ship PR
  (Auto)   : EPIC FINISH — if an epic just completed: merge PRs, run 5-phase epic wrap-up

Usage:
    python scripts/auto-story.py E07-S01              # single story
    python scripts/auto-story.py E07-S01 E07-S02      # multiple stories
    python scripts/auto-story.py --next 3              # next 3 backlog stories
    python scripts/auto-story.py --supervised E07-S01  # pause for human approval
    python scripts/auto-story.py --dry-run --next 5    # show plan without executing
    python scripts/auto-story.py --autonomous E07-S01  # auto-approve everything
    python scripts/auto-story.py --epic-only 15        # skip stories, run epic finish only
    python scripts/auto-story.py --skip-epic-finish --next 3  # process stories, skip epic finish
    python scripts/auto-story.py --skip-adversarial --epic-only 15  # epic finish without adversarial review
    python scripts/auto-story.py --epic-only 15 --phase retrospective  # run only retrospective for epic 15
    python scripts/auto-story.py --epic-only 15 --phase testarch-trace testarch-nfr  # run specific phases

Requires: pip install claude-agent-sdk pyyaml
"""

from __future__ import annotations

import argparse
import asyncio
import html
import json
import logging
import re
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, date
from pathlib import Path
from typing import Any

import yaml

from claude_agent_sdk import (
    AssistantMessage,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    ResultMessage,
)
from claude_agent_sdk.types import AgentDefinition, McpStdioServerConfig, TextBlock

# ─────────────────────────────────────────────────
# Section A: CLI & Config
# ─────────────────────────────────────────────────

log = logging.getLogger("auto-story")

PROJECT_DIR = Path(__file__).resolve().parent.parent
SPRINT_STATUS = PROJECT_DIR / "docs" / "implementation-artifacts" / "sprint-status.yaml"
AGENTS_DIR = PROJECT_DIR / ".claude" / "agents"

# No budget caps — let sessions run to completion
BUDGET_SESSION_START = 0  # 0 = unlimited
BUDGET_SESSION_IMPLEMENT = 0
BUDGET_SESSION_REVIEW = 0
BUDGET_PER_STORY = 25.00  # estimate for dry-run display only
BUDGET_SESSION_EPIC_FINISH = 0  # unlimited

# Timing and display constants
SERVER_STARTUP_WAIT_SECS = 5
SERVER_SHUTDOWN_TIMEOUT_SECS = 5
PROGRESS_DOT_INTERVAL_CHARS = 2000
PLAN_PREVIEW_CHARS = 3000


@dataclass
class RunConfig:
    stories: list[str]
    mode: str  # "supervised" | "autonomous"
    dry_run: bool
    resume: bool
    max_review_rounds: int
    max_turns: int
    log_file: Path
    skip_epic_finish: bool = False
    skip_adversarial: bool = False
    epic_only: str | None = None  # e.g., "15" — skip stories, run only epic finish
    epic_phases: list[str] | None = None  # e.g., ["retrospective"] — run only specific phases
    skip_epics: list[int] | None = None  # e.g., [19] — skip stories from these epics in --next
    legacy_mode: bool = False  # disable all optimizations (per-phase models, effort, session chaining)


@dataclass
class StoryInfo:
    key: str  # "E07-S01"
    yaml_key: str  # "7-1-momentum-score-calculation"
    name: str  # "Momentum Score Calculation"
    epic_num: str
    story_num: str
    status: str


@dataclass
class Verdict:
    is_pass: bool
    blocker_count: int
    high_count: int
    findings_text: str


@dataclass
class ReviewResult:
    rounds: int = 0
    blockers_found: int = 0
    blockers_fixed: int = 0


@dataclass
class StoryResult:
    story: StoryInfo
    phase_reached: str = "init"
    success: bool = False
    duration_secs: float = 0.0
    total_cost_usd: float = 0.0
    cost_start: float = 0.0
    cost_implement: float = 0.0
    cost_review: float = 0.0
    review_rounds: int = 0
    blockers_found: int = 0
    blockers_fixed: int = 0
    pr_url: str | None = None
    error: str | None = None
    session_ids: list[str] = field(default_factory=list)


@dataclass
class EpicFinishResult:
    epic_num: str
    phases_completed: list[str] = field(default_factory=list)
    phases_failed: list[str] = field(default_factory=list)
    merged_prs: list[str] = field(default_factory=list)
    duration_secs: float = 0.0
    total_cost_usd: float = 0.0
    success: bool = False
    error: str | None = None
    session_id: str | None = None


VALID_EFFORTS = ("low", "medium", "high", "max")
VALID_MODELS = ("sonnet", "opus", "opusplan")


@dataclass
class PhaseConfig:
    """Per-phase SDK configuration for model, effort, session chaining, and tools."""
    model: str | None = None
    effort: str | None = None
    fallback_model: str | None = None
    resume_session_id: str | None = None
    fork_session: bool = False
    append_context: str = ""
    needs_agents: bool = True
    needs_playwright: bool = True

    def __post_init__(self):
        if self.effort and self.effort not in VALID_EFFORTS:
            raise ValueError(f"Invalid effort '{self.effort}', must be one of {VALID_EFFORTS}")
        if self.model and self.model not in VALID_MODELS:
            raise ValueError(f"Invalid model '{self.model}', must be one of {VALID_MODELS}")
        if self.model and self.fallback_model and self.model == self.fallback_model:
            raise ValueError(f"fallback_model cannot be the same as model ('{self.model}')")


class StoryError(Exception):
    pass


def parse_args() -> RunConfig:
    parser = argparse.ArgumentParser(
        description="Automated story development for Knowlune",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "stories", nargs="*", help="Story IDs (e.g., E07-S01 E07-S02)"
    )
    parser.add_argument(
        "--next", type=int, metavar="N", help="Process next N backlog stories"
    )
    parser.add_argument(
        "--supervised", action="store_true",
        help="Pause for human approval at plan and fix stages (default)",
    )
    parser.add_argument(
        "--autonomous", action="store_true",
        help="Auto-approve plans and fixes",
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would run")
    parser.add_argument(
        "--resume", action="store_true",
        help="Skip stories already completed in log file",
    )
    parser.add_argument("--max-review-rounds", type=int, default=3)
    parser.add_argument("--max-turns", type=int, default=100)
    parser.add_argument(
        "--log-file", type=Path, default=PROJECT_DIR / "scripts" / "auto-story.log"
    )
    parser.add_argument(
        "--skip-epic-finish", action="store_true",
        help="Skip end-of-epic processing even if an epic just completed",
    )
    parser.add_argument(
        "--skip-adversarial", action="store_true",
        help="Skip adversarial review during epic finish (faster)",
    )
    parser.add_argument(
        "--epic-only", metavar="EPIC",
        help="Skip stories, run only epic finish for given epic (e.g., 15 or 9b)",
    )
    all_phase_names = [p[0] for p in EPIC_FINISH_PHASES]
    parser.add_argument(
        "--phase", nargs="+", metavar="PHASE", dest="epic_phases",
        choices=all_phase_names,
        help=f"Run only specific epic-finish phases (choices: {', '.join(all_phase_names)})",
    )
    parser.add_argument(
        "--skip-epic", nargs="+", type=int, metavar="N", dest="skip_epics",
        help="Skip stories from these epic numbers in --next discovery (e.g., --skip-epic 19)",
    )
    parser.add_argument(
        "--legacy-mode", action="store_true",
        help="Disable all optimizations (no per-phase models, effort, session chaining)",
    )

    args = parser.parse_args()

    if not args.stories and args.next is None and args.epic_only is None:
        parser.error("Provide story IDs, --next N, or --epic-only EPIC")

    mode = "autonomous" if args.autonomous else "supervised"

    stories_raw = list(args.stories or [])
    if args.next:
        # Deduplicate: --next skips stories already listed explicitly
        existing = {s.upper() for s in stories_raw}
        for key in find_next_backlog_keys(args.next + len(existing), args.skip_epics):
            if key.upper() not in existing:
                stories_raw.append(key)
                existing.add(key.upper())
            if len(stories_raw) >= len(args.stories or []) + args.next:
                break
    if args.epic_only:
        stories_raw = []  # no stories to process in epic-only mode

    return RunConfig(
        stories=stories_raw,
        mode=mode,
        dry_run=args.dry_run,
        resume=args.resume,
        max_review_rounds=args.max_review_rounds,
        max_turns=args.max_turns,
        log_file=args.log_file,
        skip_epic_finish=args.skip_epic_finish,
        skip_adversarial=args.skip_adversarial,
        epic_only=args.epic_only,
        epic_phases=args.epic_phases,
        skip_epics=args.skip_epics,
        legacy_mode=args.legacy_mode,
    )


# ─────────────────────────────────────────────────
# Section B: Story Discovery
# ─────────────────────────────────────────────────


def normalize_story_id(sid: str) -> tuple[str, str]:
    """E07-S01 -> ("7", "1"), E09B-S01 -> ("9b", "1"), stripping leading zeros."""
    m = re.match(r"E(\d+)([A-Z]?)-S(\d+)", sid, re.IGNORECASE)
    if not m:
        raise ValueError(f"Invalid story ID format: {sid!r}. Expected E##-S## or E##X-S##")
    epic_num = str(int(m.group(1)))
    suffix = m.group(2).lower() if m.group(2) else ""
    story_num = str(int(m.group(3)))
    return epic_num + suffix, story_num


def parse_epic_num(epic_num: str) -> tuple[int, str]:
    """Parse epic_num like '9b' into (9, 'b') or '7' into (7, '')."""
    m = re.match(r"(\d+)([a-z]?)", epic_num)
    if not m:
        raise ValueError(f"Invalid epic_num format: {epic_num!r}")
    return int(m.group(1)), m.group(2)


def load_sprint_status() -> dict[str, Any]:
    with open(SPRINT_STATUS) as f:
        return yaml.safe_load(f)


def find_yaml_key(
    epic_num: str, story_num: str, dev_status: dict[str, str]
) -> str | None:
    prefix = f"{epic_num}-{story_num}-"
    for key in dev_status:
        if key.startswith(prefix):
            return key
    return None


def slug_to_name(slug: str) -> str:
    """Convert '7-1-momentum-score-calculation' to 'Momentum Score Calculation'."""
    parts = slug.split("-")
    # Skip the leading epic-story numbers
    name_parts = parts[2:] if len(parts) > 2 else parts
    return " ".join(p.capitalize() for p in name_parts)


def find_story(sid: str) -> StoryInfo:
    epic_num, story_num = normalize_story_id(sid)
    data = load_sprint_status()
    dev_status = data.get("development_status", {})

    yaml_key = find_yaml_key(epic_num, story_num, dev_status)
    if yaml_key is None:
        raise ValueError(
            f"Story {sid} not found in sprint-status.yaml "
            f"(looked for prefix {epic_num}-{story_num}-)"
        )

    return StoryInfo(
        key=sid.upper(),
        yaml_key=yaml_key,
        name=slug_to_name(yaml_key),
        epic_num=epic_num,
        story_num=story_num,
        status=str(dev_status[yaml_key]),
    )


def detect_completed_epics(
    stories: list[StoryInfo], results: list[StoryResult],
    resumed_keys: set[str] | None = None,
) -> list[str]:
    """Return epic numbers that just became fully done after this batch.

    Combines sprint-status.yaml (on main, pre-batch state) with in-memory
    batch results and stories completed in prior --resume runs to determine
    completion. A story counts as done if it was already 'done' in YAML,
    succeeded in this batch, or was completed in a prior run.

    Returns sorted list of epic numbers (e.g., ["15", "16"]).
    """
    # Collect epic numbers from successful stories in this batch
    batch_succeeded: dict[str, set[str]] = {}  # epic_num -> set of yaml_keys
    for story, result in zip(stories, results):
        if result.success:
            batch_succeeded.setdefault(story.epic_num, set()).add(story.yaml_key)

    data = load_sprint_status()
    dev_status = data.get("development_status", {})

    # Include stories completed in prior resumed runs
    if resumed_keys:
        for skey in resumed_keys:
            try:
                epic_num, story_num = normalize_story_id(skey)
                yaml_key = find_yaml_key(epic_num, story_num, dev_status)
                if yaml_key:
                    batch_succeeded.setdefault(epic_num, set()).add(yaml_key)
            except ValueError:
                continue

    if not batch_succeeded:
        return []
    completed: list[str] = []

    for epic_num in sorted(batch_succeeded):
        epic_key = f"epic-{epic_num}"

        # Skip if epic is already marked done (completed before this batch)
        if str(dev_status.get(epic_key, "")).strip() == "done":
            continue

        # Check every story for this epic: must be done in YAML or succeeded in batch
        prefix = f"{epic_num}-"
        has_stories = False
        all_done = True
        for key, status in dev_status.items():
            if not key.startswith(prefix):
                continue
            if key.endswith("-retrospective"):
                continue
            has_stories = True
            if str(status).strip() == "done":
                continue  # already done on main (before batch)
            if key in batch_succeeded.get(epic_num, set()):
                continue  # succeeded in this batch
            all_done = False
            break
        if not has_stories:
            all_done = False

        if all_done:
            completed.append(epic_num)

    return completed


def find_next_backlog_keys(n: int, skip_epics: list[int] | None = None) -> list[str]:
    data = load_sprint_status()
    dev_status = data.get("development_status", {})

    # Build set of done epics — skip their leftover backlog stories
    done_epics: set[int] = set()
    for yaml_key, status in dev_status.items():
        if yaml_key.startswith("epic-") and str(status).strip() == "done":
            # "epic-7" -> 7, "epic-9b" -> 9
            num_part = yaml_key.split("-")[1]
            try:
                done_epics.add(int(re.match(r"(\d+)", num_part).group(1)))
            except (ValueError, AttributeError):
                pass

    keys: list[str] = []
    for yaml_key, status in dev_status.items():
        if str(status) != "backlog":
            continue
        if yaml_key.startswith("epic-") or yaml_key.endswith("-retrospective"):
            continue
        parts = yaml_key.split("-")
        if len(parts) >= 2:
            try:
                epic_n, story_n = int(parts[0]), int(parts[1])
            except ValueError:
                continue
            # Skip stories from done epics or explicitly skipped epics
            if epic_n in done_epics or (skip_epics and epic_n in skip_epics):
                continue
            keys.append(f"E{epic_n:02d}-S{story_n:02d}")
        if len(keys) >= n:
            break
    return keys


# ─────────────────────────────────────────────────
# Section C: Phase Prompts
# ─────────────────────────────────────────────────

START_PROMPT = """
You are starting story {story_id} ("{story_name}").

Follow these steps exactly:

1. Look up story "{story_id}" in docs/planning-artifacts/epics.md — find its acceptance criteria and requirements
2. Check current status in docs/implementation-artifacts/sprint-status.yaml
3. Create branch: feature/{branch_slug} from main (if it doesn't exist, switch to it if it does)
4. Create story file from docs/implementation-artifacts/story-template.md at docs/implementation-artifacts/{yaml_key}.md (if it doesn't already exist)
5. Update sprint-status.yaml: set story to in-progress
6. Research the codebase:
   - Read the acceptance criteria carefully
   - Check existing components, stores, and utilities that relate to this story
   - Identify patterns from similar completed features
   - Check test patterns in tests/
7. Create a detailed implementation plan and save it to docs/implementation-artifacts/plans/
8. Link the plan in the story file
9. Commit: "chore: start story {story_id}"

Do NOT start implementing. Only plan.
When done, output the full plan and end with: PLAN_COMPLETE
"""

IMPLEMENT_PROMPT = """
Implement story {story_id} following the plan you created.

Read the plan file at docs/implementation-artifacts/plans/ (find the latest one for this story).

Key rules:
- Follow existing codebase patterns (Tailwind, shadcn/ui, Zustand, Dexie)
- Use the @/ import alias
- Make granular commits after each logical task (as save points)
- Write unit tests for business logic
- Write E2E test spec at tests/e2e/story-{story_id_lower}.spec.ts if the story has UI
- Run tests after implementation to verify (npm run test:unit, npx playwright test)
- Commit all changes when complete

When finished, output: IMPLEMENTATION_COMPLETE
"""

REVIEW_PROMPT = """
Review story {story_id}. Run these quality gates in order:

PRE-CHECKS:
1. Verify working tree is clean (commit any uncommitted changes first)
2. npm run build — must pass
3. npm run lint — must pass
4. npx tsc --noEmit — must pass (auto-fix type errors in branch-changed files)
5. npx prettier --check src/ — auto-fix with --write if needed, then commit
6. npm run test:unit -- --run (if tests exist)
7. npx playwright test tests/e2e/navigation.spec.ts tests/e2e/overview.spec.ts tests/e2e/courses.spec.ts (smoke specs, chromium only)
8. If a story-specific E2E spec exists at tests/e2e/story-{story_id_lower}.spec.ts, run it too

AGENT REVIEWS:
9. Run the code-review agent: dispatch it via the Agent tool with subagent_type="code-review". It should review git diff main...HEAD.
10. Run the code-review-testing agent: dispatch via Agent tool with subagent_type="code-review-testing". It should verify AC coverage.
11. Run the design-review agent: dispatch via Agent tool with subagent_type="design-review". It tests the live app at http://localhost:5173 using Playwright MCP at mobile (375px), tablet (768px), and desktop (1440px) viewports. Only run this if the story has UI changes (check git diff for .tsx or .css files).

IMPORTANT: Run agents 9, 10, and 11 in PARALLEL for efficiency.

12. Save review reports to:
    - docs/reviews/code/code-review-{today}-{story_id}.md
    - docs/reviews/code/code-review-testing-{today}-{story_id}.md
    - docs/reviews/design/design-review-{today}-{story_id}.md (if design review ran)

13. Generate a CONSOLIDATED report with severity-triaged findings:
    - [Blocker]: must fix before shipping (confidence >= 70)
    - [High]: should fix (confidence >= 70)
    - [Medium]: fix when possible
    - [Nit]: optional

14. Update story file frontmatter: review_gates_passed list, reviewed status

End with exactly one of:
- VERDICT: PASS — if no [Blocker] findings
- VERDICT: BLOCKED — N blocker(s) — ONLY if [Blocker] findings exist

IMPORTANT: Only [Blocker] severity triggers BLOCKED. [High], [Medium], and [Nit]
are informational — report them but they do NOT block shipping.
"""

FIX_PROMPT = """
The review found issues that must be fixed before shipping story {story_id}.

Read the review reports you just generated at docs/reviews/code/ and docs/reviews/design/ (if design review ran).

Fix ALL findings by severity priority:
1. [Blocker] — mandatory, these block shipping
2. [High] — fix these, they are important quality issues
3. [Medium] — fix if straightforward
4. [Nit] — fix if trivial (one-line changes)

For each fix:
1. Open the file at the exact line referenced
2. Apply the suggested fix
3. Verify the fix doesn't break existing tests
4. Commit with message: "fix({story_id}): [what was fixed]"

After ALL fixes are committed, run: npm run build && npm run lint && npx tsc --noEmit
If those pass, output: FIXES_APPLIED
If they fail, fix the failures and try again.
"""

RE_REVIEW_PROMPT = """
Fixes have been applied for story {story_id}. Re-validate:

1. Re-run pre-checks: build, lint, typecheck, format, unit tests, e2e tests
2. For each previously-reported [Blocker] finding, verify the fix at the exact file:line
3. [High], [Medium], and [Nit] findings are informational — do NOT re-check them
4. Do NOT re-run the full code-review or code-review-testing agents (already completed)
5. Check if any fix introduced new issues

Output exactly one of:
- VERDICT: PASS — all blockers resolved, pre-checks pass
- VERDICT: BLOCKED — N remaining — list the unresolved issues
"""

FINISH_PROMPT = """
Finish story {story_id}:

1. Update story file frontmatter: status=done, completed={today}, reviewed=true
2. Update sprint-status.yaml: set story to done
3. Commit: "feat({story_id}): [story name from story file]"
4. If tests/e2e/story-{story_id_lower}.spec.ts exists, move it to tests/e2e/regression/
5. Commit the archive: "chore: archive {story_id} spec to regression"
6. Push: git push -u origin HEAD
7. Create PR via: gh pr create --title "feat({story_id}): [story name]" --body "[summary of changes, verification table]"

Output the PR URL on its own line as: PR_URL: <url>
"""

FINISH_RETRY_PROMPT = """
The FINISH phase for story {story_id} did not complete all tasks.

Missing:
{missing_items}

Complete ONLY the missing tasks listed above. Do not repeat already-completed tasks.
When done, output: FINISH_COMPLETE
"""

# ── Epic Finish Prompts (direct instructions, no slash commands) ──

EPIC_SPRINT_STATUS_PROMPT = """
Epic {epic_num} has just been completed (all stories merged to main).

Verify the epic is truly complete:

1. Read docs/implementation-artifacts/sprint-status.yaml
2. Find ALL story keys starting with "{epic_num}-" (excluding retrospective entries)
3. Confirm every story has status: done
4. If any stories are NOT done, list them with their current status
5. Check that "epic-{epic_num}" is set to "in-progress" or "done"
6. If epic-{epic_num} is not yet "done", update it to "done" in sprint-status.yaml
7. Commit if changes were made: "chore: mark Epic {epic_num} as done"

Output one of:
- SPRINT_STATUS_COMPLETE — all stories verified done, epic marked done
- SPRINT_STATUS_ISSUES: [description of problems found]
"""

EPIC_TESTARCH_TRACE_PROMPT = """
Generate a requirements-to-tests traceability matrix for Epic {epic_num}.

Steps:
1. Read the epic definition from docs/planning-artifacts/epics.md — find Epic {epic_num}
2. List ALL acceptance criteria (ACs) across all stories in Epic {epic_num}
3. For each AC, search for corresponding test coverage:
   - E2E specs in tests/e2e/regression/ matching story patterns (e.g., story-e{epic_num_padded}*)
   - Unit tests in tests/unit/ or src/ (*.test.ts, *.spec.ts)
4. Build a traceability matrix table:
   | Story | AC ID | AC Description | Test File(s) | Coverage Status |
5. Flag any ACs with NO test coverage as gaps
6. Save the matrix to docs/reviews/testarch-trace-{today}-epic-{epic_num}.md

When complete, output: TESTARCH_TRACE_COMPLETE
"""

EPIC_TESTARCH_NFR_PROMPT = """
Assess non-functional requirements for Epic {epic_num}.

Steps:
1. Read docs/planning-artifacts/epics.md — find Epic {epic_num} NFRs (if defined)
2. Review all code changes for Epic {epic_num}:
   - Run: git log --oneline --all --grep="E{epic_num_padded}" to find relevant commits
   - Run: git log --oneline --all --grep="e{epic_num_padded}" for lowercase matches
3. Assess these NFR categories against the code:
   - **Performance**: Bundle size impact, render performance, memory usage
   - **Security**: Input validation, data handling, XSS/injection vectors
   - **Accessibility**: WCAG AA compliance, keyboard nav, screen reader support
   - **Reliability**: Error handling, edge cases, data integrity
4. Rate each category: PASS / NEEDS_ATTENTION / FAIL
5. Save assessment to docs/reviews/testarch-nfr-{today}-epic-{epic_num}.md

When complete, output: TESTARCH_NFR_COMPLETE
"""

EPIC_ADVERSARIAL_PROMPT = """
Perform a cynical adversarial review of Epic {epic_num}.

You are a skeptical reviewer. Assume problems exist. Find at least 10 issues.

Steps:
1. Read all story files for Epic {epic_num} in docs/implementation-artifacts/ (keys starting with {epic_num}-)
2. Review the combined diff: git diff main~{story_count}..main (approximate — adjust range to cover epic commits)
   Alternative: check git log for commits matching E{epic_num_padded} and review those files
3. Read any existing review reports in docs/reviews/code/ and docs/reviews/design/ for this epic
4. Cynically assess:
   - Architecture decisions: over-engineering, under-engineering, wrong abstractions
   - Code quality: duplication, naming, complexity
   - Missing edge cases and error handling
   - UX issues: accessibility gaps, responsive design problems
   - Test quality: are tests actually testing the right things?
   - Security: any new attack surfaces?
5. Produce findings as a severity-triaged Markdown list:
   - [Blocker]: Must fix
   - [High]: Should fix
   - [Medium]: Fix when possible
   - [Low]: Minor improvements
6. Save to docs/reviews/code/adversarial-review-{today}-epic-{epic_num}.md
7. Commit: "chore: adversarial review for Epic {epic_num}"

When complete, output: ADVERSARIAL_COMPLETE
"""

EPIC_RETROSPECTIVE_PROMPT = """
Generate a retrospective for Epic {epic_num}.

Steps:
1. Gather data:
   - Read all story files in docs/implementation-artifacts/ for Epic {epic_num} (keys starting with {epic_num}-)
   - Read review reports in docs/reviews/code/ and docs/reviews/design/ for this epic
   - Run: git log --oneline --all --grep="E{epic_num_padded}" to see commit history
   - Count total stories, review rounds, blockers found/fixed from story file frontmatter
2. Analyze:
   - What went well? (patterns that worked, tools that helped)
   - What didn't go well? (recurring blockers, slow iterations)
   - What should change? (process improvements, new automation)
   - Lessons learned: extract reusable patterns for engineering-patterns.md
3. Generate retrospective document with sections:
   - Epic Summary (scope, duration, story count)
   - Metrics (review rounds, blocker rate, fix rate)
   - What Went Well
   - What Needs Improvement
   - Action Items (specific, actionable improvements)
   - Lessons Learned
4. Save to docs/implementation-artifacts/retrospective-epic-{epic_num}.md
5. Update sprint-status.yaml:
   - Set "epic-{epic_num}-retrospective" to "done"
6. Commit: "chore: Epic {epic_num} retrospective"

When complete, output: RETROSPECTIVE_COMPLETE
"""

# Phase registry for epic finish (name, template, completion marker)
EPIC_FINISH_PHASES = [
    ("sprint-status", EPIC_SPRINT_STATUS_PROMPT, "SPRINT_STATUS_COMPLETE"),
    ("testarch-trace", EPIC_TESTARCH_TRACE_PROMPT, "TESTARCH_TRACE_COMPLETE"),
    ("testarch-nfr", EPIC_TESTARCH_NFR_PROMPT, "TESTARCH_NFR_COMPLETE"),
    ("adversarial", EPIC_ADVERSARIAL_PROMPT, "ADVERSARIAL_COMPLETE"),
    ("retrospective", EPIC_RETROSPECTIVE_PROMPT, "RETROSPECTIVE_COMPLETE"),
]


def format_epic_prompt(template: str, epic_num: str, story_count: int = 0) -> str:
    """Fill epic-finish prompt template with epic details."""
    epic_n, epic_suffix = parse_epic_num(epic_num)
    return template.format(
        epic_num=epic_num,
        epic_num_padded=f"{epic_n:02d}{epic_suffix}",
        today=date.today().isoformat(),
        story_count=story_count,
    )


# ─────────────────────────────────────────────────
# Section D: Phase Runners
# ─────────────────────────────────────────────────


def make_options(
    max_turns: int, max_budget: float, autonomous: bool,
    phase: PhaseConfig | None = None,
) -> ClaudeAgentOptions:
    """Build ClaudeAgentOptions with agent registration and scoped permissions.

    When phase is provided, applies per-phase model, effort, session chaining,
    and tool overrides. When phase is None, preserves original behavior.
    """
    pc = phase or PhaseConfig()

    agents: dict[str, AgentDefinition] = {}
    if pc.needs_agents:
        # Register code-review agents if configs exist
        cr_path = AGENTS_DIR / "code-review.md"
        crt_path = AGENTS_DIR / "code-review-testing.md"

        if cr_path.exists():
            agents["code-review"] = AgentDefinition(
                description="Adversarial code reviewer. Find 3-10 real issues per review.",
                prompt=cr_path.read_text(),
                model="opus",
            )
        if crt_path.exists():
            agents["code-review-testing"] = AgentDefinition(
                description="Test coverage specialist. Verify every AC has a test.",
                prompt=crt_path.read_text(),
                model="sonnet",
            )

        dr_path = AGENTS_DIR / "design-review.md"
        if dr_path.exists():
            agents["design-review"] = AgentDefinition(
                description="Elite UI/UX design reviewer using Playwright MCP to test the live app at multiple viewports.",
                prompt=dr_path.read_text(),
                model="sonnet",
            )

    # Core tools needed for story development
    allowed = [
        "Read", "Write", "Edit",          # File operations
        "Glob", "Grep",                   # Search
        "Bash",                           # Git, npm, build commands
        "Agent",                          # Spawn review agents
        "TodoWrite",                      # Track implementation progress
        "ToolSearch",                     # Discover MCP tools
    ]

    # Headless Playwright MCP for design review (no browser window pops up)
    mcp_servers: dict[str, McpStdioServerConfig] = {}
    if pc.needs_playwright:
        mcp_servers["playwright"] = McpStdioServerConfig(
            command="npx",
            args=["@playwright/mcp@latest", "--headless"],
        )

    opts: dict[str, Any] = dict(
        setting_sources=["user", "project", "local"],
        agents=agents if agents else None,
        allowed_tools=allowed,
        disallowed_tools=["EnterWorktree"],
        permission_mode="bypassPermissions" if autonomous else "acceptEdits",
        system_prompt={"type": "preset", "preset": "claude_code"},
        max_turns=max_turns,
        cwd=str(PROJECT_DIR),
        mcp_servers=mcp_servers if mcp_servers else None,
        max_buffer_size=10 * 1024 * 1024,  # 10MB buffer (Epic 9B AI features exceed 1MB default)
    )

    # Apply per-phase overrides
    if pc.model:
        opts["model"] = pc.model
    if pc.effort:
        opts["effort"] = pc.effort
    if pc.fallback_model:
        opts["fallback_model"] = pc.fallback_model
    if pc.resume_session_id:
        opts["resume"] = pc.resume_session_id
        opts["fork_session"] = pc.fork_session
    if pc.append_context and pc.append_context.strip():
        opts["system_prompt"] = {
            "type": "preset", "preset": "claude_code",
            "append": pc.append_context,
        }

    if max_budget > 0:
        opts["max_budget_usd"] = max_budget

    # Log buffer size for visibility (helpful for debugging overflow issues)
    buffer_mb = opts["max_buffer_size"] / (1024 * 1024)
    log.debug(f"ClaudeAgentOptions configured with {buffer_mb:.0f}MB message buffer")

    return ClaudeAgentOptions(**opts)


def format_prompt(template: str, story: StoryInfo) -> str:
    """Fill prompt template with story details. Sanitizes story name to prevent injection."""
    epic_n, epic_suffix = parse_epic_num(story.epic_num)
    story_n = int(story.story_num)
    branch_slug = f"e{epic_n:02d}{epic_suffix}-s{story_n:02d}-{'-'.join(story.name.lower().split())}"
    story_id_lower = f"e{epic_n:02d}{epic_suffix}-s{story_n:02d}"
    today = date.today().isoformat()

    return template.format(
        story_id=story.key,
        story_name=html.escape(story.name),  # Prevent prompt injection
        yaml_key=story.yaml_key,
        branch_slug=branch_slug,
        story_id_lower=story_id_lower,
        today=today,
    )


PROGRESS_FILE = PROJECT_DIR / "scripts" / "auto-story-progress.log"


def write_progress(story_key: str, phase: str, detail: str = "") -> None:
    """Write a timestamped progress line to the live progress file."""
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] [{story_key}] {phase}"
    if detail:
        line += f" — {detail}"
    log.info(line)
    with open(PROGRESS_FILE, "a") as f:
        f.write(line + "\n")


def _checkout_main_and_pull(force: bool = False) -> None:
    """Switch to main and pull latest. Logs warnings on failure instead of crashing."""
    checkout_cmd = ["git", "checkout"]
    if force:
        checkout_cmd.append("-f")
    checkout_cmd.append("main")

    checkout = subprocess.run(
        checkout_cmd, capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if checkout.returncode != 0:
        log.warning(f"git checkout main failed: {checkout.stderr.strip()}")
        return  # Don't attempt pull if checkout failed

    pull = subprocess.run(
        ["git", "pull", "--ff-only"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if pull.returncode != 0:
        log.warning(f"git pull --ff-only failed, trying rebase: {pull.stderr.strip()}")
        rebase_pull = subprocess.run(
            ["git", "pull", "--rebase"],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if rebase_pull.returncode != 0:
            log.warning(f"git pull --rebase also failed: {rebase_pull.stderr.strip()}")


def merge_epic_prs(
    epic_num: str,
    stories: list[StoryInfo] | None = None,
    results: list[StoryResult] | None = None,
    supervised: bool = True,
) -> list[str]:
    """Merge all open PRs for an epic. Returns list of merged PR URLs.

    In normal mode, uses batch stories/results to find PRs.
    In --epic-only mode (stories=None), discovers PRs by branch prefix.
    Checks each PR state before merge (handles already-merged/closed).
    """
    pr_infos: list[dict[str, Any]] = []

    if stories and results:
        # Normal mode: find PRs from batch results
        for story, result in zip(stories, results):
            if story.epic_num != epic_num or not result.success:
                continue
            if result.pr_url:
                pr_number = result.pr_url.split("/")[-1]
                pr_infos.append({"number": pr_number, "url": result.pr_url, "story": story.key})
    else:
        # --epic-only mode: discover PRs by branch prefix
        epic_n, epic_suffix = parse_epic_num(epic_num)
        branch_prefix = f"feature/e{epic_n:02d}{epic_suffix}-"
        result = subprocess.run(
            ["gh", "pr", "list", "--head", branch_prefix, "--json", "number,url,headRefName",
             "--state", "open", "--limit", "50"],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if result.returncode == 0 and result.stdout.strip():
            for pr in json.loads(result.stdout):
                pr_infos.append({
                    "number": str(pr["number"]),
                    "url": pr["url"],
                    "story": pr.get("headRefName", "?"),
                })

    if not pr_infos:
        log.info(f"  No PRs found to merge for Epic {epic_num}")
        return []

    # Supervised: confirm before merging
    if supervised:
        print(f"\n  PRs to merge for Epic {epic_num}:")
        for pr in pr_infos:
            print(f"    #{pr['number']} — {pr['story']} ({pr['url']})")
        approval = input(f"\n  Merge {len(pr_infos)} PR(s)? [y/n]: ").strip().lower()
        if approval != "y":
            log.info("  Skipping PR merge per user request")
            return []

    merged: list[str] = []
    for pr in pr_infos:
        pr_num = pr["number"]

        # Check PR state before merge (review fix #2)
        state_check = subprocess.run(
            ["gh", "pr", "view", pr_num, "--json", "state"],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if state_check.returncode != 0:
            log.warning(f"  PR #{pr_num}: cannot check state, skipping ({state_check.stderr.strip()})")
            continue

        state = json.loads(state_check.stdout).get("state", "UNKNOWN")
        if state == "MERGED":
            log.info(f"  PR #{pr_num}: already merged, skipping")
            merged.append(pr["url"])
            continue
        if state != "OPEN":
            log.warning(f"  PR #{pr_num}: state is {state}, skipping")
            continue

        # Merge
        merge_result = subprocess.run(
            ["gh", "pr", "merge", pr_num, "--squash", "--delete-branch"],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if merge_result.returncode == 0:
            log.info(f"  PR #{pr_num}: merged successfully")
            merged.append(pr["url"])
        else:
            log.error(f"  PR #{pr_num}: merge failed — {merge_result.stderr.strip()}")

    # Pull merged changes to main
    if merged:
        _checkout_main_and_pull()

    return merged


def merge_epic_prs(
    epic_num: str,
    stories: list[StoryInfo] | None = None,
    results: list[StoryResult] | None = None,
    supervised: bool = True,
) -> list[str]:
    """Merge all open PRs for an epic. Returns list of merged PR URLs.

    In normal mode, uses batch stories/results to find PRs.
    In --epic-only mode (stories=None), discovers PRs by branch prefix.
    Checks each PR state before merge (handles already-merged/closed).
    """
    pr_infos: list[dict[str, Any]] = []

    if stories and results:
        # Normal mode: find PRs from batch results
        for story, result in zip(stories, results):
            if story.epic_num != epic_num or not result.success:
                continue
            if result.pr_url:
                pr_number = result.pr_url.split("/")[-1]
                pr_infos.append({"number": pr_number, "url": result.pr_url, "story": story.key})
    else:
        # --epic-only mode: discover PRs by branch prefix
        epic_n, epic_suffix = parse_epic_num(epic_num)
        branch_prefix = f"feature/e{epic_n:02d}{epic_suffix}-"
        result = subprocess.run(
            ["gh", "pr", "list", "--head", branch_prefix, "--json", "number,url,headRefName",
             "--state", "open", "--limit", "50"],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if result.returncode == 0 and result.stdout.strip():
            for pr in json.loads(result.stdout):
                pr_infos.append({
                    "number": str(pr["number"]),
                    "url": pr["url"],
                    "story": pr.get("headRefName", "?"),
                })

    if not pr_infos:
        log.info(f"  No PRs found to merge for Epic {epic_num}")
        return []

    # Supervised: confirm before merging
    if supervised:
        print(f"\n  PRs to merge for Epic {epic_num}:")
        for pr in pr_infos:
            print(f"    #{pr['number']} — {pr['story']} ({pr['url']})")
        approval = input(f"\n  Merge {len(pr_infos)} PR(s)? [y/n]: ").strip().lower()
        if approval != "y":
            log.info("  Skipping PR merge per user request")
            return []

    merged: list[str] = []
    for pr in pr_infos:
        pr_num = pr["number"]

        # Check PR state before merge (review fix #2)
        state_check = subprocess.run(
            ["gh", "pr", "view", pr_num, "--json", "state"],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if state_check.returncode != 0:
            log.warning(f"  PR #{pr_num}: cannot check state, skipping ({state_check.stderr.strip()})")
            continue

        state = json.loads(state_check.stdout).get("state", "UNKNOWN")
        if state == "MERGED":
            log.info(f"  PR #{pr_num}: already merged, skipping")
            merged.append(pr["url"])
            continue
        if state != "OPEN":
            log.warning(f"  PR #{pr_num}: state is {state}, skipping")
            continue

        # Merge
        merge_result = subprocess.run(
            ["gh", "pr", "merge", pr_num, "--squash", "--delete-branch"],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if merge_result.returncode == 0:
            log.info(f"  PR #{pr_num}: merged successfully")
            merged.append(pr["url"])
        else:
            log.error(f"  PR #{pr_num}: merge failed — {merge_result.stderr.strip()}")

    # Pull merged changes to main
    if merged:
        _checkout_main_and_pull()

    return merged


async def collect_response(
    client: ClaudeSDKClient, story_key: str = "", stream: bool = True
) -> tuple[str, str | None, float]:
    """Collect all text from a response. Returns (full_text, session_id, cost).

    When stream=True, prints Claude's text to stdout in real-time and logs
    key markers (PLAN_COMPLETE, VERDICT, etc.) to the progress file.
    """
    parts: list[str] = []
    session_id = None
    cost = 0.0
    char_count = 0

    async for msg in client.receive_response():
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    parts.append(block.text)
                    char_count += len(block.text)
                    if stream:
                        # Print a dot periodically to show progress
                        if char_count % PROGRESS_DOT_INTERVAL_CHARS < len(block.text):
                            print(".", end="", flush=True)
                    # Detect key markers in streaming text
                    for marker in [
                        "PLAN_COMPLETE", "IMPLEMENTATION_COMPLETE",
                        "VERDICT: PASS", "VERDICT: BLOCKED",
                        "FIXES_APPLIED", "PR_URL:",
                    ]:
                        if marker in block.text:
                            write_progress(story_key, f"MARKER: {marker}")
        elif isinstance(msg, ResultMessage):
            session_id = msg.session_id
            cost = msg.total_cost_usd or 0.0
            write_progress(
                story_key,
                "SESSION_DONE",
                f"cost=${cost:.2f}, turns={getattr(msg, 'num_turns', '?')}",
            )
            if msg.result:
                parts.append(msg.result)
            if msg.is_error:
                write_progress(story_key, "SESSION_ERROR", msg.result or "unknown")
                raise StoryError(f"Session error: {msg.result or 'unknown'}")

    if stream:
        print()  # newline after dots
    return "\n".join(parts), session_id, cost


async def run_session(
    prompt: str, max_turns: int, max_budget: float, autonomous: bool,
    story_key: str = "", phase: PhaseConfig | None = None,
) -> tuple[str, str | None, float]:
    """Run a single SDK session and return (text, session_id, cost)."""
    options = make_options(max_turns, max_budget, autonomous, phase=phase)
    async with ClaudeSDKClient(options=options) as client:
        await client.query(prompt)
        return await collect_response(client, story_key=story_key)


async def run_review_fix_session(
    story: StoryInfo, config: RunConfig
) -> tuple[ReviewResult, str, float]:
    """Run review + fix loop in a single session. Returns (review_result, text, cost)."""
    autonomous = config.mode == "autonomous"
    review_phase = None if config.legacy_mode else PhaseConfig(
        model="sonnet", effort="medium", fallback_model="opus",
        needs_agents=True, needs_playwright=True,
        append_context=f"Story: {story.key}. Running quality gates.",
    )
    options = make_options(config.max_turns, BUDGET_SESSION_REVIEW, autonomous, phase=review_phase)
    result = ReviewResult()
    total_cost = 0.0
    all_text = ""

    async with ClaudeSDKClient(options=options) as client:
        # Initial review
        write_progress(story.key, "REVIEW", "running quality gates...")
        review_prompt = format_prompt(REVIEW_PROMPT, story)
        await client.query(review_prompt)
        text, _, cost = await collect_response(client, story_key=story.key)
        total_cost += cost
        all_text = text

        # ── Review + Fix loop ──
        # Strategy: fix ALL findings (blocker/high/medium/nit) in each fix round,
        # but only BLOCKERS trigger the re-review loop. Non-blocker-only findings
        # get one fix pass then proceed to FINISH.

        verdict = parse_verdict(text)

        # If zero blockers but non-blocker findings exist, do one fix pass
        if verdict.is_pass and (verdict.high_count > 0):
            total_findings = verdict.high_count
            write_progress(story.key, "REVIEW",
                f"PASSED (0 blockers), {total_findings} non-blocker finding(s) — fixing in one pass")
            result.rounds = 1

            # Supervised: ask before fixing
            if config.mode == "supervised":
                print(f"\n{'=' * 60}")
                print(f"NON-BLOCKER FINDINGS: {verdict.high_count} HIGH")
                print(f"{'=' * 60}")
                print(verdict.findings_text[:2000])
                print()
                action = input("Fix non-blockers? [y/n]: ").strip().lower()
                if action != "y":
                    log.info("Skipping non-blocker fixes per user request")
                else:
                    fix_prompt = format_prompt(FIX_PROMPT, story)
                    await client.query(fix_prompt)
                    fix_text, _, fix_cost = await collect_response(client, story_key=story.key)
                    total_cost += fix_cost
            else:
                write_progress(story.key, "FIX", "fixing non-blocker findings...")
                fix_prompt = format_prompt(FIX_PROMPT, story)
                await client.query(fix_prompt)
                fix_text, _, fix_cost = await collect_response(client, story_key=story.key)
                total_cost += fix_cost

        elif verdict.is_pass:
            write_progress(story.key, "REVIEW", "PASSED — no findings")
            result.rounds = 1

        else:
            # Blockers exist — enter fix + re-review loop
            for round_num in range(1, config.max_review_rounds + 1):
                result.rounds = round_num

                if verdict.is_pass:
                    write_progress(story.key, "REVIEW", f"PASSED on round {round_num}")
                    break

                result.blockers_found += verdict.blocker_count
                write_progress(
                    story.key, "REVIEW",
                    f"round {round_num}: {verdict.blocker_count} blocker(s), "
                    f"{verdict.high_count} high(s)",
                )

                # Supervised: ask before fixing
                if config.mode == "supervised":
                    print(f"\n{'=' * 60}")
                    print(f"REVIEW ROUND {round_num}: "
                          f"{verdict.blocker_count} BLOCKER(S), "
                          f"{verdict.high_count} HIGH")
                    print(f"{'=' * 60}")
                    print(verdict.findings_text[:2000])
                    print()
                    action = input("Fix automatically? [y/n/skip]: ").strip().lower()
                    if action == "n":
                        raise StoryError("User declined to fix blockers")
                    if action == "skip":
                        log.warning("Skipping blockers per user request")
                        break

                # Fix ALL findings (blockers + highs + mediums + nits)
                write_progress(story.key, "FIX", f"round {round_num}: fixing all findings...")
                fix_prompt = format_prompt(FIX_PROMPT, story)
                await client.query(fix_prompt)
                fix_text, _, fix_cost = await collect_response(client, story_key=story.key)
                total_cost += fix_cost
                result.blockers_fixed += verdict.blocker_count  # optimistic

                if round_num >= config.max_review_rounds:
                    raise StoryError(
                        f"Still blocked after {config.max_review_rounds} fix rounds"
                    )

                # Re-review (only verifies blockers are resolved)
                write_progress(story.key, "RE-REVIEW", f"round {round_num + 1}...")
                re_review_prompt = format_prompt(RE_REVIEW_PROMPT, story)
                await client.query(re_review_prompt)
                text, _, rr_cost = await collect_response(client, story_key=story.key)
                total_cost += rr_cost
                all_text = text
                verdict = parse_verdict(text)

        # Finish (same session if review passed)
        write_progress(story.key, "FINISH", "updating story, pushing, creating PR...")
        finish_prompt = format_prompt(FINISH_PROMPT, story)
        await client.query(finish_prompt)
        finish_text, _, finish_cost = await collect_response(
            client, story_key=story.key
        )
        total_cost += finish_cost
        all_text += "\n" + finish_text

        # Verify FINISH completed its tasks
        missing = verify_finish(story)
        if missing:
            write_progress(
                story.key, "FINISH_RETRY",
                f"missing: {', '.join(missing)}",
            )
            retry_prompt = FINISH_RETRY_PROMPT.format(
                story_id=story.key,
                missing_items="\n".join(f"- {m}" for m in missing),
            )
            await client.query(retry_prompt)
            retry_text, _, retry_cost = await collect_response(
                client, story_key=story.key
            )
            total_cost += retry_cost
            all_text += "\n" + retry_text

            # Check again
            still_missing = verify_finish(story)
            if still_missing:
                raise StoryError(
                    f"FINISH incomplete after retry: {', '.join(still_missing)}"
                )

    # Return to main for next story (runs after verify_finish on feature branch)
    _checkout_main_and_pull()

    return result, all_text, total_cost


async def _run_single_epic_phase(
    phase_name: str, template: str, marker: str,
    epic_num: str, story_count: int,
    config: RunConfig,
) -> tuple[str, bool, float]:
    """Run one epic-finish phase in its own SDK session.

    Returns (phase_name, succeeded, cost).
    """
    epic_key = f"EPIC-{epic_num}"
    autonomous = config.mode == "autonomous"
    write_progress(epic_key, f"EPIC_FINISH: {phase_name}", "starting...")

    prompt = format_epic_prompt(template, epic_num, story_count)

    try:
        text, _sid, cost = await run_session(
            prompt, config.max_turns, BUDGET_SESSION_EPIC_FINISH, autonomous,
            story_key=epic_key,
        )
    except StoryError as e:
        log.error(f"  [{epic_key}] {phase_name} session error: {e}")
        write_progress(epic_key, f"EPIC_FINISH: {phase_name}", f"FAILED: {e}")
        return phase_name, False, 0.0

    if marker in text:
        write_progress(epic_key, f"EPIC_FINISH: {phase_name}", "DONE")
        return phase_name, True, cost
    else:
        write_progress(epic_key, f"EPIC_FINISH: {phase_name}",
                       f"WARNING: {marker} not found in output")
        return phase_name, False, cost


async def run_epic_finish(
    epic_num: str, config: RunConfig, story_count: int = 0,
) -> EpicFinishResult:
    """Run end-of-epic workflow: each phase in its own session.

    Execution order:
      1. sprint-status (sequential — must mark epic done first)
      2. testarch-trace + testarch-nfr + adversarial (parallel — independent analyses)
      3. retrospective (sequential — needs all review reports as input)
    """
    start_time = time.monotonic()
    result = EpicFinishResult(epic_num=epic_num)
    epic_key = f"EPIC-{epic_num}"

    # Build phase list (filter by --skip-adversarial and --phase)
    phases = [
        p for p in EPIC_FINISH_PHASES
        if not (p[0] == "adversarial" and config.skip_adversarial)
    ]
    if config.epic_phases:
        phases = [p for p in phases if p[0] in config.epic_phases]

    if not phases:
        log.warning(f"[{epic_key}] No phases to run (all filtered out)")
        result.success = True
        return result

    # Ensure we're on main for epic-level analysis
    _checkout_main_and_pull()

    # Partition phases into: before-parallel, parallel, after-parallel
    PARALLEL_PHASES = {"testarch-trace", "testarch-nfr", "adversarial"}
    before: list[tuple[str, str, str]] = []
    parallel: list[tuple[str, str, str]] = []
    after: list[tuple[str, str, str]] = []
    for p in phases:
        if p[0] == "sprint-status":
            before.append(p)
        elif p[0] in PARALLEL_PHASES:
            parallel.append(p)
        else:  # retrospective
            after.append(p)

    async def _run_phase(phase: tuple[str, str, str]) -> tuple[str, bool, float]:
        return await _run_single_epic_phase(
            phase[0], phase[1], phase[2],
            epic_num, story_count, config,
        )

    def _collect(phase_results: list[tuple[str, bool, float]]) -> None:
        for name, succeeded, cost in phase_results:
            result.total_cost_usd += cost
            if succeeded:
                result.phases_completed.append(name)
            else:
                result.phases_failed.append(name)

    try:
        # 1. Sequential: sprint-status (must run first)
        for phase in before:
            phase_result = await _run_phase(phase)
            _collect([phase_result])

        # 2. Parallel: testarch-trace + testarch-nfr + adversarial
        if parallel:
            log.info(f"  [{epic_key}] Running {len(parallel)} phases in parallel: "
                     f"{', '.join(p[0] for p in parallel)}")
            parallel_results = await asyncio.gather(
                *[_run_phase(p) for p in parallel],
                return_exceptions=False,
            )
            _collect(list(parallel_results))

        # 3. Sequential: retrospective (needs all reports as input)
        for phase in after:
            phase_result = await _run_phase(phase)
            _collect([phase_result])

        result.success = len(result.phases_failed) == 0

    except Exception as e:
        result.error = f"{type(e).__name__}: {e}"
        log.error(f"[{epic_key}] Epic finish failed: {e}")

    result.duration_secs = time.monotonic() - start_time
    return result


# ─────────────────────────────────────────────────
# Section E: Orchestration
# ─────────────────────────────────────────────────


async def run_story(story: StoryInfo, config: RunConfig) -> StoryResult:
    """Full lifecycle for one story across 3 sessions."""
    start_time = time.monotonic()
    result = StoryResult(story=story)
    autonomous = config.mode == "autonomous"

    try:
        # ── Phase configs (disabled in legacy mode) ──
        if config.legacy_mode:
            start_phase = None
            impl_phase = None
        else:
            start_phase = PhaseConfig(
                model="opus", effort="high", fallback_model="sonnet",
                needs_agents=False, needs_playwright=False,
                append_context=f"Story: {story.key} ({story.name}). Planning phase only.",
            )

        # ── Session 1: START ──
        write_progress(story.key, "SESSION 1: START", "branch, story file, plan...")
        start_prompt = format_prompt(START_PROMPT, story)
        text, sid, cost = await run_session(
            start_prompt, config.max_turns, BUDGET_SESSION_START, autonomous,
            story_key=story.key, phase=start_phase if not config.legacy_mode else None,
        )
        result.cost_start = cost
        result.total_cost_usd += cost
        if sid:
            result.session_ids.append(sid)
        start_session_id = sid  # save for session chaining
        result.phase_reached = "start"

        if "PLAN_COMPLETE" not in text:
            log.warning(f"  START did not output PLAN_COMPLETE marker")

        # Supervised: show plan and ask for approval
        if config.mode == "supervised":
            print(f"\n{'=' * 60}")
            print(f"PLAN FOR {story.key}")
            print(f"{'=' * 60}")
            # Show end of output (the plan is usually at the end)
            print(text[-PLAN_PREVIEW_CHARS:])
            approval = input("\nApprove plan? [y/n]: ").strip().lower()
            if approval != "y":
                raise StoryError("Plan rejected by user")

        # ── Session 2: IMPLEMENT (with session chaining fallback) ──
        write_progress(story.key, "SESSION 2: IMPLEMENT", "coding feature...")
        impl_prompt = format_prompt(IMPLEMENT_PROMPT, story)

        if not config.legacy_mode:
            impl_phase = PhaseConfig(
                model="sonnet", effort="high", fallback_model="opus",
                resume_session_id=start_session_id,
                fork_session=True,
                needs_agents=False, needs_playwright=False,
                append_context=f"Story: {story.key}. Implement the plan from the previous session.",
            )
            try:
                text, sid, cost = await run_session(
                    impl_prompt, config.max_turns, BUDGET_SESSION_IMPLEMENT, autonomous,
                    story_key=story.key, phase=impl_phase,
                )
            except Exception as e:
                log.warning(f"  Session chaining failed ({e}), falling back to cold start")
                impl_phase.resume_session_id = None
                impl_phase.fork_session = False
                text, sid, cost = await run_session(
                    impl_prompt, config.max_turns, BUDGET_SESSION_IMPLEMENT, autonomous,
                    story_key=story.key, phase=impl_phase,
                )
        else:
            text, sid, cost = await run_session(
                impl_prompt, config.max_turns, BUDGET_SESSION_IMPLEMENT, autonomous,
                story_key=story.key,
            )

        result.cost_implement = cost
        result.total_cost_usd += cost
        if sid:
            result.session_ids.append(sid)
        result.phase_reached = "implement"

        # ── Session 3: REVIEW + FIX + FINISH ──
        write_progress(story.key, "SESSION 3: REVIEW+FIX+FINISH", "quality gates...")
        review_result, text, cost = await run_review_fix_session(story, config)
        result.cost_review = cost
        result.total_cost_usd += cost
        result.review_rounds = review_result.rounds
        result.blockers_found = review_result.blockers_found
        result.blockers_fixed = review_result.blockers_fixed
        result.phase_reached = "finish"

        # Extract and verify PR URL
        result.pr_url = extract_pr_url(text, story)
        if not result.pr_url:
            raise StoryError("FINISH phase did not create a PR (no URL found)")

        # Verify PR actually exists
        pr_number = result.pr_url.split('/')[-1]
        verify_pr = subprocess.run(
            ["gh", "pr", "view", pr_number],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if verify_pr.returncode != 0:
            raise StoryError(f"PR {pr_number} does not exist: {verify_pr.stderr}")

        write_progress(story.key, "PR_VERIFIED", f"PR #{pr_number} created successfully")
        result.success = True

    except StoryError as e:
        result.error = str(e)
        log.error(f"[{story.key}] Failed at {result.phase_reached}: {e}")
    except Exception as e:
        result.error = f"{type(e).__name__}: {e}"
        log.error(f"[{story.key}] Unexpected error at {result.phase_reached}: {e}")
    finally:
        # Always return to main for next story, even on failure.
        # Uses -f to handle dirty trees left by LLM (last line of defense).
        _checkout_main_and_pull(force=True)

    result.duration_secs = time.monotonic() - start_time
    return result


async def _run_epic_only(config: RunConfig) -> None:
    """Standalone epic finish: merge PRs + run phases for a single epic."""
    epic_num = config.epic_only
    assert epic_num is not None

    # Count stories for this epic from sprint-status.yaml
    data = load_sprint_status()
    dev_status = data.get("development_status", {})
    prefix = f"{epic_num}-"
    story_count = sum(
        1 for k in dev_status
        if k.startswith(prefix) and not k.endswith("-retrospective")
    )

    if config.dry_run:
        print(f"\nDRY RUN — Epic-only finish for Epic {epic_num}")
        print(f"  Stories in epic: {story_count}")
        phases = [p[0] for p in EPIC_FINISH_PHASES
                  if not (p[0] == "adversarial" and config.skip_adversarial)]
        if config.epic_phases:
            phases = [p for p in phases if p in config.epic_phases]
        print(f"  Phases: {', '.join(phases)}")
        # Show execution strategy
        parallel = [p for p in phases if p in {"testarch-trace", "testarch-nfr", "adversarial"}]
        if parallel and len(parallel) > 1:
            print(f"  Parallel: {', '.join(parallel)}")
        print(f"  Will discover and merge open PRs with branch prefix feature/e{epic_num}-")
        print(f"  Mode: {config.mode}")
        return

    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, "w") as f:
        f.write(f"=== epic-only run: {datetime.now().isoformat()} ===\n")
        f.write(f"Epic: {epic_num}\n")
        f.write(f"Mode: {config.mode}\n\n")

    # Start dev server (some phases may benefit from live app)
    log.info("Starting dev server (npm run dev)...")
    dev_server_log = PROJECT_DIR / "scripts" / "dev-server.log"
    dev_server_log_file = open(dev_server_log, "w")
    dev_server = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=PROJECT_DIR,
        stdout=dev_server_log_file,
        stderr=subprocess.STDOUT,
    )

    try:
        log.info("Waiting for dev server to be ready...")
        wait_result = subprocess.run(
            ["./scripts/wait-for-server.sh", "http://localhost:5173", "30"],
            cwd=PROJECT_DIR, capture_output=True, text=True,
        )
        if wait_result.returncode != 0:
            log.error(f"Dev server failed to start: {wait_result.stderr}")
            dev_server.terminate()
            dev_server.wait(timeout=5)
            sys.exit(1)
        log.info("Dev server ready")

        # Merge PRs (discover by branch prefix)
        merged = merge_epic_prs(
            epic_num, supervised=(config.mode == "supervised"),
        )

        # Run epic finish
        ef_result = await run_epic_finish(epic_num, config, story_count)
        ef_result.merged_prs = merged
        log_epic_result(ef_result, config.log_file)

        # Summary
        print(f"\n{'=' * 60}")
        print(f"EPIC {epic_num} FINISH {'COMPLETE' if ef_result.success else 'PARTIAL'}")
        print(f"{'=' * 60}")
        if ef_result.phases_completed:
            print(f"  Passed: {', '.join(ef_result.phases_completed)}")
        if ef_result.phases_failed:
            print(f"  Failed: {', '.join(ef_result.phases_failed)}")
        if merged:
            print(f"  Merged PRs: {len(merged)}")
        print(f"  Cost: ${ef_result.total_cost_usd:.2f}")
        print(f"  Time: {ef_result.duration_secs / 60:.1f} min")
        print(f"  Log: {config.log_file}")

    finally:
        log.info("Stopping dev server...")
        dev_server.terminate()
        try:
            dev_server.wait(timeout=SERVER_SHUTDOWN_TIMEOUT_SECS)
        except subprocess.TimeoutExpired:
            dev_server.kill()
            dev_server.wait()
        dev_server_log_file.close()


async def main() -> None:
    config = parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    # ── Epic-only mode: skip story processing entirely ──
    if config.epic_only:
        await _run_epic_only(config)
        return

    # Resolve stories
    stories: list[StoryInfo] = []
    for sid in config.stories:
        try:
            stories.append(find_story(sid))
        except ValueError as e:
            log.error(str(e))
            sys.exit(1)

    if not stories:
        log.error("No stories found to process")
        sys.exit(1)

    # Resume: skip already completed stories
    completed_keys: set[str] = set()
    if config.resume and config.log_file.exists():
        with open(config.log_file) as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    if entry.get("success"):
                        completed_keys.add(entry["story"])
                except (json.JSONDecodeError, KeyError):
                    continue

        if completed_keys:
            original_count = len(stories)
            stories = [s for s in stories if s.key not in completed_keys]
            skipped = original_count - len(stories)
            if skipped > 0:
                log.info(f"Resume mode: skipping {skipped} completed story(ies)")
                log.info(f"Completed: {', '.join(sorted(completed_keys))}")

        if not stories:
            log.info("All stories already completed!")
            return

    # Preflight: ensure script exists on main (prevents "file not found" after checkout)
    check = subprocess.run(
        ["git", "show", "main:scripts/auto-story.py"],
        capture_output=True, cwd=PROJECT_DIR,
    )
    if check.returncode != 0:
        log.error("scripts/auto-story.py not found on main branch!")
        log.error("Run: git checkout main && git add scripts/auto-story.py && git commit")
        sys.exit(1)

    # Dry run
    if config.dry_run:
        print(f"\nDRY RUN — {len(stories)} story(ies):\n")
        for s in stories:
            print(f"  {s.key}: {s.name} (status: {s.status})")
        est_cost = len(stories) * BUDGET_PER_STORY
        print(f"\nEstimated max cost: ${est_cost:.2f} "
              f"({len(stories)} stories x ${BUDGET_PER_STORY:.2f})")
        print(f"Mode: {config.mode}")
        print(f"Max review rounds: {config.max_review_rounds}")
        print(f"Max turns per session: {config.max_turns}")

        # Preview which epics would complete (simulate all stories succeeding)
        if not config.skip_epic_finish:
            fake_results = [StoryResult(story=s, success=True) for s in stories]
            would_complete = detect_completed_epics(stories, fake_results, completed_keys)
            if would_complete:
                phases = [p[0] for p in EPIC_FINISH_PHASES
                          if not (p[0] == "adversarial" and config.skip_adversarial)]
                print(f"\nEpic finish (if all stories pass):")
                for e in would_complete:
                    print(f"  Epic {e} would complete -> phases: {', '.join(phases)}")
        return

    # Clear progress file for this run
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, "w") as f:
        f.write(f"=== auto-story run: {datetime.now().isoformat()} ===\n")
        f.write(f"Stories: {[s.key for s in stories]}\n")
        f.write(f"Mode: {config.mode}\n\n")

    # Start dev server for design review
    log.info("Starting dev server (npm run dev)...")
    dev_server_log = PROJECT_DIR / "scripts" / "dev-server.log"
    dev_server_log_file = open(dev_server_log, "w")
    dev_server = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=PROJECT_DIR,
        stdout=dev_server_log_file,
        stderr=subprocess.STDOUT,
    )

    try:
        # Wait for server to be ready (use existing wait script)
        log.info("Waiting for dev server to be ready...")
        wait_result = subprocess.run(
            ["./scripts/wait-for-server.sh", "http://localhost:5173", "30"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
        )
        if wait_result.returncode != 0:
            log.error(f"Dev server failed to start: {wait_result.stderr}")
            log.error(f"Check {dev_server_log} for details")
            dev_server.terminate()
            dev_server.wait(timeout=5)
            sys.exit(1)
        log.info("Dev server ready at http://localhost:5173")

        results: list[StoryResult] = []
        for i, story in enumerate(stories):
            log.info(f"\n{'=' * 60}")
            log.info(f"[{i + 1}/{len(stories)}] {story.key} — {story.name}")
            log.info(f"{'=' * 60}")

            result = await run_story(story, config)
            results.append(result)

            log_result(result, config.log_file)
            print_progress(results, len(stories))

            if not result.success:
                log.warning(f"[{story.key}] Failed. Moving to next story.\n")

        # Final summary
        print(f"\n{'=' * 60}")
        print("BATCH COMPLETE")
        print(f"{'=' * 60}")
        print_progress(results, len(stories))

        total_cost = sum(r.total_cost_usd for r in results)
        total_time = sum(r.duration_secs for r in results)
        print(f"\nTotal cost: ${total_cost:.2f}")
        print(f"Total time: {total_time / 60:.1f} min")
        print(f"Log file: {config.log_file}")

        # ── End-of-Epic Processing ──
        if not config.skip_epic_finish:
            completed_epics = detect_completed_epics(stories, results, completed_keys)

            if completed_epics:
                print(f"\n{'=' * 60}")
                print(f"EPIC FINISH — {len(completed_epics)} epic(s) newly completed: "
                      f"{', '.join(f'E{e}' for e in completed_epics)}")
                print(f"{'=' * 60}")

                # Supervised: confirm before starting
                if config.mode == "supervised":
                    action = input(
                        f"\nRun epic finish for "
                        f"{', '.join(f'E{e}' for e in completed_epics)}? [y/n]: "
                    ).strip().lower()
                    if action != "y":
                        log.info("Skipping epic finish per user request")
                        completed_epics = []

                for epic_num in completed_epics:
                    story_count = sum(
                        1 for s, r in zip(stories, results)
                        if s.epic_num == epic_num and r.success
                    )
                    log.info(f"\n--- Epic {epic_num} finish ({story_count} stories) ---")

                    # Merge PRs first
                    merged = merge_epic_prs(
                        epic_num, stories, results,
                        supervised=(config.mode == "supervised"),
                    )

                    # Run epic finish phases
                    ef_result = await run_epic_finish(epic_num, config, story_count)
                    ef_result.merged_prs = merged
                    log_epic_result(ef_result, config.log_file)

                    status = "PASS" if ef_result.success else "PARTIAL"
                    phases_done = ", ".join(ef_result.phases_completed) or "none"
                    print(f"  Epic {epic_num}: {status} ({phases_done}) "
                          f"${ef_result.total_cost_usd:.2f} {ef_result.duration_secs:.0f}s")
                    if ef_result.phases_failed:
                        print(f"    Failed: {', '.join(ef_result.phases_failed)}")

                    total_cost += ef_result.total_cost_usd
                    total_time += ef_result.duration_secs

                if completed_epics:
                    print(f"\nGrand total: ${total_cost:.2f} | {total_time / 60:.1f} min")

    finally:
        log.info("Stopping dev server...")
        dev_server.terminate()
        try:
            dev_server.wait(timeout=SERVER_SHUTDOWN_TIMEOUT_SECS)
        except subprocess.TimeoutExpired:
            log.warning("Dev server didn't stop cleanly, killing...")
            dev_server.kill()
            dev_server.wait()
        dev_server_log_file.close()


# ─────────────────────────────────────────────────
# Section F: Helpers
# ─────────────────────────────────────────────────


def parse_verdict(text: str) -> Verdict:
    """Extract VERDICT and severity counts from review output."""
    is_pass = False
    # Accept colon, dash, or whitespace between VERDICT and status
    m = re.search(r"VERDICT[:\s\-]*(PASS|BLOCKED)", text, re.IGNORECASE)
    if m:
        is_pass = m.group(1).upper() == "PASS"

    blocker_count = len(re.findall(r"\[Blocker\]", text, re.IGNORECASE))
    high_count = len(re.findall(r"\[High\]", text, re.IGNORECASE))

    # If no explicit VERDICT, infer from blocker count
    if not m:
        is_pass = blocker_count == 0

    # Safety overrides: verdict is deterministic based on blocker count,
    # regardless of what the model outputs.
    if is_pass and blocker_count > 0:
        log.warning(f"  parse_verdict: model said PASS but {blocker_count} "
                    f"[Blocker] found — forcing BLOCKED")
        is_pass = False
    if not is_pass and blocker_count == 0:
        log.info(f"  parse_verdict: model said BLOCKED but 0 blockers — "
                 f"overriding to PASS ({high_count} high(s) are informational)")
        is_pass = True

    # Extract findings section for display
    findings_text = ""
    findings_match = re.search(
        r"(Blocker.*?)(?:VERDICT|$)", text, re.DOTALL | re.IGNORECASE
    )
    if findings_match:
        findings_text = findings_match.group(1).strip()

    return Verdict(
        is_pass=is_pass,
        blocker_count=blocker_count,
        high_count=high_count,
        findings_text=findings_text,
    )


def verify_finish(story: StoryInfo) -> list[str]:
    """Check that FINISH actually completed its tasks. Returns list of failures."""
    failures: list[str] = []

    # 1. Check story file status
    story_files = list(
        (PROJECT_DIR / "docs" / "implementation-artifacts").glob(f"{story.yaml_key}*")
    )
    if story_files:
        content = story_files[0].read_text()
        if "status: done" not in content and "status: \"done\"" not in content:
            failures.append("Story file not marked done")
    else:
        failures.append(f"Story file not found for {story.yaml_key}")

    # 2. Check sprint-status.yaml
    data = load_sprint_status()
    dev_status = data.get("development_status", {})
    if str(dev_status.get(story.yaml_key, "")).strip() != "done":
        failures.append("Sprint status not updated to done")

    # 3. Check no uncommitted changes
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if result.stdout.strip():
        failures.append(f"Uncommitted files: {result.stdout.strip()[:200]}")

    # 4. Check branch was pushed
    # First verify upstream is set
    upstream_check = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "@{u}"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if upstream_check.returncode != 0:
        failures.append("Branch has no upstream (not pushed with -u)")
    else:
        # Check if local is ahead of remote
        result = subprocess.run(
            ["git", "log", "@{u}..HEAD", "--oneline"],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if result.stdout.strip():
            failures.append("Branch has unpushed commits")

    return failures


def extract_pr_url(text: str, story: StoryInfo | None = None) -> str | None:
    """Extract PR URL from finish output, with gh CLI fallback."""
    m = re.search(r"PR_URL:\s*(https://\S+)", text)
    if m:
        return m.group(1)
    m = re.search(r"https://github\.com/\S+/pull/\d+", text)
    if m:
        return m.group(0)

    # Fallback: check GitHub for open PRs from this branch
    if story:
        epic_n, epic_suffix = parse_epic_num(story.epic_num)
        story_n = int(story.story_num)
        branch_slug = f"e{epic_n:02d}{epic_suffix}-s{story_n:02d}"
        result = subprocess.run(
            ["gh", "pr", "list", "--head", f"feature/{branch_slug}",
             "--json", "url", "--limit", "1"],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if result.returncode == 0 and result.stdout.strip():
            prs = json.loads(result.stdout)
            if prs:
                return prs[0]["url"]
    return None


def print_progress(results: list[StoryResult], total: int) -> None:
    done = sum(1 for r in results if r.success)
    failed = sum(1 for r in results if not r.success and r.phase_reached != "init")
    remaining = total - len(results)

    print(f"\n--- Progress: {done} done, {failed} failed, {remaining} remaining ---")
    for r in results:
        status = "PASS" if r.success else f"FAIL ({r.phase_reached})"
        cost = f"${r.total_cost_usd:.2f}"
        duration = f"{r.duration_secs:.0f}s"
        pr = f" | PR: {r.pr_url}" if r.pr_url else ""
        err = f" | {r.error}" if r.error else ""
        print(f"  {r.story.key}: {status} | {duration} | {cost}{pr}{err}")


def log_result(result: StoryResult, log_file: Path) -> None:
    entry = {
        "timestamp": datetime.now().isoformat(),
        "story": result.story.key,
        "story_name": result.story.name,
        "success": result.success,
        "phase": result.phase_reached,
        "duration_secs": round(result.duration_secs, 1),
        "cost_usd": round(result.total_cost_usd, 2),
        "review_rounds": result.review_rounds,
        "blockers_found": result.blockers_found,
        "blockers_fixed": result.blockers_fixed,
        "pr_url": result.pr_url,
        "error": result.error,
    }
    log_file.parent.mkdir(parents=True, exist_ok=True)
    with open(log_file, "a") as f:
        f.write(json.dumps(entry) + "\n")


def log_epic_result(result: EpicFinishResult, log_file: Path) -> None:
    entry = {
        "timestamp": datetime.now().isoformat(),
        "type": "epic-finish",
        "epic": result.epic_num,
        "success": result.success,
        "phases_completed": result.phases_completed,
        "phases_failed": result.phases_failed,
        "merged_prs": result.merged_prs,
        "duration_secs": round(result.duration_secs, 1),
        "cost_usd": round(result.total_cost_usd, 2),
        "error": result.error,
    }
    log_file.parent.mkdir(parents=True, exist_ok=True)
    with open(log_file, "a") as f:
        f.write(json.dumps(entry) + "\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("\nInterrupted by user. Use --resume to continue where you left off.")
