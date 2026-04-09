#!/usr/bin/env python3
"""
Gate Validator for review-story workflow.

Validates that all required gates are present (base name or -skipped variant)
in the review run state. Returns JSON with validation results.

Usage:
    python3 scripts/workflow/validate-gates.py \
        --gates-config=.claude/skills/review-story/config/gates.json \
        --run-state=.claude/state/review-story/review-run-E01-S03.json

Output (JSON to stdout):
    {
        "valid": true/false,
        "missing_gates": ["gate-name", ...],
        "present_gates": ["gate-name", ...],
        "can_mark_reviewed": true/false,
        "gate_details": {
            "build": {"present": true, "status": "passed", "required": true},
            ...
        }
    }
"""

import json
import sys
import argparse
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description='Validate review gates against config')
    parser.add_argument('--gates-config', required=True, help='Path to gates.json')
    parser.add_argument('--run-state', required=True, help='Path to review run state JSON')
    return parser.parse_args()


def load_json(path):
    """Load JSON file, returning None if not found."""
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def validate_gates(gates_config, run_state):
    """
    Validate that all required gates are present in run state.

    Returns:
        dict: Validation results with validity, missing gates, and details
    """
    # Extract required gates and legacy gates from config
    required_gates = set(gates_config.get('required_for_reviewed_true', []))
    legacy_gates = set(gates_config.get('legacy_gates', []))

    # Build gate map: gate name -> skip suffix (if any)
    gate_skip_map = {}
    for gate in gates_config.get('gates', []):
        name = gate['name']
        skip_suffix = gate.get('skip_suffix')
        if skip_suffix:
            gate_skip_map[name] = skip_suffix

    # Get passed gates from run state
    passed_gates = set(run_state.get('gates_passed_list', []))

    # Remove legacy gates from passed_gates for validation (backward compat)
    passed_gates = passed_gates - legacy_gates

    # Check each required gate
    missing = []
    present = []
    gate_details = {}

    for gate_name in required_gates:
        skip_variant = gate_skip_map.get(gate_name)
        is_present = False
        status = "missing"

        # Check if base name is present
        if gate_name in passed_gates:
            is_present = True
            status = "passed"
        # Check if skipped variant is present
        elif skip_variant and skip_variant in passed_gates:
            is_present = True
            status = "skipped"

        gate_details[gate_name] = {
            "present": is_present,
            "status": status,
            "required": True
        }

        if is_present:
            present.append(gate_name)
        else:
            missing.append(gate_name)

    valid = len(missing) == 0
    can_mark_reviewed = valid

    return {
        "valid": valid,
        "missing_gates": sorted(missing),
        "present_gates": sorted(present),
        "can_mark_reviewed": can_mark_reviewed,
        "gate_details": gate_details
    }


def main():
    args = parse_args()

    # Load gates config
    gates_config = load_json(args.gates_config)
    if gates_config is None:
        print(json.dumps({
            "error": f"Gates config not found: {args.gates_config}",
            "valid": False,
            "missing_gates": [],
            "present_gates": []
        }))
        sys.exit(1)

    # Load run state
    run_state = load_json(args.run_state)
    if run_state is None:
        print(json.dumps({
            "error": f"Run state not found: {args.run_state}",
            "valid": False,
            "missing_gates": [],
            "present_gates": []
        }))
        sys.exit(1)

    # Validate gates
    result = validate_gates(gates_config, run_state)

    # Output JSON to stdout
    print(json.dumps(result, indent=2))

    # Human-readable summary to stderr
    if result['valid']:
        print(f"✓ All required gates present ({len(result['present_gates'])}/{len(result['present_gates'])})", file=sys.stderr)
    else:
        print(f"✗ Missing gates: {', '.join(result['missing_gates'])}", file=sys.stderr)

    # Exit with appropriate code
    sys.exit(0 if result['valid'] else 1)


if __name__ == '__main__':
    main()
