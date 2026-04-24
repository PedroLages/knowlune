#!/usr/bin/env bash
# run_m4b_tool.sh — runs INSIDE a detached tmux session on titan. Invokes
# `docker run sandreas/m4b-tool:latest merge ...` with the bitrate/samplerate
# pulled from the manifest, captures logs, then calls verify_output.sh.
#
# Usage (from tmux): bash /tmp/audiobook-m4b/run_m4b_tool.sh <jobid>
#
# Assumes:
#   - Manifest at $JOB_MANIFEST_DIR/<jobid>.json (SSH_HOST's view of it).
#   - Workspace at /tmp/audiobook-m4b/<jobid>/workspace/ containing
#     candidate.json and optionally cover.jpg, chapters.txt.
#   - verify_output.sh shipped to /tmp/audiobook-m4b/verify_output.sh.
#
# Manifest state machine: queued -> running -> verifying -> succeeded|failed.
#
# 4h wall-clock timeout on docker; exceeding marks the job failed:"timeout".

set -uo pipefail

JOBID="${1:-}"
if [[ -z "$JOBID" ]]; then
  echo "usage: run_m4b_tool.sh <jobid>" >&2
  exit 64
fi

# Pick up config — prefer an env-provided JOB_MANIFEST_DIR so local tests can
# invoke this runner with --dry-run against a temp dir.
: "${JOB_MANIFEST_DIR:?JOB_MANIFEST_DIR must be set}"
: "${CONVERT_JOBS:=4}"

MANIFEST="$JOB_MANIFEST_DIR/$JOBID.json"
LOG="$JOB_MANIFEST_DIR/$JOBID.log"
WORKSPACE="/tmp/audiobook-m4b/$JOBID/workspace"
VERIFY="/tmp/audiobook-m4b/verify_output.sh"

if [[ ! -f "$MANIFEST" ]]; then
  echo "❌ manifest not found: $MANIFEST" >&2
  exit 2
fi

# --- Helper: atomic manifest update via python -----------------------------
update_manifest() {
  python3 - "$MANIFEST" "$@" <<'PYEOF'
import json, os, sys
manifest_path = sys.argv[1]
updates = {}
i = 2
while i < len(sys.argv):
    k, v = sys.argv[i], sys.argv[i+1]
    # Let certain keys be JSON-parsed
    if k in ("stderr_tail",):
        try: v = json.loads(v)
        except Exception: pass
    updates[k] = v
    i += 2
with open(manifest_path) as f:
    m = json.load(f)
m.update(updates)
tmp = manifest_path + ".tmp"
with open(tmp, "w") as f:
    json.dump(m, f, indent=2)
os.replace(tmp, manifest_path)
PYEOF
}

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

# --- Transition to running ------------------------------------------------
update_manifest state running started_at "$(now)"

# --- Read manifest fields we need -----------------------------------------
read_field() {
  python3 - "$MANIFEST" "$1" <<'RFEOF'
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
RFEOF
}

SOURCE_PATH="$(read_field source_path)"
SOURCE_BITRATE="$(read_field source_bitrate)"
SOURCE_SAMPLERATE="$(read_field source_samplerate)"
AUDIO_CODEC="$(read_field audio_codec)"
SLUG="$(read_field slug)"
: "${SLUG:=audiobook}"

OUTPUT_FILE="$WORKSPACE/${SLUG}.m4b"

# Docker binary can be overridden for offline tests (ABM4B_DOCKER=/path/to/fake).
DOCKER_BIN="${ABM4B_DOCKER:-docker}"

# --- Build docker args -----------------------------------------------------
DOCKER_ARGS=(
  run --rm
  -u "$(id -u):$(id -g)"
  -v "$SOURCE_PATH:/input:ro"
  -v "$WORKSPACE:/output"
  sandreas/m4b-tool:latest merge /input
  "--output-file=/output/${SLUG}.m4b"
  "--jobs=$CONVERT_JOBS"
  "--no-cache"
)

[[ -n "$SOURCE_BITRATE"   ]] && DOCKER_ARGS+=("--audio-bitrate=${SOURCE_BITRATE}")
[[ -n "$SOURCE_SAMPLERATE" ]] && DOCKER_ARGS+=("--audio-samplerate=${SOURCE_SAMPLERATE}")
[[ -n "$AUDIO_CODEC" ]] && DOCKER_ARGS+=("--audio-codec=${AUDIO_CODEC}")

if [[ -f "$WORKSPACE/chapters.txt" ]]; then
  # m4b-tool consumes the chapters file from /input mount in Pedro's doc, but
  # /input is the source folder (read-only). Copy chapters.txt into /output
  # instead and pass the /output path — m4b-tool accepts absolute paths.
  DOCKER_ARGS+=("--chapters-file=/output/chapters.txt")
else
  DOCKER_ARGS+=("--use-filenames-as-chapters")
fi

if [[ -f "$WORKSPACE/cover.jpg" ]]; then
  DOCKER_ARGS+=("--cover=/output/cover.jpg")
fi

# --- Run m4b-tool (4h timeout) --------------------------------------------
: > "$LOG"
TIMEOUT_SECONDS=14400
DOCKER_RC=0

(
  # Best-effort progress tailing in background: watch the log for lines
  # and poke manifest.last_log_line occasionally.
  tail -F "$LOG" 2>/dev/null | while IFS= read -r line; do
    # Throttle: only update every ~5s.
    now_s=$(date +%s)
    last_s="${LAST_UPDATE_S:-0}"
    if (( now_s - last_s >= 5 )); then
      LAST_UPDATE_S=$now_s
      # Keep last_log_line pithy.
      trimmed="${line:0:240}"
      python3 - "$MANIFEST" "$trimmed" <<'PYEOF' 2>/dev/null || true
import json,os,sys
mp, line = sys.argv[1], sys.argv[2]
try:
    with open(mp) as f: m=json.load(f)
    m["last_log_line"]=line
    tmp=mp+".tmp"
    with open(tmp,"w") as f: json.dump(m,f,indent=2)
    os.replace(tmp,mp)
except Exception: pass
PYEOF
    fi
  done
) &
TAIL_PID=$!

if command -v timeout >/dev/null 2>&1; then
  timeout --preserve-status "$TIMEOUT_SECONDS" "$DOCKER_BIN" "${DOCKER_ARGS[@]}" >> "$LOG" 2>&1
  DOCKER_RC=$?
else
  "$DOCKER_BIN" "${DOCKER_ARGS[@]}" >> "$LOG" 2>&1 &
  DPID=$!
  SECONDS=0
  while kill -0 "$DPID" 2>/dev/null; do
    if (( SECONDS >= TIMEOUT_SECONDS )); then
      kill -TERM "$DPID" 2>/dev/null; sleep 5
      kill -KILL "$DPID" 2>/dev/null
      DOCKER_RC=124
      break
    fi
    sleep 5
  done
  wait "$DPID" 2>/dev/null
  [[ $DOCKER_RC -eq 0 ]] && DOCKER_RC=$?
fi

kill "$TAIL_PID" 2>/dev/null || true
wait "$TAIL_PID" 2>/dev/null || true

# --- Handle result ---------------------------------------------------------
if (( DOCKER_RC == 124 )); then
  stderr_tail_json="$(python3 -c "import json; print(json.dumps(['timeout after ${TIMEOUT_SECONDS}s']))")"
  update_manifest state failed reason timeout stderr_tail "$stderr_tail_json" finished_at "$(now)"
  exit 1
fi

if (( DOCKER_RC != 0 )); then
  tail_json="$(tail -n 20 "$LOG" 2>/dev/null | python3 -c "import json,sys; print(json.dumps([l.rstrip() for l in sys.stdin.readlines()]))")"
  update_manifest state failed reason "m4b-tool exited $DOCKER_RC" stderr_tail "$tail_json" finished_at "$(now)"
  exit 1
fi

# --- Auto-retag: force genre=Audiobook before verify ----------------------
# m4b-tool merge inherits whatever genre the first source MP3 had (often empty,
# "Science", or wrong). verify_output.sh's strict genre check rejects that.
# Fix upstream: overwrite the genre tag on the fresh m4b. Mirrors the existing
# retag path in relocate_m4b.sh:270-294 — same docker args shape, same error
# capture, just scoped to the one tag we guarantee to own.
update_manifest state tagging
retag_err="$(mktemp -t audiobook-m4b-retag-err.XXXXXX)"

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
# Cap at 60s — meta is a tag-write, sub-second in practice. Defensive only.
if command -v timeout >/dev/null 2>&1; then
  if ! timeout 60 "$DOCKER_BIN" "${META_ARGS[@]}" >>"$LOG" 2>"$retag_err"; then
    err_msg="$(head -c 400 "$retag_err" 2>/dev/null | tr '\n' ' ')"
    rm -f "$retag_err"
    retag_tail_json="$(python3 -c "import json,sys; print(json.dumps([sys.argv[1]]))" "${err_msg:-retag failed}")"
    update_manifest state failed reason "retag failed" stderr_tail "$retag_tail_json" finished_at "$(now)"
    exit 1
  fi
else
  if ! "$DOCKER_BIN" "${META_ARGS[@]}" >>"$LOG" 2>"$retag_err"; then
    err_msg="$(head -c 400 "$retag_err" 2>/dev/null | tr '\n' ' ')"
    rm -f "$retag_err"
    retag_tail_json="$(python3 -c "import json,sys; print(json.dumps([sys.argv[1]]))" "${err_msg:-retag failed}")"
    update_manifest state failed reason "retag failed" stderr_tail "$retag_tail_json" finished_at "$(now)"
    exit 1
  fi
fi
rm -f "$retag_err"

# --- Verify ---------------------------------------------------------------
update_manifest state verifying finished_at "$(now)"

if [[ -x "$VERIFY" || -f "$VERIFY" ]]; then
  bash "$VERIFY" "$OUTPUT_FILE" "$MANIFEST"
  VRC=$?
  if (( VRC == 2 )); then
    # internal error — mark failed with internal flag, preserve state.
    update_manifest internal_error 1 state failed
    exit 1
  fi
  if (( VRC != 0 )); then
    # verify_output.sh already transitioned manifest to failed.
    exit $VRC
  fi
  # verify passed → state=succeeded. Fall through to chained publish + quarantine.
else
  update_manifest state failed reason "verify_output.sh missing" finished_at "$(now)"
  exit 1
fi

# --- Chain: publish → quarantine ------------------------------------------
# After verify succeeds, the runner drives the rest of the pipeline atomically
# from inside the same tmux session. Sources are only moved to quarantine
# after the library publish succeeds — preserving the invariant "sources are
# only deleted when every step succeeded".
#
# Required env (passed via tmux launch in convert_on_titan.sh):
#   LIBRARY_ROOT    — destination for the .m4b (publish_to_library.sh)
#   QUARANTINE_ROOT — 7-day holding area for originals (quarantine_sources.sh)
#
# If either env is missing, the chain skips with a clear manifest note. The
# user can publish manually. This matches pre-chaining behaviour.
PUBLISH_SCRIPT="/tmp/audiobook-m4b/publish_to_library.sh"
QUARANTINE_SCRIPT="/tmp/audiobook-m4b/quarantine_sources.sh"

# Test hook: tests can override the chain-script locations.
[[ -n "${ABM4B_PUBLISH_SCRIPT:-}" ]]    && PUBLISH_SCRIPT="$ABM4B_PUBLISH_SCRIPT"
[[ -n "${ABM4B_QUARANTINE_SCRIPT:-}" ]] && QUARANTINE_SCRIPT="$ABM4B_QUARANTINE_SCRIPT"

if [[ -z "${LIBRARY_ROOT:-}" || -z "${QUARANTINE_ROOT:-}" ]]; then
  update_manifest chain_skipped "LIBRARY_ROOT or QUARANTINE_ROOT not set"
  exit 0
fi
if [[ ! -f "$PUBLISH_SCRIPT" || ! -f "$QUARANTINE_SCRIPT" ]]; then
  update_manifest chain_skipped "publish/quarantine scripts not shipped to titan"
  exit 0
fi

# Step: publish. On success, publish_to_library.sh sets state=published.
update_manifest state publishing
pub_err="$(mktemp -t audiobook-m4b-pub-err.XXXXXX)"
if ! bash "$PUBLISH_SCRIPT" "$MANIFEST" >>"$LOG" 2>"$pub_err"; then
  pub_msg="$(head -c 400 "$pub_err" 2>/dev/null | tr '\n' ' ')"
  rm -f "$pub_err"
  pub_tail="$(python3 -c "import json,sys; print(json.dumps([sys.argv[1]]))" "${pub_msg:-publish failed}")"
  update_manifest state publish_failed reason "publish failed" stderr_tail "$pub_tail" finished_at "$(now)"
  exit 1
fi
rm -f "$pub_err"

# Confirm the publish script actually wrote state=published. Guards against
# silent no-ops / schema drift where rc=0 but the manifest was not updated,
# which would otherwise quarantine sources under a false-published manifest
# and violate the "sources only deleted when every step succeeded" invariant.
post_publish_state="$(read_field state)"
if [[ "$post_publish_state" != "published" ]]; then
  fallback_tail="$(python3 -c "import json,sys; print(json.dumps([sys.argv[1]]))" "publish script rc=0 but state=$post_publish_state")"
  update_manifest state publish_failed reason "publish script returned 0 but did not write state=published" stderr_tail "$fallback_tail" finished_at "$(now)"
  exit 1
fi

# Step: quarantine. Success → state=quarantined (terminal).
# Failure → state=published_quarantine_error (library is intact, source still
# at original path, operator can re-run quarantine manually). Runner exits 0
# because the user-visible artifact is safe.
update_manifest state quarantining
qtn_err="$(mktemp -t audiobook-m4b-qtn-err.XXXXXX)"
if ! bash "$QUARANTINE_SCRIPT" "$MANIFEST" >>"$LOG" 2>"$qtn_err"; then
  qtn_msg="$(head -c 400 "$qtn_err" 2>/dev/null | tr '\n' ' ')"
  rm -f "$qtn_err"
  qtn_tail="$(python3 -c "import json,sys; print(json.dumps([sys.argv[1]]))" "${qtn_msg:-quarantine failed}")"
  update_manifest state published_quarantine_error reason "quarantine failed" stderr_tail "$qtn_tail" finished_at "$(now)"
  exit 0
fi
rm -f "$qtn_err"

update_manifest state quarantined finished_at "$(now)"
exit 0
