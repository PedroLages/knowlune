#!/usr/bin/env python3
"""
epic-runner.py — Automated epic/story development cycle for Knowlune.

Follows the /epic-orchestrator systematic flow:
  Phase 0: SETUP     — epic selection, known issues load, tracking file creation
  Phase 1: STORIES   — for each story: start → implement → review loop → finish → merge
  Phase 2: POST-EPIC — sprint-status, testarch, adversarial, retro, fix pass, gate check
  Phase 3: REPORT    — completion report from tracking file + artifacts

Usage:
    python scripts/epic-runner.py E07-S01              # single story
    python scripts/epic-runner.py E07-S01 E07-S02      # multiple stories
    python scripts/epic-runner.py --next 3              # next 3 backlog stories
    python scripts/epic-runner.py --supervised E07-S01  # pause for human approval
    python scripts/epic-runner.py --dry-run --next 5    # show plan without executing
    python scripts/epic-runner.py --autonomous E07-S01  # auto-approve everything
    python scripts/epic-runner.py --epic-only 15        # skip stories, run epic finish only
    python scripts/epic-runner.py --skip-epic-finish --next 3  # process stories, skip epic finish
    python scripts/epic-runner.py --skip-adversarial --epic-only 15  # epic finish without adversarial review
    python scripts/epic-runner.py --epic-only 15 --phase retrospective  # run only retrospective
    python scripts/epic-runner.py --epic-only 15 --phase testarch-trace testarch-nfr
    python scripts/epic-runner.py --legacy-mode --next 3  # disable all optimizations

Requires: pip install claude-agent-sdk pyyaml
"""

from __future__ import annotations

import argparse
import asyncio
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

log = logging.getLogger("epic-runner")

PROJECT_DIR = Path(__file__).resolve().parent.parent
SPRINT_STATUS = PROJECT_DIR / "docs" / "implementation-artifacts" / "sprint-status.yaml"
KNOWN_ISSUES_PATH = PROJECT_DIR / "docs" / "known-issues.yaml"
EPICS_PATH = PROJECT_DIR / "docs" / "planning-artifacts" / "epics.md"
AGENTS_DIR = PROJECT_DIR / ".claude" / "agents"
TRACKING_DIR = PROJECT_DIR / "docs" / "implementation-artifacts"

# No budget caps — let sessions run to completion
BUDGET_SESSION_START = 0
BUDGET_SESSION_IMPLEMENT = 0
BUDGET_SESSION_REVIEW = 0
BUDGET_PER_STORY = 15.00  # estimate for dry-run display (reduced from 25 with optimizations)
BUDGET_SESSION_EPIC_FINISH = 0

# Timing and display constants
SERVER_STARTUP_WAIT_SECS = 5
SERVER_SHUTDOWN_TIMEOUT_SECS = 5
PROGRESS_DOT_INTERVAL_CHARS = 2000
PLAN_PREVIEW_CHARS = 3000

# Per-phase max_turns caps (--max-turns overrides when lower)
MAX_TURNS_START = 40       # planning is bounded
MAX_TURNS_IMPLEMENT = 80   # implementation needs the most room
MAX_TURNS_REVIEW = 60      # review pipeline is bounded
MAX_TURNS_FIX = 60         # fixing is bounded
MAX_TURNS_FINISH = 30      # finishing is quick

VALID_EFFORTS = ("low", "medium", "high", "max")
VALID_MODELS = ("sonnet", "opus", "opusplan")


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
    epic_only: str | None = None
    epic_phases: list[str] | None = None
    skip_epics: list[int] | None = None
    legacy_mode: bool = False
    no_coordinator: bool = False


def phase_turns(config: RunConfig, phase_cap: int) -> int:
    """Return effective max_turns for a phase, respecting global override."""
    if config.legacy_mode:
        return config.max_turns
    return min(config.max_turns, phase_cap)


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
    medium_count: int
    low_count: int
    nit_count: int
    story_related_total: int
    pre_existing_total: int
    known_issues_matched: int
    non_issues_total: int
    findings_text: str
    story_related_findings: str  # text of story-related issues for fix agent


@dataclass
class ReviewResult:
    rounds: int = 0
    blockers_found: int = 0
    blockers_fixed: int = 0


@dataclass
class CoordinatorDecision:
    """Adaptive coordinator decision between review and fix rounds."""
    action: str       # "fix" | "escalate" | "park" | "accept"
    strategy: str     # hint injected into fix prompt
    reason: str       # human-readable justification
    raw_json: str = ""  # original text for debugging


@dataclass
class RoundEntry:
    """One round of the review-fix loop, accumulated for coordinator context."""
    round_num: int
    verdict_summary: str   # "BLOCKED (3B 2H 1M 0L 0N)"
    findings_brief: str    # truncated findings (~500 chars)
    fix_applied: str       # "(applied)" or "(not yet fixed)"
    delta: str             # "blockers 3->1, high 2->2"


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
    issues_fixed_total: int = 0
    pr_url: str | None = None
    error: str | None = None
    session_ids: list[str] = field(default_factory=list)
    pre_existing_issues: list[str] = field(default_factory=list)
    known_issues_matched: list[str] = field(default_factory=list)
    non_issues: list[str] = field(default_factory=list)
    coordinator_decisions: list[str] = field(default_factory=list)
    coordinator_cost_usd: float = 0.0


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


@dataclass
class EpicContext:
    """Accumulated context across all stories in an epic run."""
    epic_num: str
    epic_name: str = ""
    known_issues_summary: str = ""
    next_ki_number: int = 0
    tracking_file: Path | None = None
    all_pre_existing: list[str] = field(default_factory=list)
    all_known_matched: list[str] = field(default_factory=list)
    all_non_issues: list[str] = field(default_factory=list)
    story_count: int = 0


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


class StoryError(Exception):
    pass


def parse_args() -> RunConfig:
    parser = argparse.ArgumentParser(
        description="Automated epic/story development for Knowlune",
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
        "--log-file", type=Path, default=PROJECT_DIR / "scripts" / "epic-runner.log"
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
    parser.add_argument(
        "--no-coordinator", action="store_true",
        help="Disable adaptive coordinator between review and fix (use simple fix loop)",
    )

    args = parser.parse_args()

    if not args.stories and args.next is None and args.epic_only is None:
        parser.error("Provide story IDs, --next N, or --epic-only EPIC")

    mode = "autonomous" if args.autonomous else "supervised"

    stories_raw = list(args.stories or [])
    if args.next:
        existing = {s.upper() for s in stories_raw}
        for key in find_next_backlog_keys(args.next + len(existing), args.skip_epics):
            if key.upper() not in existing:
                stories_raw.append(key)
                existing.add(key.upper())
            if len(stories_raw) >= len(args.stories or []) + args.next:
                break

    if args.epic_only:
        stories_raw = []

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
        no_coordinator=args.no_coordinator,
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
    """Return epic numbers that just became fully done after this batch."""
    batch_succeeded: dict[str, set[str]] = {}
    for story, result in zip(stories, results):
        if result.success:
            batch_succeeded.setdefault(story.epic_num, set()).add(story.yaml_key)

    data = load_sprint_status()
    dev_status = data.get("development_status", {})

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
        if str(dev_status.get(epic_key, "")).strip() == "done":
            continue

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
                continue
            if key in batch_succeeded.get(epic_num, set()):
                continue
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

    done_epics: set[int] = set()
    for yaml_key, status in dev_status.items():
        if yaml_key.startswith("epic-") and str(status).strip() == "done":
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
                epic_match = re.match(r"(\d+)", parts[0])
                if not epic_match:
                    continue
                epic_n = int(epic_match.group(1))
                story_n = int(parts[1])
            except (ValueError, AttributeError):
                continue
            if epic_n in done_epics or (skip_epics and epic_n in skip_epics):
                continue
            keys.append(f"E{epic_n:02d}-S{story_n:02d}")
        if len(keys) >= n:
            break
    return keys


def extract_epic_name(epic_num: str) -> str:
    """Extract epic name from docs/planning-artifacts/epics.md."""
    if not EPICS_PATH.exists():
        return f"Epic {epic_num}"
    content = EPICS_PATH.read_text()
    epic_n, epic_suffix = parse_epic_num(epic_num)
    # Match patterns like "## Epic 110:" or "### Epic 110 —"
    pattern = rf"#+\s*Epic\s+{epic_n}{epic_suffix}[\s:—\-]+(.+)"
    m = re.search(pattern, content, re.IGNORECASE)
    if m:
        return m.group(1).strip().rstrip("#").strip()
    return f"Epic {epic_num}"


# ─────────────────────────────────────────────────
# Section G: Known Issues Register
# ─────────────────────────────────────────────────


def load_known_issues() -> tuple[str, int]:
    """Load known issues register. Returns (summary_text, next_ki_number)."""
    if not KNOWN_ISSUES_PATH.exists():
        return "", 1

    with open(KNOWN_ISSUES_PATH) as f:
        data = yaml.safe_load(f)

    if not data or not isinstance(data, list):
        return "", 1

    lines: list[str] = []
    max_ki = 0
    for entry in data:
        if not isinstance(entry, dict):
            continue
        ki_id = entry.get("id", "")
        status = entry.get("status", "")
        if status != "open":
            continue
        ki_type = entry.get("type", "unknown")
        summary = entry.get("summary", "")
        file_ref = entry.get("file", "")
        lines.append(f"{ki_id}: [{ki_type}] {summary} ({file_ref})")

        # Track highest KI number
        ki_match = re.match(r"KI-(\d+)", ki_id)
        if ki_match:
            max_ki = max(max_ki, int(ki_match.group(1)))

    return "\n".join(lines), max_ki + 1


# ─────────────────────────────────────────────────
# Section H: Tracking File Management
# ─────────────────────────────────────────────────


def find_tracking_file(epic_num: str) -> Path | None:
    """Find existing tracking file for an epic."""
    pattern = f"epic-{epic_num}-tracking-*.md"
    files = sorted(TRACKING_DIR.glob(pattern), reverse=True)
    return files[0] if files else None


def create_tracking_file(epic_num: str, epic_name: str, stories: list[StoryInfo]) -> Path:
    """Create initial persistent tracking file."""
    today = date.today().isoformat()
    filename = f"epic-{epic_num}-tracking-{today}.md"
    filepath = TRACKING_DIR / filename

    story_rows = "\n".join(
        f"| {s.key} | queued | — | — | — |" for s in stories
    )
    story_details = "\n\n---\n\n".join(
        f"### {s.key}: {s.name}\n"
        f"**Status:** queued\n"
        f"#### Errors\n_(none yet)_\n"
        f"#### Review Findings\n_(none yet)_\n"
        f"#### Fixes Applied\n_(none yet)_\n"
        f"#### Notes\n_(none yet)_"
        for s in stories
    )

    content = f"""# Epic {epic_num}: {epic_name} — Execution Tracker

Generated: {today}
Last Updated: {today}

## Progress Summary

| Story | Status | PR URL | Review Rounds | Issues Fixed |
|-------|--------|--------|---------------|--------------|
{story_rows}

## Story Details

{story_details}

## Post-Epic Validation

| Command | Status | Result | Notes |
|---------|--------|--------|-------|
| Sprint Status | pending | — | — |
| Mark Epic Done | pending | — | — |
| Testarch Trace | pending | — | — |
| Testarch NFR | pending | — | — |
| Adversarial Review | pending | — | — |
| Retrospective | pending | — | — |
| Fix Pass Planning | pending | — | — |
| Fix Pass Execution | pending | — | — |
| Gate Check | pending | — | — |

## Non-Issues (False Positives)
_(none yet)_

## Known Issues Cross-Reference

### Matched (already in register)
_(none yet)_

### New (to be added to register in Phase 2)
_(none yet)_

## Epic Summary
- Started: {today}
- Completed: --
- Total Stories: {len(stories)}
- Total Review Rounds: --
- Total Issues Fixed: --
"""
    filepath.write_text(content)
    log.info(f"  Created tracking file: {filepath}")
    return filepath


def update_tracking_story(
    tracking_file: Path, story_key: str,
    status: str, pr_url: str = "—", rounds: str = "—", issues_fixed: str = "—",
) -> None:
    """Update a story's row in the tracking file progress table."""
    if not tracking_file or not tracking_file.exists():
        return
    content = tracking_file.read_text()
    # Update the row matching the story key
    pattern = rf"\| {re.escape(story_key)} \|[^\n]+"
    replacement = f"| {story_key} | {status} | {pr_url} | {rounds} | {issues_fixed} |"
    updated = re.sub(pattern, replacement, content)
    # Update last-updated timestamp
    updated = re.sub(
        r"Last Updated: .+",
        f"Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        updated,
    )
    tracking_file.write_text(updated)


def update_tracking_post_epic(
    tracking_file: Path, command: str, status: str, result: str = "—", notes: str = "—",
) -> None:
    """Update a post-epic command row in the tracking file."""
    if not tracking_file or not tracking_file.exists():
        return
    content = tracking_file.read_text()
    pattern = rf"\| {re.escape(command)} \|[^\n]+"
    replacement = f"| {command} | {status} | {result} | {notes} |"
    updated = re.sub(pattern, replacement, content)
    tracking_file.write_text(updated)


def commit_tracking_file(epic_num: str, message: str) -> None:
    """Commit tracking file to protect against session crashes."""
    subprocess.run(
        ["git", "add", f"docs/implementation-artifacts/epic-{epic_num}-tracking-*.md"],
        cwd=PROJECT_DIR, capture_output=True,
    )
    subprocess.run(
        ["git", "commit", "-m", message],
        cwd=PROJECT_DIR, capture_output=True,
    )


# ─────────────────────────────────────────────────
# Section C: Phase Prompts
# ─────────────────────────────────────────────────


def start_prompt(story: StoryInfo) -> str:
    """Story Agent: /start-story ONLY — plan generation, no implementation."""
    return (
        f"You are planning story {story.key} for the Knowlune learning platform.\n\n"
        f"STEP 0: Activate `/auto-answer autopilot` to handle plan mode questions autonomously without blocking.\n\n"
        f"STEP 1: Run `/start-story {story.key}` which will:\n"
        f"- Create branch feature/{story.key.lower()}-{{slug}}\n"
        f"- Create story file from template\n"
        f"- Research codebase context (3 parallel agents)\n"
        f"- Generate implementation plan\n"
        f"- Enter plan mode for your approval\n\n"
        f"STEP 1.5: Verify branch — run `git branch --show-current` and confirm it matches "
        f"the expected `feature/{story.key.lower()}-*` pattern. If not, STOP and report the mismatch.\n\n"
        f"STEP 2: After the plan is generated and approved, STOP. Do NOT implement anything.\n"
        f"Your job in this session is ONLY to produce the plan. Implementation happens in a separate session.\n\n"
        f"STEP 3: Return a brief summary:\n"
        f"- Plan file location\n"
        f"- Branch name created\n"
        f"- Story file location\n"
        f"- Number of plan tasks/phases"
    )


def implement_prompt(story: StoryInfo) -> str:
    """Implementation instructions — self-contained session that reads plan from disk."""
    return (
        f"You are implementing story {story.key} for the Knowlune learning platform.\n\n"
        f"STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.\n\n"
        f"STEP 1: Read context from disk:\n"
        f"- Read the implementation plan at docs/implementation-artifacts/plans/ (find the file matching {story.key.lower()})\n"
        f"- Read the story file at docs/implementation-artifacts/stories/ (find the file matching {story.key})\n"
        f"- The story file contains acceptance criteria and requirements\n"
        f"- The plan contains the ordered tasks to implement\n\n"
        f"STEP 2: Implement the plan fully:\n"
        f"- Follow existing codebase patterns (Tailwind CSS v4, shadcn/ui, Zustand, Dexie)\n"
        f"- Use the @/ import alias\n"
        f"- Follow project conventions: design tokens (never hardcode colors), accessibility (WCAG AA)\n"
        f"- Use existing UI components from src/app/components/ui/\n"
        f"- Make granular commits after each logical task (as save points)\n"
        f"- Write unit tests for business logic\n"
        f"- Write E2E test spec if the story has UI\n"
        f"- Run `npm run build` to verify before finishing\n\n"
        f"STEP 3: Return a brief summary:\n"
        f"- What was built (2-3 sentences)\n"
        f"- Key files created/modified (list)\n"
        f"- Any decisions or concerns\n"
        f"- Total commits made\n\n"
        f"When finished, output: IMPLEMENTATION_COMPLETE"
    )


def review_prompt(story: StoryInfo, known_issues: str = "", skip_agents: str = "") -> str:
    """Review Agent: /review-story with full structured template."""
    skip_section = ""
    if skip_agents:
        skip_section = (
            f"\nSKIP THESE REVIEW AGENTS (no relevant changes):\n{skip_agents}\n"
        )

    return (
        f"STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.\n\n"
        f"Run `/review-story {story.key}` on the current branch.\n\n"
        f"NOTE: OpenAI and GLM adversarial reviews are enabled via `.claude/settings.json` env block. "
        f"Ensure `/review-story` dispatches both when API keys are available.\n\n"
        f"KNOWN ISSUES (already tracked in docs/known-issues.yaml — do NOT re-flag these):\n"
        f"{known_issues or '(none)'}\n\n"
        f"If a pre-existing issue matches one of the above known issues (same file or same category "
        f"of problem), classify it as KNOWN, not PRE-EXISTING. This prevents duplicate reporting.\n"
        f"{skip_section}\n"
        f"This runs the full quality gate pipeline — pre-checks (build, lint (auto-fix), type-check, "
        f"format (auto-fix), unit-tests, e2e-tests) followed by agent gates.\n\n"
        f"BEFORE reviewing, run this to identify which files the story changed:\n"
        f"  git diff --name-only main...HEAD\n\n"
        f"Use this file list to CLASSIFY every issue as either STORY-RELATED (in files the story changed) "
        f"or PRE-EXISTING (in files the story did NOT touch).\n\n"
        f"After review completes, return a STRUCTURED summary in this exact format:\n\n"
        f"VERDICT: [PASS or ISSUES FOUND]\n\n"
        f"STORY-RELATED ISSUES (files changed by this story — must be fixed):\n"
        f"BLOCKER: [count]\n"
        f"HIGH: [count]\n"
        f"MEDIUM: [count]\n"
        f"LOW: [count]\n"
        f"NITS: [count]\n"
        f"TOTAL: [count]\n"
        f"- [SEVERITY] [description] — [file:line]\n"
        f"- [SEVERITY] [description] — [file:line]\n"
        f"...\n\n"
        f"PRE-EXISTING ISSUES (files NOT changed by this story — deferred to final report):\n"
        f"TOTAL: [count]\n"
        f"- [SEVERITY] [description] — [file:line]\n"
        f"...\n\n"
        f"KNOWN ISSUES (already in known-issues.yaml — no action needed):\n"
        f"TOTAL: [count]\n"
        f"- KI-NNN: [matched description]\n"
        f"...\n\n"
        f"NON-ISSUES (verified false positives — not actual problems):\n"
        f"TOTAL: [count]\n"
        f"- [ORIGINAL_SEVERITY] [description] — [why it's not an issue]\n\n"
        f"REPORT PATHS:\n"
        f"- Design: [path or \"skipped\"]\n"
        f"- Code: [path]\n"
        f"- Testing: [path]\n"
        f"- Performance: [path or \"skipped\"]\n"
        f"- Security: [path]\n"
        f"- QA: [path or \"skipped\"]\n\n"
        f"IMPORTANT: Report ALL issues at every severity level. Classify each into one of four tiers:\n"
        f"- STORY-RELATED: in files changed by this story — will be fixed now\n"
        f"- PRE-EXISTING (NEW): in untouched files, NOT in known-issues.yaml — goes in final report\n"
        f"- KNOWN: matches an entry in known-issues.yaml — acknowledged, no action needed\n"
        f"- NON-ISSUES: verified false positives — not actual problems"
    )


def fix_prompt(story: StoryInfo, findings: str = "", strategy: str = "") -> str:
    """Fix Agent: fix ALL story-related review findings."""
    strategy_section = ""
    if strategy:
        strategy_section = (
            f"COORDINATOR STRATEGY HINT:\n"
            f"{strategy}\n"
            f"Follow this guidance when deciding HOW to fix each issue.\n\n"
        )
    return (
        f"STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.\n\n"
        f"STEP 0.5: Verify branch — run `git branch --show-current` and confirm it matches "
        f"the expected `feature/{story.key.lower()}-*` pattern. If not, STOP and report the mismatch.\n\n"
        f"You are fixing ALL STORY-RELATED review issues for story {story.key}. "
        f"Fix EVERY issue listed below — no exceptions, regardless of severity.\n\n"
        f"Note: Pre-existing issues (in files not changed by this story) are excluded — "
        f"they will be reported separately.\n\n"
        f"STORY-RELATED ISSUES TO FIX:\n"
        f"{findings or '(read review reports below)'}\n\n"
        f"{strategy_section}"
        f"If no specific findings listed above, read the review reports for story {story.key} at:\n"
        f"  - docs/reviews/code/code-review-*-{story.key.lower()}.md\n"
        f"  - docs/reviews/code/code-review-testing-*-{story.key.lower()}.md\n"
        f"  - docs/reviews/design/design-review-*-{story.key.lower()}.md (if exists)\n\n"
        f"INSTRUCTIONS:\n"
        f"For each issue:\n"
        f"1. Read the file at the specified location\n"
        f"2. Understand the root cause\n"
        f"3. Implement the correct fix following project conventions\n"
        f"4. Ensure the fix doesn't break anything else\n\n"
        f"If an issue is a FALSE POSITIVE (not actually a problem), do NOT change code for it.\n"
        f"Instead, explain WHY it's not an issue in your return. The coordinator will classify it as NON-ISSUE.\n\n"
        f"After fixing ALL issues:\n"
        f"1. Run `npm run build` — must pass\n"
        f"2. Run `npm run lint` — must pass\n"
        f"3. Commit all fixes:\n"
        f'   git add [specific files]\n'
        f'   git commit -m "fix({story.key}): address review findings — [brief summary]"\n\n'
        f"RETURN:\n"
        f"- Total issues fixed: [N]\n"
        f"- Issues that could NOT be fixed (with explanation): [list or \"none\"]\n"
        f"- Files modified: [list]"
    )


def format_round_history(round_history: list[RoundEntry]) -> str:
    """Format round history list into structured text for coordinator context."""
    if not round_history:
        return "(no prior rounds)"
    lines = []
    for entry in round_history:
        lines.append(
            f"Round {entry.round_num}:\n"
            f"  Verdict: {entry.verdict_summary}\n"
            f"  Findings: {entry.findings_brief}\n"
            f"  Fix applied: {entry.fix_applied}\n"
            f"  Delta: {entry.delta}"
        )
    return "\n\n".join(lines)


def coordinator_prompt(
    story: StoryInfo,
    round_num: int,
    max_rounds: int,
    round_history: list[RoundEntry],
    verdict: Verdict,
) -> str:
    """Coordinator prompt: analyze review history and decide next action."""
    return (
        f"You are the REVIEW COORDINATOR for story {story.key}, round {round_num} of {max_rounds}.\n\n"
        f"Your job: analyze the review-fix history and decide the optimal next action.\n\n"
        f"ROUND HISTORY:\n"
        f"{format_round_history(round_history)}\n\n"
        f"CURRENT REVIEW RESULT (round {round_num}):\n"
        f"  Blockers: {verdict.blocker_count}\n"
        f"  High: {verdict.high_count}\n"
        f"  Medium: {verdict.medium_count}\n"
        f"  Low: {verdict.low_count}\n"
        f"  Nits: {verdict.nit_count}\n"
        f"  Total story-related: {verdict.story_related_total}\n\n"
        f"FINDINGS:\n"
        f"{verdict.findings_text[:1500]}\n\n"
        f"AVAILABLE ACTIONS:\n"
        f'1. "fix" — Standard fix pass (sonnet). Use when issues are clear and progress is being made between rounds.\n'
        f'2. "escalate" — Use opus for the fix. Use when: issues are architectural/cross-cutting, '
        f"the same issues keep recurring (regression), or the fix requires understanding complex interactions.\n"
        f'3. "park" — Abandon this story for now. ONLY allowed after round 2+. '
        f"Use when: issues reveal fundamental design problems that cannot be fixed incrementally.\n"
        f'4. "accept" — Ship with remaining issues. ONLY allowed when ALL remaining issues are LOW or NIT '
        f"severity (zero blockers, zero high, zero medium).\n\n"
        f"STRATEGY HINTS — when action is \"fix\" or \"escalate\", provide a concrete strategy:\n"
        f"- Which issues to prioritize\n"
        f"- What approach to take (e.g., \"refactor the hook before fixing individual call sites\")\n"
        f"- What to watch out for (e.g., \"the previous fix broke X, avoid that pattern\")\n\n"
        f"Respond with ONLY a JSON object (no markdown, no explanation outside the JSON):\n"
        f'{{"action": "fix|escalate|park|accept", "strategy": "concrete guidance for the fix agent", '
        f'"reason": "one-sentence justification"}}'
    )


def finish_prompt_text(story: StoryInfo) -> str:
    """Finish Agent: /finish-story + PR creation."""
    return (
        f"Run `/finish-story {story.key}`.\n\n"
        f"This will:\n"
        f"1. Validate all review gates passed\n"
        f"2. Update story file: reviewed → true. DO NOT set status → done yet.\n"
        f"3. Update sprint-status.yaml: story → review. DO NOT set to done yet — done only after PR merge.\n"
        f"4. Commit changes\n"
        f"5. Push branch to remote\n"
        f"6. Create PR with description\n"
        f"7. After PR is created and merged: update story status → done, sprint-status → done, set completed date\n\n"
        f"Activate `/auto-answer autopilot` before running /finish-story to handle any interactive questions automatically.\n\n"
        f"RETURN:\n"
        f"- PR URL\n"
        f"- PR title\n"
        f"- Branch name"
    )


def finish_retry_prompt(story: StoryInfo, missing: list[str]) -> str:
    """Retry prompt for incomplete FINISH — only addresses missing tasks."""
    missing_str = "\n".join(f"- {m}" for m in missing)
    return (
        f"The FINISH phase for story {story.key} did not complete all tasks.\n\n"
        f"Missing:\n{missing_str}\n\n"
        f"Complete ONLY the missing tasks listed above. Do not repeat already-completed tasks.\n"
        f"When done, output: FINISH_COMPLETE"
    )


# ── Epic Finish Prompts ──

EPIC_SPRINT_STATUS_PROMPT = """
STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

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
STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

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
STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

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
STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

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
Run `/retrospective` for Epic {epic_num}.

Activate `/auto-answer autopilot` to handle retrospective dialogue autonomously.

IMPORTANT: You are acting as Pedro (the developer/project owner) in the party mode dialogue.

Before answering ANY question during the retrospective:
1. Think deeply and analytically about the question
2. Consider multiple perspectives before responding
3. Evaluate if your answer is the BEST possible answer
4. Draw from the actual implementation experience of this epic
5. Be thoughtful, honest, and constructive — not generic

When asked about:
- What went well → Be specific about techniques, patterns, tools that worked
- What didn't → Be honest about friction points, time sinks, quality gaps
- Action items → Propose concrete, measurable improvements

RETURN:
- Retrospective document path: [file path]
- Top 3 lessons learned: [list]
- Action items for next epic: [list]
"""

EPIC_FIX_PASS_PLANNER_PROMPT = """
STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

You are the FIX PASS PLANNER for Epic {epic_num}: {epic_name}.

Your job is to READ and ANALYZE — do NOT modify any code. Produce a structured fix plan that execution agents will implement.

AUDIT REPORTS TO READ:
- Testarch Trace: docs/reviews/testarch-trace-*-epic-{epic_num}.md
- Testarch NFR: docs/reviews/testarch-nfr-*-epic-{epic_num}.md
- Adversarial Review: docs/reviews/code/adversarial-review-*-epic-{epic_num}.md (if exists)
- Known Issues Register: docs/known-issues.yaml (for cross-reference — don't re-flag known issues)

INSTRUCTIONS:
1. Read each audit report and extract ALL unresolved findings
2. Cross-reference with known-issues.yaml — skip already-tracked items
3. For each remaining finding, READ the source code at the specified location
4. Determine the specific fix approach (not just "fix this" — explain HOW)
5. Identify dependencies between fixes (e.g., fixing A in file X also resolves B)
6. Group findings by file/area for efficient execution (not just severity)
7. Triage LOW/NIT: mark as QUICK FIX (< 5 min, include approach) or DEFER (explain why)
8. Identify false positives with clear reasoning

RETURN a structured fix plan in this exact format:

FIX PLAN FOR EPIC {epic_num}

SUMMARY:
- Total unresolved findings: [N]
- BLOCKER: [N], HIGH: [N], MEDIUM: [N], LOW: [N], NIT: [N]
- False positives identified: [N]
- Dependencies found: [list or "none"]
- Recommended execution groups: [N]

GROUP 1: [area/theme] — [severity mix]
Files: [list]
Findings:
- [ID] [SEVERITY] [description] — file:line — FIX: [specific approach]
Dependencies: [any ordering constraints, or "none"]
Estimated complexity: [simple / moderate / complex]

GROUP 2: [area/theme] — [severity mix]
...

LOW/NIT TRIAGE:
- [ID] [description] — file:line — QUICK FIX: [approach] (< 5 min)
- [ID] [description] — file:line — DEFER: [reason] → known-issues.yaml

FALSE POSITIVES:
- [ID] [SEVERITY] [description] — REASON: [why this is not an actual issue]
"""

EPIC_FIX_PASS_EXECUTOR_PROMPT = """
STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

You are implementing fixes from the Fix Pass Plan for Epic {epic_num}: {epic_name}.

You have been assigned GROUP {group_number}: {group_theme}

DO NOT re-analyze or second-guess the plan — the planning agent (opus) already read the code and determined the approach. Follow the fix instructions precisely.

FIXES TO IMPLEMENT:
{group_findings}

INSTRUCTIONS:
For each fix:
1. Read the file at the specified location
2. Implement the fix EXACTLY as described in the plan
3. If the planned approach doesn't work (code has changed, approach is wrong), explain why and implement the best alternative
4. Ensure the fix doesn't break related code

After implementing all fixes in this group:
1. Run `npm run build` — must pass
2. Run `npm run lint` — must pass
3. Commit:
   git add [specific files]
   git commit -m "fix(Epic {epic_num}): post-epic fixes — {group_theme}"

RETURN:
- Fixes implemented: [N] / [total in group]
- Fixes that diverged from plan (with explanation): [list or "none"]
- Fixes that could NOT be implemented (with explanation): [list or "none"]
- Files modified: [list]
"""

EPIC_REPORT_PROMPT = """
STEP 0: Activate `/auto-answer autopilot` to handle any interactive questions autonomously without blocking.

Create a comprehensive epic completion report for Epic {epic_num}: {epic_name}.

GATHER INFORMATION FROM:
- Persistent tracking file: docs/implementation-artifacts/epic-{epic_num}-tracking-*.md (primary data source)
- Story files: docs/implementation-artifacts/*{epic_num}*.md
- Design review reports: docs/reviews/design/
- Code review reports: docs/reviews/code/
- Sprint status: docs/implementation-artifacts/sprint-status.yaml
- Git log: git log main --oneline (recent merges)
- Post-epic outputs: testarch-trace, testarch-nfr, adversarial review, retrospective

COORDINATOR DATA:
{tracking_data}

KNOWN ISSUES MATCHED:
{known_matched}

NEW PRE-EXISTING ISSUES:
{new_pre_existing}

NON-ISSUES:
{non_issues}

REPORT STRUCTURE:
1. **Executive Summary** — Epic goal, outcome, date range
2. **Stories Delivered** — Table: story ID, name, PR URL, review rounds, issues fixed
3. **Review Metrics** — Total issues found/fixed by severity
4. **Deferred Issues** — 4a: Known (already tracked), 4b: New pre-existing, 4c: Non-issues
5. **Post-Epic Validation** — Trace coverage, NFR assessment, adversarial findings
5b. **Fix Pass Results** — Severity breakdown, fix counts, gate check result
6. **Lessons Learned** — Key insights from retrospective
7. **Suggestions for Next Epic** — Process improvements based on observed patterns
8. **Build Verification** — Run `npm run build` on main, confirm success

SAVE TO: docs/implementation-artifacts/epic-{epic_num}-completion-report-{today}.md

RETURN:
- Report file path
"""

# Phase registry for epic finish (name, template, completion marker)
EPIC_FINISH_PHASES = [
    ("sprint-status", EPIC_SPRINT_STATUS_PROMPT, "SPRINT_STATUS_COMPLETE"),
    ("testarch-trace", EPIC_TESTARCH_TRACE_PROMPT, "TESTARCH_TRACE_COMPLETE"),
    ("testarch-nfr", EPIC_TESTARCH_NFR_PROMPT, "TESTARCH_NFR_COMPLETE"),
    ("adversarial", EPIC_ADVERSARIAL_PROMPT, "ADVERSARIAL_COMPLETE"),
    ("retrospective", EPIC_RETROSPECTIVE_PROMPT, "RETROSPECTIVE_COMPLETE"),
]


def format_epic_prompt(template: str, epic_num: str, story_count: int = 0, **kwargs) -> str:
    """Fill epic-finish prompt template with epic details."""
    epic_n, epic_suffix = parse_epic_num(epic_num)
    return template.format(
        epic_num=epic_num,
        epic_name=kwargs.get("epic_name", f"Epic {epic_num}"),
        epic_num_padded=f"{epic_n:02d}{epic_suffix}",
        today=date.today().isoformat(),
        story_count=story_count,
        # Fix pass specific
        group_number=kwargs.get("group_number", ""),
        group_theme=kwargs.get("group_theme", ""),
        group_findings=kwargs.get("group_findings", ""),
        # Report specific
        tracking_data=kwargs.get("tracking_data", "(see tracking file)"),
        known_matched=kwargs.get("known_matched", "(none)"),
        new_pre_existing=kwargs.get("new_pre_existing", "(none)"),
        non_issues=kwargs.get("non_issues", "(none)"),
    )


# ─────────────────────────────────────────────────
# Section D: Phase Runners
# ─────────────────────────────────────────────────


def make_options(
    max_turns: int, max_budget: float, autonomous: bool,
    phase: PhaseConfig | None = None,
) -> ClaudeAgentOptions:
    """Build ClaudeAgentOptions with agent registration and scoped permissions."""
    pc = phase or PhaseConfig()

    agents: dict[str, AgentDefinition] = {}
    if pc.needs_agents:
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

    allowed = [
        "Read", "Write", "Edit",
        "Glob", "Grep",
        "Bash",
        "Agent",
        "TodoWrite",
        "ToolSearch",
        "Skill",
    ]

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
        max_buffer_size=10 * 1024 * 1024,
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

    buffer_mb = opts["max_buffer_size"] / (1024 * 1024)
    log.debug(f"ClaudeAgentOptions configured with {buffer_mb:.0f}MB message buffer")

    return ClaudeAgentOptions(**opts)


PROGRESS_FILE = PROJECT_DIR / "scripts" / "epic-runner-progress.log"


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
    """Switch to main and pull latest."""
    checkout_cmd = ["git", "checkout"]
    if force:
        checkout_cmd.append("-f")
    checkout_cmd.append("main")

    checkout = subprocess.run(
        checkout_cmd, capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if checkout.returncode != 0:
        log.warning(f"git checkout main failed: {checkout.stderr.strip()}")
        return

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


async def resolve_merge_conflict(
    branch_name: str, story_key: str, autonomous: bool
) -> bool:
    """Resolve merge conflicts by merging main into the branch via AI session."""
    checkout = subprocess.run(
        ["git", "checkout", branch_name],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if checkout.returncode != 0:
        log.error(f"  Cannot checkout {branch_name}: {checkout.stderr.strip()}")
        return False

    merge = subprocess.run(
        ["git", "merge", "main", "--no-edit"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if merge.returncode == 0:
        push = subprocess.run(
            ["git", "push"], capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if push.returncode == 0:
            return True
        log.error(f"  Push failed after clean merge: {push.stderr.strip()}")
        return False

    log.info(f"  [{story_key}] Resolving merge conflicts on {branch_name}...")
    resolve_phase = PhaseConfig(
        model="sonnet", effort="high",
        needs_agents=False, needs_playwright=False,
    )
    try:
        text, _, cost = await run_session(
            (
                f"There are merge conflicts on branch {branch_name} for story {story_key}.\n"
                f"Run `git status` to see conflicted files.\n"
                f"For each conflicted file:\n"
                f"1. Read the file to see conflict markers (<<<<<<< / ======= / >>>>>>>)\n"
                f"2. Resolve by keeping the correct code (usually both changes are needed)\n"
                f"3. git add the resolved file\n"
                f"After all conflicts resolved: git commit (accept the default merge message)\n"
                f"Then: npm run build && npm run lint (verify nothing broke)\n"
                f"If build/lint fails, fix and commit.\n"
                f"Finally: git push"
            ),
            max_turns=50, max_budget=0, autonomous=autonomous,
            story_key=story_key, phase=resolve_phase,
        )
        write_progress(story_key, "CONFLICT_RESOLVED", f"cost=${cost:.2f}")
        return True

    except (StoryError, Exception) as e:
        log.error(f"  Conflict resolution failed for {branch_name}: {e}")
        subprocess.run(["git", "merge", "--abort"], cwd=PROJECT_DIR)
        subprocess.run(["git", "checkout", "main"], cwd=PROJECT_DIR)
        return False


async def merge_epic_prs(
    epic_num: str,
    stories: list[StoryInfo] | None = None,
    results: list[StoryResult] | None = None,
    supervised: bool = True,
) -> list[str]:
    """Merge all open PRs for an epic. Returns list of merged PR URLs."""
    pr_infos: list[dict[str, Any]] = []

    if stories and results:
        for story, result in zip(stories, results):
            if story.epic_num != epic_num or not result.success:
                continue
            if result.pr_url:
                pr_number = result.pr_url.split("/")[-1]
                pr_infos.append({"number": pr_number, "url": result.pr_url, "story": story.key})
    else:
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

        merge_result = subprocess.run(
            ["gh", "pr", "merge", pr_num, "--squash", "--delete-branch"],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if merge_result.returncode == 0:
            log.info(f"  PR #{pr_num}: merged successfully")
            merged.append(pr["url"])
        else:
            stderr = merge_result.stderr.strip()
            log.warning(f"  PR #{pr_num}: merge failed — {stderr}")

            if "conflict" in stderr.lower() or "not possible" in stderr.lower():
                branch_info = subprocess.run(
                    ["gh", "pr", "view", pr_num, "--json", "headRefName"],
                    capture_output=True, text=True, cwd=PROJECT_DIR,
                )
                if branch_info.returncode == 0:
                    branch_name = json.loads(branch_info.stdout)["headRefName"]
                    log.info(f"  PR #{pr_num}: attempting conflict resolution on {branch_name}...")

                    resolved = await resolve_merge_conflict(
                        branch_name, pr.get("story", "?"), not supervised,
                    )
                    if resolved:
                        _checkout_main_and_pull()
                        retry = subprocess.run(
                            ["gh", "pr", "merge", pr_num, "--squash", "--delete-branch"],
                            capture_output=True, text=True, cwd=PROJECT_DIR,
                        )
                        if retry.returncode == 0:
                            log.info(f"  PR #{pr_num}: merged after conflict resolution")
                            merged.append(pr["url"])
                        else:
                            log.error(f"  PR #{pr_num}: still failed after resolution — {retry.stderr.strip()}")
                    else:
                        log.error(f"  PR #{pr_num}: conflict resolution failed, skipping")

        if pr["url"] in merged:
            _checkout_main_and_pull()

    return merged


async def collect_response(
    client: ClaudeSDKClient, story_key: str = "", stream: bool = True
) -> tuple[str, str | None, float]:
    """Collect all text from a response. Returns (full_text, session_id, cost)."""
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
                        if char_count % PROGRESS_DOT_INTERVAL_CHARS < len(block.text):
                            print(".", end="", flush=True)
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
        print()
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


# ─────────────────────────────────────────────────
# Section E: Adaptive Review Scope
# ─────────────────────────────────────────────────


def detect_review_skip_agents() -> str:
    """Check git diff to determine which review agents to skip."""
    result = subprocess.run(
        ["git", "diff", "--name-only", "main...HEAD"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if result.returncode != 0:
        return ""  # can't determine, run all agents

    changed_files = result.stdout.strip().splitlines()
    if not changed_files:
        return ""

    has_tsx = any(f.endswith(".tsx") for f in changed_files)
    has_css = any(f.endswith(".css") for f in changed_files)
    has_ts = any(f.endswith(".ts") and not f.endswith(".spec.ts") and not f.endswith(".test.ts") for f in changed_files)
    only_docs = all(
        f.endswith((".md", ".yaml", ".yml", ".json"))
        for f in changed_files
    )
    only_tests = all(
        "tests/" in f or f.endswith((".spec.ts", ".test.ts"))
        for f in changed_files
    )

    skip_lines: list[str] = []

    if only_docs:
        skip_lines.append("- design-review (no .tsx/.css changes)")
        skip_lines.append("- exploratory-qa (no UI changes)")
        skip_lines.append("- performance-benchmark (no code changes)")
    elif only_tests:
        skip_lines.append("- design-review (only test files changed)")
        skip_lines.append("- exploratory-qa (only test files changed)")
        skip_lines.append("- performance-benchmark (only test files changed)")
    elif not has_tsx and not has_css:
        skip_lines.append("- design-review (no .tsx/.css changes)")
        if not has_ts:
            skip_lines.append("- exploratory-qa (no UI changes)")

    return "\n".join(skip_lines)


# ─────────────────────────────────────────────────
# Section F: Verdict Parsing & Helpers
# ─────────────────────────────────────────────────


# Files that are expected noise — don't fail verify_finish for these
_NOISE_FILES = {
    ".claude/scheduled_tasks.lock",
    "scripts/__pycache__/",
    "scripts/epic-runner-progress.log",
    "scripts/dev-server.log",
}


def parse_verdict(text: str) -> Verdict:
    """Extract VERDICT, severity counts, and issue classification from review output."""
    is_pass = False
    m = re.search(r"VERDICT[:\s\-]*(PASS|BLOCKED|ISSUES FOUND)", text, re.IGNORECASE)
    if m:
        is_pass = m.group(1).upper() == "PASS"

    # Count story-related issues by severity
    blocker_count = _count_severity(text, "Blocker", "STORY-RELATED")
    high_count = _count_severity(text, "High", "STORY-RELATED")
    medium_count = _count_severity(text, "Medium", "STORY-RELATED")
    low_count = _count_severity(text, "Low", "STORY-RELATED")
    nit_count = _count_severity(text, "Nit", "STORY-RELATED")

    # Fallback: count all severities if structured section not found
    if blocker_count == 0 and high_count == 0:
        blocker_count = len(re.findall(r"\[Blocker\]", text, re.IGNORECASE))
        high_count = len(re.findall(r"\[High\]", text, re.IGNORECASE))
        medium_count = len(re.findall(r"\[Medium\]", text, re.IGNORECASE))
        low_count = len(re.findall(r"\[Low\]", text, re.IGNORECASE))
        nit_count = len(re.findall(r"\[Nit\]", text, re.IGNORECASE))

    story_related_total = blocker_count + high_count + medium_count + low_count + nit_count

    # Extract pre-existing count
    pre_existing_total = _extract_section_count(text, "PRE-EXISTING ISSUES")
    known_issues_matched = _extract_section_count(text, "KNOWN ISSUES")
    non_issues_total = _extract_section_count(text, "NON-ISSUES")

    # Safety overrides
    if not m:
        is_pass = blocker_count == 0
    if is_pass and blocker_count > 0:
        log.warning(f"  parse_verdict: model said PASS but {blocker_count} [Blocker] found — forcing BLOCKED")
        is_pass = False
    if not is_pass and blocker_count == 0:
        log.info(f"  parse_verdict: model said BLOCKED but 0 blockers — overriding to PASS")
        is_pass = True

    # Extract story-related findings text for fix agent
    story_related_findings = _extract_section(text, "STORY-RELATED ISSUES")

    # Extract full findings text for display
    findings_text = ""
    findings_match = re.search(
        r"(STORY-RELATED ISSUES.*?)(?:PRE-EXISTING|KNOWN ISSUES|NON-ISSUES|REPORT PATHS|$)",
        text, re.DOTALL | re.IGNORECASE
    )
    if findings_match:
        findings_text = findings_match.group(1).strip()
    else:
        # Fallback to old pattern
        findings_match = re.search(
            r"(Blocker.*?)(?:VERDICT|$)", text, re.DOTALL | re.IGNORECASE
        )
        if findings_match:
            findings_text = findings_match.group(1).strip()

    return Verdict(
        is_pass=is_pass,
        blocker_count=blocker_count,
        high_count=high_count,
        medium_count=medium_count,
        low_count=low_count,
        nit_count=nit_count,
        story_related_total=story_related_total,
        pre_existing_total=pre_existing_total,
        known_issues_matched=known_issues_matched,
        non_issues_total=non_issues_total,
        findings_text=findings_text,
        story_related_findings=story_related_findings,
    )


def _count_severity(text: str, severity: str, section: str) -> int:
    """Count occurrences of a severity within a specific section."""
    section_text = _extract_section(text, section)
    if section_text:
        return len(re.findall(rf"\[{severity}\]", section_text, re.IGNORECASE))
    return 0


def _extract_section(text: str, section_name: str) -> str:
    """Extract text between a section header and the next section."""
    pattern = rf"({re.escape(section_name)}.*?)(?=\n(?:PRE-EXISTING|KNOWN ISSUES|NON-ISSUES|REPORT PATHS|STORY-RELATED|VERDICT)\b|\Z)"
    m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    return m.group(1) if m else ""


def _extract_section_count(text: str, section_name: str) -> int:
    """Extract TOTAL: [N] from a section."""
    section = _extract_section(text, section_name)
    if not section:
        return 0
    m = re.search(r"TOTAL:\s*(\d+)", section)
    return int(m.group(1)) if m else 0


def _validate_coordinator_decision(data: dict, raw: str) -> CoordinatorDecision:
    """Validate parsed JSON into CoordinatorDecision."""
    action = str(data.get("action", "fix")).lower()
    if action not in ("fix", "escalate", "park", "accept"):
        action = "fix"
    return CoordinatorDecision(
        action=action,
        strategy=str(data.get("strategy", "")),
        reason=str(data.get("reason", "")),
        raw_json=raw,
    )


def parse_coordinator_decision(text: str) -> CoordinatorDecision:
    """Parse coordinator JSON response with robust fallback."""
    # Strip markdown fences
    cleaned = re.sub(r"```json\s*", "", text)
    cleaned = re.sub(r"```\s*", "", cleaned)
    cleaned = cleaned.strip()

    # Attempt 1: parse entire cleaned text as JSON
    try:
        data = json.loads(cleaned)
        return _validate_coordinator_decision(data, cleaned)
    except (json.JSONDecodeError, ValueError):
        pass

    # Attempt 2: find JSON object in text
    m = re.search(r'\{[^{}]*"action"\s*:\s*"[^"]+?"[^{}]*\}', cleaned)
    if m:
        try:
            data = json.loads(m.group(0))
            return _validate_coordinator_decision(data, m.group(0))
        except (json.JSONDecodeError, ValueError):
            pass

    # Attempt 3: regex extraction of key fields
    action_m = re.search(r'"action"\s*:\s*"(fix|escalate|park|accept)"', text, re.IGNORECASE)
    if action_m:
        strategy_m = re.search(r'"strategy"\s*:\s*"([^"]*)"', text)
        reason_m = re.search(r'"reason"\s*:\s*"([^"]*)"', text)
        return CoordinatorDecision(
            action=action_m.group(1).lower(),
            strategy=strategy_m.group(1) if strategy_m else "",
            reason=reason_m.group(1) if reason_m else "parsed from fragments",
            raw_json=text[:500],
        )

    # Final fallback: default to fix
    log.warning("  Coordinator output unparseable, defaulting to 'fix'")
    return CoordinatorDecision(
        action="fix",
        strategy="",
        reason="coordinator output unparseable — defaulting to fix",
        raw_json=text[:500],
    )


def ensure_clean_tree(story: StoryInfo, next_phase: str) -> None:
    """Auto-commit any dirty files before the next phase."""
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    dirty_lines = result.stdout.strip()
    if not dirty_lines:
        return

    meaningful = [
        line for line in dirty_lines.splitlines()
        if not any(noise in line for noise in _NOISE_FILES)
    ]
    if not meaningful:
        return

    subprocess.run(["git", "add", "-A"], cwd=PROJECT_DIR, check=True)
    subprocess.run(
        ["git", "commit", "-m", f"chore({story.key}): save progress before {next_phase}"],
        cwd=PROJECT_DIR, check=True,
    )
    log.info(f"  Auto-committed {len(meaningful)} file(s) before {next_phase}")


def verify_start(story: StoryInfo) -> list[str]:
    """Check START phase artifacts exist on disk."""
    failures: list[str] = []

    epic_n, epic_suffix = parse_epic_num(story.epic_num)
    story_n = int(story.story_num)
    branch_prefix = f"feature/e{epic_n:02d}{epic_suffix}-s{story_n:02d}"
    result = subprocess.run(
        ["git", "branch", "--list", f"{branch_prefix}*"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if not result.stdout.strip():
        failures.append(f"Branch matching {branch_prefix}* not created")

    story_files = list(
        (PROJECT_DIR / "docs" / "implementation-artifacts").glob(f"{story.yaml_key}*")
    )
    if not story_files:
        failures.append(f"Story file not created for {story.yaml_key}")

    plans = list(
        (PROJECT_DIR / "docs" / "implementation-artifacts" / "plans").glob(f"*")
    )
    has_plan = any(
        story.yaml_key in p.name or story.key.lower() in p.name.lower()
        for p in plans
    )
    if not has_plan:
        failures.append("No plan file created")

    data = load_sprint_status()
    dev_status = data.get("development_status", {})
    status = str(dev_status.get(story.yaml_key, "")).strip()
    if status not in ("in-progress", "done"):
        failures.append(f"Sprint status is '{status}', expected 'in-progress'")

    return failures


def verify_implement(story: StoryInfo) -> list[str]:
    """Check IMPLEMENT phase: code was committed, build passes."""
    failures: list[str] = []

    result = subprocess.run(
        ["git", "log", "main..HEAD", "--oneline"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    commit_count = len(result.stdout.strip().splitlines()) if result.stdout.strip() else 0
    if commit_count <= 1:
        failures.append(f"[{story.key}] Only {commit_count} commit(s) on branch (expected implementation commits)")

    build = subprocess.run(
        ["npm", "run", "build"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
        timeout=120,
    )
    if build.returncode != 0:
        failures.append("Build fails after implementation")

    return failures


def verify_finish(story: StoryInfo) -> list[str]:
    """Check that FINISH actually completed its tasks."""
    failures: list[str] = []

    story_files = list(
        (PROJECT_DIR / "docs" / "implementation-artifacts").glob(f"{story.yaml_key}*")
    )
    if story_files:
        content = story_files[0].read_text()
        if "status: done" not in content and "status: \"done\"" not in content:
            failures.append("Story file not marked done")
    else:
        failures.append(f"Story file not found for {story.yaml_key}")

    data = load_sprint_status()
    dev_status = data.get("development_status", {})
    if str(dev_status.get(story.yaml_key, "")).strip() != "done":
        failures.append("Sprint status not updated to done")

    result = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if result.stdout.strip():
        meaningful = [
            line for line in result.stdout.strip().splitlines()
            if not any(noise in line for noise in _NOISE_FILES)
        ]
        if meaningful:
            failures.append(f"Uncommitted files: {'; '.join(meaningful)[:200]}")

    upstream_check = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "@{u}"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if upstream_check.returncode != 0:
        failures.append("Branch has no upstream (not pushed with -u)")
    else:
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


def merge_story_pr(pr_url: str, story_key: str) -> bool:
    """Merge a single story PR immediately via squash."""
    pr_number = pr_url.split("/")[-1]

    merge_result = subprocess.run(
        ["gh", "pr", "merge", pr_number, "--squash", "--delete-branch"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if merge_result.returncode == 0:
        log.info(f"  [{story_key}] PR #{pr_number} merged successfully")
        write_progress(story_key, "PR_MERGED", f"PR #{pr_number}")
        return True

    log.warning(f"  [{story_key}] PR #{pr_number} merge failed: {merge_result.stderr.strip()}")
    return False


def run_gate_check() -> tuple[bool, list[str]]:
    """Run gate check: build, lint, test, tsc. No AI cost. Returns (passed, failures)."""
    failures: list[str] = []

    checks = [
        ("build", ["npm", "run", "build"]),
        ("lint", ["npm", "run", "lint"]),
        ("test:unit", ["npm", "run", "test:unit"]),
        ("tsc", ["npx", "tsc", "--noEmit"]),
    ]

    for name, cmd in checks:
        result = subprocess.run(
            cmd, capture_output=True, text=True, cwd=PROJECT_DIR, timeout=300,
        )
        if result.returncode != 0:
            failures.append(f"{name} failed")
            log.warning(f"  Gate check: {name} FAILED")
        else:
            log.info(f"  Gate check: {name} PASSED")

    # Check git status is clean
    git_status = subprocess.run(
        ["git", "status", "--porcelain"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    if git_status.stdout.strip():
        meaningful = [
            line for line in git_status.stdout.strip().splitlines()
            if not any(noise in line for noise in _NOISE_FILES)
        ]
        if meaningful:
            failures.append("uncommitted changes")

    return len(failures) == 0, failures


# ─────────────────────────────────────────────────
# Section O: Orchestration
# ─────────────────────────────────────────────────


async def run_story(
    story: StoryInfo, config: RunConfig,
    epic_ctx: EpicContext | None = None,
) -> StoryResult:
    """Full lifecycle for one story — each phase gets a fresh SDK session."""
    start_time = time.monotonic()
    result = StoryResult(story=story)
    autonomous = config.mode == "autonomous"
    known_issues = epic_ctx.known_issues_summary if epic_ctx else ""

    try:
        # ── Phase configs (disabled in legacy mode) ──
        start_phase = None if config.legacy_mode else PhaseConfig(
            model="opus", effort="high", fallback_model="sonnet",
            needs_agents=False, needs_playwright=False,
        )

        # ── Session 1: START (fresh) ──
        write_progress(story.key, "SESSION 1: START", "branch, story file, plan...")
        text, sid, cost = await run_session(
            start_prompt(story), phase_turns(config, MAX_TURNS_START), BUDGET_SESSION_START, autonomous,
            story_key=story.key, phase=start_phase,
        )
        result.cost_start = cost
        result.total_cost_usd += cost
        if sid:
            result.session_ids.append(sid)
        result.phase_reached = "start"

        # Verify START artifacts on disk
        start_failures = verify_start(story)
        if start_failures:
            log.warning(f"  START verification: {', '.join(start_failures)}")

        # Supervised: show plan and ask for approval
        if config.mode == "supervised":
            print(f"\n{'=' * 60}")
            print(f"PLAN FOR {story.key}")
            print(f"{'=' * 60}")
            print(text[-PLAN_PREVIEW_CHARS:])
            approval = input("\nApprove plan? [y/n]: ").strip().lower()
            if approval != "y":
                raise StoryError("Plan rejected by user")

        # ── Session 2: IMPLEMENT (fresh — reads plan from disk) ──
        write_progress(story.key, "SESSION 2: IMPLEMENT", "coding feature...")
        impl_phase = None if config.legacy_mode else PhaseConfig(
            model="sonnet", effort="high", fallback_model="sonnet",
            needs_agents=False, needs_playwright=False,
        )

        text, sid, cost = await run_session(
            implement_prompt(story),
            phase_turns(config, MAX_TURNS_IMPLEMENT) if not config.legacy_mode else config.max_turns,
            BUDGET_SESSION_IMPLEMENT,
            autonomous, story_key=story.key, phase=impl_phase,
        )

        result.cost_implement = cost
        result.total_cost_usd += cost
        if sid:
            result.session_ids.append(sid)
        result.phase_reached = "implement"

        # Verify implementation artifacts
        impl_failures = verify_implement(story)
        if impl_failures:
            log.warning(f"  IMPLEMENT verification: {', '.join(impl_failures)}")

        # Ensure clean tree before review
        ensure_clean_tree(story, "review")

        # Update tracking file
        if epic_ctx and epic_ctx.tracking_file:
            update_tracking_story(epic_ctx.tracking_file, story.key, "reviewing")

        # ── Session 3+: REVIEW LOOP ──
        review_phase = None if config.legacy_mode else PhaseConfig(
            model="sonnet", effort="medium", fallback_model="sonnet",
            needs_agents=True, needs_playwright=True,
            append_context=f"Story: {story.key}. Running quality gates.",
        )

        # Detect which agents to skip based on changed files
        skip_agents = "" if config.legacy_mode else detect_review_skip_agents()

        write_progress(story.key, "SESSION 3: REVIEW", "quality gates...")
        text, sid, cost = await run_session(
            review_prompt(story, known_issues=known_issues, skip_agents=skip_agents),
            phase_turns(config, MAX_TURNS_REVIEW), BUDGET_SESSION_REVIEW,
            autonomous, story_key=story.key, phase=review_phase,
        )
        result.cost_review = cost
        result.total_cost_usd += cost
        if sid:
            result.session_ids.append(sid)

        verdict = parse_verdict(text)
        rr = ReviewResult(rounds=1, blockers_found=verdict.blocker_count)

        # Collect classified issues
        if verdict.pre_existing_total > 0:
            pre_existing_section = _extract_section(text, "PRE-EXISTING ISSUES")
            if pre_existing_section:
                result.pre_existing_issues.append(pre_existing_section)
        if verdict.known_issues_matched > 0:
            known_section = _extract_section(text, "KNOWN ISSUES")
            if known_section:
                result.known_issues_matched.append(known_section)
        if verdict.non_issues_total > 0:
            non_issues_section = _extract_section(text, "NON-ISSUES")
            if non_issues_section:
                result.non_issues.append(non_issues_section)

        # ── Fix loop (with adaptive coordinator) ──
        round_history: list[RoundEntry] = []
        prev_verdict: Verdict | None = None

        for round_num in range(1, config.max_review_rounds + 1):
            if verdict.is_pass and verdict.story_related_total == 0:
                write_progress(story.key, "REVIEW", f"PASSED on round {round_num}")
                break

            rr.rounds = round_num

            # Build round history entry
            if round_num == 1:
                round_history.append(RoundEntry(
                    round_num=0,
                    verdict_summary=(
                        f"INITIAL REVIEW: "
                        f"({verdict.blocker_count}B {verdict.high_count}H "
                        f"{verdict.medium_count}M {verdict.low_count}L "
                        f"{verdict.nit_count}N)"
                    ),
                    findings_brief=verdict.findings_text[:500],
                    fix_applied="(not yet fixed)",
                    delta="(initial)",
                ))
            elif prev_verdict is not None:
                delta = (
                    f"blockers {prev_verdict.blocker_count}->{verdict.blocker_count}, "
                    f"high {prev_verdict.high_count}->{verdict.high_count}, "
                    f"medium {prev_verdict.medium_count}->{verdict.medium_count}"
                )
                round_history.append(RoundEntry(
                    round_num=round_num - 1,
                    verdict_summary=(
                        f"{'PASS' if prev_verdict.is_pass else 'BLOCKED'} "
                        f"({prev_verdict.blocker_count}B {prev_verdict.high_count}H "
                        f"{prev_verdict.medium_count}M {prev_verdict.low_count}L "
                        f"{prev_verdict.nit_count}N)"
                    ),
                    findings_brief=prev_verdict.findings_text[:500],
                    fix_applied="(applied)",
                    delta=delta,
                ))

            write_progress(
                story.key, "REVIEW",
                f"round {round_num}: {verdict.blocker_count}B {verdict.high_count}H "
                f"{verdict.medium_count}M {verdict.low_count}L {verdict.nit_count}N",
            )

            # ── Coordinator call (adaptive decision) ──
            coord_decision: CoordinatorDecision | None = None
            fix_strategy = ""
            fix_model = "sonnet"

            use_coordinator = not config.legacy_mode and not config.no_coordinator

            if use_coordinator:
                coordinator_phase = PhaseConfig(
                    model="sonnet", effort="low",
                    needs_agents=False, needs_playwright=False,
                )
                write_progress(story.key, "COORDINATOR", f"round {round_num}: deciding next action...")
                try:
                    coord_text, _, coord_cost = await run_session(
                        coordinator_prompt(story, round_num, config.max_review_rounds, round_history, verdict),
                        max_turns=10, max_budget=0, autonomous=True,
                        story_key=story.key, phase=coordinator_phase,
                    )
                    result.coordinator_cost_usd += coord_cost
                    result.total_cost_usd += coord_cost

                    coord_decision = parse_coordinator_decision(coord_text)

                    # Enforce constraints in code (not just prompt)
                    if coord_decision.action == "park" and round_num < 2:
                        coord_decision.action = "fix"
                        coord_decision.reason += " (park overridden: requires 2+ rounds)"
                    if coord_decision.action == "accept" and (
                        verdict.blocker_count > 0 or verdict.high_count > 0 or verdict.medium_count > 0
                    ):
                        coord_decision.action = "fix"
                        coord_decision.reason += " (accept overridden: non-low issues remain)"

                    result.coordinator_decisions.append(json.dumps({
                        "round": round_num,
                        "action": coord_decision.action,
                        "strategy": coord_decision.strategy,
                        "reason": coord_decision.reason,
                    }))

                    write_progress(story.key, "COORDINATOR",
                        f"round {round_num}: action={coord_decision.action}, "
                        f"reason={coord_decision.reason[:80]}")

                except Exception as e:
                    log.warning(f"  Coordinator failed ({e}), defaulting to fix")
                    coord_decision = CoordinatorDecision(
                        action="fix", strategy="", reason=f"coordinator error: {e}"
                    )

            # ── Handle coordinator decision ──
            if coord_decision:
                if coord_decision.action == "accept":
                    write_progress(story.key, "COORDINATOR",
                        f"ACCEPT: {coord_decision.reason}")
                    log.info(f"  Coordinator: ACCEPT remaining "
                             f"{verdict.low_count}L {verdict.nit_count}N issues")
                    break

                if coord_decision.action == "park":
                    write_progress(story.key, "COORDINATOR",
                        f"PARK: {coord_decision.reason}")
                    raise StoryError(f"PARKED: {coord_decision.reason}")

                if coord_decision.action == "escalate":
                    fix_model = "opus"
                    write_progress(story.key, "COORDINATOR",
                        f"ESCALATE: using opus for fix round {round_num}")

                fix_strategy = coord_decision.strategy

            # Supervised: show decision and allow override
            if config.mode == "supervised":
                print(f"\n{'=' * 60}")
                print(f"REVIEW ROUND {round_num}: "
                      f"{verdict.blocker_count} BLOCKER, {verdict.high_count} HIGH, "
                      f"{verdict.medium_count} MEDIUM, {verdict.low_count} LOW")
                if coord_decision:
                    print(f"COORDINATOR: {coord_decision.action.upper()} — {coord_decision.reason}")
                    if coord_decision.strategy:
                        print(f"STRATEGY: {coord_decision.strategy[:200]}")
                print(f"{'=' * 60}")
                print(verdict.findings_text[:2000])
                print()
                action = input("Fix automatically? [y/n/skip/override]: ").strip().lower()
                if action == "n":
                    raise StoryError("User declined to fix blockers")
                if action == "skip":
                    log.warning("Skipping blockers per user request")
                    break
                if action == "override":
                    override = input("Override action [fix/escalate/park/accept]: ").strip().lower()
                    if override == "park":
                        raise StoryError("PARKED: user override")
                    if override == "accept":
                        break
                    if override == "escalate":
                        fix_model = "opus"
                    fix_strategy = input("Strategy hint (or enter to skip): ").strip()

            # Fix session (fresh context)
            fix_phase = None if config.legacy_mode else PhaseConfig(
                model=fix_model, effort="high", fallback_model="sonnet",
                needs_agents=False, needs_playwright=False,
                append_context=f"Story: {story.key}. Fixing review findings round {round_num}.",
            )
            write_progress(story.key, "FIX", f"round {round_num}: fixing ({fix_model})...")
            _, _, fix_cost = await run_session(
                fix_prompt(story, findings=verdict.story_related_findings, strategy=fix_strategy),
                phase_turns(config, MAX_TURNS_FIX), BUDGET_SESSION_REVIEW,
                autonomous, story_key=story.key, phase=fix_phase,
            )
            result.cost_review += fix_cost
            result.total_cost_usd += fix_cost
            rr.blockers_fixed += verdict.blocker_count
            prev_verdict = verdict

            if round_num >= config.max_review_rounds:
                raise StoryError(
                    f"Still blocked after {config.max_review_rounds} fix rounds"
                )

            # Ensure fixes are committed before re-review
            ensure_clean_tree(story, "re-review")

            # Re-review session (fresh — all gates)
            write_progress(story.key, "RE-REVIEW", f"round {round_num + 1}...")
            text, _, rr_cost = await run_session(
                review_prompt(story, known_issues=known_issues, skip_agents=skip_agents),
                phase_turns(config, MAX_TURNS_REVIEW), BUDGET_SESSION_REVIEW,
                autonomous, story_key=story.key, phase=review_phase,
            )
            result.cost_review += rr_cost
            result.total_cost_usd += rr_cost
            verdict = parse_verdict(text)
            rr.blockers_found += verdict.blocker_count

        # Handle stories that pass but still have non-blocker findings
        if verdict.is_pass and verdict.story_related_total > 0:
            # With coordinator active, it handles accept decisions — skip redundant pass
            if config.legacy_mode or config.no_coordinator:
                write_progress(story.key, "REVIEW",
                    f"PASSED (0 blockers), {verdict.story_related_total} remaining finding(s) — fixing in one pass")
                should_fix = True
                if config.mode == "supervised":
                    print(f"\n{'=' * 60}")
                    print(f"NON-BLOCKER FINDINGS: {verdict.story_related_total} total")
                    print(f"{'=' * 60}")
                    print(verdict.findings_text[:2000])
                    print()
                    should_fix = input("Fix non-blockers? [y/n]: ").strip().lower() == "y"

                if should_fix:
                    fix_phase = None if config.legacy_mode else PhaseConfig(
                        model="sonnet", effort="high", fallback_model="sonnet",
                        needs_agents=False, needs_playwright=False,
                    )
                    write_progress(story.key, "FIX", "fixing non-blocker findings...")
                    _, _, fix_cost = await run_session(
                        fix_prompt(story, findings=verdict.story_related_findings),
                        phase_turns(config, MAX_TURNS_FIX), BUDGET_SESSION_REVIEW,
                        autonomous, story_key=story.key, phase=fix_phase,
                    )
                    result.cost_review += fix_cost
                    result.total_cost_usd += fix_cost

        result.review_rounds = rr.rounds
        result.blockers_found = rr.blockers_found
        result.blockers_fixed = rr.blockers_fixed
        result.issues_fixed_total = verdict.story_related_total
        result.phase_reached = "review"

        # Ensure clean tree before finish
        ensure_clean_tree(story, "finish")

        # ── Session N: FINISH (fresh) ──
        finish_phase = None if config.legacy_mode else PhaseConfig(
            model="sonnet", effort="low", fallback_model="sonnet",
            needs_agents=False, needs_playwright=False,
        )

        write_progress(story.key, "FINISH", "updating story, pushing, creating PR...")
        text, sid, cost = await run_session(
            finish_prompt_text(story), phase_turns(config, MAX_TURNS_FINISH), BUDGET_SESSION_REVIEW,
            autonomous, story_key=story.key, phase=finish_phase,
        )
        result.cost_review += cost
        result.total_cost_usd += cost
        if sid:
            result.session_ids.append(sid)
        result.phase_reached = "finish"

        # Verify FINISH completed its tasks
        missing = verify_finish(story)
        if missing:
            write_progress(story.key, "FINISH_RETRY", f"missing: {', '.join(missing)}")
            retry_phase = None if config.legacy_mode else PhaseConfig(
                model="sonnet", effort="low", fallback_model="sonnet",
                needs_agents=False, needs_playwright=False,
            )
            retry_text, _, retry_cost = await run_session(
                finish_retry_prompt(story, missing), phase_turns(config, MAX_TURNS_FINISH),
                BUDGET_SESSION_REVIEW, autonomous,
                story_key=story.key, phase=retry_phase,
            )
            result.total_cost_usd += retry_cost
            text += "\n" + retry_text

            still_missing = verify_finish(story)
            if still_missing:
                raise StoryError(
                    f"FINISH incomplete after retry: {', '.join(still_missing)}"
                )

        # Extract and verify PR URL
        result.pr_url = extract_pr_url(text, story)
        if not result.pr_url:
            raise StoryError("FINISH phase did not create a PR (no URL found)")

        pr_number = result.pr_url.split('/')[-1]
        verify_pr = subprocess.run(
            ["gh", "pr", "view", pr_number],
            capture_output=True, text=True, cwd=PROJECT_DIR,
        )
        if verify_pr.returncode != 0:
            raise StoryError(f"PR {pr_number} does not exist: {verify_pr.stderr}")

        write_progress(story.key, "PR_VERIFIED", f"PR #{pr_number} created successfully")

        # Merge immediately
        if not merge_story_pr(result.pr_url, story.key):
            log.warning(f"  [{story.key}] PR merge failed — PR stays open for manual merge")

        # Update tracking file
        if epic_ctx and epic_ctx.tracking_file:
            update_tracking_story(
                epic_ctx.tracking_file, story.key, "done",
                pr_url=result.pr_url or "—",
                rounds=str(result.review_rounds),
                issues_fixed=str(result.issues_fixed_total),
            )
            commit_tracking_file(epic_ctx.epic_num, f"chore: update epic tracking after {story.key}")

        # Accumulate classified issues into epic context
        if epic_ctx:
            epic_ctx.all_pre_existing.extend(result.pre_existing_issues)
            epic_ctx.all_known_matched.extend(result.known_issues_matched)
            epic_ctx.all_non_issues.extend(result.non_issues)

        result.success = True

    except StoryError as e:
        result.error = str(e)
        log.error(f"[{story.key}] Failed at {result.phase_reached}: {e}")
    except Exception as e:
        result.error = f"{type(e).__name__}: {e}"
        log.error(f"[{story.key}] Unexpected error at {result.phase_reached}: {e}")
    finally:
        _checkout_main_and_pull(force=True)

    result.duration_secs = time.monotonic() - start_time
    return result


async def _run_single_epic_phase(
    phase_name: str, template: str, marker: str,
    epic_num: str, story_count: int,
    config: RunConfig, epic_ctx: EpicContext | None = None,
) -> tuple[str, bool, float, str]:
    """Run one epic-finish phase in its own SDK session.

    Returns (phase_name, succeeded, cost, output_text).
    """
    epic_key = f"EPIC-{epic_num}"
    autonomous = config.mode == "autonomous"
    write_progress(epic_key, f"EPIC_FINISH: {phase_name}", "starting...")

    # Per-phase model/effort optimization
    phase_configs = {
        "sprint-status": PhaseConfig(
            model="sonnet", effort="low",
            needs_agents=False, needs_playwright=False,
        ),
        "testarch-trace": PhaseConfig(
            model="sonnet", effort="medium",
            needs_agents=False, needs_playwright=False,
        ),
        "testarch-nfr": PhaseConfig(
            model="sonnet", effort="medium",
            needs_agents=False, needs_playwright=False,
        ),
        "adversarial": PhaseConfig(
            model="sonnet", effort="high",
            needs_agents=False, needs_playwright=False,
        ),
        "retrospective": PhaseConfig(
            model="sonnet", effort="medium",
            needs_agents=False, needs_playwright=False,
        ),
    }

    phase_cfg = None if config.legacy_mode else phase_configs.get(phase_name)
    prompt = format_epic_prompt(
        template, epic_num, story_count,
        epic_name=epic_ctx.epic_name if epic_ctx else f"Epic {epic_num}",
    )

    try:
        text, _sid, cost = await run_session(
            prompt, config.max_turns, BUDGET_SESSION_EPIC_FINISH, autonomous,
            story_key=epic_key, phase=phase_cfg,
        )
    except StoryError as e:
        log.error(f"  [{epic_key}] {phase_name} session error: {e}")
        write_progress(epic_key, f"EPIC_FINISH: {phase_name}", f"FAILED: {e}")
        return phase_name, False, 0.0, ""

    if marker in text:
        write_progress(epic_key, f"EPIC_FINISH: {phase_name}", "DONE")
        # Update tracking file
        if epic_ctx and epic_ctx.tracking_file:
            update_tracking_post_epic(
                epic_ctx.tracking_file,
                phase_name.replace("-", " ").title().replace(" ", " "),
                "done", "completed",
            )
        return phase_name, True, cost, text
    else:
        write_progress(epic_key, f"EPIC_FINISH: {phase_name}",
                       f"WARNING: {marker} not found in output")
        return phase_name, False, cost, text


async def run_fix_pass(
    epic_num: str, config: RunConfig, epic_ctx: EpicContext | None = None,
) -> tuple[float, bool]:
    """Two-stage fix pass: opus planner + sonnet executors. Returns (cost, success)."""
    epic_key = f"EPIC-{epic_num}"
    autonomous = config.mode == "autonomous"
    total_cost = 0.0

    # Stage 1: Planning (opus)
    write_progress(epic_key, "FIX_PASS: PLANNING", "opus analyzing all findings...")
    planner_phase = None if config.legacy_mode else PhaseConfig(
        model="opus", effort="high",
        needs_agents=False, needs_playwright=False,
    )

    planner_prompt = format_epic_prompt(
        EPIC_FIX_PASS_PLANNER_PROMPT, epic_num,
        epic_name=epic_ctx.epic_name if epic_ctx else f"Epic {epic_num}",
    )

    try:
        plan_text, _, plan_cost = await run_session(
            planner_prompt, config.max_turns, BUDGET_SESSION_EPIC_FINISH, autonomous,
            story_key=epic_key, phase=planner_phase,
        )
        total_cost += plan_cost
    except StoryError as e:
        log.error(f"  [{epic_key}] Fix pass planner failed: {e}")
        return total_cost, False

    write_progress(epic_key, "FIX_PASS: PLANNING", f"DONE, cost=${plan_cost:.2f}")

    if epic_ctx and epic_ctx.tracking_file:
        update_tracking_post_epic(epic_ctx.tracking_file, "Fix Pass Planning", "done", "completed")

    # Stage 2: Parse groups and dispatch executors
    groups = _parse_fix_groups(plan_text)
    if not groups:
        log.info(f"  [{epic_key}] No fix groups found in planner output — nothing to fix")
        return total_cost, True

    write_progress(epic_key, "FIX_PASS: EXECUTING", f"{len(groups)} group(s) to process...")

    executor_phase = None if config.legacy_mode else PhaseConfig(
        model="sonnet", effort="high",
        needs_agents=False, needs_playwright=False,
    )

    for i, (theme, findings) in enumerate(groups, 1):
        exec_prompt = format_epic_prompt(
            EPIC_FIX_PASS_EXECUTOR_PROMPT, epic_num,
            epic_name=epic_ctx.epic_name if epic_ctx else f"Epic {epic_num}",
            group_number=str(i),
            group_theme=theme,
            group_findings=findings,
        )
        try:
            _, _, exec_cost = await run_session(
                exec_prompt, config.max_turns, BUDGET_SESSION_EPIC_FINISH, autonomous,
                story_key=epic_key, phase=executor_phase,
            )
            total_cost += exec_cost
            write_progress(epic_key, f"FIX_PASS: GROUP {i}", f"DONE, cost=${exec_cost:.2f}")
        except StoryError as e:
            log.error(f"  [{epic_key}] Fix pass executor group {i} failed: {e}")

    if epic_ctx and epic_ctx.tracking_file:
        update_tracking_post_epic(epic_ctx.tracking_file, "Fix Pass Execution", "done", f"{len(groups)} groups")

    return total_cost, True


def _parse_fix_groups(plan_text: str) -> list[tuple[str, str]]:
    """Parse GROUP sections from fix pass planner output. Returns [(theme, findings)]."""
    groups: list[tuple[str, str]] = []
    # Match "GROUP N: theme" sections
    pattern = r"GROUP\s+\d+:\s*(.+?)(?:\n)(.*?)(?=GROUP\s+\d+:|LOW/NIT TRIAGE|FALSE POSITIVES|\Z)"
    for m in re.finditer(pattern, plan_text, re.DOTALL | re.IGNORECASE):
        theme = m.group(1).strip().rstrip("—-").strip()
        findings = m.group(2).strip()
        if findings:
            groups.append((theme, findings))
    return groups


async def run_epic_finish(
    epic_num: str, config: RunConfig, story_count: int = 0,
    epic_ctx: EpicContext | None = None,
) -> EpicFinishResult:
    """Run end-of-epic workflow with optimized model/effort per phase.

    Execution order:
      1. sprint-status (sequential — must mark epic done first)
      2. testarch-trace + testarch-nfr + adversarial (parallel)
      3. retrospective (sequential — needs all review reports)
      4. fix pass: planner (opus) + executors (sonnet)
      5. gate check (subprocess only — zero AI cost)
      6. report (sonnet)
    """
    start_time = time.monotonic()
    result = EpicFinishResult(epic_num=epic_num)
    epic_key = f"EPIC-{epic_num}"

    # Build phase list
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

    _checkout_main_and_pull()

    # Partition: before-parallel, parallel, after-parallel
    PARALLEL_PHASES = {"testarch-trace", "testarch-nfr", "adversarial"}
    before: list[tuple[str, str, str]] = []
    parallel: list[tuple[str, str, str]] = []
    after: list[tuple[str, str, str]] = []
    for p in phases:
        if p[0] == "sprint-status":
            before.append(p)
        elif p[0] in PARALLEL_PHASES:
            parallel.append(p)
        else:
            after.append(p)

    async def _run_phase(phase: tuple[str, str, str]) -> tuple[str, bool, float, str]:
        return await _run_single_epic_phase(
            phase[0], phase[1], phase[2],
            epic_num, story_count, config, epic_ctx,
        )

    def _collect(phase_results: list[tuple[str, bool, float, str]]) -> None:
        for name, succeeded, cost, _ in phase_results:
            result.total_cost_usd += cost
            if succeeded:
                result.phases_completed.append(name)
            else:
                result.phases_failed.append(name)

    try:
        # 1. Sequential: sprint-status
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

        # 3. Sequential: retrospective
        for phase in after:
            phase_result = await _run_phase(phase)
            _collect([phase_result])

        # 4. Fix pass (planner + executors) — skip if --phase filters don't include it
        if not config.epic_phases or "fix-pass" in (config.epic_phases or []):
            fix_cost, fix_success = await run_fix_pass(epic_num, config, epic_ctx)
            result.total_cost_usd += fix_cost
            if fix_success:
                result.phases_completed.append("fix-pass")
            else:
                result.phases_failed.append("fix-pass")

        # 5. Gate check (subprocess only — zero AI cost)
        if not config.epic_phases or "gate-check" in (config.epic_phases or []):
            write_progress(epic_key, "GATE_CHECK", "build, lint, test, tsc...")
            gate_passed, gate_failures = run_gate_check()
            if gate_passed:
                result.phases_completed.append("gate-check")
                write_progress(epic_key, "GATE_CHECK", "PASSED")
            else:
                result.phases_failed.append("gate-check")
                write_progress(epic_key, "GATE_CHECK", f"FAILED: {', '.join(gate_failures)}")
            if epic_ctx and epic_ctx.tracking_file:
                update_tracking_post_epic(
                    epic_ctx.tracking_file, "Gate Check",
                    "done" if gate_passed else "failed",
                    "PASS" if gate_passed else ", ".join(gate_failures),
                )

        # 6. Report (sonnet)
        if not config.epic_phases or "report" in (config.epic_phases or []):
            write_progress(epic_key, "REPORT", "generating completion report...")
            report_phase = None if config.legacy_mode else PhaseConfig(
                model="sonnet", effort="medium",
                needs_agents=False, needs_playwright=False,
            )
            report_prompt_filled = format_epic_prompt(
                EPIC_REPORT_PROMPT, epic_num,
                epic_name=epic_ctx.epic_name if epic_ctx else f"Epic {epic_num}",
                tracking_data="(see tracking file)",
                known_matched="\n".join(epic_ctx.all_known_matched) if epic_ctx else "(none)",
                new_pre_existing="\n".join(epic_ctx.all_pre_existing) if epic_ctx else "(none)",
                non_issues="\n".join(epic_ctx.all_non_issues) if epic_ctx else "(none)",
            )
            try:
                _, _, report_cost = await run_session(
                    report_prompt_filled, config.max_turns, BUDGET_SESSION_EPIC_FINISH,
                    config.mode == "autonomous",
                    story_key=epic_key, phase=report_phase,
                )
                result.total_cost_usd += report_cost
                result.phases_completed.append("report")
                write_progress(epic_key, "REPORT", f"DONE, cost=${report_cost:.2f}")
            except StoryError as e:
                log.error(f"  [{epic_key}] Report failed: {e}")
                result.phases_failed.append("report")

        result.success = len(result.phases_failed) == 0

    except Exception as e:
        result.error = f"{type(e).__name__}: {e}"
        log.error(f"[{epic_key}] Epic finish failed: {e}")

    result.duration_secs = time.monotonic() - start_time
    return result


async def _run_epic_only(config: RunConfig) -> None:
    """Standalone epic finish: merge PRs + run phases for a single epic."""
    epic_num = config.epic_only
    assert epic_num is not None

    data = load_sprint_status()
    dev_status = data.get("development_status", {})
    prefix = f"{epic_num}-"
    story_count = sum(
        1 for k in dev_status
        if k.startswith(prefix) and not k.endswith("-retrospective")
    )

    epic_name = extract_epic_name(epic_num)
    epic_ctx = EpicContext(
        epic_num=epic_num,
        epic_name=epic_name,
        story_count=story_count,
    )
    epic_ctx.known_issues_summary, epic_ctx.next_ki_number = load_known_issues()
    epic_ctx.tracking_file = find_tracking_file(epic_num)

    if config.dry_run:
        print(f"\nDRY RUN — Epic-only finish for Epic {epic_num}: {epic_name}")
        print(f"  Stories in epic: {story_count}")
        phases = [p[0] for p in EPIC_FINISH_PHASES
                  if not (p[0] == "adversarial" and config.skip_adversarial)]
        if config.epic_phases:
            phases = [p for p in phases if p in config.epic_phases]
        print(f"  Phases: {', '.join(phases)}")
        # Show optimization info
        print(f"  Fix pass: opus planner → sonnet executors")
        print(f"  Gate check: subprocess only (zero AI cost)")
        print(f"  Report: sonnet, effort=medium")
        parallel = [p for p in phases if p in {"testarch-trace", "testarch-nfr", "adversarial"}]
        if parallel and len(parallel) > 1:
            print(f"  Parallel: {', '.join(parallel)}")
        print(f"  Known issues loaded: {len(epic_ctx.known_issues_summary.splitlines()) if epic_ctx.known_issues_summary else 0}")
        print(f"  Mode: {config.mode}")
        print(f"  Legacy mode: {config.legacy_mode}")
        return

    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, "w") as f:
        f.write(f"=== epic-only run: {datetime.now().isoformat()} ===\n")
        f.write(f"Epic: {epic_num} ({epic_name})\n")
        f.write(f"Mode: {config.mode}\n\n")

    # Start dev server
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

        # Merge PRs
        merged = await merge_epic_prs(
            epic_num, supervised=(config.mode == "supervised"),
        )

        # Run epic finish
        ef_result = await run_epic_finish(epic_num, config, story_count, epic_ctx)
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

    # ── Epic-only mode ──
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

    # Preflight
    check = subprocess.run(
        ["git", "show", "main:scripts/epic-runner.py"],
        capture_output=True, cwd=PROJECT_DIR,
    )
    if check.returncode != 0:
        log.error("scripts/epic-runner.py not found on main branch!")
        log.error("Run: git checkout main && git add scripts/epic-runner.py && git commit")
        sys.exit(1)

    # ── Phase 0: Setup ──
    # Detect epic from stories
    epic_nums = list({s.epic_num for s in stories})
    primary_epic = epic_nums[0] if len(epic_nums) == 1 else epic_nums[0]
    epic_name = extract_epic_name(primary_epic)

    # Load known issues
    known_summary, next_ki = load_known_issues()
    log.info(f"  Known issues loaded: {len(known_summary.splitlines()) if known_summary else 0} open issues")

    # Create epic context
    epic_ctx = EpicContext(
        epic_num=primary_epic,
        epic_name=epic_name,
        known_issues_summary=known_summary,
        next_ki_number=next_ki,
        story_count=len(stories),
    )

    # Create or find tracking file
    existing_tracking = find_tracking_file(primary_epic)
    if existing_tracking:
        log.info(f"  Found existing tracking file: {existing_tracking}")
        epic_ctx.tracking_file = existing_tracking
    else:
        epic_ctx.tracking_file = create_tracking_file(primary_epic, epic_name, stories)

    # Dry run
    if config.dry_run:
        print(f"\nDRY RUN — {len(stories)} story(ies) for Epic {primary_epic}: {epic_name}\n")
        for s in stories:
            print(f"  {s.key}: {s.name} (status: {s.status})")
        est_cost = len(stories) * BUDGET_PER_STORY
        print(f"\nEstimated max cost: ${est_cost:.2f} "
              f"({len(stories)} stories x ${BUDGET_PER_STORY:.2f})")
        print(f"Mode: {config.mode}")
        print(f"Max review rounds: {config.max_review_rounds}")
        print(f"Max turns per session: {config.max_turns}")
        print(f"Known issues: {len(known_summary.splitlines()) if known_summary else 0}")
        print(f"Tracking file: {epic_ctx.tracking_file}")
        print(f"Legacy mode: {config.legacy_mode}")

        # Model/effort optimization preview
        if not config.legacy_mode:
            print(f"\nOptimized model/effort per phase:")
            print(f"  START:  opus, effort=high")
            print(f"  IMPL:   sonnet, effort=high (fresh session, reads plan from disk)")
            print(f"  REVIEW: sonnet, effort=medium")
            coord_status = "(DISABLED)" if config.no_coordinator else ""
            print(f"  COORD:  sonnet, effort=low {coord_status}")
            print(f"  FIX:    sonnet, effort=high (or opus on escalate)")
            print(f"  FINISH: sonnet, effort=low")
            print(f"\nPer-phase turn caps (when --max-turns not set):")
            print(f"  START={MAX_TURNS_START}, IMPL={MAX_TURNS_IMPLEMENT}, "
                  f"REVIEW={MAX_TURNS_REVIEW}, FIX={MAX_TURNS_FIX}, FINISH={MAX_TURNS_FINISH}")

        if not config.skip_epic_finish:
            fake_results = [StoryResult(story=s, success=True) for s in stories]
            would_complete = detect_completed_epics(stories, fake_results, completed_keys)
            if would_complete:
                phases = [p[0] for p in EPIC_FINISH_PHASES
                          if not (p[0] == "adversarial" and config.skip_adversarial)]
                print(f"\nEpic finish (if all stories pass):")
                for e in would_complete:
                    print(f"  Epic {e} → phases: {', '.join(phases)} + fix-pass + gate-check + report")
        return

    # Clear progress file
    PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_FILE, "w") as f:
        f.write(f"=== epic-runner run: {datetime.now().isoformat()} ===\n")
        f.write(f"Epic: {primary_epic} ({epic_name})\n")
        f.write(f"Stories: {[s.key for s in stories]}\n")
        f.write(f"Mode: {config.mode}\n")
        f.write(f"Known issues: {len(known_summary.splitlines()) if known_summary else 0}\n\n")

    # Start dev server
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

        # ── Phase 1: Story Pipeline ──
        results: list[StoryResult] = []
        for i, story in enumerate(stories):
            log.info(f"\n{'=' * 60}")
            log.info(f"[{i + 1}/{len(stories)}] {story.key} — {story.name}")
            log.info(f"{'=' * 60}")

            result = await run_story(story, config, epic_ctx)
            results.append(result)

            log_result(result, config.log_file)
            print_progress(results, len(stories))

            if not result.success:
                log.warning(f"[{story.key}] Failed. Moving to next story.\n")

            # Kill dev server between stories (will be restarted by next review)
            subprocess.run(
                ["lsof", "-ti:5173"], capture_output=True, text=True, cwd=PROJECT_DIR,
            )

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

        # ── Phase 2+3: End-of-Epic Processing ──
        if not config.skip_epic_finish:
            completed_epics = detect_completed_epics(stories, results, completed_keys)

            if completed_epics:
                print(f"\n{'=' * 60}")
                print(f"EPIC FINISH — {len(completed_epics)} epic(s) newly completed: "
                      f"{', '.join(f'E{e}' for e in completed_epics)}")
                print(f"{'=' * 60}")

                if config.mode == "supervised":
                    action = input(
                        f"\nRun epic finish for "
                        f"{', '.join(f'E{e}' for e in completed_epics)}? [y/n]: "
                    ).strip().lower()
                    if action != "y":
                        log.info("Skipping epic finish per user request")
                        completed_epics = []

                for epic_num_done in completed_epics:
                    sc = sum(
                        1 for s, r in zip(stories, results)
                        if s.epic_num == epic_num_done and r.success
                    )
                    log.info(f"\n--- Epic {epic_num_done} finish ({sc} stories) ---")

                    # Merge PRs first
                    merged = await merge_epic_prs(
                        epic_num_done, stories, results,
                        supervised=(config.mode == "supervised"),
                    )

                    # Run epic finish phases
                    ef_result = await run_epic_finish(
                        epic_num_done, config, sc, epic_ctx,
                    )
                    ef_result.merged_prs = merged
                    log_epic_result(ef_result, config.log_file)

                    status = "PASS" if ef_result.success else "PARTIAL"
                    phases_done = ", ".join(ef_result.phases_completed) or "none"
                    print(f"  Epic {epic_num_done}: {status} ({phases_done}) "
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
# Section P: Display & Logging
# ─────────────────────────────────────────────────


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
        "cost_start": round(result.cost_start, 2),
        "cost_implement": round(result.cost_implement, 2),
        "cost_review": round(result.cost_review, 2),
        "review_rounds": result.review_rounds,
        "blockers_found": result.blockers_found,
        "blockers_fixed": result.blockers_fixed,
        "issues_fixed_total": result.issues_fixed_total,
        "pr_url": result.pr_url,
        "error": result.error,
        "pre_existing_count": len(result.pre_existing_issues),
        "known_matched_count": len(result.known_issues_matched),
        "non_issues_count": len(result.non_issues),
        "coordinator_decisions": result.coordinator_decisions,
        "coordinator_cost_usd": round(result.coordinator_cost_usd, 2),
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
