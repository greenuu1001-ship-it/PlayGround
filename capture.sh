#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

/usr/bin/time -p test -n "${CAPTURE_URL:-}"
/usr/bin/time -p test -n "${CAPTURE_DIR:-}"
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
PROJECT_DIR="$(pwd)" /usr/bin/time -p node scripts/capture.mjs
