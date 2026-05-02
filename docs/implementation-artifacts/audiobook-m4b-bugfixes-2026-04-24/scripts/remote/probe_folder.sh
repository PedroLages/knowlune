#!/bin/bash
# probe_folder.sh — runs on titan. ffprobes every audio file in each folder arg.
# Emits JSONL to stdout (one JSON record per line). See probe_sources.sh for schema.
#
# Usage (on titan): bash /tmp/audiobook-m4b/probe_folder.sh <folder1> [<folder2> ...]
#
# FFPROBE_IMAGE env var controls which Docker image provides ffprobe.
# Default: jrottenberg/ffmpeg:latest (sandreas/m4b-tool dropped ffprobe upstream).
# Override with: FFPROBE_IMAGE=<image> bash probe_folder.sh ...

set -u   # undefined-var fail, but let individual commands fail without abort

FFPROBE_IMAGE="${FFPROBE_IMAGE:-jrottenberg/ffmpeg:latest}"

json_str() {
  python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"
}

for folder in "$@"; do
  if [ ! -e "$folder" ]; then
    printf '{"kind":"folder_error","path":%s,"error":"missing"}\n' "$(json_str "$folder")"
    continue
  fi
  if [ ! -r "$folder" ]; then
    printf '{"kind":"folder_error","path":%s,"error":"unreadable"}\n' "$(json_str "$folder")"
    continue
  fi

  printf '{"kind":"folder_start","path":%s}\n' "$(json_str "$folder")"

  has_cover=false
  for c in cover.jpg cover.jpeg cover.png folder.jpg folder.jpeg front.jpg front.jpeg; do
    if [ -f "$folder/$c" ]; then
      has_cover=true
      break
    fi
  done
  printf '{"kind":"folder_cover","path":%s,"has_cover":%s}\n' "$(json_str "$folder")" "$has_cover"

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

  if [ "${#audio_files[@]}" -eq 0 ]; then
    printf '{"kind":"folder_empty","path":%s}\n' "$(json_str "$folder")"
    continue
  fi

  for af in "${audio_files[@]}"; do
    probe_dir="$(dirname "$af")"
    probe_base="$(basename "$af")"
    probe_err_file="$(mktemp -t audiobook-m4b-ffprobe.XXXXXX.err)"
    probe_json=$(
      docker run --rm \
        -v "$probe_dir":/probe:ro \
        --entrypoint ffprobe \
        "$FFPROBE_IMAGE" \
        -v error -print_format json \
        -show_format -show_streams \
        "/probe/$probe_base" 2>"$probe_err_file"
    ) || probe_json=""
    probe_err="$(head -c 200 "$probe_err_file" 2>/dev/null | tr -d '\r' | tr '\n' ' ')"
    rm -f "$probe_err_file"

    if [ -z "$probe_json" ]; then
      printf '{"kind":"file_error","folder":%s,"path":%s,"error":"ffprobe_failed","stderr":%s,"image":%s}\n' \
        "$(json_str "$folder")" "$(json_str "$af")" \
        "$(json_str "$probe_err")" "$(json_str "$FFPROBE_IMAGE")"
      continue
    fi

    python3 - "$folder" "$af" "$probe_json" <<'PYEOF'
import json, sys
folder, path, probe = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    d = json.loads(probe)
except json.JSONDecodeError:
    print(json.dumps({"kind":"file_error","folder":folder,"path":path,"error":"ffprobe_invalid_json"}))
    sys.exit(0)

fmt = d.get("format", {}) or {}
streams = d.get("streams", []) or []
audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
has_video = any(s.get("codec_type") == "video" for s in streams)
tags = fmt.get("tags", {}) or {}

def tag(k):
    for candidate in (k, k.lower(), k.upper(), k.capitalize()):
        if candidate in tags:
            return tags[candidate]
    return None

def int_or_none(v):
    try:
        return int(v) if v is not None else None
    except (ValueError, TypeError):
        return None

def float_or_none(v):
    try:
        return float(v) if v is not None else None
    except (ValueError, TypeError):
        return None

bit_rate = int_or_none((audio or {}).get("bit_rate") or fmt.get("bit_rate"))
sample_rate = int_or_none((audio or {}).get("sample_rate"))
duration = float_or_none(fmt.get("duration") or (audio or {}).get("duration"))
codec = (audio or {}).get("codec_name")

def split_num(s):
    if s is None:
        return None
    return int_or_none(str(s).split("/")[0].strip())

rec = {
    "kind": "file_result",
    "folder": folder,
    "path": path,
    "basename": path.rsplit("/", 1)[-1],
    "codec": codec,
    "bit_rate": bit_rate,
    "sample_rate": sample_rate,
    "duration": duration,
    "disc": split_num(tag("disc")),
    "track": split_num(tag("track")),
    "title_tag": tag("title"),
    "artist_tag": tag("artist") or tag("album_artist"),
    "album_tag": tag("album"),
    "has_embedded_cover": has_video,
}
print(json.dumps(rec))
PYEOF
  done

  printf '{"kind":"folder_end","path":%s}\n' "$(json_str "$folder")"
done
