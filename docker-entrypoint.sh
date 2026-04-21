#!/bin/sh
set -e

# Start Nginx in the background
nginx -g 'daemon on;'

# Run the AI proxy server via tsx (same runtime as `npm run server` in dev).
exec npx tsx server/index.ts
