#!/usr/bin/env bash
# publish_to_library.sh — moves a verified m4b into the Audiobookshelf library.
#
# Usage: bash publish_to_library.sh <manifest.json>
#
# Reads manifest fields:
#   output_path       — the verified .m4b in workspace (required)
#   audnex            — {author, title, series?} metadata sub-object (required)
#   cover_path        — optional path to cover.jpg
#   debug_metadata    — optional bool (default true); writes audnex payload to metadata.json
#
# Target: $LIBRARY_ROOT/<Author>/[<Series>/]<Book Title>/<Book Title>.m4b
#
# Env overrides (for tests):
#   LIBRARY_ROOT      — if already exported, load_config.sh is skipped.
#
# Exit codes:
#   0  published
#   1  duplicate target (existing .m4b); does NOT overwrite
#   2  I/O error

set -uo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: publish_to_library.sh <manifest.json>" >&2
  exit 2
fi

MANIFEST="$1"

if [[ ! -f "$MANIFEST" ]]; then
  echo "❌ publish: manifest not found: $MANIFEST" >&2
  exit 2
fi

# Load config only if LIBRARY_ROOT not already set (tests override it).
if [[ -z "${LIBRARY_ROOT:-}" ]]; then
  # shellcheck disable=SC1091
  source "$(dirname "$0")/load_config.sh"
fi

if [[ -z "${LIBRARY_ROOT:-}" ]]; then
  echo "❌ publish: LIBRARY_ROOT not set" >&2
  exit 2
fi

python3 - "$MANIFEST" "$LIBRARY_ROOT" <<'PYEOF'
import json, os, shutil, sys, re, errno
from datetime import datetime, timezone

manifest_path = sys.argv[1]
library_root = sys.argv[2]

with open(manifest_path) as f:
    manifest = json.load(f)

output_path = manifest.get("output_path")
audnex = manifest.get("audnex") or {}
cover_path = manifest.get("cover_path")
debug_metadata = manifest.get("debug_metadata", True)

if not output_path or not os.path.isfile(output_path):
    print(f"❌ publish: output_path missing or not a file: {output_path}", file=sys.stderr)
    sys.exit(2)

fallback = manifest.get("fallback_metadata") or {}

author = (audnex.get("author") or fallback.get("author") or "").strip()
title = (audnex.get("title") or fallback.get("title") or "").strip()
# Invariant: audnex.series may be a dict {name, position} OR a bare string.
# Both shapes appear in real audnex payloads — DO NOT simplify this to
# `str(audnex["series"])`, which would yield "{'name': 'Foo', ...}" as a
# path segment and poison the library tree. Both branches are exercised by
# tests; keep the isinstance check.
series = ""
if audnex.get("series"):
    series = (audnex["series"].get("name") or "").strip() if isinstance(audnex["series"], dict) else str(audnex["series"]).strip()

if not author or not title:
    print(f"❌ publish: author and title required (got author={author!r} title={title!r}; checked audnex + fallback_metadata)", file=sys.stderr)
    sys.exit(2)

# Sanitize a single path segment.
ILLEGAL = re.compile(r'[:/?*<>|"]')
ALLOWED = re.compile(r"[^A-Za-z0-9 \-_.()']")

def sanitize_segment(s, max_stem=None):
    # Replace illegal chars with " - "
    s = ILLEGAL.sub(" - ", s)
    # Drop any remaining unusual characters.
    s = ALLOWED.sub("", s)
    # Collapse whitespace.
    s = re.sub(r"\s+", " ", s).strip()
    # Trim leading/trailing dots (Windows hostile; also ugly on Unraid shares).
    s = s.strip(".")
    if not s:
        s = "Unknown"
    if max_stem is not None and len(s) > max_stem:
        # Truncate and append ellipsis marker. Reserve 1 char for the ellipsis.
        s = s[: max_stem - 1].rstrip() + "…"
    return s

author_seg = sanitize_segment(author)
series_seg = sanitize_segment(series) if series else ""
# Book dir + filename stem share the same 120-char cap.
title_seg = sanitize_segment(title, max_stem=120)

parts = [library_root, author_seg]
if series_seg:
    parts.append(series_seg)
parts.append(title_seg)
target_dir = os.path.join(*parts)
target_file = os.path.join(target_dir, f"{title_seg}.m4b")

# Duplicate detection: any existing .m4b in the target dir is a block.
if os.path.isdir(target_dir):
    existing = [f for f in os.listdir(target_dir) if f.lower().endswith(".m4b")]
    if existing:
        print(f"❌ publish: duplicate target — {target_dir} already has {existing[0]!r}. "
              f"Approve overwrite or rename manually.", file=sys.stderr)
        sys.exit(1)

try:
    os.makedirs(target_dir, exist_ok=True)
except OSError as e:
    print(f"❌ publish: mkdir failed: {e}", file=sys.stderr)
    sys.exit(2)

# Move the m4b. Prefer rename (atomic same-volume). Fall back on EXDEV.
try:
    os.rename(output_path, target_file)
except OSError as e:
    if e.errno == errno.EXDEV:
        try:
            shutil.copy2(output_path, target_file)
            os.remove(output_path)
        except OSError as e2:
            print(f"❌ publish: cross-device copy failed: {e2}", file=sys.stderr)
            sys.exit(2)
    else:
        print(f"❌ publish: move failed: {e}", file=sys.stderr)
        sys.exit(2)

# Copy cover if present.
if cover_path and os.path.isfile(cover_path):
    try:
        shutil.copy2(cover_path, os.path.join(target_dir, "cover.jpg"))
    except OSError as e:
        print(f"❌ publish: cover copy failed: {e}", file=sys.stderr)
        sys.exit(2)

# Debug metadata dump.
if debug_metadata is not False:
    try:
        with open(os.path.join(target_dir, "metadata.json"), "w") as mf:
            json.dump(audnex, mf, indent=2)
    except OSError as e:
        print(f"❌ publish: metadata.json write failed: {e}", file=sys.stderr)
        sys.exit(2)

now = datetime.now(timezone.utc).isoformat()
manifest["state"] = "published"
manifest["target_path"] = target_file
manifest["finished_at"] = now

tmp = manifest_path + ".tmp"
with open(tmp, "w") as f:
    json.dump(manifest, f, indent=2)
os.replace(tmp, manifest_path)

print(target_file)
sys.exit(0)
PYEOF
exit $?
