Phase 3B is accepted. That completes the full safe workflow:

```text
Stage 1: convert / normalize
Stage 2: repair metadata by ASIN + Audnexus
Stage 3: repair covers from plan + safe apply
```

The two implementation choices are right:

```text
Magic bytes > URL extension
shutil.move() > os.rename() for cross-filesystem safety
```

## Next step: final integration pass

Before adding new features, ask Claude Code to do a final integration/readiness pass.

```markdown
All phases are accepted.

Do a final integration/readiness pass only.

Do not add new features.

## Goals

1. Confirm the full workflow is documented:
   - conversion
   - add/find ASIN
   - repair metadata
   - repair covers

2. Confirm commands are discoverable in SKILL.md and README.md.

3. Confirm config.example.yaml includes all final sections:
   - server
   - paths
   - guards
   - qbit
   - tools
   - audio_policy
   - chapter_policy
   - metadata_priority
   - publish
   - quarantine
   - cover_repair

4. Confirm no old forbidden behavior remains:
   - no `/mnt/cache` default workspace
   - no `/books?title=...&author=...`
   - no Audnexus in conversion
   - no forced 64k/mono defaults
   - no required embedded cover for Stage 1
   - no metadata.json written by default

5. Run full test suite and report:
   - test files
   - test counts
   - failures, if any

6. Produce a final operator guide:
   - first-time setup
   - config migration
   - health check
   - scan qBit
   - process manual folder
   - status/logs
   - add ASIN
   - repair metadata plan/apply
   - repair covers plan/apply
   - quarantine sweep
   - troubleshooting

7. Produce a final release checklist.

## Output format

# Final Integration Audit

# Commands

# Config

# Full Workflow

# Safety Guarantees

# Test Results

# Operator Guide

# Release Checklist

# Remaining Limitations
```

## After that, run one real “happy path” on Titan

Use one small book and test:

```text
1. Convert
2. Add ASIN
3. repair-metadata
4. repair-metadata --apply
5. repair-covers
6. repair-covers --apply
7. Check Audiobookshelf folder
```

That will prove the whole chain works end to end.
