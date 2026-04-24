#!/usr/bin/env bash
# convert_on_titan.sh — dispatch a single audiobook conversion job to titan.
#
# Usage:
#   bash scripts/convert_on_titan.sh --candidate <approved-candidate.json> [--parallel N] [--wait-for-slot MINUTES]
#   cat <approved-candidate.json> | bash scripts/convert_on_titan.sh [--parallel N] [--wait-for-slot MINUTES]
#
# On success: echoes the jobid to stdout. The caller (SKILL.md Stage 5) then
# polls via scripts/poll_job.sh.
#
# What it does:
#   1. Mints a jobid: yyyymmdd-hhmmss-<8hex>.
#   2. Checks titan's $JOB_MANIFEST_DIR for any state=running manifests.
#      If one exists and --parallel wasn't raised above the running count,
#      exits with a clear "wait or --parallel N" error.
#   3. SCPs the approved-candidate JSON (+ cover.jpg, + chapters.txt if present)
#      to titan:/tmp/audiobook-m4b/<jobid>/workspace/.
#   4. Writes the initial manifest (state=queued) to $JOB_MANIFEST_DIR/<jobid>.json.
#   5. Ships scripts/remote/run_m4b_tool.sh to titan:/tmp/audiobook-m4b/run_m4b_tool.sh.
#   6. Starts a detached tmux session `audiobook-m4b-<jobid>` running the runner.
#
# Test overrides (all optional — used by tests/test_convert_dispatch.sh):
#   ABM4B_LOCAL_MANIFEST_DIR  — local dir used instead of SSHing to titan for manifests.
#   ABM4B_SKIP_REMOTE=1       — skip SCP/SSH/tmux entirely; still writes the manifest
#                               to ABM4B_LOCAL_MANIFEST_DIR.
#   ABM4B_FAKE_BIN            — directory prepended to PATH holding fake ssh/scp/tmux.

set -uo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# --- Arg parsing -----------------------------------------------------------
CANDIDATE_FILE=""
PARALLEL=1
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

# --- Load candidate (file or stdin) ---------------------------------------
if [[ -n "$CANDIDATE_FILE" ]]; then
  if [[ ! -f "$CANDIDATE_FILE" ]]; then
    echo "❌ candidate file not found: $CANDIDATE_FILE" >&2
    exit 2
  fi
  CAND_JSON="$(cat "$CANDIDATE_FILE")"
else
  if [[ -t 0 ]]; then
    echo "❌ no --candidate and no stdin. See --help." >&2
    exit 64
  fi
  CAND_JSON="$(cat)"
fi

if ! printf '%s' "$CAND_JSON" | python3 -c "import json,sys; json.loads(sys.stdin.read())" 2>/dev/null; then
  echo "❌ candidate is not valid JSON" >&2
  exit 2
fi

# --- Config ----------------------------------------------------------------
# For tests we allow skipping load_config.sh by providing env vars directly.
if [[ -z "${SSH_HOST:-}" || -z "${JOB_MANIFEST_DIR:-}" ]]; then
  # shellcheck disable=SC1091
  source "$SKILL_DIR/scripts/load_config.sh"
fi

: "${CONVERT_JOBS:=4}"

# --- Mint jobid ------------------------------------------------------------
rand_hex="$(openssl rand -hex 4 2>/dev/null || head -c 4 /dev/urandom | xxd -p 2>/dev/null || head -c 4 /dev/urandom | od -An -tx1 | tr -d ' \n')"
rand_hex="${rand_hex:0:8}"
JOBID="$(date -u +%Y%m%d-%H%M%S)-${rand_hex}"

# --- Helpers ---------------------------------------------------------------
ssh_run()  { ssh -o BatchMode=yes "$SSH_HOST" "$@"; }

# --- Duplicate-source guard ------------------------------------------------
# Returns 0 and echoes "<jobid> <state>" if a manifest in a non-terminal state
# already references this source_path. Returns 1 (no match) otherwise.
#
# Non-terminal states: queued, running, tagging, verifying, publishing,
# quarantining. Terminal states (failed, succeeded, published, quarantined,
# publish_failed, published_quarantine_error) do NOT block — they represent
# completed or abandoned runs.
#
# Scans $JOB_MANIFEST_DIR (via ssh against titan in production, or via the
# ABM4B_LOCAL_MANIFEST_DIR override in tests). Uses python for robust JSON
# parsing rather than fragile grep-on-JSON.
has_inflight_for_source() {
  local src_path="$1"
  if [[ -n "${ABM4B_LOCAL_MANIFEST_DIR:-}" ]]; then
    local dir="$ABM4B_LOCAL_MANIFEST_DIR"
    [[ -d "$dir" ]] || return 1
    python3 - "$dir" "$src_path" <<'PYEOF'
import json, os, sys
dir_path, src = sys.argv[1], sys.argv[2]
NON_TERMINAL = {"queued", "running", "tagging", "verifying", "publishing", "quarantining"}
try:
    entries = sorted(os.listdir(dir_path))
except Exception:
    sys.exit(1)
for name in entries:
    if not name.endswith(".json"):
        continue
    path = os.path.join(dir_path, name)
    try:
        with open(path) as f:
            m = json.load(f)
    except Exception:
        continue
    if m.get("source_path") == src and m.get("state") in NON_TERMINAL:
        print(f"{m.get('jobid', name[:-5])} {m.get('state')}")
        sys.exit(0)
sys.exit(1)
PYEOF
    return $?
  else
    # Production path: run the same python via ssh, passing both args via argv.
    # Base64-encode the source path to survive ssh quoting (same technique as
    # the pre-probe block above).
    local src_b64
    src_b64="$(printf '%s' "$src_path" | base64 | tr -d '\n')"
    ssh -o BatchMode=yes "$SSH_HOST" \
      bash -s "$JOB_MANIFEST_DIR" "$src_b64" <<'REMOTESH'
dir="$1"
src="$(echo "$2" | base64 -d)"
[ -d "$dir" ] || exit 1
python3 - "$dir" "$src" <<'PYEOF'
import json, os, sys
dir_path, src = sys.argv[1], sys.argv[2]
NON_TERMINAL = {"queued", "running", "tagging", "verifying", "publishing", "quarantining"}
try:
    entries = sorted(os.listdir(dir_path))
except Exception:
    sys.exit(1)
for name in entries:
    if not name.endswith(".json"):
        continue
    path = os.path.join(dir_path, name)
    try:
        with open(path) as f:
            m = json.load(f)
    except Exception:
        continue
    if m.get("source_path") == src and m.get("state") in NON_TERMINAL:
        print(f"{m.get('jobid', name[:-5])} {m.get('state')}")
        sys.exit(0)
sys.exit(1)
PYEOF
REMOTESH
    return $?
  fi
}

# --- Serial-guard: count currently-running manifests ----------------------
# Lists manifest JSON files and greps for "state": "running". Works both
# against SSH titan (production) and a local dir (tests).
count_running() {
  if [[ -n "${ABM4B_LOCAL_MANIFEST_DIR:-}" ]]; then
    local dir="$ABM4B_LOCAL_MANIFEST_DIR"
    [[ -d "$dir" ]] || { echo 0; return; }
    local c=0
    for f in "$dir"/*.json; do
      [[ -f "$f" ]] || continue
      if grep -q '"state"[[:space:]]*:[[:space:]]*"running"' "$f" 2>/dev/null; then
        c=$((c+1))
      fi
    done
    echo "$c"
  else
    ssh_run "set -e; d='$JOB_MANIFEST_DIR'; if [ ! -d \"\$d\" ]; then echo 0; exit 0; fi; grep -l '\"state\"[[:space:]]*:[[:space:]]*\"running\"' \"\$d\"/*.json 2>/dev/null | wc -l | tr -d ' '" 2>/dev/null || echo 0
  fi
}

# --- Duplicate-source guard ------------------------------------------------
# Refuse to start a new job against a source_path that is already queued,
# running, tagging, verifying, publishing, or quarantining. --force bypasses.
# Extract source_path from the candidate (tolerates the same shapes as the
# later manifest-builder python block).
CAND_SRC_PATH="$(printf '%s' "$CAND_JSON" | python3 -c "
import json, sys
c = json.loads(sys.stdin.read())
src = c.get('source') or {}
print(c.get('source_path') or c.get('content_path') or src.get('path') or c.get('path') or '')
" 2>/dev/null || echo "")"

if (( FORCE_FLAG == 0 )) && [[ -n "$CAND_SRC_PATH" ]]; then
  INFLIGHT="$(has_inflight_for_source "$CAND_SRC_PATH" 2>/dev/null || true)"
  if [[ -n "$INFLIGHT" ]]; then
    EXISTING_JOBID="${INFLIGHT%% *}"
    EXISTING_STATE="${INFLIGHT##* }"
    cat >&2 <<EOF
❌ source already in flight: jobid=$EXISTING_JOBID state=$EXISTING_STATE
   Wait for it to finish, or pass --force if you know what you're doing.
EOF
    exit 6
  fi
fi

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

# --- Load-aware throttle ---------------------------------------------------
# Opt-in. CLI --max-load overrides env TITAN_MAX_LOAD. When the threshold is
# set, SSH to titan, read /proc/loadavg's 1-minute field, and decide:
#   load < threshold → proceed
#   load >= threshold and --wait-for-load 0 (default) → exit 5 with advice
#   load >= threshold and --wait-for-load N → poll every 30s for up to N min
#
# Test hooks:
#   ABM4B_FAKE_LOAD=N            — skip SSH, return N
#   ABM4B_FAKE_LOAD=seq:<path>   — read one line per check from <path>
#   ABM4B_LOAD_POLL_SECONDS=N    — override the 30s poll interval (for tests)
EFFECTIVE_MAX_LOAD="${MAX_LOAD:-${TITAN_MAX_LOAD:-}}"
if [[ -n "$EFFECTIVE_MAX_LOAD" ]]; then
  poll_seconds="${ABM4B_LOAD_POLL_SECONDS:-30}"
  deadline=$(( $(date +%s) + WAIT_FOR_LOAD_MIN * 60 ))

  # Reads the 1-minute load average from titan (or ABM4B_FAKE_LOAD in tests).
  # On success: prints the raw load string and returns 0.
  # On SSH failure: prints nothing, returns 8 (distinct from "ssh succeeded
  # but output unparseable" — that stays exit 7 in the caller).
  read_current_load() {
    if [[ -n "${ABM4B_FAKE_LOAD:-}" ]]; then
      if [[ "$ABM4B_FAKE_LOAD" == seq:* ]]; then
        local seq_path="${ABM4B_FAKE_LOAD#seq:}"
        # Pop the first line (destructive, so subsequent calls see next value).
        local first rest
        first="$(head -n 1 "$seq_path" 2>/dev/null)"
        rest="$(tail -n +2 "$seq_path" 2>/dev/null || true)"
        printf '%s' "$rest" > "$seq_path"
        printf '%s' "$first"
      else
        printf '%s' "$ABM4B_FAKE_LOAD"
      fi
      return 0
    fi
    # Real SSH branch. Capture stdout and exit code separately so we can
    # distinguish "ssh broken" (unreachable host, auth denied) from "ssh
    # worked but /proc/loadavg output doesn't parse as a float".
    local out rc
    out="$(ssh_run "awk '{print \$1}' /proc/loadavg" 2>/dev/null)"
    rc=$?
    if (( rc != 0 )); then
      return 8
    fi
    printf '%s' "$out"
    return 0
  }

  while true; do
    set +e
    raw_load="$(read_current_load)"
    load_rc=$?
    set -e
    if (( load_rc == 8 )); then
      cat >&2 <<EOF
❌ ssh to $SSH_HOST failed while reading titan load average (ssh exit != 0).
   Check SSH connectivity (host reachable, BatchMode auth configured).
EOF
      exit 8
    fi
    # Parse as float; reject malformed (not just a decimal number).
    if ! [[ "$raw_load" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
      cat >&2 <<EOF
❌ could not parse titan load average (got: "$raw_load").
   ssh succeeded but /proc/loadavg output was not a float on $SSH_HOST.
EOF
      exit 7
    fi
    # Float compare via python (portable across macOS/Linux shells).
    if python3 -c "import sys; sys.exit(0 if float('$raw_load') < float('$EFFECTIVE_MAX_LOAD') else 1)"; then
      break  # load is safe, continue to dispatch
    fi
    if (( WAIT_FOR_LOAD_MIN <= 0 )) || (( $(date +%s) >= deadline )); then
      cat >&2 <<EOF
❌ titan 1-min load average $raw_load >= threshold $EFFECTIVE_MAX_LOAD.
   Wait for load to drop, or raise --max-load / --wait-for-load N.
EOF
      exit 5
    fi
    waited_s=$(( $(date +%s) - (deadline - WAIT_FOR_LOAD_MIN * 60) ))
    echo "[load] titan 1-min=$raw_load, threshold=$EFFECTIVE_MAX_LOAD, waited=${waited_s}s — sleeping ${poll_seconds}s" >&2
    sleep "$poll_seconds"
  done
fi

# --- Auto-enrich candidate: probe + audnex --------------------------------
# If source_bitrate/samplerate/duration missing, probe the source remotely.
# If asin given but no audnex block, fetch it.
cand_stash="$(mktemp -t audiobook-m4b-cand-in.XXXXXX.json)"
printf '%s' "$CAND_JSON" > "$cand_stash"

# Check what's missing. If we need to probe, do it over SSH against the source.
need_probe="$(python3 -c '
import json, sys
c = json.load(open(sys.argv[1]))
src = c.get("source") or {}
br = c.get("source_bitrate") or src.get("bit_rate") or c.get("bit_rate")
sr = c.get("source_samplerate") or src.get("sample_rate") or c.get("sample_rate")
dur = c.get("source_duration") or src.get("total_duration") or c.get("total_duration")
path = c.get("source_path") or c.get("content_path") or src.get("path") or c.get("path")
print("1" if (path and not (br and sr and dur)) else "0")
' "$cand_stash")"

if [[ "$need_probe" == "1" && "${ABM4B_SKIP_REMOTE:-0}" != "1" ]]; then
  src_path="$(python3 -c 'import json,sys; c=json.load(open(sys.argv[1])); print(c.get("source_path") or c.get("content_path") or "")' "$cand_stash")"
  ffprobe_img="${FFPROBE_IMAGE:-jrottenberg/ffmpeg:latest}"
  if [[ -n "$src_path" ]]; then
    probe_tmp="$(mktemp -t audiobook-m4b-probe.XXXXXX.json)"
    # Base64-encode the source path to survive quoting through ssh remote shell.
    src_b64="$(printf '%s' "$src_path" | base64 | tr -d '\n')"
    # Run the remote probe via argv-passed script (args are base64-encoded).
    ssh -o BatchMode=yes "$SSH_HOST" \
      bash -s "$src_b64" "$ffprobe_img" > "$probe_tmp" 2>/dev/null <<'PROBESH' || true
src="$(echo "$1" | base64 -d)"
img="$2"
exts='-iname *.mp3 -o -iname *.m4a -o -iname *.m4b -o -iname *.flac -o -iname *.wav -o -iname *.ogg -o -iname *.opus -o -iname *.aac'
if [ -f "$src" ]; then
  target="$src"
elif [ -d "$src" ]; then
  target=$(find "$src" -maxdepth 3 -type f \( -iname '*.mp3' -o -iname '*.m4a' -o -iname '*.m4b' -o -iname '*.flac' -o -iname '*.wav' -o -iname '*.ogg' -o -iname '*.opus' -o -iname '*.aac' \) 2>/dev/null | sort | head -1)
else
  exit 0
fi
[ -z "$target" ] && exit 0
dir="$(dirname "$target")"
base="$(basename "$target")"
# Emit the probe JSON on first line-group, then a marker, then total_duration if dir.
docker run --rm --entrypoint ffprobe -v "$dir:/in:ro" "$img" -v error -print_format json -show_format -show_streams "/in/$base" 2>/dev/null
if [ -d "$src" ]; then
  echo '---TOTAL---'
  total=0
  while IFS= read -r f; do
    d=$(docker run --rm --entrypoint ffprobe -v "$(dirname "$f"):/in:ro" "$img" -v error -show_entries format=duration -of default=nw=1:nk=1 "/in/$(basename "$f")" 2>/dev/null)
    [ -n "$d" ] && total=$(python3 -c "print($total + float('$d' or 0))")
  done < <(find "$src" -maxdepth 3 -type f \( -iname '*.mp3' -o -iname '*.m4a' -o -iname '*.m4b' -o -iname '*.flac' -o -iname '*.wav' -o -iname '*.ogg' -o -iname '*.opus' -o -iname '*.aac' \) 2>/dev/null | sort)
  echo "total_duration=$total"
fi
PROBESH

    # Parse probe output and enrich candidate.
    python3 - "$cand_stash" "$probe_tmp" <<'PYEOF'
import json, sys, re
cand_path, probe_path = sys.argv[1], sys.argv[2]
cand = json.load(open(cand_path))
probe_raw = open(probe_path).read() if probe_path else ""
if '---TOTAL---' in probe_raw:
    probe_part, total_part = probe_raw.split('---TOTAL---', 1)
    m = re.search(r'total_duration=([\d.]+)', total_part)
    total_dur = float(m.group(1)) if m else None
else:
    probe_part, total_dur = probe_raw, None
try:
    probe = json.loads(probe_part)
except Exception:
    probe = {}
fmt = probe.get('format', {}) or {}
streams = probe.get('streams', []) or []
audio = [s for s in streams if s.get('codec_type') == 'audio']
if audio:
    if not cand.get('source_bitrate'):
        br = int(audio[0].get('bit_rate') or fmt.get('bit_rate') or 0) or None
        if br: cand['source_bitrate'] = br
    if not cand.get('source_samplerate'):
        sr = int(audio[0].get('sample_rate') or 0) or None
        if sr: cand['source_samplerate'] = sr
    if not cand.get('source_codec'):
        c = audio[0].get('codec_name')
        if c: cand['source_codec'] = c
if not cand.get('source_duration'):
    dur = total_dur if total_dur else (float(fmt.get('duration')) if fmt.get('duration') else None)
    if dur: cand['source_duration'] = dur
json.dump(cand, open(cand_path, 'w'), indent=2)
PYEOF
    rm -f "$probe_tmp"
  fi
fi

# If asin present but no audnex block, try fetching audnex metadata.
has_audnex="$(python3 -c 'import json,sys; c=json.load(open(sys.argv[1])); print("1" if c.get("audnex") else "0")' "$cand_stash")"
has_asin="$(python3 -c 'import json,sys; c=json.load(open(sys.argv[1])); print(c.get("asin") or "")' "$cand_stash")"
if [[ "$has_audnex" == "0" && -n "$has_asin" ]]; then
  audnex_json="$(python3 "$SKILL_DIR/scripts/audnex_lookup.py" --asin "$has_asin" --path "$(python3 -c 'import json,sys; c=json.load(open(sys.argv[1])); print(c.get("source_path") or "")' "$cand_stash")" 2>/dev/null || true)"
  if [[ -n "$audnex_json" ]]; then
    python3 - "$cand_stash" "$audnex_json" <<'PYEOF'
import json, sys
cand_path, audnex_raw = sys.argv[1], sys.argv[2]
cand = json.load(open(cand_path))
try:
    enriched = json.loads(audnex_raw)
    a = enriched.get('audnex')
    if a: cand['audnex'] = a
except Exception:
    pass
json.dump(cand, open(cand_path, 'w'), indent=2)
PYEOF
  fi
fi

# --- Build initial manifest JSON ------------------------------------------
manifest_json="$(python3 - "$JOBID" "$CONVERT_JOBS" "$cand_stash" "$FORCE_FLAG" <<'PYEOF'
import json, sys, datetime
jobid, convert_jobs, cand_path = sys.argv[1], int(sys.argv[2]), sys.argv[3]
force_flag = sys.argv[4] == "1"
with open(cand_path) as f:
    cand = json.load(f)
src = cand.get("source") or {}
audnex = cand.get("audnex") or {}
fallback = cand.get("fallback_metadata") or {}

# Normalise source fields pulled from probe_sources.sh shape.
source_path       = cand.get("source_path") or cand.get("content_path") or src.get("path") or cand.get("path")
source_bitrate    = cand.get("source_bitrate") or src.get("bit_rate") or cand.get("bit_rate")
source_samplerate = cand.get("source_samplerate") or src.get("sample_rate") or cand.get("sample_rate")
source_codec      = cand.get("source_codec") or src.get("codec") or cand.get("codec")
total_duration    = cand.get("source_duration") or src.get("total_duration") or cand.get("total_duration")
# Derive slug from fallback title or basename if not provided.
import re, os
def slugify(s):
    s = re.sub(r"[^A-Za-z0-9 ]+", " ", s or "").strip().lower()
    return re.sub(r"\s+", "-", s) or "audiobook"
slug = cand.get("slug") or src.get("slug") or slugify(fallback.get("title") or audnex.get("title") or os.path.basename(source_path or "audiobook"))
target_path       = cand.get("target_path")
has_chapters      = bool(cand.get("has_chapters") or audnex.get("chapters") or audnex.get("chapters_ms"))
has_cover         = bool(cand.get("has_cover") or audnex.get("cover_url"))
asin              = cand.get("asin") or audnex.get("asin")

# Codec choice — copy if source is already AAC/M4A/M4B family.
copyable = (source_codec or "").lower() in ("aac", "alac", "m4a", "m4b")
audio_codec = "copy" if copyable else "libfdk_aac"

manifest = {
    "jobid": jobid,
    "state": "queued",
    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "source_path": source_path,
    "target_path": target_path,
    "slug": slug,
    "source_bitrate": source_bitrate,
    "source_samplerate": source_samplerate,
    "source_codec": source_codec,
    "source_duration": total_duration,
    "source": {
        "path": source_path,
        "bit_rate": source_bitrate,
        "sample_rate": source_samplerate,
        "codec": source_codec,
        "total_duration": total_duration,
    },
    "audio_codec": audio_codec,
    "remux_only": audio_codec == "copy",
    "audnex": audnex or None,
    "audnex_asin": asin,
    "fallback_metadata": fallback or None,
    "has_chapters": has_chapters,
    "has_cover": has_cover,
    "expected_min_chapters": 1 if has_chapters else 0,
    "convert_jobs": convert_jobs,
    "last_log_line": "",
    "stderr_tail": [],
    "candidate": cand,
    "force_flag_used": force_flag,
}
print(json.dumps(manifest, indent=2))
PYEOF
)" || {
  rm -f "$cand_stash"
  echo "❌ failed to build manifest from candidate" >&2
  exit 2
}
rm -f "$cand_stash"

# --- Write manifest + workspace -------------------------------------------
manifest_tmp="$(mktemp -t audiobook-m4b-manifest.XXXXXX.json)"
trap 'rm -f "$manifest_tmp"' EXIT
printf '%s\n' "$manifest_json" > "$manifest_tmp"

if [[ -n "${ABM4B_LOCAL_MANIFEST_DIR:-}" ]]; then
  mkdir -p "$ABM4B_LOCAL_MANIFEST_DIR"
  cp "$manifest_tmp" "$ABM4B_LOCAL_MANIFEST_DIR/$JOBID.json"
fi

if [[ "${ABM4B_SKIP_REMOTE:-0}" != "1" ]]; then
  REMOTE_ROOT="/tmp/audiobook-m4b"
  REMOTE_WS="$REMOTE_ROOT/$JOBID/workspace"
  REMOTE_RUNNER="$REMOTE_ROOT/run_m4b_tool.sh"

  ssh_run "mkdir -p '$REMOTE_WS' '$JOB_MANIFEST_DIR'" || {
    echo "❌ failed to create remote dirs on $SSH_HOST" >&2
    exit 4
  }

  # Candidate JSON into the workspace.
  cand_tmp="$(mktemp -t audiobook-m4b-cand.XXXXXX.json)"
  printf '%s' "$CAND_JSON" > "$cand_tmp"
  scp -q "$cand_tmp" "$SSH_HOST:$REMOTE_WS/candidate.json" || {
    echo "❌ scp candidate.json failed" >&2; rm -f "$cand_tmp"; exit 4
  }
  rm -f "$cand_tmp"

  # Optional cover.jpg — fetch locally if audnex cover_url present.
  cover_url="$(printf '%s' "$CAND_JSON" | python3 -c "import json,sys; c=json.loads(sys.stdin.read()); a=c.get('audnex') or {}; print(a.get('cover_url') or c.get('cover_url') or '')")"
  if [[ -n "$cover_url" ]]; then
    cover_tmp="$(mktemp -t audiobook-m4b-cover.XXXXXX.jpg)"
    if curl -fsSL "$cover_url" -o "$cover_tmp" 2>/dev/null; then
      scp -q "$cover_tmp" "$SSH_HOST:$REMOTE_WS/cover.jpg" || true
    fi
    rm -f "$cover_tmp"
  fi

  # Optional chapters.txt — candidate may include an "audnex.chapters_text" or "chapters_text".
  chapters_text="$(printf '%s' "$CAND_JSON" | python3 -c "import json,sys; c=json.loads(sys.stdin.read()); a=c.get('audnex') or {}; print(a.get('chapters_text') or c.get('chapters_text') or '')")"
  if [[ -n "$chapters_text" ]]; then
    ch_tmp="$(mktemp -t audiobook-m4b-chapters.XXXXXX.txt)"
    printf '%s' "$chapters_text" > "$ch_tmp"
    scp -q "$ch_tmp" "$SSH_HOST:$REMOTE_WS/chapters.txt" || true
    rm -f "$ch_tmp"
  fi

  # Ship the manifest.
  scp -q "$manifest_tmp" "$SSH_HOST:$JOB_MANIFEST_DIR/$JOBID.json" || {
    echo "❌ scp manifest failed" >&2; exit 4
  }

  # Ship the runner script and all remote-side helpers needed for the
  # convert → verify → publish → quarantine chain. `publish_to_library.sh` and
  # `quarantine_sources.sh` already short-circuit `source load_config.sh` when
  # LIBRARY_ROOT / QUARANTINE_ROOT are pre-set in the env (which the tmux
  # launch below does) — so no remote config-file shipping is required.
  scp -q "$SKILL_DIR/scripts/remote/run_m4b_tool.sh" "$SSH_HOST:$REMOTE_RUNNER" || {
    echo "❌ scp runner failed" >&2; exit 4
  }
  scp -q "$SKILL_DIR/scripts/verify_output.sh" "$SSH_HOST:$REMOTE_ROOT/verify_output.sh" || {
    echo "❌ scp verify_output.sh failed" >&2; exit 4
  }
  scp -q "$SKILL_DIR/scripts/publish_to_library.sh" "$SSH_HOST:$REMOTE_ROOT/publish_to_library.sh" || {
    echo "❌ scp publish_to_library.sh failed" >&2; exit 4
  }
  scp -q "$SKILL_DIR/scripts/relocate_m4b.sh" "$SSH_HOST:$REMOTE_ROOT/relocate_m4b.sh" || {
    echo "❌ scp relocate_m4b.sh failed" >&2; exit 4
  }
  scp -q "$SKILL_DIR/scripts/quarantine_sources.sh" "$SSH_HOST:$REMOTE_ROOT/quarantine_sources.sh" || {
    echo "❌ scp quarantine_sources.sh failed" >&2; exit 4
  }
  ssh_run "chmod +x '$REMOTE_RUNNER' '$REMOTE_ROOT/verify_output.sh' '$REMOTE_ROOT/publish_to_library.sh' '$REMOTE_ROOT/relocate_m4b.sh' '$REMOTE_ROOT/quarantine_sources.sh'" || true

  # Start detached tmux session.
  tmux_name="audiobook-m4b-$JOBID"
  # Pass env vars explicitly — tmux on titan doesn't inherit from the ssh cmd.
  # LIBRARY_ROOT and QUARANTINE_ROOT are needed by the chained publish +
  # quarantine steps (Unit 3) that the runner invokes after verify.
  ssh_run "tmux new-session -d -s '$tmux_name' 'JOB_MANIFEST_DIR=\"$JOB_MANIFEST_DIR\" CONVERT_JOBS=\"$CONVERT_JOBS\" FFPROBE_IMAGE=\"${FFPROBE_IMAGE:-jrottenberg/ffmpeg:latest}\" LIBRARY_ROOT=\"${LIBRARY_ROOT:-}\" QUARANTINE_ROOT=\"${QUARANTINE_ROOT:-}\" bash $REMOTE_RUNNER $JOBID'" || {
    echo "❌ failed to start tmux session on $SSH_HOST" >&2
    exit 4
  }
fi

# Emit the jobid so the caller can poll.
echo "$JOBID"
