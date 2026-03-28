#!/bin/bash
#
# Bundle Analysis Script
# Analyzes Vite build output and compares against a performance baseline.
#
# Usage:
#   bash scripts/workflow/analyze-bundle.sh --dist-dir=dist --baseline=docs/reviews/performance/baseline.json
#   bash scripts/workflow/analyze-bundle.sh --dist-dir=dist --create-baseline=docs/reviews/performance/baseline.json
#
# Exit codes:
#   0 - PASS or WARNING (no regression)
#   1 - REGRESSION detected (>25% total JS increase or single chunk >100KB growth)
#
# Output:
#   JSON comparison results to stdout
#   Human-readable progress to stderr

set -euo pipefail

# Colors for stderr output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DIST_DIR=""
BASELINE_PATH=""
CREATE_BASELINE=""

# Parse arguments
for arg in "$@"; do
  case $arg in
    --dist-dir=*)
      DIST_DIR="${arg#*=}"
      ;;
    --baseline=*)
      BASELINE_PATH="${arg#*=}"
      ;;
    --create-baseline=*)
      CREATE_BASELINE="${arg#*=}"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if [ -z "$DIST_DIR" ]; then
  echo "Error: --dist-dir is required" >&2
  exit 1
fi

ASSETS_DIR="${DIST_DIR}/assets"

if [ ! -d "$ASSETS_DIR" ]; then
  echo "Error: Assets directory not found: ${ASSETS_DIR}" >&2
  exit 1
fi

# Scan dist/assets for JS and CSS files, output JSON with sizes
scan_assets() {
  python3 -c "
import os, json, sys

assets_dir = sys.argv[1]
chunks = {}
total_js = 0
total_css = 0

for f in sorted(os.listdir(assets_dir)):
    fpath = os.path.join(assets_dir, f)
    if not os.path.isfile(fpath):
        continue
    size = os.path.getsize(fpath)
    if f.endswith('.js'):
        total_js += size
        # Strip hash: 'index-R7j1of8u.js' -> 'index'
        # Split on '.js', take the name part, then strip the hash
        name_part = f[:-3]  # remove .js
        # Find last '-' that precedes a hash (8+ chars of alphanumeric)
        import re
        m = re.match(r'^(.+)-[A-Za-z0-9_]{6,}$', name_part)
        if m:
            chunk_name = m.group(1)
        else:
            chunk_name = name_part
        chunks[chunk_name] = {'raw': size, 'file': f}
    elif f.endswith('.css'):
        total_css += size
        name_part = f[:-4]  # remove .css
        import re
        m = re.match(r'^(.+)-[A-Za-z0-9_]{6,}$', name_part)
        if m:
            chunk_name = m.group(1)
        else:
            chunk_name = name_part
        chunks[chunk_name] = {'raw': size, 'file': f}

result = {
    'total_js_bytes': total_js,
    'total_css_bytes': total_css,
    'chunks': chunks
}
print(json.dumps(result))
" "$ASSETS_DIR"
}

# Create baseline mode
if [ -n "$CREATE_BASELINE" ]; then
  echo -e "${BLUE}ℹ${NC} Scanning assets in ${ASSETS_DIR}..." >&2
  SCAN_RESULT=$(scan_assets)

  COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  CAPTURED_AT=$(date +%Y-%m-%d)

  # Create baseline directory if needed
  mkdir -p "$(dirname "$CREATE_BASELINE")"

  python3 -c "
import json, sys

scan = json.loads(sys.argv[1])
commit = sys.argv[2]
captured_at = sys.argv[3]
output_path = sys.argv[4]

baseline = {
    'captured_at': captured_at,
    'commit': commit,
    'bundle': scan,
    'page_metrics': {}
}

with open(output_path, 'w') as f:
    json.dump(baseline, f, indent=2)
    f.write('\n')

total_js_kb = scan['total_js_bytes'] / 1024
total_css_kb = scan['total_css_bytes'] / 1024
num_chunks = len(scan['chunks'])
print(f'Baseline created: {total_js_kb:.1f}KB JS, {total_css_kb:.1f}KB CSS, {num_chunks} chunks', file=sys.stderr)
" "$SCAN_RESULT" "$COMMIT" "$CAPTURED_AT" "$CREATE_BASELINE"

  echo -e "${GREEN}✓${NC} Baseline written to ${CREATE_BASELINE}" >&2
  exit 0
fi

# Compare mode
if [ -z "$BASELINE_PATH" ]; then
  echo "Error: either --baseline or --create-baseline is required" >&2
  exit 1
fi

if [ ! -f "$BASELINE_PATH" ]; then
  echo "Error: Baseline file not found: ${BASELINE_PATH}" >&2
  exit 1
fi

echo -e "${BLUE}ℹ${NC} Scanning current build assets..." >&2
SCAN_RESULT=$(scan_assets)

echo -e "${BLUE}ℹ${NC} Comparing against baseline..." >&2

# Compare and produce JSON output
python3 -c "
import json, sys

current = json.loads(sys.argv[1])
with open(sys.argv[2], 'r') as f:
    baseline = json.load(f)

b = baseline['bundle']

# Total JS comparison
b_js = b['total_js_bytes']
c_js = current['total_js_bytes']
js_delta_pct = ((c_js - b_js) / b_js * 100) if b_js > 0 else 0

# Total CSS comparison
b_css = b['total_css_bytes']
c_css = current['total_css_bytes']
css_delta_pct = ((c_css - b_css) / b_css * 100) if b_css > 0 else 0

# Per-chunk comparison
b_chunks = b.get('chunks', {})
c_chunks = current.get('chunks', {})

chunk_regressions = []
for name, cdata in c_chunks.items():
    if name in b_chunks:
        bsize = b_chunks[name]['raw']
        csize = cdata['raw']
        delta = csize - bsize
        if delta > 100 * 1024:  # >100KB raw increase
            chunk_regressions.append({
                'name': name,
                'baseline': bsize,
                'current': csize,
                'delta': delta
            })

new_chunks = sorted([n for n in c_chunks if n not in b_chunks])
removed_chunks = sorted([n for n in b_chunks if n not in c_chunks])

# Determine status
status = 'pass'
if js_delta_pct > 25 or len(chunk_regressions) > 0:
    status = 'regression'
elif js_delta_pct > 15:
    status = 'warning'

result = {
    'status': status,
    'total_js_bytes': {
        'baseline': b_js,
        'current': c_js,
        'delta_pct': round(js_delta_pct, 2)
    },
    'total_css_bytes': {
        'baseline': b_css,
        'current': c_css,
        'delta_pct': round(css_delta_pct, 2)
    },
    'chunk_regressions': chunk_regressions,
    'new_chunks': new_chunks,
    'removed_chunks': removed_chunks
}

# Human-readable summary to stderr
print(f'Total JS: {c_js:,} bytes (baseline: {b_js:,}, delta: {js_delta_pct:+.1f}%)', file=sys.stderr)
print(f'Total CSS: {c_css:,} bytes (baseline: {b_css:,}, delta: {css_delta_pct:+.1f}%)', file=sys.stderr)
if new_chunks:
    print(f'New chunks: {len(new_chunks)}', file=sys.stderr)
if removed_chunks:
    print(f'Removed chunks: {len(removed_chunks)}', file=sys.stderr)
if chunk_regressions:
    for cr in chunk_regressions:
        print(f'CHUNK REGRESSION: {cr[\"name\"]} grew by {cr[\"delta\"]:,} bytes ({cr[\"baseline\"]:,} -> {cr[\"current\"]:,})', file=sys.stderr)

if status == 'regression':
    print('STATUS: REGRESSION', file=sys.stderr)
elif status == 'warning':
    print('STATUS: WARNING (>15% JS increase)', file=sys.stderr)
else:
    print('STATUS: PASS', file=sys.stderr)

# JSON to stdout
print(json.dumps(result, indent=2))

sys.exit(1 if status == 'regression' else 0)
" "$SCAN_RESULT" "$BASELINE_PATH"
