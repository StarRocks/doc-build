#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Guard against drift between the build-time exclusion list and the CloudFront
// Function that serves Markdown.
//
// src/agentDocsRoutes.js decides which routes get a .md twin generated.
// cloudfront/viewer-request-markdown.js decides which routes get rewritten to
// their .md twin when a client sends `Accept: text/markdown`. The Function runs
// in an isolated CloudFront runtime with no module system, so it cannot import
// the shared list — it keeps a literal copy. If the two disagree:
//
//   - route excluded in the config but not in the Function -> agents asking for
//     Markdown get a 404 (or, with the soft-404 behavior, a 200 of nothing).
//   - route excluded in the Function but not in the config -> a .md file exists
//     that content negotiation will never serve.
//
// This is a CHECK, not a code generator: the Function is deployed to AWS by
// hand, so regenerating the file would imply a sync with the live distribution
// that this repo cannot guarantee. When this fails, fix the Function file AND
// redeploy it (see cloudfront/README.md).
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const {EXCLUDED_ROUTES, EXCLUDED_ROUTE_TREES} = require('../src/agentDocsRoutes');

const FUNCTION_PATH = path.join(
  __dirname,
  '..',
  'cloudfront',
  'viewer-request-markdown.js',
);

function fail(message, details) {
  console.error(`\n✖ CloudFront exclusion drift: ${message}\n`);
  if (details) {
    console.error(details);
  }
  console.error(
    `\nReconcile cloudfront/viewer-request-markdown.js with src/agentDocsRoutes.js,` +
      `\nthen redeploy the Function per cloudfront/README.md.\n`,
  );
  process.exit(1);
}

const source = fs.readFileSync(FUNCTION_PATH, 'utf8');

// Pull the EXCLUDED object literal out of docHasMarkdownTwin().
const excludedBlock = source.match(/var EXCLUDED = \{([\s\S]*?)\};/);
if (!excludedBlock) {
  fail(
    `could not find the "var EXCLUDED = { ... };" literal in ${path.relative(process.cwd(), FUNCTION_PATH)}`,
  );
}

const functionRoutes = new Set(
  [...excludedBlock[1].matchAll(/'([^']+)'\s*:\s*true/g)].map((m) => m[1]),
);

const configRoutes = new Set(EXCLUDED_ROUTES);

const missingInFunction = [...configRoutes].filter((r) => !functionRoutes.has(r));
const missingInConfig = [...functionRoutes].filter((r) => !configRoutes.has(r));

if (missingInFunction.length || missingInConfig.length) {
  const details = [
    missingInFunction.length
      ? `Excluded in src/agentDocsRoutes.js but NOT in the CloudFront Function\n` +
        `(agents requesting Markdown for these would get a missing .md):\n` +
        missingInFunction.map((r) => `    ${r}`).join('\n')
      : null,
    missingInConfig.length
      ? `Excluded in the CloudFront Function but NOT in src/agentDocsRoutes.js\n` +
        `(a .md twin exists that content negotiation will never serve):\n` +
        missingInConfig.map((r) => `    ${r}`).join('\n')
      : null,
  ]
    .filter(Boolean)
    .join('\n\n');
  fail(`${missingInFunction.length + missingInConfig.length} route(s) out of sync`, details);
}

// The tree-level exclusions are expressed as prefix checks in the Function
// rather than map keys, so verify each prefix is referenced somewhere.
const missingTrees = EXCLUDED_ROUTE_TREES.filter(
  (tree) => !source.includes(`'${tree}'`),
);
if (missingTrees.length) {
  fail(
    `${missingTrees.length} excluded route tree(s) not referenced in the CloudFront Function`,
    missingTrees.map((t) => `    ${t}`).join('\n'),
  );
}

console.log(
  `✔ CloudFront exclusions in sync (${configRoutes.size} routes, ${EXCLUDED_ROUTE_TREES.length} trees)`,
);
