# audiobook-m4b Skill — 7 Bug Fixes Implementation Plan

**Plan date:** 2026-04-24
**Requirements:** [2026-04-24-001-audiobook-m4b-bugfixes-requirements.md](../brainstorms/2026-04-24-001-audiobook-m4b-bugfixes-requirements.md)
**Skill location:** `~/.claude/skills/audiobook-m4b/`

## Context

The audiobook-m4b Claude Code skill is a shell + Python pipeline that converts loose audiobook folders into verified `.m4b` files published into the Audiobookshelf library on titan. Seven diagnosed bugs break the pipeline end-to-end at the relocate, retag, verify, sweep, dispatch, publish, and probe stages. This plan scopes each fix to the minimal diff on the relevant existing script — no architectural changes, no new files, no schema changes.

**Scope guardrails:**
- Shell + Python only; no npm/vite/TypeScript in play.
- Edits target existing scripts; we do not restructure modules.
- No changes to manifest schema (requirements AC).
- No changes to existing test fixtures (requirements AC).

**Files targeted (6 of 7 listed in requirements — see BUG-6 for why `convert_on_titan.sh` is excluded):**

1. `scripts/relocate_m4b.sh` (BUG-1)
2. `scripts/remote/run_m4b_tool.sh` (BUG-2)
3. `scripts/verify_output.sh` (BUG-3)
4. `scripts/sweep_quarantine.sh` (BUG-4)
5. `scripts/convert_on_titan.sh` (BUG-5 only — not BUG-6)
6. `scripts/publish_to_library.sh` (BUG-6)
7. `scripts/remote/probe_folder.sh` (BUG-7)

---

## BUG-1 — `relocate_m4b.sh` never persists `output_path` on the retag-failure path

**File:** `~/.claude/skills/audiobook-m4b/scripts/relocate_m4b.sh`

**Committed diagnosis (single root cause):**

`set_fields "output_path=$OUT_M4B"` at **line 301** is the ONLY place where `output_path` gets written to the manifest. It runs AFTER the retag block (lines 241-297). The retag block can bail out via `fail_manifest "retag (m4b-tool meta) failed: …" 2` at **line 293**, which invokes `fail_manifest` (lines 102-107) — this sets `state=failed` and `error=…` but NEVER sets `output_path`. Since the manifest produced by `convert_on_titan.sh` (lines 455-486) does NOT initialize an `output_path` key at all, it stays absent; when `publish_to_library.sh` later reads it via `manifest.get("output_path")` (line 57), it returns `None` → the observed `output_path missing or not a file: None` error.

Additionally, even on the happy path, there is a smaller risk window: if verify (line 306) fails, the script exits 1 *after* `set_fields` already wrote `output_path` — that is acceptable (state=failed is set by verify, and publish should not run). But if a human retries publish manually, `output_path` points at a workspace file that verify may have moved to `failed/`. That is out of scope for this fix (manifest already says `state=failed`; the dispatcher won't publish).

**Root cause in one line:** `set_fields "output_path=…"` must run **before any exit path** that could leave the manifest in a state where a downstream consumer (publish, a retry, a human) sees no `output_path`.

**Exact line edit:**

Move `set_fields "output_path=$OUT_M4B"` from **line 301** to **immediately after line 237** (after the `log "workspace copy: $OUT_M4B"` line), and remove the existing call + its comment header at lines 299-301.

**Before — lines 237-311 (verbatim):**
```bash
log "workspace copy: $OUT_M4B"

# --- Retag if not acceptable -----------------------------------------------

if [[ "$ACCEPTABLE" != "True" ]]; then
  # ... ~60 lines of retag logic that may call fail_manifest on line 293 ...
fi

# --- Update manifest with output_path --------------------------------------

set_fields "output_path=$OUT_M4B"

# --- Verify ---------------------------------------------------------------

if [[ "${ABM4B_SKIP_VERIFY:-0}" != "1" ]]; then
  if ! bash "$SCRIPT_DIR/verify_output.sh" "$OUT_M4B" "$MANIFEST"; then
    echo "relocate: verify failed — see manifest" >&2
    exit 1
  fi
fi
```

**After — lines 237-311:**
```bash
log "workspace copy: $OUT_M4B"

# Persist output_path IMMEDIATELY after the workspace copy succeeds — BEFORE
# the retag block, which can bail via fail_manifest on m4b-tool error (exit 2)
# without ever reaching the previous write site. publish_to_library.sh reads
# output_path via manifest.get('output_path'); if the key is absent, it prints
# "output_path missing or not a file: None" and exits 2.
# The workspace m4b path is stable across retag — m4b-tool `meta` mutates the
# file in place, so OUT_M4B remains valid whether or not retag succeeds.
set_fields "output_path=$OUT_M4B"

# --- Retag if not acceptable -----------------------------------------------

if [[ "$ACCEPTABLE" != "True" ]]; then
  # ... retag block UNCHANGED ...
fi

# --- Verify ---------------------------------------------------------------
# (previous set_fields + comment block at old lines 299-301 removed — already
#  written above.)

if [[ "${ABM4B_SKIP_VERIFY:-0}" != "1" ]]; then
  if ! bash "$SCRIPT_DIR/verify_output.sh" "$OUT_M4B" "$MANIFEST"; then
    echo "relocate: verify failed — see manifest" >&2
    exit 1
  fi
fi
```

**Exact diff summary:**
- **Delete** lines 299-301 (`# --- Update manifest with output_path ---…` header, blank line, and `set_fields "output_path=$OUT_M4B"`).
- **Insert** after line 237 (after `log "workspace copy: $OUT_M4B"`): a blank line, an 8-line comment explaining why this happens early, and the moved `set_fields "output_path=$OUT_M4B"` call.

No other edits in this file.

---

## BUG-2 — Post-merge retag omits title/artist/album from fallback metadata

**File:** `~/.claude/skills/audiobook-m4b/scripts/remote/run_m4b_tool.sh`

**Current behavior (lines 185-219):** The post-merge retag only passes `--genre=Audiobook`. When audnex lookup failed earlier, the merged m4b's title/artist/album are whatever m4b-tool inferred from source filenames (often garbage). `verify_output.sh` line 152 rejects missing title/artist/album.

**Fix:** Build META_ARGS with `--name`, `--artist`, `--album` populated from audnex (preferred) or `fallback_metadata` (fallback). Read these values via the existing `read_field` helper. If both audnex and fallback_metadata lack title/author, fall back to NOT passing those flags (preserves current behavior — still passes genre-only, and verify will fail cleanly as today).

**Before (lines 192-200):**
```bash
META_ARGS=(
  run --rm
  -u "$(id -u):$(id -g)"
  -v "$WORKSPACE:/output"
  sandreas/m4b-tool:latest
  meta "/output/${SLUG}.m4b"
  "--genre=Audiobook"
)
```

**After:**
```bash
# Read metadata for retag — prefer audnex, fall back to fallback_metadata.
# These feed into verify_output.sh's title/artist/album check. Without them,
# m4b-tool merge inherits whatever the first source MP3 had, which fails verify.
RETAG_TITLE="$(read_field audnex.title)"
[[ -z "$RETAG_TITLE" ]] && RETAG_TITLE="$(read_field fallback_metadata.title)"
RETAG_AUTHOR="$(read_field audnex.author)"
[[ -z "$RETAG_AUTHOR" ]] && RETAG_AUTHOR="$(read_field fallback_metadata.author)"
RETAG_YEAR="$(read_field audnex.year)"
[[ -z "$RETAG_YEAR" ]] && RETAG_YEAR="$(read_field fallback_metadata.year)"

META_ARGS=(
  run --rm
  -u "$(id -u):$(id -g)"
  -v "$WORKSPACE:/output"
  sandreas/m4b-tool:latest
  meta "/output/${SLUG}.m4b"
  "--genre=Audiobook"
)
[[ -n "$RETAG_TITLE"  ]] && META_ARGS+=("--name=$RETAG_TITLE" "--album=$RETAG_TITLE")
[[ -n "$RETAG_AUTHOR" ]] && META_ARGS+=("--artist=$RETAG_AUTHOR")
[[ -n "$RETAG_YEAR"   ]] && META_ARGS+=("--year=$RETAG_YEAR")
```

**Note:** `read_field` helper is defined at lines 72-74 and reads top-level keys only via `m.get('$1')`. For nested `audnex.title`, we need to either extend read_field to support dotted paths or inline a small python call. The cleanest minimal diff is to extend read_field once to handle dotted paths (same pattern as `relocate_m4b.sh` lines 63-81):

**read_field helper extension (lines 72-74):**
```bash
read_field() {
  python3 - "$MANIFEST" "$1" <<'PYEOF'
import json, sys
m = json.load(open(sys.argv[1]))
keys = sys.argv[2].split(".")
cur = m
for k in keys:
    if isinstance(cur, dict) and k in cur:
        cur = cur[k]
    else:
        cur = None
        break
print('' if cur is None else cur)
PYEOF
}
```

This matches the `relocate_m4b.sh:63-81` pattern exactly. Existing callers that pass top-level keys (`source_path`, `source_bitrate`, etc.) continue to work because single-key splits are still handled.

---

## BUG-3 — Duration verify tolerance too tight for multi-part merges

**File:** `~/.claude/skills/audiobook-m4b/scripts/verify_output.sh`

**Current behavior (lines 162-172):** Hardcoded 2.0s tolerance for all conversions. A 106-part merge accumulates boundary rounding well beyond 2s.

**Fix:** Compute tolerance as `max(2.0, file_count * 0.5)` capped at 600.0s, where `file_count` comes from manifest `candidate.files` or falls back to 1. Single-file sources keep the 2.0s tight check.

**Before (lines 162-172 in embedded python, inside the `check` heredoc):**
```python
# 4. Duration within 2.0s
out_duration = None
try:
    out_duration = float(fmt.get("duration"))
except (TypeError, ValueError):
    pass
if expected_duration is None or out_duration is None:
    check("duration", False, f"expected={expected_duration} actual={out_duration}")
else:
    diff = abs(out_duration - float(expected_duration))
    check("duration", diff <= 2.0, f"expected={expected_duration} actual={out_duration} diff={diff:.3f}s")
```

**After:**
```python
# 4. Duration within tolerance. Tolerance is proportional to source file count:
#    single-file remux → 2.0s; multi-part merge (N>1) → max(2.0, N*0.5), capped at 600s.
#    Boundary rounding in m4b-tool concat accumulates ~0.3–0.5s per part; 2s
#    was too tight for large concats (106-part merges legitimately exceed it).
out_duration = None
try:
    out_duration = float(fmt.get("duration"))
except (TypeError, ValueError):
    pass

# Derive source file count from manifest. Prefer candidate.files (probe output);
# fall back to 1 when the field is absent.
candidate = manifest.get("candidate") or {}
files = candidate.get("files") or []
file_count = len(files) if isinstance(files, list) else 1
if file_count < 1:
    file_count = 1
duration_tolerance = max(2.0, file_count * 0.5)
if duration_tolerance > 600.0:
    duration_tolerance = 600.0

if expected_duration is None or out_duration is None:
    check("duration", False, f"expected={expected_duration} actual={out_duration}")
else:
    diff = abs(out_duration - float(expected_duration))
    check(
        "duration",
        diff <= duration_tolerance,
        f"expected={expected_duration} actual={out_duration} diff={diff:.3f}s tolerance={duration_tolerance:.1f}s file_count={file_count}",
    )
```

**Schema note:** `candidate.files` is populated by `probe_sources.sh`/`convert_on_titan.sh` when the candidate is a folder with multiple audio files. On RELOCATE path (single m4b), `files` is absent or length 1 — tolerance stays at 2.0s.

---

## BUG-4 — `sweep_quarantine.sh` fails without pre-sourced config

**File:** `~/.claude/skills/audiobook-m4b/scripts/sweep_quarantine.sh`

**Current behavior:** Script reads `$QUARANTINE_ROOT` at line 36 but never sources `load_config.sh`. When invoked standalone as a subprocess (e.g. from a cron wrapper), fails with "QUARANTINE_ROOT not set".

**Fix:** Add guarded `source load_config.sh` near the top — only if `QUARANTINE_ROOT` is unset (preserves test override behavior where tests set env vars directly).

**Before (lines 15-17):**
```bash
set -uo pipefail

DRY_RUN=0
LOCAL=0
```

**After:**
```bash
set -uo pipefail

# Load config only if QUARANTINE_ROOT not already set. Preserves test override
# pattern (tests set env vars directly and do not need load_config.sh). Mirrors
# the guard used in publish_to_library.sh:37-40.
if [[ -z "${QUARANTINE_ROOT:-}" ]]; then
  SCRIPT_DIR_SQ="$(cd "$(dirname "$0")" && pwd)"
  # shellcheck disable=SC1091
  [[ -f "$SCRIPT_DIR_SQ/load_config.sh" ]] && source "$SCRIPT_DIR_SQ/load_config.sh"
fi

DRY_RUN=0
LOCAL=0
```

**Variable name choice:** Use `SCRIPT_DIR_SQ` (not `SCRIPT_DIR`) to avoid shadowing if load_config.sh uses that name internally.

---

## BUG-5 — `convert_on_titan.sh` has no built-in slot-wait

**File:** `~/.claude/skills/audiobook-m4b/scripts/convert_on_titan.sh`

**Current behavior (lines 38-50, 212-223):** Parses `--parallel` and `--wait-for-load` but has no `--wait-for-slot`. When `RUNNING >= PARALLEL`, exits code 3 immediately.

**Fix:** Add `--wait-for-slot MINUTES` flag. Default 0 preserves current exit-3 behavior. When set, poll every 30s (same interval as load-wait) until `count_running < PARALLEL` or deadline expires.

### Deadlock analysis (critic BLOCKER 2)

**Question:** Does the slot-wait loop deadlock because `count_running` already includes this job's own manifest?

**Answer: No deadlock.** Line-number evidence:

1. **Slot check runs at lines 212-223** — this is BEFORE any manifest is written.
2. **First manifest write is at line 544** (`scp -q "$manifest_tmp" "$SSH_HOST:$JOB_MANIFEST_DIR/$JOBID.json"`) for the production path, or line 503 (`cp "$manifest_tmp" "$ABM4B_LOCAL_MANIFEST_DIR/$JOBID.json"`) for the test path. Both happen **~300+ lines after** the slot-wait check.
3. **Manifest's initial state is `"state": "queued"`** (line 457 in the python manifest builder at lines 424-488), NOT `"running"`.
4. **`count_running`** (lines 170-185) matches only files containing `"state": "running"` — so even if a manifest for this job existed at check time (it doesn't), it would be `queued` and not counted.
5. **State transitions to `"running"`** only after the tmux-launched `run_m4b_tool.sh` picks up the manifest on titan — that is a *downstream* event, well after convert_on_titan.sh has exited.

**Conclusion:** `count_running` at the moment of the slot-wait check does NOT include the current job. Polling `count_running < PARALLEL` is safe; no self-exclusion logic is needed. The loop is correct as designed.

### Change 1 — arg parsing (lines 37-50)

**Before:**
```bash
FORCE_FLAG=0
MAX_LOAD=""
WAIT_FOR_LOAD_MIN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --candidate) CANDIDATE_FILE="$2"; shift 2 ;;
    --parallel)  PARALLEL="$2"; shift 2 ;;
    --force)     FORCE_FLAG=1; shift ;;
    --max-load)  MAX_LOAD="$2"; shift 2 ;;
    --wait-for-load) WAIT_FOR_LOAD_MIN="$2"; shift 2 ;;
    -h|--help)
      sed -n '1,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "❌ unknown arg: $1" >&2; exit 64 ;;
  esac
done
```

**After:**
```bash
FORCE_FLAG=0
MAX_LOAD=""
WAIT_FOR_LOAD_MIN=0
WAIT_FOR_SLOT_MIN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --candidate) CANDIDATE_FILE="$2"; shift 2 ;;
    --parallel)  PARALLEL="$2"; shift 2 ;;
    --force)     FORCE_FLAG=1; shift ;;
    --max-load)  MAX_LOAD="$2"; shift 2 ;;
    --wait-for-load) WAIT_FOR_LOAD_MIN="$2"; shift 2 ;;
    --wait-for-slot) WAIT_FOR_SLOT_MIN="$2"; shift 2 ;;
    -h|--help)
      sed -n '1,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "❌ unknown arg: $1" >&2; exit 64 ;;
  esac
done
```

### Change 2 — slot-wait loop (replacing lines 212-223)

**Before:**
```bash
RUNNING="$(count_running)"
RUNNING="${RUNNING//[^0-9]/}"
RUNNING="${RUNNING:-0}"

# Effective capacity = --parallel; we claim one slot. Block if RUNNING >= PARALLEL.
if (( RUNNING >= PARALLEL )); then
  cat >&2 <<EOF
❌ another conversion is in flight ($RUNNING running, --parallel=$PARALLEL).
   Wait for it to finish, or re-run with a higher --parallel N to allow concurrency.
EOF
  exit 3
fi
```

**After:**
```bash
# Slot-wait loop. Default (WAIT_FOR_SLOT_MIN=0) preserves legacy exit-3 behavior.
# With --wait-for-slot N, poll every 30s (configurable via ABM4B_SLOT_POLL_SECONDS
# for tests) until a slot opens or the N-minute deadline expires.
#
# Correctness note: count_running counts manifests with state="running" in
# JOB_MANIFEST_DIR. This job has NOT written its manifest yet (writes happen at
# lines ~503/544, well after this block), AND its initial state is "queued"
# (line ~457 in the manifest builder) — not "running". So count_running never
# includes this job; no self-exclusion filtering is required.
slot_poll_seconds="${ABM4B_SLOT_POLL_SECONDS:-30}"
slot_deadline=$(( $(date +%s) + WAIT_FOR_SLOT_MIN * 60 ))

while true; do
  RUNNING="$(count_running)"
  RUNNING="${RUNNING//[^0-9]/}"
  RUNNING="${RUNNING:-0}"
  if (( RUNNING < PARALLEL )); then
    break
  fi
  if (( WAIT_FOR_SLOT_MIN <= 0 )) || (( $(date +%s) >= slot_deadline )); then
    cat >&2 <<EOF
❌ another conversion is in flight ($RUNNING running, --parallel=$PARALLEL).
   Wait for it to finish, re-run with higher --parallel N, or pass --wait-for-slot MINUTES.
EOF
    exit 3
  fi
  waited_s=$(( $(date +%s) - (slot_deadline - WAIT_FOR_SLOT_MIN * 60) ))
  echo "[slot] $RUNNING running, --parallel=$PARALLEL, waited=${waited_s}s — sleeping ${slot_poll_seconds}s" >&2
  sleep "$slot_poll_seconds"
done
```

### Change 3 — usage comment (lines 4-7)

Add `--wait-for-slot` to the usage block near the top of the file.

---

## BUG-6 — Series field dict-stringification in path sanitization

**File:** `~/.claude/skills/audiobook-m4b/scripts/publish_to_library.sh` (ONLY this one file)

### Scope narrowing (critic BLOCKERS 3 + 4)

Requirements list both `publish_to_library.sh` and `convert_on_titan.sh` as targets for BUG-6. **Evidence-based scope reduction:**

**`convert_on_titan.sh` — removed from BUG-6 scope.** Verified by reading lines 424-488 (the full manifest builder) and the rest of the file. The only `audnex` reads are:
- Line 431: `audnex = cand.get("audnex") or {}` (pass-through assignment)
- Line 445: `audnex.get("title")` (used for slug fallback only — never series)
- Line 447: `audnex.get("chapters")` / `audnex.get("chapters_ms")` (booleans only)
- Line 448: `audnex.get("cover_url")` (boolean check)
- Line 449: `audnex.get("asin")` (string only)
- Line 475: `"audnex": audnex or None` (pass-through stored in manifest)

**`audnex.series` is never read, stringified, or used to build a path in `convert_on_titan.sh`.** The audnex payload is stored as-is into `manifest["audnex"]` and `manifest["candidate"]["audnex"]`; neither is consumed here — only `publish_to_library.sh` dereferences `audnex.series` downstream. No fix needed in `convert_on_titan.sh` for BUG-6.

**`publish_to_library.sh` — already-correct isinstance check, needs a comment only.** Verified by reading lines 70-72:
```python
series = ""
if audnex.get("series"):
    series = (audnex["series"].get("name") or "").strip() if isinstance(audnex["series"], dict) else str(audnex["series"]).strip()
```
This already handles both the `dict` shape (`{"name": "Foo", "position": "1"}`) and the bare-string shape correctly. No behavioral edit is needed. The fix is **documentation-only**: add a one-line invariant comment so a future reader doesn't "simplify" the isinstance check into a naked `str(audnex["series"])` and regress the bug.

### Exact edit — publish_to_library.sh lines 70-72

**Before:**
```python
series = ""
if audnex.get("series"):
    series = (audnex["series"].get("name") or "").strip() if isinstance(audnex["series"], dict) else str(audnex["series"]).strip()
```

**After:**
```python
# Invariant: audnex.series may be a dict {name, position} OR a bare string.
# Both shapes appear in real audnex payloads — DO NOT simplify this to
# `str(audnex["series"])`, which would yield "{'name': 'Foo', ...}" as a
# path segment and poison the library tree. Both branches are exercised by
# tests; keep the isinstance check.
series = ""
if audnex.get("series"):
    series = (audnex["series"].get("name") or "").strip() if isinstance(audnex["series"], dict) else str(audnex["series"]).strip()
```

No other edit. `convert_on_titan.sh` is not touched for BUG-6.

### AC update (critic BLOCKER 4 — AC-traceability)

**Original requirement language:** "all 7 scripts modified".

**Updated AC:** "6 of 7 scripts modified; `convert_on_titan.sh` excluded from BUG-6 scope because it does not read `audnex.series` (verified by reading lines 424-488). `convert_on_titan.sh` is still modified for BUG-5 (slot-wait), so its diff is non-empty across the epic — just not for BUG-6."

**Scripts modified per bug:**

| Bug   | Scripts modified                                  |
|-------|---------------------------------------------------|
| BUG-1 | `scripts/relocate_m4b.sh`                         |
| BUG-2 | `scripts/remote/run_m4b_tool.sh`                  |
| BUG-3 | `scripts/verify_output.sh`                        |
| BUG-4 | `scripts/sweep_quarantine.sh`                     |
| BUG-5 | `scripts/convert_on_titan.sh`                     |
| BUG-6 | `scripts/publish_to_library.sh` (ONLY)            |
| BUG-7 | `scripts/remote/probe_folder.sh`                  |

**Total: 7 scripts modified across the epic, with BUG-6 limited to 1 file.** This matches the spirit of the original "all 7 scripts modified" AC while being precise about per-bug scope.

---

## BUG-7 — `probe_folder.sh` uses `find -type f` (doesn't follow symlinks)

**File:** `~/.claude/skills/audiobook-m4b/scripts/remote/probe_folder.sh`

**Current behavior (lines 40-46):**
```bash
mapfile -d '' -t audio_files < <(
  find "$folder" -maxdepth 2 -type f \
    \( -iname '*.mp3' -o -iname '*.m4a' -o -iname '*.m4b' \
       -o -iname '*.flac' -o -iname '*.wav' -o -iname '*.ogg' \
       -o -iname '*.opus' -o -iname '*.aac' \) \
    -print0 | sort -zV
)
```

**Fix:** Add `-L` to follow symlinks. Also add a brief usage comment about `ln` vs `ln -s` for staging.

**After:**
```bash
# Use `find -L` so symlinked audio files (e.g. single-file candidates staged
# via `ln -s`) are discovered. Hardlinks (`ln`) are preferred for staging —
# they share inodes and avoid broken-link risk — but symlinks must still work.
mapfile -d '' -t audio_files < <(
  find -L "$folder" -maxdepth 2 -type f \
    \( -iname '*.mp3' -o -iname '*.m4a' -o -iname '*.m4b' \
       -o -iname '*.flac' -o -iname '*.wav' -o -iname '*.ogg' \
       -o -iname '*.opus' -o -iname '*.aac' \) \
    -print0 | sort -zV
)
```

**Note on `$folder` existence check (lines 20-22):** `[ ! -e "$folder" ]` already follows symlinks (unlike `[ -f ]`/`[ -d ]`). No change needed there.

---

## Verification Plan

### Automated tests

Run the existing skill test suite after each fix. Tests live in `~/.claude/skills/audiobook-m4b/tests/`:

```bash
cd ~/.claude/skills/audiobook-m4b
bash tests/run_all.sh     # or whichever runner exists; fall back to individual specs
```

Expected touched test files (per bug):

| Bug | Test specs most relevant |
|-----|--------------------------|
| BUG-1 | `tests/test_relocate_m4b.sh` (if present) — add a case that asserts `output_path` is set EVEN WHEN retag fails (manifest has state=failed AND output_path populated) |
| BUG-2 | `tests/test_run_m4b_tool.sh` — add assertion on META_ARGS containing `--name=`, `--artist=` |
| BUG-3 | `tests/test_verify_output.sh` — add multi-file fixture (file_count=100) with 50s diff |
| BUG-4 | `tests/test_sweep_quarantine.sh` — invoke with unset QUARANTINE_ROOT and expect config load |
| BUG-5 | `tests/test_convert_dispatch.sh` — add `--wait-for-slot 1` with `ABM4B_SLOT_POLL_SECONDS=1` test |
| BUG-6 | Existing publish tests already cover series-as-dict; reconfirm green (comment-only change, so behavior unchanged) |
| BUG-7 | `tests/test_probe_folder.sh` — stage a symlink and assert it appears in probe output |

If a test file doesn't exist for a given bug, do **not** add one unless it's a trivial extension of an adjacent existing test (requirements AC: "No regressions to existing passing tests"). Manual verification covers gaps.

### Manual verification

For each fix, the following smoke checks:

**BUG-1 (happy path):**
```bash
# After RELOCATE path runs, inspect the manifest:
jq '.output_path, .state' $JOB_MANIFEST_DIR/<jobid>.json
# Expect: "/tmp/audiobook-m4b/<jobid>/workspace/<file>.m4b" and "succeeded"
```

**BUG-1 (retag-failure path — the path that motivated the fix):**
```bash
# Force retag failure (e.g. pass a mocked docker that exits 1):
ABM4B_DOCKER=/path/to/failing-mock bash relocate_m4b.sh $MANIFEST
# Expect exit 2, and:
jq '.output_path, .state, .error' $MANIFEST
# output_path is populated (workspace path), state=failed, error=retag...
# Previously: output_path was missing/None.
```

**BUG-2:** On a titan run with no audnex match but fallback_metadata populated, post-merge m4b tags:
```bash
ffprobe -show_format /output/audiobook.m4b 2>&1 | grep -E 'title|artist|album'
# Expect all three non-empty
```

**BUG-3:** Run a 100-part merge:
```bash
# verify block in manifest should show tolerance=50.0s
jq '.verify.checks.duration.detail' $JOB_MANIFEST_DIR/<jobid>.json
```

**BUG-4:**
```bash
unset QUARANTINE_ROOT JOB_MANIFEST_DIR
bash ~/.claude/skills/audiobook-m4b/scripts/sweep_quarantine.sh --dry-run --local
# Expect: non-error exit, config loaded from skill's config file
```

**BUG-5:**
```bash
# With 1 job already running at --parallel=1:
ABM4B_SLOT_POLL_SECONDS=1 bash convert_on_titan.sh --candidate c.json --parallel 1 --wait-for-slot 1
# Expect: polls, prints "[slot] ..." message, then either dispatches or exits 3 after ~60s
```

**BUG-6:** Simulate audnex series as dict:
```bash
# Stage a manifest where audnex.series = {"name": "Foo", "position": "1"}
bash publish_to_library.sh /tmp/test-manifest.json
# Expect target path contains "/Foo/<title>/" not "/{'name': 'Foo'...}/"
# (This already works; test confirms no regression from comment-only edit.)
```

**BUG-7:**
```bash
# On titan, stage a symlink to an mp3:
ln -s /path/to/real.mp3 /tmp/test-folder/book.mp3
bash ~/.claude/skills/audiobook-m4b/scripts/remote/probe_folder.sh /tmp/test-folder
# Expect: JSONL includes a kind:"file_result" line for book.mp3
```

### Regression check

After all fixes land, run the full skill test suite twice (back-to-back) and confirm zero new failures. Also run one real end-to-end conversion on titan against a known-good multi-part mp3 source:
```bash
bash ~/.claude/skills/audiobook-m4b/scripts/convert_on_titan.sh --candidate known-good.json
# Poll until state=quarantined. Manifest should have:
#   - output_path populated (BUG-1)
#   - verify.checks.metadata_tags.passed=true (BUG-2)
#   - verify.checks.duration.passed=true with sensible tolerance (BUG-3)
#   - target_path under Library/<Author>/<Series>/<Title>/<Title>.m4b (BUG-6)
```

---

## Implementation Order

Recommended sequencing (independent fixes; order chosen for risk minimization):

1. **BUG-7** (probe_folder.sh): single-char diff, lowest risk, unblocks BUG-staging tests.
2. **BUG-4** (sweep_quarantine.sh): isolated, unblocks standalone sweep testing.
3. **BUG-6** (publish_to_library.sh): comment-only; confirms invariant is documented.
4. **BUG-3** (verify_output.sh): embedded python edit, moderate risk; add fixture.
5. **BUG-1** (relocate_m4b.sh): move one `set_fields` call earlier; verify ordering via retag-failure test.
6. **BUG-2** (run_m4b_tool.sh): extend `read_field`, add META_ARGS; re-test retag path.
7. **BUG-5** (convert_on_titan.sh): new flag + polling loop, highest surface area.

Each fix lands as its own commit with the format:
```
fix(audiobook-m4b): <one-line summary per bug>
```

No new files. No schema changes. No test-fixture changes. All edits local to the scripts listed above.

---

## Files NOT Touched

- `docs/**` (no doc updates required; requirements is the spec)
- `tests/` fixtures (requirements AC)
- Manifest JSON schema (requirements AC)
- `load_config.sh` (already exists; BUG-4 just sources it)
- Any `src/` in the Knowlune React app (the skill is orthogonal)
- `convert_on_titan.sh` FOR BUG-6 (see scope narrowing above — this file IS edited for BUG-5, just not for BUG-6)

---

## Risks & Open Questions

1. **BUG-1 retag-failure reproduction.** Committed root cause is that `fail_manifest` at line 293 exits before the `set_fields "output_path=…"` at line 301 runs. The fix moves that write to before retag. Verification requires simulating retag failure (mocked `ABM4B_DOCKER` that exits non-zero) and asserting the manifest has `output_path` populated AND `state=failed`. If a real-world manifest with `output_path: None` cannot be reproduced via this path, re-investigate whether a DIFFERENT call site (e.g. an older relocate_m4b.sh shipped to titan) is the one running in production — run `md5sum` on the titan-side copy versus the local copy before assuming the fix lands.
2. **BUG-3 depends on `manifest.candidate.files`** being populated. If `probe_sources.sh` emits a different shape, we need to adjust the file-count derivation. Plan to grep the codebase during implementation to confirm.
3. **BUG-5's polling loop** inside a shell script means the script holds the shell session for up to N minutes. Callers that pipe this into other commands should wrap with `timeout` if needed — documented in the usage comment. Deadlock risk addressed in the Deadlock Analysis subsection above (no self-exclusion needed — state is `queued`, not `running`, and manifest is not written until well after the check).
4. **BUG-6 is documentation-only** in publish_to_library.sh; no behavioral change. `convert_on_titan.sh` is confirmed out of BUG-6 scope by reading lines 424-488 — series is never touched there.
