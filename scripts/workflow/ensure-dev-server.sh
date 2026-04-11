#!/bin/bash
#
# Dev Server Health Check / Startup
# Ensures the Vite dev server is reachable for Playwright-based review agents.
#
# Usage:
#   ./ensure-dev-server.sh [--port=5173] [--base-path=PATH]
#
# Stdout contract:
#   JSON: {"status": "running"|"unreachable", "started": true|false}
#   All progress messages → stderr
#
# Exit codes:
#   0 - Server is reachable
#   1 - Server unreachable after timeout

set -euo pipefail

PORT=5173
BASE_PATH=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

for arg in "$@"; do
  case $arg in
    --port=*)
      PORT="${arg#*=}"
      ;;
    --base-path=*)
      BASE_PATH="${arg#*=}"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

URL="http://localhost:${PORT}"

check_server() {
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null || echo "000")
  [ "$code" = "200" ]
}

# Check if already running
if check_server; then
  echo '{"status": "running", "started": false}'
  exit 0
fi

# Start dev server in background
echo "Dev server not reachable — starting npm run dev..." >&2
cd "$BASE_PATH"
npm run dev >/dev/null 2>&1 &

# Poll up to 30 seconds
WAIT=0
while [ $WAIT -lt 30 ]; do
  sleep 2
  WAIT=$((WAIT + 2))
  if check_server; then
    echo "Dev server ready after ${WAIT}s" >&2
    echo '{"status": "running", "started": true}'
    exit 0
  fi
done

echo "Dev server unreachable after 30s" >&2
echo '{"status": "unreachable", "started": false}'
exit 1
