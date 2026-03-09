#!/bin/bash
# wait-for-server.sh - Wait for a web server to become available
# Usage: wait-for-server.sh <url> <timeout_seconds>

set -e

URL="${1:-http://localhost:5173}"
TIMEOUT="${2:-30}"
START_TIME=$(date +%s)

echo "Waiting for server at $URL (timeout: ${TIMEOUT}s)..."

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))

    if [ $ELAPSED -ge $TIMEOUT ]; then
        echo "ERROR: Server did not become available within ${TIMEOUT}s"
        exit 1
    fi

    # Try to connect to the server (suppress curl output)
    if curl -s -f -o /dev/null "$URL" 2>/dev/null; then
        echo "Server is ready at $URL"
        exit 0
    fi

    # Wait before retrying
    sleep 0.5
done
