#!/usr/bin/env python3
"""
Consolidated Review Report Generator.

Reads agent findings, run state, and gates config to produce
a single severity-triaged markdown report.

Usage:
    python3 scripts/workflow/generate-report.py \
        --findings=.claude/state/review-story/consolidated-findings-E01-S03.json \
        --run-state=.claude/state/review-story/review-run-E01-S03.json \
        --gates-config=.claude/skills/review-story/config/gates.json \
        --output=docs/reviews/consolidated-review-2026-04-09-E01-S03.md

Exit codes:
    0 - Report generated successfully
    2 - Script error (missing/invalid files or arguments)
"""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

# Severity ordering: highest first
SEVERITY_ORDER = ["BLOCKER", "HIGH", "MEDIUM", "LOW", "NIT"]

# Display labels for each severity in the consolidated findings section
SEVERITY_LABELS = {
    "BLOCKER": "Blockers (must fix)",
    "HIGH": "High Priority (should fix)",
    "MEDIUM": "Medium (fix when possible)",
    "LOW": "Low (improve when convenient)",
    "NIT": "Nits (optional)",
}

# Agent display names and section titles
AGENT_SECTIONS = [
    ("design-review", "Design Review", "Report: {}"),
    ("code-review", "Code Review (Architecture)", "Report: {}"),
    ("code-review-testing", "Code Review (Testing)", "Report: {}"),
    ("edge-case-review", "Edge Case Review", "Report: {}"),
    ("performance-benchmark", "Performance Benchmark", "Report: {}"),
    ("security-review", "Security Review", "Report: {}"),
    ("exploratory-qa", "Exploratory QA", "Report: {}"),
    ("openai-code-review", "OpenAI Adversarial Review", "Report: {}"),
    ("glm-code-review", "GLM Adversarial Review", "Report: {}"),
]

# Skip reasons keyed by agent name
DEFAULT_SKIP_REASONS = {
    "design-review": "Skipped -- no UI changes",
    "exploratory-qa": "Skipped -- no UI changes",
    "openai-code-review": "Skipped -- no OPENAI_API_KEY or Codex CLI",
    "glm-code-review": "Skipped -- no ZAI_API_KEY",
}


# ── Logging helpers ──────────────────────────────────────────────────────────


def log_info(msg: str) -> None:
    print(f"\033[0;34m\u2139\033[0m {msg}", file=sys.stderr)


def log_success(msg: str) -> None:
    print(f"\033[0;32m\u2713\033[0m {msg}", file=sys.stderr)


def log_error(msg: str) -> None:
    print(f"\033[0;31m\u2717\033[0m {msg}", file=sys.stderr)


def log_section(msg: str) -> None:
    print(f"\n\033[0;34m\u2501\u2501\u2501 {msg} \u2501\u2501\u2501\033[0m", file=sys.stderr)


# ── File I/O ─────────────────────────────────────────────────────────────────


def load_json(path: Path, description: str) -> dict:
    """Load and parse a JSON file with a clear error message on failure."""
    if not path.exists():
        log_error(f"{description} not found: {path}")
        sys.exit(2)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        log_error(f"Invalid JSON in {description} ({path}): {exc}")
        sys.exit(2)


# ── Formatting helpers ───────────────────────────────────────────────────────


def severity_rank(severity: str) -> int:
    """Return sort rank for a severity string (lower = more severe)."""
    severity_upper = severity.upper()
    for i, s in enumerate(SEVERITY_ORDER):
        if s == severity_upper:
            return i
    # Unknown severity goes after NIT
    return len(SEVERITY_ORDER)


def format_prechecks(precheck_summary: dict) -> str:
    """Format the pre-checks section from the summary dict."""
    if not precheck_summary:
        return "### Pre-checks\n- No pre-check data available\n"

    lines = ["### Pre-checks"]
    fields = [
        ("dependency_audit", "Dependency audit"),
        ("format_check", "Format check"),
        ("lint", "Lint"),
        ("type_check", "Type check"),
        ("build", "Build"),
        ("unit_tests", "Unit tests"),
        ("e2e_tests", "E2E tests"),
    ]
    for key, label in fields:
        value = precheck_summary.get(key, "unknown")
        lines.append(f"- {label}: {value}")
    return "\n".join(lines) + "\n"


def format_agent_summary(agent_key: str, agent_data: dict | None) -> str:
    """Format a single agent's summary line, handling missing/failed/skipped."""
    if agent_data is None:
        return DEFAULT_SKIP_REASONS.get(agent_key, "Not dispatched")

    status = agent_data.get("status", "UNKNOWN")
    counts = agent_data.get("counts", {})
    summary = agent_data.get("summary", "")

    # If the agent provided a summary, use it
    if summary:
        return summary

    # Build a brief summary from counts
    parts = []
    for sev in SEVERITY_ORDER:
        count = counts.get(sev.lower(), 0)
        if count:
            parts.append(f"{count} {sev.lower()}")

    if parts:
        findings_str = ", ".join(parts)
        return f"{status} -- {findings_str}"

    return f"{status}"


def format_agent_section(
    title: str, agent_key: str, agents: dict, base_path: str
) -> str:
    """Format a full agent section (summary + report path)."""
    agent_data = agents.get(agent_key)
    report_path = agent_data.get("report_path", "") if agent_data else ""

    summary = format_agent_summary(agent_key, agent_data)

    lines = [f"### {title}", summary]
    if report_path:
        full_path = f"{base_path}/{report_path}" if base_path else report_path
        lines.append(f"Report: {full_path}")

    return "\n".join(lines) + "\n"


def format_dedup(dedup_result: dict | None) -> str:
    """Format the deduplication scan section."""
    if not dedup_result:
        return "### Deduplication Scan\nSkipped\n"

    action = dedup_result.get("action", "unknown")
    extracted = dedup_result.get("extracted", 0)
    found = dedup_result.get("found", 0)

    if action == "skipped":
        text = "Skipped by user"
    elif extracted > 0:
        text = f"{found} duplicates found, {extracted} extracted"
    elif found > 0:
        text = f"{found} duplicates found, 0 extracted"
    else:
        text = "No duplicates detected"

    return f"### Deduplication Scan\n{text}\n"


def format_consolidated_findings(findings: list) -> str:
    """Format findings grouped and sorted by severity."""
    if not findings:
        return "### Consolidated Findings\n\nNo findings.\n"

    # Group by severity
    groups: dict[str, list[dict]] = {}
    for finding in findings:
        sev = finding.get("severity", "MEDIUM").upper()
        groups.setdefault(sev, []).append(finding)

    # Sort within each group by source, then description
    for sev in groups:
        groups[sev].sort(key=lambda f: (f.get("source", ""), f.get("description", "")))

    lines = ["### Consolidated Findings\n"]

    # Emit groups in severity order
    for sev in SEVERITY_ORDER:
        group = groups.get(sev, [])
        if not group:
            continue
        label = SEVERITY_LABELS.get(sev, sev)
        lines.append(f"#### {label}")
        for f in group:
            source = f.get("source", "unknown")
            description = f.get("description", "(no description)")
            file_ref = f.get("file", "")
            line_ref = f.get("line")
            location = f" ({file_ref}:{line_ref})" if file_ref and line_ref else ""
            consensus = f.get("consensus_score")
            consensus_tag = (
                f" [Consensus: {consensus}]" if consensus and consensus >= 2 else ""
            )
            lines.append(f"- {source}: {description}{location}{consensus_tag}")
        lines.append("")

    return "\n".join(lines) + "\n"


def format_verdict(verdict: str, blocker_count: int) -> str:
    """Format the verdict section."""
    if verdict == "PASS":
        return "### Verdict\nPASS -- ready for /finish-story\n"
    return f"### Verdict\nBLOCKED -- fix {blocker_count} blocker(s) first\n"


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate consolidated review report from findings and run state."
    )
    parser.add_argument(
        "--findings",
        required=True,
        help="Path to consolidated-findings JSON.",
    )
    parser.add_argument(
        "--run-state",
        required=True,
        help="Path to review run state JSON.",
    )
    parser.add_argument(
        "--gates-config",
        required=True,
        help="Path to gates.json config.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output path for the markdown report.",
    )
    args = parser.parse_args()

    findings_path = Path(args.findings)
    run_state_path = Path(args.run_state)
    gates_config_path = Path(args.gates_config)
    output_path = Path(args.output)

    log_section("Report Generation")

    # ── Load inputs ─────────────────────────────────────────────────
    findings_data = load_json(findings_path, "Consolidated findings")
    run_state = load_json(run_state_path, "Run state")
    gates_config = load_json(gates_config_path, "Gates config")

    # ── Extract data ────────────────────────────────────────────────
    story_id = run_state.get("story_id", "E??-S??")
    story_name = run_state.get("story_name", "Unknown Story")
    base_path = run_state.get("base_path", "")
    agents = findings_data.get("agents", {})
    consolidated = findings_data.get("consolidated_findings", [])
    verdict = findings_data.get("verdict", "PASS")
    dedup_result = findings_data.get("dedup_result")
    precheck_summary = findings_data.get("precheck_summary", {})

    # Count blockers for verdict text
    blocker_count = sum(
        1 for f in consolidated if f.get("severity", "").upper() == "BLOCKER"
    )
    # Override verdict if blockers found but verdict doesn't match
    if blocker_count > 0 and verdict != "BLOCKED":
        verdict = "BLOCKED"

    # ── Build report ────────────────────────────────────────────────
    today = date.today().isoformat()
    report_lines: list[str] = []

    # Header
    report_lines.append(f"## Review Summary: {story_id} -- {story_name}")
    report_lines.append(f"Date: {today}\n")

    # Pre-checks
    report_lines.append(format_prechecks(precheck_summary))

    # Agent sections
    for agent_key, section_title, _ in AGENT_SECTIONS:
        report_lines.append(
            format_agent_section(section_title, agent_key, agents, base_path)
        )

    # Dedup scan
    report_lines.append(format_dedup(dedup_result))

    # Consolidated findings
    sorted_findings = sorted(consolidated, key=lambda f: severity_rank(f.get("severity", "MEDIUM")))
    report_lines.append(format_consolidated_findings(sorted_findings))

    # Verdict
    report_lines.append(format_verdict(verdict, blocker_count))

    report_content = "\n".join(report_lines)

    # ── Write output ────────────────────────────────────────────────
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report_content, encoding="utf-8")

    # ── Summary to stderr ───────────────────────────────────────────
    total_findings = len(consolidated)
    high_count = sum(1 for f in consolidated if f.get("severity", "").upper() == "HIGH")
    medium_count = sum(
        1 for f in consolidated if f.get("severity", "").upper() == "MEDIUM"
    )
    nit_count = sum(
        1
        for f in consolidated
        if f.get("severity", "").upper() in ("NIT", "LOW")
    )

    log_info(f"Story: {story_id} -- {story_name}")
    log_info(f"Findings: {blocker_count} blockers, {high_count} high, "
             f"{medium_count} medium, {nit_count} low/nit")
    log_info(f"Verdict: {verdict}")
    log_success(f"Report written to {output_path}")


if __name__ == "__main__":
    main()
