"""
epic_runner_ui.py — Rich-powered terminal UI for epic-runner.py.

Provides colored banners, formatted tables, status badges, and progress
indicators. Gracefully falls back to plain print() if Rich is not installed.
"""

from __future__ import annotations

from typing import Any

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.rule import Rule
    from rich.table import Table
    from rich.text import Text

    HAS_RICH = True
except ImportError:
    HAS_RICH = False

console = Console(highlight=False) if HAS_RICH else None

# ── Status badge markup ──────────────────────────────────────────────

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


def status_badge(status: str) -> str:
    """Return a Rich-markup string for a status keyword, or plain text."""
    key = status.upper().split(" ")[0]  # e.g. "FAIL (review)" → "FAIL"
    if HAS_RICH and key in _STATUS_STYLES:
        style, label = _STATUS_STYLES[key]
        # Append extra info if present (e.g. "(review)")
        extra = status[len(key):].strip()
        suffix = f" {extra}" if extra else ""
        return f"[{style}]{label}{suffix}[/]"
    return status


# ── Banners and rules ────────────────────────────────────────────────


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


# ── Tables ───────────────────────────────────────────────────────────


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
        table.add_column("Duration", justify="right", no_wrap=True)
        table.add_column("Cost", justify="right", style="green", no_wrap=True)
        table.add_column("PR", no_wrap=True)
        table.add_column("Error", style="red", max_width=50)

        for r in results:
            raw_status = "PASS" if r.success else f"FAIL ({r.phase_reached})"
            table.add_row(
                r.story.key,
                status_badge(raw_status),
                f"{r.duration_secs:.0f}s",
                f"${r.total_cost_usd:.2f}",
                r.pr_url or "—",
                r.error or "",
            )
        console.print(table)
    else:
        print(f"\n--- Progress: {done} done, {failed} failed, {remaining} remaining ---")
        for r in results:
            status = "PASS" if r.success else f"FAIL ({r.phase_reached})"
            cost = f"${r.total_cost_usd:.2f}"
            duration = f"{r.duration_secs:.0f}s"
            pr = f" | PR: {r.pr_url}" if r.pr_url else ""
            err = f" | {r.error}" if r.error else ""
            print(f"  {r.story.key}: {status} | {duration} | {cost}{pr}{err}")


# ── Summary panels ───────────────────────────────────────────────────


def summary_panel(title: str, kvs: dict[str, str], style: str = "cyan") -> None:
    """Print a key-value summary in a styled panel."""
    if HAS_RICH:
        lines = "\n".join(f"  [bold]{k}:[/] {v}" for k, v in kvs.items())
        console.print(Panel(lines, title=title, style=style, expand=False, padding=(0, 2)))
    else:
        print(f"\n{title}")
        for k, v in kvs.items():
            print(f"  {k}: {v}")


def findings_panel(title: str, text: str, style: str = "dim") -> None:
    """Print review findings in a bordered panel."""
    if HAS_RICH:
        console.print(Panel(text, title=title, style=style, expand=True, padding=(0, 2)))
    else:
        print(f"\n--- {title} ---")
        print(text)
        print()


# ── Coordinator / phase output ───────────────────────────────────────


def coordinator_decision(action: str, reason: str, strategy: str = "") -> None:
    """Print a coordinator decision with colored action."""
    badge = status_badge(action)
    if HAS_RICH:
        console.print(f"  [bold]COORDINATOR:[/] {badge} — {reason}")
        if strategy:
            console.print(f"  [dim]STRATEGY:[/] {strategy[:200]}")
    else:
        print(f"COORDINATOR: {action.upper()} — {reason}")
        if strategy:
            print(f"STRATEGY: {strategy[:200]}")


def phase_header(story_key: str, phase: str, detail: str = "") -> None:
    """Print a colored one-liner for a phase transition."""
    if HAS_RICH:
        suffix = f" — {detail}" if detail else ""
        console.print(f"  [bold cyan]{story_key}[/] [bold]{phase.upper()}[/]{suffix}")
    else:
        suffix = f" — {detail}" if detail else ""
        print(f"  {story_key} {phase.upper()}{suffix}")


# ── Inline helpers ───────────────────────────────────────────────────


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
