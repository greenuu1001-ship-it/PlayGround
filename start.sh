#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_DIR="$(pwd)"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
BUILD_DIR="${BUILD_DIR:-$PROJECT_DIR/dist}"
PORT="${PORT:-3000}"
export PROJECT_DIR BUILD_DIR PORT

/usr/bin/time -p test -f site/index.html
/usr/bin/time -p mkdir -p "$WEB_DIR"

if [[ -f package.json ]]; then
  if [[ -f package-lock.json ]]; then
    /usr/bin/time -p npm ci --no-audit --no-fund
  else
    /usr/bin/time -p npm install --no-audit --no-fund
  fi
  if /usr/bin/time -p node -e 'const p=require("./package.json");process.exit(p.scripts&&p.scripts.build?0:1)'; then
    /usr/bin/time -p npm run build
  else
    /usr/bin/time -p node scripts/build.mjs
  fi
else
  /usr/bin/time -p node scripts/build.mjs
fi

/usr/bin/time -p test -f "$BUILD_DIR/index.html"
/usr/bin/time -p node -e 'const fs=require("node:fs");const path=require("node:path");const [project,directory,file]=process.argv.slice(1);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify({project,directory}))' "$PROJECT_DIR" "$BUILD_DIR" "$WEB_DIR/deployment-output.json"

exec /usr/bin/time -p node scripts/serve.mjs
