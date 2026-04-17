#!/bin/bash
set -boe
yarn install --frozen-lockfile
git clone git@github.com:StarRocks/starrocks.git temp
npm run copy
export DOCUSAURUS_IGNORE_SSG_WARNINGS=true
export NODE_OPTIONS="--max-old-space-size=8192"
export DOCUSAURUS_SSR_CONCURRENCY=8
export DOCUSAURUS_PERF_LOGGER=true
yarn clear && yarn build && yarn serve
