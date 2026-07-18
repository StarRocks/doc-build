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
// Only page routes under /docs/ and /releasenotes/ are rewritten — those are
// the only routes for which the llms-txt plugin generates .md files (en locale
// only). Requests without text/markdown, asset requests, and localized
// (/zh/, /ja/) routes are passed through unchanged.
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

  // Only the en documentation routes that have Markdown twins.
  if (uri.indexOf('/docs/') === 0 || uri.indexOf('/releasenotes/') === 0) {
    request.uri = uri.substring(0, uri.length - 1) + '.md';
  }

  return request;
}
