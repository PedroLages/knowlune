#!/usr/bin/env bash
# relocate_m4b.sh — RELOCATE path for already-m4b candidates.
#
# Usage:
#   bash relocate_m4b.sh <manifest.json>
#
# Flow:
#   1. Read source_path from manifest (folder OR direct .m4b).
#   2. Resolve to a single .m4b file. If folder contains >1 m4b, exit 5 (caller
#      must route to CONVERT path — concat via m4b-tool).
#   3. ffprobe the m4b (via sandreas/m4b-tool container, entrypoint=ffprobe).
#   4. DRM check: if encoder tag contains "encrypted" or codec is aax/aac_aax,
#      exit 4 with clear error (de-DRM upstream — Libation/OpenAudible).
#   5. Acceptability: non-empty title+artist+album AND (embedded cover video
#      stream OR sibling cover.* in source dir).
#   6a. Acceptable: copy m4b + cover to workspace under
#       /tmp/audiobook-m4b/<jobid>/workspace/ (defensive — never mutate source).
#   6b. Not acceptable: retag in-place on the *copy* via
#       `docker run sandreas/m4b-tool:latest meta ... --name --artist --album
#       --genre=Audiobook --year --description`. Requires manifest.audnex.
#       If audnex is null → exit 3. Note: `meta` modifies mp4 tags only;
#       embedded chapters are preserved.
#   7. Invoke scripts/verify_output.sh on the workspace copy (unless
#      ABM4B_SKIP_VERIFY=1 — used by tests).
#   8. On success, manifest.output_path points to the workspace copy. Caller
#      (Stage 5 dispatcher) invokes publish_to_library.sh next.
#
# Exit codes:
#   0 success
#   1 ffprobe failure (or multi-m4b detection fallback parse error)
#   2 retag command failure
#   3 audnex required for retag but missing
#   4 DRM detected — rejected
#   5 multi-m4b folder — route to CONVERT path
#
# Environment overrides (for tests):
#   ABM4B_FFPROBE       — path to a local ffprobe binary (mock)
#   ABM4B_FIXTURE       — passed through to mock ffprobe
#   ABM4B_DOCKER        — override `docker` binary (mock for retag)
#   ABM4B_SKIP_VERIFY=1 — skip calling verify_output.sh
#   ABM4B_WORKSPACE     — override workspace root (default /tmp/audiobook-m4b)
#   ABM4B_DEBUG=1       — verbose stderr

set -uo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: relocate_m4b.sh <manifest.json>" >&2
  exit 1
fi

MANIFEST="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() { [[ "${ABM4B_DEBUG:-0}" == "1" ]] && echo "[relocate] $*" >&2 || true; }

if [[ ! -f "$MANIFEST" ]]; then
  echo "relocate: manifest not found: $MANIFEST" >&2
  exit 1
fi

# --- Manifest helpers: read + atomic write ---------------------------------

read_field() {
  # read_field <key-path> — e.g. "source_path" or "audnex.title"
  python3 - "$MANIFEST" "$1" <<'PY'
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
if cur is None:
    print("")
else:
    print(cur)
PY
}

set_fields() {
  # set_fields k1=v1 k2=v2 ... (values are strings; "null" means JSON null)
  python3 - "$MANIFEST" "$@" <<'PY'
import json, os, sys
path = sys.argv[1]
m = json.load(open(path))
for pair in sys.argv[2:]:
    k, _, v = pair.partition("=")
    if v == "__NULL__":
        m[k] = None
    else:
        m[k] = v
tmp = path + ".tmp"
with open(tmp, "w") as f:
    json.dump(m, f, indent=2)
os.replace(tmp, path)
PY
}

fail_manifest() {
  local msg="$1" code="$2"
  set_fields "state=failed" "error=$msg" || true
  echo "relocate: $msg" >&2
  exit "$code"
}

JOBID="$(read_field jobid)"
[[ -z "$JOBID" ]] && JOBID="$(read_field job_id)"
[[ -z "$JOBID" ]] && JOBID="unknown"
SRC="$(read_field source_path)"
if [[ -z "$SRC" ]]; then
  fail_manifest "manifest.source_path missing" 1
fi

# --- Resolve source to single m4b ------------------------------------------

M4B=""
SRC_DIR=""
if [[ -f "$SRC" && ( "$SRC" == *.m4b || "$SRC" == *.m4a ) ]]; then
  M4B="$SRC"
  SRC_DIR="$(cd "$(dirname "$SRC")" && pwd)"
elif [[ -d "$SRC" ]]; then
  SRC_DIR="$(cd "$SRC" && pwd)"
  # Find m4b/m4a files at top level (don't recurse — a multi-disc set with nested
  # files is also multi-file and should route to CONVERT).
  mapfile -t M4BS < <(find "$SRC_DIR" -maxdepth 1 -type f \( -iname '*.m4b' -o -iname '*.m4a' \) | sort)
  if (( ${#M4BS[@]} == 0 )); then
    fail_manifest "no .m4b/.m4a file in source_path" 1
  elif (( ${#M4BS[@]} > 1 )); then
    set_fields "state=failed" "error=multi-m4b → use CONVERT path" || true
    echo "relocate: multi-m4b → use CONVERT path (${#M4BS[@]} files)" >&2
    exit 5
  fi
  M4B="${M4BS[0]}"
else
  fail_manifest "source_path is neither file nor directory: $SRC" 1
fi

log "resolved m4b: $M4B"

# --- ffprobe ---------------------------------------------------------------

run_ffprobe() {
  local target="$1"
  if [[ -n "${ABM4B_FFPROBE:-}" ]]; then
    "$ABM4B_FFPROBE" -v error -print_format json -show_format -show_streams "$target"
  else
    local dir base
    dir="$(cd "$(dirname "$target")" && pwd)"
    base="$(basename "$target")"
    docker run --rm \
      --entrypoint ffprobe \
      -v "$dir:/in:ro" \
      "${FFPROBE_IMAGE:-jrottenberg/ffmpeg:latest}" \
      -v error -print_format json -show_format -show_streams "/in/$base"
  fi
}

PROBE_JSON="$(mktemp -t audiobook-m4b-relocate.XXXXXX.json)"
trap 'rm -f "$PROBE_JSON"' EXIT

if ! run_ffprobe "$M4B" > "$PROBE_JSON" 2>/dev/null; then
  fail_manifest "ffprobe failed on $M4B" 1
fi

# --- Evaluate probe: DRM, acceptability ------------------------------------

EVAL="$(python3 - "$PROBE_JSON" "$SRC_DIR" <<'PY'
import json, os, sys, glob
probe = json.load(open(sys.argv[1]))
src_dir = sys.argv[2]

streams = probe.get("streams", []) or []
fmt = probe.get("format", {}) or {}
tags = {k.lower(): v for k, v in (fmt.get("tags") or {}).items()}

# DRM detection
encoder = (tags.get("encoder") or "").lower()
codecs = [(s.get("codec_name") or "").lower() for s in streams]
drm = ("encrypted" in encoder) or any(c in ("aax", "aac_aax") for c in codecs)

# Cover detection: embedded video stream OR sibling cover.*
has_embedded_cover = any(s.get("codec_type") == "video" for s in streams)
sibling_cover = ""
for ext in ("jpg", "jpeg", "png", "webp"):
    matches = glob.glob(os.path.join(src_dir, f"cover.{ext}"))
    if matches:
        sibling_cover = matches[0]
        break
has_cover = has_embedded_cover or bool(sibling_cover)

title = (tags.get("title") or "").strip()
artist = (tags.get("artist") or "").strip()
album = (tags.get("album") or "").strip()
genre = (tags.get("genre") or "").lower()
has_tags = bool(title) and bool(artist) and bool(album)
has_audiobook_genre = "audiobook" in genre

acceptable = has_tags and has_cover and has_audiobook_genre

print(json.dumps({
    "drm": drm,
    "has_tags": has_tags,
    "has_cover": has_cover,
    "has_embedded_cover": has_embedded_cover,
    "sibling_cover": sibling_cover,
    "acceptable": acceptable,
    "title": title,
    "artist": artist,
    "album": album,
}))
PY
)"

DRM="$(echo "$EVAL" | python3 -c 'import json,sys; print(json.load(sys.stdin)["drm"])')"
ACCEPTABLE="$(echo "$EVAL" | python3 -c 'import json,sys; print(json.load(sys.stdin)["acceptable"])')"
SIBLING_COVER="$(echo "$EVAL" | python3 -c 'import json,sys; print(json.load(sys.stdin)["sibling_cover"])')"

if [[ "$DRM" == "True" ]]; then
  fail_manifest "DRM detected — de-DRM upstream (Libation/OpenAudible); relocate rejected" 4
fi

# --- Workspace setup -------------------------------------------------------

WORKSPACE_ROOT="${ABM4B_WORKSPACE:-/tmp/audiobook-m4b}"
WORKSPACE="$WORKSPACE_ROOT/$JOBID/workspace"
mkdir -p "$WORKSPACE"

OUT_M4B="$WORKSPACE/$(basename "$M4B")"
cp -f "$M4B" "$OUT_M4B"
if [[ -n "$SIBLING_COVER" && -f "$SIBLING_COVER" ]]; then
  cp -f "$SIBLING_COVER" "$WORKSPACE/$(basename "$SIBLING_COVER")"
fi

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
  log "metadata not acceptable — retag required"

  # Prefer audnex, fall back to existing tags (from probe eval) or fallback_metadata.
  AUDNEX_TITLE="$(read_field audnex.title)"
  AUDNEX_AUTHOR="$(read_field audnex.author)"
  AUDNEX_YEAR="$(read_field audnex.year)"
  AUDNEX_DESC="$(read_field audnex.description)"

  # Fall back to fallback_metadata when audnex is absent.
  if [[ -z "$AUDNEX_TITLE" ]]; then
    AUDNEX_TITLE="$(read_field fallback_metadata.title)"
  fi
  if [[ -z "$AUDNEX_AUTHOR" ]]; then
    AUDNEX_AUTHOR="$(read_field fallback_metadata.author)"
  fi

  # Last resort: use existing ID3 tags read from the probe (stored in EVAL json).
  if [[ -z "$AUDNEX_TITLE" ]]; then
    AUDNEX_TITLE="$(echo "$EVAL" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("title",""))')"
  fi
  if [[ -z "$AUDNEX_AUTHOR" ]]; then
    AUDNEX_AUTHOR="$(echo "$EVAL" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("artist",""))')"
  fi

  if [[ -z "$AUDNEX_TITLE" || -z "$AUDNEX_AUTHOR" ]]; then
    fail_manifest "no title/author available for retag (audnex and fallback_metadata both missing)" 3
  fi

  DOCKER_BIN="${ABM4B_DOCKER:-docker}"
  DIR="$(cd "$(dirname "$OUT_M4B")" && pwd)"
  BASE="$(basename "$OUT_M4B")"

  # Build args. description intentionally simple — quoting robust via array.
  META_ARGS=(
    run --rm
    -v "$DIR:/mnt"
    sandreas/m4b-tool:latest
    meta "/mnt/$BASE"
    "--name=$AUDNEX_TITLE"
    "--artist=$AUDNEX_AUTHOR"
    "--album=$AUDNEX_TITLE"
    "--genre=Audiobook"
  )
  [[ -n "$AUDNEX_YEAR" ]] && META_ARGS+=("--year=$AUDNEX_YEAR")
  [[ -n "$AUDNEX_DESC" ]] && META_ARGS+=("--description=$AUDNEX_DESC")

  # Capture stderr for diagnostics on failure.
  retag_err="$(mktemp -t audiobook-m4b-retag-err.XXXXXX)"
  if ! "$DOCKER_BIN" "${META_ARGS[@]}" >/dev/null 2>"$retag_err"; then
    err_msg="$(head -c 400 "$retag_err" 2>/dev/null | tr '\n' ' ')"
    rm -f "$retag_err"
    fail_manifest "retag (m4b-tool meta) failed: $err_msg" 2
  fi
  rm -f "$retag_err"
  log "retag succeeded"
fi

# --- Verify ---------------------------------------------------------------
# (output_path already written above, immediately after the workspace copy —
#  before the retag block, which can bail via fail_manifest.)

if [[ "${ABM4B_SKIP_VERIFY:-0}" != "1" ]]; then
  if ! bash "$SCRIPT_DIR/verify_output.sh" "$OUT_M4B" "$MANIFEST"; then
    # verify_output.sh itself writes state=failed + diagnostics.
    echo "relocate: verify failed — see manifest" >&2
    exit 1
  fi
fi

log "relocate complete: $OUT_M4B"
exit 0
