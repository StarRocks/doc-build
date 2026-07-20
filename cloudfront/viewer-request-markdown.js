// CloudFront Function (event type: viewer-request)
// -----------------------------------------------------------------------------
// Content negotiation for AI agents.
//
// When a client requests a documentation page with `Accept: text/markdown`
// (Claude Code, Cursor, OpenCode, etc. do this), rewrite the request URI to the
// Markdown twin of the page so CloudFront serves the .md file instead of HTML.
//
// The site uses trailingSlash: true, so page routes look like
//   /docs/administration/cluster_snapshot/
// and the generated Markdown lives at the sibling key
//   /docs/administration/cluster_snapshot.md
// i.e. "strip the trailing slash, append .md".
//
// Only page routes that actually have a .md twin are rewritten. Markdown is
// generated for the en locale only, for the latest doc version (served at
// /docs/ with no version prefix) and all /releasenotes/ pages — and NOT for
// older versions (/docs/4.0/, /docs/3.5/, ...) or the navigation/index routes
// excluded in docusaurus.config.js. Everything else — requests without
// text/markdown, assets, localized (/zh/, /ja/) routes, and docs routes with no
// .md twin — is passed through unchanged so agents get HTML rather than a 404.
//
// Because the URI is rewritten before the cache lookup, the Markdown and HTML
// responses cache under distinct keys automatically — no need to add the Accept
// header to the cache key.
//
// Runtime: cloudfront-js-2.0
// -----------------------------------------------------------------------------

function handler(event) {
  var request = event.request;

  var acceptHeader = request.headers.accept;
  var accept = acceptHeader ? acceptHeader.value : '';
  if (accept.indexOf('text/markdown') === -1) {
    return request;
  }

  var uri = request.uri;

  // Only page routes (trailing slash). Assets have file extensions; .md/.txt
  // and other files do not end with '/'.
  if (uri.charAt(uri.length - 1) !== '/') {
    return request;
  }

  // Release notes: all pages have Markdown twins.
  if (uri.indexOf('/releasenotes/') === 0) {
    request.uri = uri.substring(0, uri.length - 1) + '.md';
    return request;
  }

  // Docs: only rewrite when a Markdown twin actually exists. Routes without one
  // (older versions, navigation/index pages) are left as HTML so agents get a
  // real page rather than a 404 on a missing .md object.
  if (uri.indexOf('/docs/') === 0 && docHasMarkdownTwin(uri)) {
    request.uri = uri.substring(0, uri.length - 1) + '.md';
  }

  return request;
}

// Returns true if a /docs/ page route has a generated .md twin.
//
// Markdown is generated only for the LATEST version (served at /docs/ with no
// version prefix) and excludes the navigation/index routes listed in
// docusaurus.config.js (`markdown.excludeRoutes`). Keep EXCLUDED in sync with
// that config.
function docHasMarkdownTwin(uri) {
  var afterDocs = uri.substring(6); // strip leading "/docs/"
  var firstSeg = afterDocs.split('/')[0];

  // "/docs/" root itself has no .md twin.
  if (firstSeg === '') {
    return false;
  }

  // Older versions are served at /docs/<major>.<minor>/... and have no .md.
  // e.g. /docs/4.0/, /docs/3.5/, /docs/2.5/
  if (/^[0-9]+\.[0-9]+/.test(firstSeg)) {
    return false;
  }

  // Navigation-only route trees excluded from Markdown generation.
  if (
    uri.indexOf('/docs/category/') === 0 ||
    uri.indexOf('/docs/cover_pages/') === 0
  ) {
    return false;
  }

  // Specific index/landing pages excluded from Markdown generation.
  var EXCLUDED = {
    '/docs/administration/': true,
    '/docs/administration/management/': true,
    '/docs/administration/management/configuration/': true,
    '/docs/benchmarking/': true,
    '/docs/data_source/catalog/catalog_intro/': true,
    '/docs/faq/': true,
    '/docs/integrations/': true,
    '/docs/integrations/streaming/': true,
    '/docs/integrations/streaming/apache_kafka/': true,
    '/docs/introduction/': true,
    '/docs/loading/': true,
    '/docs/loading/loading_introduction/loading_overview/': true,
    '/docs/loading/objectstorage/': true,
    '/docs/project_help/': true,
    '/docs/sql-reference/data-types/': true,
    '/docs/sql-reference/data-types/date-types/': true,
    '/docs/sql-reference/sql-functions/': true,
    '/docs/sql-reference/sql-functions/date-time-functions/': true,
    '/docs/unloading/': true,
  };
  return !EXCLUDED[uri];
}
