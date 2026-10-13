#!/usr/bin/env bash
set -euo pipefail

# Run from the reviewed repository checkout. Old Samson/base drafts fail here.
test -f ops/cloud-audit/run.mjs
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 13)) throw new Error("Node >=22.13 required")'
npm ci --no-audit --no-fund
node node_modules/playwright/cli.js install --with-deps chromium
node --test ops/cloud-audit/tests/*.test.mjs ops/develop-events/tests/*.test.mjs
