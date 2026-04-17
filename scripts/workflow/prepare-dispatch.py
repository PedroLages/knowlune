#!/usr/bin/env python3
"""
Dispatch Manifest Builder
Reads gates.json, evaluates skip logic, and produces a JSON manifest that the
orchestrator (SKILL.md) uses to issue Task calls for review agents.

This script is a PURE manifest builder — no side effects, no state mutation.
All file I/O (dev server check, bundle generation) is delegated back to the
orchestrator or to ensure-dev-server.sh.

Usage:
    python3 scripts/workflow/prepare-dispatch.py
        --story-id=E01-S03
        --base-path=PATH
        --has-ui-changes=true|false
        --infra-file-count=N  (SQL/migration files in diff; default 0)
        --review-scope=full|lightweight
        --gates-already-passed=build,lint,code-review
        --gates-config=.claude/skills/review-story/config/gates.json

Stdout contract:
    JSON dispatch manifest (see Output JSON below)
    All informational messages → stderr

Output JSON fields:
    bundle_path          - Expected path where make-review-bundle.sh writes the bundle
    agents               - Array of agent dispatch descriptors
    dispatch_count       - Number of agents to dispatch
    skip_count           - Number of agents being skipped
    dev_server_needed    - true if any dispatched agent requires the dev server
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import date

def parse_gate_list(raw: str) -> list[str]:
    """Parse comma-separated gate list (handles empty string and whitespace)."""
    if not raw:
        return []
    return [g.strip() for g in raw.split(",") if g.strip()]

def report_path_for_gate(gate: dict, story_id: str, base_path: str) -> str | None:
    """Resolve a gate's report_path_template to an absolute path."""
    template = gate.get("report_path_template")
    if not template:
        return None
    today = date.today().isoformat()
    story_id_lower = story_id.lower()
    path = template.replace("{date}", today).replace("{story-id}", story_id_lower)
    return os.path.join(base_path, path)

def output_json_path_for_gate(gate: dict, story_id: str, base_path: str) -> str:
    """Resolve where the agent should write its structured JSON result."""
    gate_name = gate["name"]
    story_id_upper = story_id.upper()
    rel = f".claude/state/review-story/agent-results/{gate_name}-{story_id_upper}.json"
    return os.path.join(base_path, rel)

def evaluate_skip(
    gate: dict,
    has_ui_changes: bool,
    has_infra_changes: bool,
    review_scope: str,
    gates_already_passed: list[str],
    resuming: bool,
) -> tuple[bool, str | None]:
    """
    Decide whether to skip a gate. Returns (should_skip, skip_reason).

    Skip if:
    1. Resuming AND gate already in gates_already_passed AND report file exists
    2. skip_condition evaluates to true for the current context
    """
    name = gate["name"]
    skip_suffix = gate.get("skip_suffix")
    skip_condition = gate.get("skip_condition") or ""

    # Resumption skip: gate already done in this run (base name OR -skipped variant)
    if resuming and (
        name in gates_already_passed
        or (skip_suffix and skip_suffix in gates_already_passed)
    ):
        return True, "already completed in current run (resuming)"

    # Condition-based skip
    if "no files matching src/app/(pages|components)/*.tsx in diff" in skip_condition:
        if not has_ui_changes:
            return True, "no UI changes detected"

    if "no infra files in diff" in skip_condition:
        if not has_infra_changes:
            return True, "no infra/migration files detected"

    if "lightweight review" in skip_condition:
        if review_scope == "lightweight":
            return True, "lightweight review scope"

    # External gate: skip if env var missing (checked separately in orchestrator)
    # We don't check env vars here — orchestrator passes --gates-already-passed
    # with skip variants already recorded.

    return False, None

def main() -> None:
    parser = argparse.ArgumentParser(description="Build agent dispatch manifest")
    parser.add_argument("--story-id", required=True)
    parser.add_argument("--base-path", required=True)
    parser.add_argument("--has-ui-changes", required=True, choices=["true", "false"])
    parser.add_argument("--infra-file-count", default="0")
    parser.add_argument("--review-scope", default="full", choices=["full", "lightweight"])
    parser.add_argument("--gates-already-passed", default="")
    parser.add_argument("--resuming", default="false", choices=["true", "false"])
    parser.add_argument("--gates-config", required=True)
    args = parser.parse_args()

    story_id = args.story_id.upper()
    base_path = args.base_path
    has_ui_changes = args.has_ui_changes == "true"
    try:
        has_infra_changes = int(args.infra_file_count) > 0
    except ValueError:
        has_infra_changes = False
    review_scope = args.review_scope
    gates_already_passed = parse_gate_list(args.gates_already_passed)
    resuming = args.resuming == "true"

    # Load gates config
    gates_config_path = os.path.join(base_path, args.gates_config)
    if not os.path.exists(gates_config_path):
        gates_config_path = args.gates_config  # try as absolute
    with open(gates_config_path) as f:
        config = json.load(f)

    agent_gates = [g for g in config["gates"] if g["phase"] in ("agent", "external")]

    # Resolve bundle path (make-review-bundle.sh writes here by default)
    story_id_upper = story_id.upper()
    bundle_path = os.path.join(
        base_path,
        f".claude/state/review-story/review-bundle-{story_id_upper}.json"
    )

    agents = []
    dev_server_needed = False
    dispatch_count = 0
    skip_count = 0

    for gate in agent_gates:
        name = gate["name"]
        agent_name = gate.get("agent") or name
        report_path = report_path_for_gate(gate, story_id, base_path)
        output_json = output_json_path_for_gate(gate, story_id, base_path)

        should_skip, skip_reason = evaluate_skip(
            gate, has_ui_changes, has_infra_changes, review_scope,
            gates_already_passed, resuming
        )

        if not should_skip:
            dispatch_count += 1
            if gate.get("dev_server_required"):
                dev_server_needed = True
        else:
            skip_count += 1

        agents.append({
            "gate": name,
            "agent": agent_name,
            "dispatch": not should_skip,
            "skip_reason": skip_reason,
            "report_path": report_path,
            "output_json_path": output_json,
            "dev_server_required": gate.get("dev_server_required", False),
        })

    manifest = {
        "bundle_path": bundle_path,
        "agents": agents,
        "dispatch_count": dispatch_count,
        "skip_count": skip_count,
        "dev_server_needed": dev_server_needed,
    }

    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
