#!/bin/bash
yarn install --frozen-lockfile
git clone git@github.com:StarRocks/starrocks.git temp
npm run copy
export DOCUSAURUS_IGNORE_SSG_WARNINGS=true
export NODE_OPTIONS="--max-old-space-size=8192"
yarn clear && yarn build && yarn serve

