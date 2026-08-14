#!/bin/bash
set -euo pipefail
yarn install --frozen-lockfile
git clone git@github.com:StarRocks/starrocks.git temp
npm run copy
export DOCUSAURUS_IGNORE_SSG_WARNINGS=true
export NODE_OPTIONS="--max-old-space-size=12288"
export DOCUSAURUS_SSR_CONCURRENCY=2
export DOCUSAURUS_PERF_LOGGER=false
# Fails fast if the CloudFront Function's route exclusions have drifted from
# src/agentDocsRoutes.js.
node scripts/check-cloudfront-excludes.js

yarn clear

# One locale per invocation. Building all three in a single `yarn build` peaks
# above the heap and the process gets OOM-killed partway through; a fresh node
# process per locale stays inside the limit.
#
# This only works because docusaurus.config.js pins the zh and ja baseUrls. A
# single `--locale` disables automatic locale-segment inference, so without those
# pins the zh and ja builds land on build/ and wipe the English one. Do not drop
# them.
#
# en must go first: it writes to build/ and Docusaurus clears the output
# directory before writing, so building it after zh/ja would delete them.
#
# A failing locale does NOT stop the run. The locales break independently — a
# broken link in the Japanese translation says nothing about English — and
# stopping at the first failure hides the rest, so a red build gets fixed one
# locale per day. Each locale's failure is recorded and all of them are reported
# together at the end. Guarding with `if` also keeps `set -e` from aborting here.
#
# Plain strings, not arrays: macOS ships bash 3.2, where `${arr[@]}` on an empty
# array trips `set -u`.
failed_locales=""
for locale in en zh ja; do
  echo "=== building locale: ${locale}"
  if yarn build --locale "${locale}"; then
    echo "=== locale ${locale}: OK"
  else
    echo "=== locale ${locale}: FAILED"
    failed_locales="${failed_locales} ${locale}"
  fi
done

# build/ now holds all three: English at /, Chinese at /zh/, Japanese at /ja/.

# The post-build steps rewrite and then audit build/, so they are only meaningful
# once every locale is in place. Skipping them keeps a partial tree from
# producing a confusing second failure that masks the real one.
post_build_status="OK"
if [ -n "${failed_locales}" ]; then
  post_build_status="SKIPPED (a locale build failed)"
else
  # Agent-friendly docs: prepend markdown directives + split llms.txt into a
  # root index and per-section files. Must run AFTER the build completes.
  node scripts/llms-postprocess.js build || post_build_status="FAILED (llms-postprocess)"
  # Fails if archived versions flooded the sitemap, which makes agent checkers
  # sampling its head conclude that Accept: text/markdown is ignored.
  if [ "${post_build_status}" = "OK" ]; then
    node scripts/check-sitemap-markdown-coverage.js build \
      || post_build_status="FAILED (check-sitemap-markdown-coverage)"
  fi
fi

echo
echo "==================== build summary ===================="
for locale in en zh ja; do
  case " ${failed_locales} " in
    *" ${locale} "*) printf '  %-4s FAILED\n' "${locale}" ;;
    *)               printf '  %-4s OK\n'     "${locale}" ;;
  esac
done
echo "  post-build  ${post_build_status}"
echo "======================================================="

if [ -n "${failed_locales}" ] || [ "${post_build_status}" != "OK" ]; then
  echo "build failed:${failed_locales:- (locales OK)}"
  exit 1
fi

yarn serve
