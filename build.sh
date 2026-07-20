#!/bin/bash
set -euo pipefail
yarn install --frozen-lockfile
git clone git@github.com:StarRocks/starrocks.git temp
npm run copy
export DOCUSAURUS_IGNORE_SSG_WARNINGS=true
export NODE_OPTIONS="--max-old-space-size=12288"
export DOCUSAURUS_SSR_CONCURRENCY=2
export DOCUSAURUS_PERF_LOGGER=false
yarn clear && yarn build
# Agent-friendly docs: prepend markdown directives + split llms.txt into a
# root index and per-section files. Must run AFTER the build completes.
node scripts/llms-postprocess.js build
yarn serve
