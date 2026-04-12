"""
epic_runner_ui.py — Rich-powered terminal UI for epic-runner.py.

Provides colored banners, formatted tables, status badges, spinners,
pipeline visualizations, and progress indicators. Gracefully falls back
to plain print() if Rich is not installed.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.rule import Rule
    from rich.status import Status
    from rich.table import Table
    from rich.text import Text

    HAS_RICH = True
except ImportError:
    HAS_RICH = False

console = Console(highlight=False) if HAS_RICH else None


# ── Data structures ─────────────────────────────────────────────────


@dataclass
class PhaseStatus:
    """Tracks a single pipeline phase's state."""
    name: str       # "plan", "build", "review", "ship"
    label: str      # "Plan", "Build", "Review", "Ship"
    status: str = "pending"  # "pending" | "active" | "done" | "failed" | "skipped"
    elapsed_secs: float = 0.0
    cost: float = 0.0
    start_time: float = 0.0  # monotonic timestamp


@dataclass
class StoryProgress:
    """Tracks a story's progress through the pipeline."""
    key: str        # "E20-S02"
    name: str
    index: int      # 0-based
    total: int
    phases: list[PhaseStatus] = field(default_factory=list)
    status: str = "pending"  # "pending" | "active" | "done" | "failed"

    def __post_init__(self) -> None:
        if not self.phases:
            self.phases = [
                PhaseStatus("plan", "Plan"),
                PhaseStatus("build", "Build"),
                PhaseStatus("review", "Review"),
                PhaseStatus("ship", "Ship"),
            ]

    def get_phase(self, name: str) -> PhaseStatus:
        for p in self.phases:
            if p.name == name:
                return p
        raise ValueError(f"Unknown phase: {name}")

    def start_phase(self, name: str) -> None:
        phase = self.get_phase(name)
        phase.status = "active"
        phase.start_time = time.monotonic()

    def end_phase(self, name: str, cost: float = 0.0, failed: bool = False) -> None:
        phase = self.get_phase(name)
        phase.status = "failed" if failed else "done"
        if phase.start_time:
            phase.elapsed_secs = time.monotonic() - phase.start_time
        phase.cost = cost

    def skip_phase(self, name: str) -> None:
        self.get_phase(name).status = "skipped"

    @property
    def total_cost(self) -> float:
        return sum(p.cost for p in self.phases)

    @property
    def total_elapsed(self) -> float:
        return sum(p.elapsed_secs for p in self.phases)


@dataclass
class ReviewRoundDisplay:
    """One row in the review loop visualization."""
    round_num: int
    verdict: str    # "PASS" | "BLOCKED"
    counts: str     # "3B 2H 1M 0L 0N"
    action: str     # "fix" | "escalate" | "accept" | "park"
    model: str = "sonnet"


# ── Formatting helpers ──────────────────────────────────────────────


def format_elapsed(secs: float) -> str:
    """Format seconds as M:SS or H:MM:SS."""
    if secs < 0:
        secs = 0
    total = int(secs)
    if total >= 3600:
        h, remainder = divmod(total, 3600)
        m, s = divmod(remainder, 60)
        return f"{h}:{m:02d}:{s:02d}"
    m, s = divmod(total, 60)
    return f"{m}:{s:02d}"


def format_cost(cost: float) -> str:
    """Format cost with color coding (green < $2, yellow < $5, red >= $5)."""
    text = f"${cost:.2f}"
    if not HAS_RICH:
        return text
    if cost >= 5.0:
        return f"[bold red]{text}[/]"
    if cost >= 2.0:
        return f"[yellow]{text}[/]"
    return f"[green]{text}[/]"


# ── Status badge markup ─────────────────────────────────────────────

_STATUS_STYLES: dict[str, tuple[str, str]] = {
    "PASS": ("bold green", "✅ PASS"),
    "DONE": ("bold green", "✅ DONE"),
    "COMPLETE": ("bold green", "✅ COMPLETE"),
    "FAIL": ("bold red", "❌ FAIL"),
    "PARTIAL": ("bold yellow", "⚠️  PARTIAL"),
    "BLOCKED": ("bold red", "🚫 BLOCKED"),
    "RUNNING": ("bold blue", "🔄 RUNNING"),
    "PARKED": ("dim", "⏸  PARKED"),
    "SKIP": ("dim yellow", "⏭  SKIP"),
    "FIX": ("bold yellow", "🔧 FIX"),
    "ESCALATE": ("bold red", "🚨 ESCALATE"),
    "ACCEPT": ("bold green", "✅ ACCEPT"),
    "PARK": ("dim", "⏸  PARK"),
}

_PHASE_ICONS: dict[str, str] = {
    "pending": "○",
    "active": "🔄",
    "done": "✅",
    "failed": "❌",
    "skipped": "⏭",
}

_STORY_ICONS: dict[str, str] = {
    "pending": "○",
    "active": "🔄",
    "done": "✅",
    "failed": "❌",
}


def status_badge(status: str) -> str:
    """Return a Rich-markup string for a status keyword, or plain text."""
    key = status.upper().split(" ")[0]
    if HAS_RICH and key in _STATUS_STYLES:
        style, label = _STATUS_STYLES[key]
        extra = status[len(key):].strip()
        suffix = f" {extra}" if extra else ""
        return f"[{style}]{label}{suffix}[/]"
    return status


# ── Pipeline visualization ──────────────────────────────────────────


def pipeline_bar(phases: list[PhaseStatus], include_times: bool = False) -> str:
    """Build the pipeline bar: ✅ Plan ── 🔄 Build ── ○ Review ── ○ Ship"""
    parts = []
    for p in phases:
        icon = _PHASE_ICONS.get(p.status, "○")
        if include_times and p.status == "done" and p.elapsed_secs > 0:
            parts.append(f"{icon} {p.label} ({format_elapsed(p.elapsed_secs)})")
        else:
            parts.append(f"{icon} {p.label}")
    return " ──── ".join(parts)


def stories_progress_bar(statuses: list[str]) -> str:
    """Build: ✅ ✅ 🔄 ○ ○"""
    return " ".join(_STORY_ICONS.get(s, "○") for s in statuses)


# ── Banners and rules ───────────────────────────────────────────────


def banner(title: str, style: str = "bold magenta") -> None:
    """Print a prominent section header."""
    if HAS_RICH:
        console.print()
        console.print(Panel(title, style=style, expand=True, padding=(0, 2)))
    else:
        print(f"\n{'=' * 60}")
        print(title)
        print(f"{'=' * 60}")


def rule(label: str = "", style: str = "dim") -> None:
    """Print a horizontal rule with optional label."""
    if HAS_RICH:
        console.print(Rule(label, style=style))
    else:
        if label:
            print(f"\n--- {label} ---")
        else:
            print()


# ── Story header ────────────────────────────────────────────────────


def story_header(progress: StoryProgress, stories_status: list[str]) -> None:
    """Print the story start panel with pipeline and multi-story progress."""
    bar = pipeline_bar(progress.phases)
    stories_bar = stories_progress_bar(stories_status)

    if HAS_RICH:
        content = (
            f"  [bold][{progress.index + 1}/{progress.total}][/] "
            f"[bold cyan]{progress.key}[/] — {progress.name}\n"
            f"  {bar}\n"
            f"  Stories: {stories_bar}"
        )
        console.print()
        console.print(Panel(content, style="bold", expand=True, padding=(0, 1)))
    else:
        print(f"\n{'=' * 60}")
        print(f"  [{progress.index + 1}/{progress.total}] {progress.key} — {progress.name}")
        print(f"  {bar}")
        print(f"  Stories: {stories_bar}")
        print(f"{'=' * 60}")


# ── Phase transitions ───────────────────────────────────────────────


def phase_transition_bar(
    progress: StoryProgress, phase: str, detail: str = "", total_cost: float = 0.0,
) -> None:
    """Print a phase separator with updated pipeline bar."""
    bar = pipeline_bar(progress.phases, include_times=True)
    elapsed = format_elapsed(progress.total_elapsed)
    cost_str = f"${total_cost:.2f}"

    phase_obj = progress.get_phase(phase)
    label = phase_obj.label

    if HAS_RICH:
        console.print(Rule(style="bold"))
        console.print(
            f"  {bar}    [dim]⏱ {elapsed}  {format_cost(total_cost)}[/]"
        )
        console.print(Rule(style="bold"))
        suffix = f": {detail}" if detail else ""
        console.print(f"  [bold]{label}{suffix}[/]")
    else:
        print(f"\n{'━' * 60}")
        print(f"  {bar}    ⏱ {elapsed}  {cost_str}")
        print(f"{'━' * 60}")
        suffix = f": {detail}" if detail else ""
        print(f"  {label}{suffix}")


# ── Session spinner ─────────────────────────────────────────────────


def create_spinner(phase_label: str) -> Any:
    """Create a Rich Status spinner. Returns None if Rich unavailable."""
    if HAS_RICH:
        spinner = console.status(f"  {phase_label}...", spinner="dots")
        spinner.start()
        return spinner
    else:
        print(f"  {phase_label}...", end="", flush=True)
        return None


def update_spinner(
    spinner: Any, phase_label: str, elapsed_secs: float, cost: float,
) -> None:
    """Update spinner text with elapsed time and cost."""
    if spinner and HAS_RICH:
        elapsed = format_elapsed(elapsed_secs)
        spinner.update(f"  {phase_label}... {elapsed} elapsed  ${cost:.2f}")


def stop_spinner(spinner: Any) -> None:
    """Stop the spinner cleanly."""
    if spinner and HAS_RICH:
        spinner.stop()
    elif not HAS_RICH:
        print()  # newline after dots


# ── Session complete ────────────────────────────────────────────────


def session_complete(
    phase_label: str, elapsed: float, cost: float, turns: int | None = None,
) -> None:
    """Print a session completion line."""
    elapsed_str = format_elapsed(elapsed)
    turns_str = f"  ({turns} turns)" if turns is not None else ""

    if HAS_RICH:
        console.print(
            f"  [bold green]✅[/] [bold]{phase_label} complete[/] — "
            f"{elapsed_str} elapsed  {format_cost(cost)}{turns_str}"
        )
    else:
        print(f"  ✅ {phase_label} complete — {elapsed_str} elapsed  ${cost:.2f}{turns_str}")


# ── Log line (styled progress) ──────────────────────────────────────


def log_line(line: str) -> None:
    """Print a styled progress line (replacement for log.info in terminal display)."""
    if HAS_RICH:
        console.print(f"  [dim]{line}[/]")
    else:
        print(f"  {line}")


# ── Error panel ─────────────────────────────────────────────────────


def error_panel_ctx(
    story_key: str, story_name: str, phase: str,
    error: str, elapsed: float, cost: float,
) -> None:
    """Print a contextual error panel with story/phase info."""
    elapsed_str = format_elapsed(elapsed)

    if HAS_RICH:
        content = (
            f"  [bold]Story:[/]   {story_key} — {story_name}\n"
            f"  [bold]Phase:[/]   {phase}\n"
            f"  [bold]Error:[/]   {error}\n"
            f"  [bold]Elapsed:[/] {elapsed_str}   [bold]Cost:[/] ${cost:.2f}"
        )
        console.print()
        console.print(Panel(
            content,
            title=f"[bold red]❌ FAILED at {phase.upper()}[/]",
            border_style="red",
            expand=True,
            padding=(0, 2),
        ))
    else:
        print(f"\n{'─' * 60}")
        print(f"  ❌ FAILED at {phase.upper()}")
        print(f"  Story:   {story_key} — {story_name}")
        print(f"  Phase:   {phase}")
        print(f"  Error:   {error}")
        print(f"  Elapsed: {elapsed_str}   Cost: ${cost:.2f}")
        print(f"{'─' * 60}")


# ── Review loop visualization ───────────────────────────────────────


def review_loop_panel(rounds: list[ReviewRoundDisplay]) -> None:
    """Print the review round history table."""
    if not rounds:
        return

    if HAS_RICH:
        table = Table(
            show_edge=False, show_header=False, pad_edge=True,
            padding=(0, 1), expand=False,
        )
        table.add_column("Round", style="bold", no_wrap=True)
        table.add_column("Verdict", no_wrap=True)
        table.add_column("Counts", no_wrap=True)
        table.add_column("Action", no_wrap=True)

        for r in rounds:
            verdict_badge = status_badge(r.verdict)
            action_badge = status_badge(r.action)
            model_tag = f" ({r.model})" if r.action in ("fix", "escalate") else ""
            table.add_row(
                f"R{r.round_num}",
                verdict_badge,
                f"[dim]{r.counts}[/]",
                f"→ {action_badge}{model_tag}",
            )

        console.print()
        console.print(Panel(
            table,
            title="[bold]Review Loop[/]",
            border_style="cyan",
            expand=False,
            padding=(0, 2),
        ))
    else:
        print(f"\n--- Review Loop ---")
        for r in rounds:
            model_tag = f" ({r.model})" if r.action in ("fix", "escalate") else ""
            print(f"  R{r.round_num}  {r.verdict:<8}  {r.counts}  → {r.action.upper()}{model_tag}")
        print()


# ── Tables ──────────────────────────────────────────────────────────


def story_table(results: list[Any], total: int) -> None:
    """Print a progress table of story results."""
    done = sum(1 for r in results if r.success)
    failed = sum(1 for r in results if not r.success and r.phase_reached != "init")
    remaining = total - len(results)

    if HAS_RICH:
        header = Text()
        header.append(f"{done}", style="bold green")
        header.append(" done, ")
        header.append(f"{failed}", style="bold red" if failed else "dim")
        header.append(" failed, ")
        header.append(f"{remaining}", style="bold cyan" if remaining else "dim")
        header.append(" remaining")
        console.print()
        console.print(header)

        table = Table(show_edge=True, pad_edge=True, expand=True)
        table.add_column("Story", style="bold", no_wrap=True)
        table.add_column("Status", no_wrap=True)
        table.add_column("Time", justify="right", no_wrap=True)
        table.add_column("Cost", justify="right", no_wrap=True)
        table.add_column("Plan", justify="right", style="dim", no_wrap=True)
        table.add_column("Build", justify="right", style="dim", no_wrap=True)
        table.add_column("Review", justify="right", style="dim", no_wrap=True)
        table.add_column("Rounds", justify="center", no_wrap=True)
        table.add_column("PR", no_wrap=True)
        table.add_column("Error", style="red", max_width=40)

        for r in results:
            raw_status = "PASS" if r.success else f"FAIL ({r.phase_reached})"
            rounds_str = str(r.review_rounds) if r.review_rounds > 0 else "—"
            table.add_row(
                r.story.key,
                status_badge(raw_status),
                format_elapsed(r.duration_secs),
                f"${r.total_cost_usd:.2f}",
                f"${r.cost_start:.2f}",
                f"${r.cost_implement:.2f}",
                f"${r.cost_review:.2f}",
                rounds_str,
                r.pr_url or "—",
                r.error or "",
            )
        console.print(table)
    else:
        print(f"\n--- Progress: {done} done, {failed} failed, {remaining} remaining ---")
        for r in results:
            status = "PASS" if r.success else f"FAIL ({r.phase_reached})"
            cost = f"${r.total_cost_usd:.2f}"
            duration = format_elapsed(r.duration_secs)
            pr = f" | PR: {r.pr_url}" if r.pr_url else ""
            err = f" | {r.error}" if r.error else ""
            print(f"  {r.story.key}: {status} | {duration} | {cost}{pr}{err}")


# ── Summary panels ──────────────────────────────────────────────────


def summary_panel(title: str, kvs: dict[str, str], style: str = "cyan") -> None:
    """Print a key-value summary in a styled panel."""
    if HAS_RICH:
        lines = "\n".join(f"  [bold]{k}:[/] {v}" for k, v in kvs.items())
        console.print(Panel(lines, title=title, style=style, expand=False, padding=(0, 2)))
    else:
        print(f"\n{title}")
        for k, v in kvs.items():
            print(f"  {k}: {v}")


def final_dashboard(
    results: list[Any], total: int, coordinator_cost: float = 0.0,
) -> None:
    """Print the enhanced final dashboard with per-phase cost breakdown."""
    # Print the story table first
    story_table(results, total)

    # Compute per-phase averages
    completed = [r for r in results if r.success]
    n = len(completed) or 1

    avg_plan = sum(r.cost_start for r in completed) / n
    avg_build = sum(r.cost_implement for r in completed) / n
    avg_review = sum(r.cost_review for r in completed) / n
    # Finish cost = total - plan - build - review
    avg_finish = sum(
        r.total_cost_usd - r.cost_start - r.cost_implement - r.cost_review
        for r in completed
    ) / n

    total_cost = sum(r.total_cost_usd for r in results)
    total_time = sum(r.duration_secs for r in results)
    avg_per_story = total_cost / len(results) if results else 0

    if HAS_RICH:
        cost_breakdown = (
            f"  [bold]Plan:[/] ${avg_plan:.2f} avg  │  "
            f"[bold]Build:[/] ${avg_build:.2f} avg  │  "
            f"[bold]Review:[/] ${avg_review:.2f} avg\n"
            f"  [bold]Finish:[/] ${avg_finish:.2f} avg  │  "
            f"[bold]Coordinator:[/] ${coordinator_cost:.2f} total"
        )
        totals = (
            f"  [bold]Total:[/] {format_cost(total_cost)}  │  "
            f"[bold]Time:[/] {format_elapsed(total_time)}  │  "
            f"[bold]Avg:[/] ${avg_per_story:.2f}/story"
        )
        console.print()
        console.print(Rule("Cost Breakdown", style="dim"))
        console.print(cost_breakdown)
        console.print()
        console.print(Rule(style="dim"))
        console.print(totals)
        console.print()
    else:
        print(f"\n--- Cost Breakdown ---")
        print(f"  Plan: ${avg_plan:.2f} avg  |  Build: ${avg_build:.2f} avg  |  Review: ${avg_review:.2f} avg")
        print(f"  Finish: ${avg_finish:.2f} avg  |  Coordinator: ${coordinator_cost:.2f} total")
        print(f"\n  Total: ${total_cost:.2f}  |  Time: {format_elapsed(total_time)}  |  Avg: ${avg_per_story:.2f}/story")


def findings_panel(title: str, text: str, style: str = "dim") -> None:
    """Print review findings in a bordered panel."""
    if HAS_RICH:
        console.print(Panel(text, title=title, style=style, expand=True, padding=(0, 2)))
    else:
        print(f"\n--- {title} ---")
        print(text)
        print()


# ── Epic finish visualization ───────────────────────────────────────


def epic_finish_panel(
    epic_num: str,
    phases_completed: list[str],
    phases_failed: list[str],
    parallel_groups: list[list[str]] | None = None,
    total_cost: float = 0.0,
    total_elapsed: float = 0.0,
) -> None:
    """Visualize the epic finish phases showing sequential vs parallel."""
    all_phases = phases_completed + phases_failed
    completed_set = set(phases_completed)

    if HAS_RICH:
        lines: list[str] = []
        for phase in all_phases:
            icon = "✅" if phase in completed_set else "❌"
            # Check if this phase is in a parallel group
            in_parallel = False
            if parallel_groups:
                for group in parallel_groups:
                    if phase in group:
                        in_parallel = True
                        break
            tag = "  (parallel)" if in_parallel else ""
            lines.append(f"  {icon} {phase}{tag}")

        lines.append("")
        lines.append(
            f"  [bold]Total:[/] {format_cost(total_cost)}  │  "
            f"[bold]Time:[/] {format_elapsed(total_elapsed)}"
        )

        content = "\n".join(lines)
        console.print()
        console.print(Panel(
            content,
            title=f"[bold magenta]EPIC {epic_num} FINISH[/]",
            border_style="magenta",
            expand=True,
            padding=(0, 2),
        ))
    else:
        print(f"\n--- EPIC {epic_num} FINISH ---")
        for phase in all_phases:
            icon = "✅" if phase in completed_set else "❌"
            print(f"  {icon} {phase}")
        print(f"\n  Total: ${total_cost:.2f}  |  Time: {format_elapsed(total_elapsed)}")


# ── Coordinator / phase output ──────────────────────────────────────


def coordinator_decision(
    action: str, reason: str, strategy: str = "",
    round_num: int | None = None, model: str = "",
) -> None:
    """Print a coordinator decision with colored action."""
    badge = status_badge(action)
    round_tag = f"R{round_num} " if round_num is not None else ""
    model_tag = f" [{model}]" if model else ""

    if HAS_RICH:
        console.print(f"  [bold]COORDINATOR {round_tag}:[/] {badge}{model_tag} — {reason}")
        if strategy:
            console.print(f"  [dim]STRATEGY:[/] {strategy[:200]}")
    else:
        print(f"  COORDINATOR {round_tag}: {action.upper()}{model_tag} — {reason}")
        if strategy:
            print(f"  STRATEGY: {strategy[:200]}")


def phase_header(story_key: str, phase: str, detail: str = "") -> None:
    """Print a colored one-liner for a phase transition."""
    if HAS_RICH:
        suffix = f" — {detail}" if detail else ""
        console.print(f"  [bold cyan]{story_key}[/] [bold]{phase.upper()}[/]{suffix}")
    else:
        suffix = f" — {detail}" if detail else ""
        print(f"  {story_key} {phase.upper()}{suffix}")


# ── Inline helpers ──────────────────────────────────────────────────


def epic_listing(epic_key: str, total: int, done: list[str], pending: list[str]) -> None:
    """Print an epic's story breakdown with colored counts."""
    if HAS_RICH:
        console.print(f"\n📋 [bold]{epic_key}[/]: [cyan]{total}[/] stories total")
        if done:
            console.print(f"   [green]✅ Done ({len(done)}):[/] {', '.join(done)}")
        if pending:
            console.print(f"   [yellow]🔄 Pending ({len(pending)}):[/] {', '.join(pending)}")
        if not pending:
            console.print("   [bold green]All stories complete![/]")
    else:
        print(f"\n📋 Epic {epic_key}: {total} stories total")
        if done:
            print(f"   ✅ Done ({len(done)}): {', '.join(done)}")
        if pending:
            print(f"   🔄 Pending ({len(pending)}): {', '.join(pending)}")
        if not pending:
            print("   All stories complete!")


def cprint(msg: str, style: str = "") -> None:
    """Console print with optional Rich style, or plain print."""
    if HAS_RICH and style:
        console.print(msg, style=style)
    elif HAS_RICH:
        console.print(msg)
    else:
        print(msg)
