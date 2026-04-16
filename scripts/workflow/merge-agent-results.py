#!/usr/bin/env python3
"""
Merge Agent Results for review-story workflow.

Reads all agent JSON outputs, deduplicates findings by file:line proximity,
applies confidence-boost consensus scoring, and produces consolidated findings.

Usage:
    python3 scripts/workflow/merge-agent-results.py \
        --agent-results-dir=.claude/state/review-story/agent-results/ \
        --output=.claude/state/review-story/consolidated-findings-E01-S03.json
"""

import json
import sys
import argparse
from pathlib import Path
from collections import defaultdict


def parse_args():
    parser = argparse.ArgumentParser(description='Merge agent review results')
    parser.add_argument('--agent-results-dir', required=True, help='Directory containing agent JSON outputs')
    parser.add_argument('--run-state', help='Optional: run state JSON for story_id')
    parser.add_argument('--output', required=True, help='Output path for consolidated findings')
    return parser.parse_args()


def load_json_files(directory):
    """Load all JSON files from a directory."""
    results = {}
    path = Path(directory)
    if not path.exists():
        return results
    
    for file_path in path.glob('*.json'):
        try:
            with open(file_path, 'r') as f:
                results[file_path.name] = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Warning: Failed to parse {file_path.name}: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Warning: Failed to read {file_path.name}: {e}", file=sys.stderr)
    
    return results


def get_agent_architecture(agent_name):
    """Map agent name to architecture type."""
    claude_agents = {'code-review', 'design-review', 'security-review', 'code-review-testing', 
                     'exploratory-qa', 'performance-benchmark'}
    if agent_name in claude_agents:
        return 'claude'
    elif agent_name == 'openai-code-review':
        return 'openai'
    elif agent_name == 'glm-code-review':
        return 'glm'
    else:
        return 'unknown'


def severity_rank(severity):
    """Convert severity string to numeric rank for sorting."""
    ranks = {'BLOCKER': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3, 'NIT': 4, 'INFO': 5}
    return ranks.get(severity, 99)


def deduplicate_findings(all_findings):
    """
    Deduplicate findings by file:line proximity (5-line window).
    Returns list of representative findings with consensus tracking.
    """
    # Group findings by file
    by_file = defaultdict(list)
    for finding in all_findings:
        key = finding.get('file', 'unknown')
        by_file[key].append(finding)
    
    # Find duplicates within 5-line window
    processed = []
    used_lines = set()
    
    for file_path, findings in by_file.items():
        # Sort by line number
        findings.sort(key=lambda f: f.get('line') or 0)
        
        for finding in findings:
            line = finding.get('line')
            if line is None:
                processed.append(finding)
                continue
            
            # Check if this line is already used
            key = (file_path, line)
            if key in used_lines:
                continue
            
            # Find nearby findings (within 5 lines)
            nearby = [f for f in findings
                     if abs((f.get('line') or 0) - line) <= 5]
            
            # Merge nearby findings into consensus
            if len(nearby) > 1:
                # Keep highest severity as representative
                nearby.sort(key=lambda f: severity_rank(f.get('severity', 'INFO')))
                representative = nearby[0]
                
                # Track all sources
                sources = [{'agent': f.get('agent'), 'confidence': f.get('confidence', 80)} 
                          for f in nearby]
                representative['consensus_sources'] = sources
                representative['consensus_count'] = len(sources)
                
                # Mark all lines as used
                for f in nearby:
                    used_lines.add((file_path, f.get('line', 0)))
                
                processed.append(representative)
            else:
                processed.append(finding)
                used_lines.add(key)
    
    return processed


def apply_consensus_scoring(findings):
    """Apply confidence-boost consensus scoring."""
    for finding in findings:
        sources = finding.get('consensus_sources', [])
        if not sources:
            finding['consensus_score'] = finding.get('confidence', 80)
            continue
        
        # Start with base confidence
        base_confidence = max(s.get('confidence', 80) for s in sources)
        consensus_score = base_confidence
        
        # Count unique architectures
        architectures = set(get_agent_architecture(s['agent']) for s in sources)
        
        # Apply boosts
        if len(sources) >= 2:
            consensus_score += 20
        if len(sources) >= 3:
            consensus_score += 20  # Total +40 for 3+
        if len(architectures) > 1:
            consensus_score += 10  # Cross-architecture bonus
        
        finding['consensus_score'] = min(consensus_score, 100)
        
        # Build consensus tag
        agent_names = [s['agent'] for s in sources]
        finding['consensus_tag'] = f"Consensus: {len(sources)} — {' + '.join(agent_names)}"


def filter_low_confidence(findings, threshold=60):
    """
    Filter findings below confidence threshold.
    Returns (kept, filtered_count).
    """
    kept = []
    filtered = 0
    for f in findings:
        confidence = f.get('confidence', 80)
        consensus = f.get('consensus_score', confidence)
        # Use consensus_score if available (it includes cross-agent boost),
        # otherwise fall back to raw confidence
        effective = consensus if consensus != confidence else confidence
        if effective >= threshold:
            kept.append(f)
        else:
            filtered += 1
    return kept, filtered


def merge_results(agent_outputs):
    """Merge all agent outputs into consolidated findings."""
    all_findings = []
    agents = {}

    # Collect all findings from all agents
    for filename, output in agent_outputs.items():
        agent = output.get('agent', filename)
        agents[agent] = output

        for finding in output.get('findings', []):
            finding['agent'] = agent
            all_findings.append(finding)

    # Deduplicate and apply consensus
    deduped = deduplicate_findings(all_findings)
    apply_consensus_scoring(deduped)

    # Filter low-confidence findings (below 60)
    deduped, filtered_count = filter_low_confidence(deduped, threshold=60)
    if filtered_count > 0:
        print(f"  Filtered: {filtered_count} low-confidence findings (below 60)", file=sys.stderr)

    # Sort by severity, then by consensus score
    deduped.sort(key=lambda f: (severity_rank(f.get('severity', 'INFO')), -f.get('consensus_score', 0)))
    
    # Determine verdict
    blockers = sum(1 for f in deduped if f.get('severity') == 'BLOCKER')
    verdict = 'BLOCKED' if blockers > 0 else 'PASS'
    
    # Build summary
    summary = {
        'total': len(deduped),
        'blockers': sum(1 for f in deduped if f.get('severity') == 'BLOCKER'),
        'high': sum(1 for f in deduped if f.get('severity') == 'HIGH'),
        'medium': sum(1 for f in deduped if f.get('severity') == 'MEDIUM'),
        'nits': sum(1 for f in deduped if f.get('severity') in ('NIT', 'LOW'))
    }
    
    return {
        'agents': agents,
        'consolidated_findings': deduped,
        'verdict': verdict,
        'summary': summary,
        'consensus_count': sum(1 for f in deduped if f.get('consensus_count', 0) > 1),
        'filtered_low_confidence': filtered_count
    }


def main():
    args = parse_args()
    
    # Load agent outputs
    agent_outputs = load_json_files(args.agent_results_dir)
    
    if not agent_outputs:
        # No outputs - return empty PASS result
        result = {
            'agents': {},
            'consolidated_findings': [],
            'verdict': 'PASS',
            'summary': {'total': 0, 'blockers': 0, 'high': 0, 'medium': 0, 'nits': 0},
            'consensus_count': 0
        }
    else:
        result = merge_results(agent_outputs)
    
    # Write output
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2)
    
    # Human-readable summary
    print(f"✓ Merged {len(result['agents'])} agent outputs", file=sys.stderr)
    print(f"  Verdict: {result['verdict']}", file=sys.stderr)
    print(f"  Findings: {result['summary']['total']} total ({result['summary']['blockers']} blockers, {result['summary']['high']} high)", file=sys.stderr)
    if result['consensus_count'] > 0:
        print(f"  Consensus: {result['consensus_count']} findings with multiple sources", file=sys.stderr)
    
    # Output result to stdout
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
