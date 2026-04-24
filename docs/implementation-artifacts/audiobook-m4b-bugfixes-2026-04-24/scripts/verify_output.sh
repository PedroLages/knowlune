#!/usr/bin/env bash
# verify_output.sh — run verification gauntlet on a converted .m4b file.
#
# Usage:
#   bash verify_output.sh <output.m4b> <manifest.json>
#
# Runs ffprobe inside the sandreas/m4b-tool Docker image (entrypoint override)
# and compares against manifest.json's expected values. Updates manifest with
# state=succeeded|failed and a verify sub-object.
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed
#   2 — internal error (missing file, bad JSON, ffprobe crash)
#
# Environment overrides (optional):
#   ABM4B_FFPROBE   — path to a local ffprobe binary to use instead of Docker
#                     (used by tests with a mock wrapper)
#   ABM4B_DEBUG=1   — verbose stderr logging

set -uo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: verify_output.sh <output.m4b> <manifest.json>" >&2
  exit 2
fi

OUTPUT="$1"
MANIFEST="$2"

log() { [[ "${ABM4B_DEBUG:-0}" == "1" ]] && echo "[verify] $*" >&2 || true; }

# --- Basic preconditions ---------------------------------------------------

if [[ ! -f "$MANIFEST" ]]; then
  echo "❌ verify: manifest not found: $MANIFEST" >&2
  exit 2
fi

if ! python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$MANIFEST" 2>/dev/null; then
  echo "❌ verify: manifest is not valid JSON: $MANIFEST" >&2
  exit 2
fi

JOBID="$(python3 -c "import json,sys; m=json.load(open(sys.argv[1])); print(m.get('jobid') or m.get('job_id') or 'unknown')" "$MANIFEST")"
MANIFEST_DIR="$(cd "$(dirname "$MANIFEST")" && pwd)"

# --- Run ffprobe -----------------------------------------------------------

probe_json_file="$(mktemp -t audiobook-m4b-probe.XXXXXX.json)"
trap 'rm -f "$probe_json_file"' EXIT

run_ffprobe() {
  local target="$1"
  if [[ -n "${ABM4B_FFPROBE:-}" ]]; then
    "$ABM4B_FFPROBE" -v error -print_format json -show_format -show_streams -show_chapters "$target"
  else
    # Use the m4b-tool image, override entrypoint to ffprobe. Mount output's
    # directory read-only.
    local dir base
    dir="$(cd "$(dirname "$target")" && pwd)"
    base="$(basename "$target")"
    docker run --rm \
      --entrypoint ffprobe \
      -v "$dir:/in:ro" \
      "${FFPROBE_IMAGE:-jrottenberg/ffmpeg:latest}" \
      -v error -print_format json -show_format -show_streams -show_chapters "/in/$base"
  fi
}

# File-exists check happens inside the Python logic too, but short-circuit
# here so ffprobe doesn't get confused.
if [[ ! -f "$OUTPUT" ]]; then
  log "output missing: $OUTPUT"
  # Still run the Python to write the failure manifest consistently.
  : > "$probe_json_file"
else
  if ! run_ffprobe "$OUTPUT" > "$probe_json_file" 2> "${probe_json_file}.err"; then
    log "ffprobe failed: $(cat "${probe_json_file}.err" 2>/dev/null || true)"
    : > "$probe_json_file"
  fi
fi

# --- Evaluate checks (Python — argv, no stdin heredoc pipe trap) -----------

checker="$(mktemp -t audiobook-m4b-verify.XXXXXX.py)"
trap 'rm -f "$probe_json_file" "${probe_json_file}.err" "$checker"' EXIT

cat >"$checker" <<'PYEOF'
import json, os, shutil, sys
from datetime import datetime, timezone

output_path, manifest_path, probe_path, jobid = sys.argv[1:5]

with open(manifest_path, "r") as f:
    manifest = json.load(f)

# Expected values — accept a few schema variants ("source_bitrate" top-level
# OR nested under "source").
src = manifest.get("source") or {}
expected_bitrate = manifest.get("source_bitrate") or src.get("bit_rate") or src.get("bitrate")
expected_samplerate = manifest.get("source_samplerate") or src.get("sample_rate") or src.get("samplerate")
expected_duration = manifest.get("source_duration") or src.get("total_duration") or src.get("duration")
_emc = manifest.get("expected_min_chapters")
expected_min_chapters = int(_emc) if _emc is not None else 1

checks = {}
reasons = []

def check(name, passed, detail=None):
    checks[name] = {"passed": bool(passed)}
    if detail is not None:
        checks[name]["detail"] = detail
    if not passed:
        reasons.append(f"{name}: {detail}" if detail else name)

# 1. File exists & size > 0
if not os.path.isfile(output_path):
    check("file_exists", False, "output file missing")
    size = 0
else:
    size = os.path.getsize(output_path)
    check("file_exists", size > 0, f"size={size}")

# Load probe JSON (may be empty on earlier failure)
probe = {}
if os.path.getsize(probe_path) > 0:
    try:
        with open(probe_path) as pf:
            probe = json.load(pf)
    except json.JSONDecodeError as e:
        check("ffprobe_parse", False, f"invalid JSON: {e}")
else:
    check("ffprobe_parse", False, "empty ffprobe output")

streams = probe.get("streams", [])
fmt = probe.get("format", {}) or {}
tags = {k.lower(): v for k, v in (fmt.get("tags") or {}).items()}
chapters = probe.get("chapters", [])

audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
video_streams = [s for s in streams if s.get("codec_type") == "video"]

# 2. Exactly one audio stream; video (cover) is optional (0 or 1).
check(
    "streams",
    len(audio_streams) == 1 and len(video_streams) <= 1,
    f"audio={len(audio_streams)} video={len(video_streams)}",
)

# 3. Metadata tags
missing_tags = [t for t in ("title", "artist", "album") if not (tags.get(t) or "").strip()]
genre = (tags.get("genre") or "").lower()
# m4b-tool writes "Audio Book" (with space); accept both variants.
genre_ok = "audiobook" in genre or "audio book" in genre
check(
    "metadata_tags",
    not missing_tags and genre_ok,
    f"missing={missing_tags} genre={tags.get('genre')!r}",
)

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

# 5. Chapter count
check(
    "chapter_count",
    len(chapters) >= expected_min_chapters,
    f"count={len(chapters)} min={expected_min_chapters}",
)

# 6. Bitrate within 5%
out_bitrate = None
if audio_streams:
    try:
        out_bitrate = int(audio_streams[0].get("bit_rate") or fmt.get("bit_rate") or 0) or None
    except (TypeError, ValueError):
        pass
if expected_bitrate is None or not out_bitrate:
    check("bitrate", False, f"expected={expected_bitrate} actual={out_bitrate}")
else:
    rel = abs(out_bitrate - int(expected_bitrate)) / float(expected_bitrate)
    check("bitrate", rel <= 0.05, f"expected={expected_bitrate} actual={out_bitrate} rel_diff={rel:.3f}")

# 7. Sample rate exact
out_samplerate = None
if audio_streams:
    try:
        out_samplerate = int(audio_streams[0].get("sample_rate") or 0) or None
    except (TypeError, ValueError):
        pass
if expected_samplerate is None or not out_samplerate:
    check("sample_rate", False, f"expected={expected_samplerate} actual={out_samplerate}")
else:
    check(
        "sample_rate",
        int(out_samplerate) == int(expected_samplerate),
        f"expected={expected_samplerate} actual={out_samplerate}",
    )

all_passed = all(v["passed"] for v in checks.values())
now = datetime.now(timezone.utc).isoformat()

verify_block = {
    "checked_at": now,
    "checks": checks,
    "all_passed": all_passed,
    "probe": {
        "duration": out_duration,
        "bit_rate": out_bitrate,
        "sample_rate": out_samplerate,
        "chapter_count": len(chapters),
        "audio_streams": len(audio_streams),
        "video_streams": len(video_streams),
        "tags": {k: tags.get(k) for k in ("title", "artist", "album", "genre")},
    },
}

if all_passed:
    manifest["state"] = "succeeded"
    manifest["verify"] = {**verify_block, "passed_at": now}
else:
    manifest["state"] = "failed"
    manifest["verify"] = {**verify_block, "failed_at": now, "reasons": reasons}
    stderr_tail = manifest.get("stderr_tail") or []
    if not isinstance(stderr_tail, list):
        stderr_tail = [str(stderr_tail)]
    stderr_tail.append(f"[{now}] verify failed: " + "; ".join(reasons))
    manifest["stderr_tail"] = stderr_tail[-20:]

    # Move output file to failed/<jobid>/ alongside a diagnostic JSON.
    manifest_dir = os.path.dirname(os.path.abspath(manifest_path))
    failed_dir = os.path.join(manifest_dir, "failed", jobid)
    try:
        os.makedirs(failed_dir, exist_ok=True)
        if os.path.isfile(output_path):
            dest = os.path.join(failed_dir, os.path.basename(output_path))
            shutil.move(output_path, dest)
            manifest["verify"]["moved_output_to"] = dest
        diag_path = os.path.join(failed_dir, f"{jobid}.verify.json")
        with open(diag_path, "w") as df:
            json.dump(verify_block, df, indent=2)
        manifest["verify"]["diagnostic_path"] = diag_path
    except OSError as e:
        manifest["verify"]["move_error"] = str(e)

# Atomic rewrite of manifest
tmp = manifest_path + ".tmp"
with open(tmp, "w") as f:
    json.dump(manifest, f, indent=2)
os.replace(tmp, manifest_path)

sys.exit(0 if all_passed else 1)
PYEOF

python3 "$checker" "$OUTPUT" "$MANIFEST" "$probe_json_file" "$JOBID"
rc=$?
exit $rc
