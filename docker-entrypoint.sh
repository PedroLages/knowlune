#!/bin/sh
set -e

# Start Nginx in the background
nginx -g 'daemon on;'

# Run the AI proxy server in the foreground
exec node server/index.js
