---
title: Audiobook M4B Pipeline — Non-Obvious Implementation Lessons
date: 2026-04-24
module: audiobook-m4b
tags: [shell, m4b-tool, ffmpeg, python, audnex, audiobookshelf, titan]
problem_type: integration_issue
category: integration-issues
related_pr: https://github.com/PedroLages/knowlune/pull/418
related_plan: docs/plans/2026-04-24-001-audiobook-m4b-bugfixes-plan.md
branch: feature/ce-2026-04-24-audiobook-m4b-bugfixes
---

# Audiobook M4B Pipeline — Non-Obvious Implementation Lessons

Seven traps encountered while hardening the audiobook-m4b conversion pipeline (merge → retag → verify → publish → sweep). Each is counter-intuitive and cost a debugging cycle to find.

## Context

The pipeline runs on a remote box (`titan`) and composes several shell scripts plus Python helpers. It converts loose MP3/FLAC/WAV/M4A folders into verified chaptered `.m4b` files in an Audiobookshelf library. The issues below surfaced during PR #418 bugfix work and are not obvious from the code.

## Guidance

### 1. `publish_to_library.sh` reads `output_path` from manifest — write it BEFORE any exit path

The publisher reads `output_path` from the job manifest immediately and fails hard if the key is absent. Any caller script that might exit early (validation failure, verify retry, cleanup branch) must write `output_path` into the manifest *as soon as the `.m4b` is produced*, not at the end of the success path.

```bash
# WRONG — output_path written only on success
run_merge && run_verify && write_manifest "$OUT" && publish

# RIGHT — persist output_path as soon as the artifact exists
run_merge
write_manifest_field output_path "$OUT"   # <-- before verify, before any early exit
run_verify
publish
```

### 2. Post-merge `m4b-tool` retag must set `--name`, `--artist`, `--album` — not just `--genre`

`verify_output` checks all four metadata fields (name, artist, album, genre). A retag step that only supplies `--genre` leaves the other three as whatever `m4b-tool merge` inferred from the first input file, which routinely disagrees with the manifest. Verify then fails with a misleading "metadata mismatch" on fields you never intended to change.

```bash
m4b-tool meta "$OUT" \
  --name="$TITLE" --artist="$AUTHOR" --album="$TITLE" --genre="$GENRE"
```

### 3. Duration tolerance in verify must scale with `file_count`

Fixed 2-second tolerance works for 5–20 part sources but fails on 100+ part audiobooks because each concat boundary introduces a fractional rounding error that accumulates.

```python
tolerance_s = max(2.0, 0.05 * file_count)  # 50ms per boundary
```

### 4. Helper scripts must self-source `load_config.sh`

`sweep_quarantine.sh` (and any similar helper) runs as a subprocess — it does **not** inherit env vars from the parent shell that sourced `load_config.sh`. Each standalone script must source it explicitly at the top.

```bash
#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/load_config.sh"   # required: we're a subprocess
```

### 5. `find -type f` silently skips symlinks — use `find -L -type f`

When staging candidates with `ln -sf`, `find -type f` walks the staging dir and finds nothing because the entries are symlinks. No error, just an empty result that quietly breaks the pipeline.

```bash
# WRONG
find "$STAGE" -type f -name '*.mp3'

# RIGHT — follow symlinks
find -L "$STAGE" -type f -name '*.mp3'
```

### 6. Python `X | Y` union type hints require 3.10+

Titan's Python version is not pinned. Scripts using PEP 604 union syntax (`str | None`) crash on 3.9 with `TypeError: unsupported operand type(s) for |`. Use `Optional[X]` from `typing`, or default-to-`None` parameters without annotation, for anything that might run on titan.

```python
# WRONG on Python 3.9
def find_cover(path: str | None = None) -> bytes | None: ...

# RIGHT
from typing import Optional
def find_cover(path: Optional[str] = None) -> Optional[bytes]: ...
```

### 7. Audnex `series` field is a dict, not a string

Audnex returns `series` as `{"name": "Foundation", "position": "1"}`, not `"Foundation"`. Using it directly as a path component yields `"{'name': 'Foundation', 'position': '1'}"` in the filesystem. Always `isinstance`-check.

```python
series = meta.get("series")
if isinstance(series, dict):
    series_name = series.get("name", "")
elif isinstance(series, str):
    series_name = series
else:
    series_name = ""
```

## Why This Matters

Each of these failure modes passes silently or produces a misleading error far from the root cause. Documenting them up front saves the next pipeline change from burning a debug cycle per trap.

## When to Apply

- Modifying any script under the audiobook-m4b pipeline (merge, verify, publish, sweep)
- Adding a new helper script invoked as a subprocess
- Integrating new metadata sources (Audnex, Audible, MusicBrainz) that may return structured values
- Running Python scripts on titan where the runtime version is not guaranteed

## References

- PR: https://github.com/PedroLages/knowlune/pull/418
- Plan: [docs/plans/2026-04-24-001-audiobook-m4b-bugfixes-plan.md](../../plans/2026-04-24-001-audiobook-m4b-bugfixes-plan.md)
- Related memory note: `feedback_audiobook_conversion.md` (bitrate matching, verify, folder+cover structure)
