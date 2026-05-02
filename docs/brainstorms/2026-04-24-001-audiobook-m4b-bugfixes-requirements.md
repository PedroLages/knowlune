# audiobook-m4b Skill — 7 Bug Fixes

## Problem
The audiobook-m4b Claude Code skill pipeline has 7 diagnosed bugs that break end-to-end conversion and publishing: missing manifest updates, incomplete retag metadata, overly tight verify tolerances, missing config sourcing, no slot-wait throttling, series dict-stringification, and symlink-blind probing. Together these cause conversion runs to fail at relocate, verify, publish, or probe stages, producing empty metadata and malformed library paths.

## Requirements

### BUG-1 — relocate_m4b.sh never writes output_path to manifest
**Root cause:** relocate_m4b.sh exits after verify succeeds but doesn't update output_path in the manifest JSON before calling publish_to_library.sh, which reads output_path and fails immediately with "output_path missing or not a file: None".
**Fix:** After workspace copy is verified in relocate_m4b.sh, write output_path to the manifest JSON before invoking publish_to_library.sh.
**Files:** ~/.claude/skills/audiobook-m4b/scripts/relocate_m4b.sh

### BUG-2 — Post-merge retag omits title/artist/album from fallback metadata
**Root cause:** The post-merge auto-retag in run_m4b_tool.sh (on titan) only runs `m4b-tool meta --genre=Audiobook`. When Audnex returns no match, fallback_metadata.title/author exist in the manifest but are not passed to the retag command, leaving title/artist/album empty and causing verify to fail.
**Fix:** Pass --name, --artist, --album from audnex or fallback_metadata in the retag step.
**Files:** ~/.claude/skills/audiobook-m4b/scripts/remote/run_m4b_tool.sh

### BUG-3 — Duration verify tolerance too tight for multi-part merges
**Root cause:** The 2s tolerance in verify_output.sh was designed for single-file remux. Multi-part m4b concatenation (e.g. 106 parts) accumulates boundary rounding that legitimately exceeds 2s without losing audio content.
**Fix:** For multi-file sources (file_count > 1), use proportional tolerance: max(2.0, file_count * 0.5) capped at 600s. Keep 2s for single-file sources.
**Files:** ~/.claude/skills/audiobook-m4b/scripts/verify_output.sh

### BUG-4 — sweep_quarantine.sh fails without pre-sourced config
**Root cause:** sweep_quarantine.sh uses $QUARANTINE_ROOT but doesn't source load_config.sh internally. Fails with "QUARANTINE_ROOT not set" when invoked as a subprocess.
**Fix:** Add `source "$(dirname "$0")/load_config.sh"` at the top of sweep_quarantine.sh, guarded: only if QUARANTINE_ROOT is unset.
**Files:** ~/.claude/skills/audiobook-m4b/scripts/sweep_quarantine.sh

### BUG-5 — convert_on_titan.sh has no built-in slot-wait for --parallel throttling
**Root cause:** convert_on_titan.sh exits code 3 immediately when --parallel slots are full. No built-in retry. Callers must implement their own polling loop.
**Fix:** Add --wait-for-slot MINUTES flag that polls every 30s until a slot opens (analogous to existing --wait-for-load). Default 0 = exit immediately (preserves current behavior).
**Files:** ~/.claude/skills/audiobook-m4b/scripts/convert_on_titan.sh

### BUG-6 — Series field dict-stringification in path sanitization
**Root cause:** Audnex returns series as a dict {name, position} not a string. sanitize() calls str() on it, producing paths like "{'name': 'X', 'position': '1'}/Title/Title.m4b".
**Fix:** In publish_to_library.sh and any other path-building code, extract series_name = series['name'] if isinstance(series, dict) else series.
**Files:** ~/.claude/skills/audiobook-m4b/scripts/publish_to_library.sh, ~/.claude/skills/audiobook-m4b/scripts/convert_on_titan.sh

### BUG-7 — probe_folder.sh uses find -type f which doesn't follow symlinks
**Root cause:** find -type f skips symlinks. Single-file candidates staged via ln -sf are invisible to the probe, returning null results.
**Fix:** Change find -type f to find -L -type f in probe_folder.sh to follow symlinks. Also document that ln (hardlink) is preferred over ln -s for staging.
**Files:** ~/.claude/skills/audiobook-m4b/scripts/remote/probe_folder.sh

## Acceptance Criteria
- [ ] All 7 scripts are modified per their fix descriptions
- [ ] No regressions to existing passing tests in ~/.claude/skills/audiobook-m4b/tests/
- [ ] sweep_quarantine.sh works when called standalone (without pre-sourced env)
- [ ] convert_on_titan.sh --wait-for-slot 5 polls and dispatches when slot opens
- [ ] relocate_m4b.sh sets output_path in manifest before calling publish_to_library.sh
- [ ] verify_output.sh uses proportional tolerance for multi-file sources
- [ ] probe_folder.sh follows symlinks via find -L

## Out of Scope
- Rewriting the pipeline architecture
- Adding new pipeline stages
- Changing the manifest schema
- Modifying existing test fixtures
