// Frozen archive navigation guard
// -----------------------------------------------------------------------------
// Doc versions listed in frozenVersions.json are no longer built. The HTML that
// is already in S3 keeps being served (the deploy workflows exclude those trees
// from `aws s3 sync --delete`, and `assets/` is append-only so the hashed chunks
// those pages reference are never removed). See ARCHIVE.md.
//
// The problem this plugin solves: a frozen page's JS bundle still carries the
// route map of the WHOLE site as it stood on freeze day. So a client-side
// navigation from /docs/3.4/... to a current-version route is handled inside the
// frozen bundle and renders a freeze-day snapshot of the then-latest docs under
// a live /docs/... URL. The reader sees stale content at a canonical URL and
// only a manual reload escapes it.
//
// Fix: on frozen pages only, force any navigation that leaves the frozen tree to
// be a real document request. Two layers, because there is more than one way to
// navigate:
//   1. a capture-phase click listener, which stops the router before it starts
//      (the clean path, and the one that covers ordinary links), and
//   2. a history.pushState/replaceState patch, which is the backstop for
//      programmatic navigation — DocSearch results, the locale dropdown,
//      savePreferredVersionName, any direct useHistory() call.
//
// The script is injected into `headTags` so history is patched before the app
// bundle runs, and it self-guards on `location.pathname` at runtime, so it is
// inert on every page that is not inside a frozen tree. That is why it can stay
// registered unconditionally: it costs a few hundred bytes and does nothing
// until a build actually emits a frozen version (i.e. the one-time freeze
// build).
// -----------------------------------------------------------------------------

const frozenVersions = require('../../frozenVersions.json');

// Written as ES5 with no template literals or arrow functions: it runs inline in
// <head>, ahead of any transpiled bundle, so it must be valid as authored.
function buildScript(versions) {
  return `(function () {
  var VERSIONS = ${JSON.stringify(versions)};
  // Each locale is a separate build with its own baseUrl and its own bundle, so
  // a cross-locale navigation has to be a document request too. Deriving the
  // locale root from the current path keeps one script correct for en/zh/ja.
  var m = /^\\/(?:zh|ja)\\//.exec(window.location.pathname);
  var root = m ? m[0] : '/';
  var prefixes = VERSIONS.map(function (v) { return root + 'docs/' + v + '/'; });

  function inFrozen(pathname) {
    for (var i = 0; i < prefixes.length; i++) {
      if (pathname.indexOf(prefixes[i]) === 0) { return true; }
    }
    return false;
  }

  if (!inFrozen(window.location.pathname)) { return; }

  function leave(href) { window.location.assign(href); }

  function resolve(url) {
    try { return new URL(url, window.location.href); } catch (e) { return null; }
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0) { return; }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) { return; }
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) { return; }
    if (a.target && a.target !== '_self') { return; }
    if (a.hasAttribute('download')) { return; }
    var url = resolve(a.getAttribute('href'));
    if (!url || url.origin !== window.location.origin) { return; }
    if (inFrozen(url.pathname)) { return; }
    e.preventDefault();
    leave(url.href);
  }, true);

  ['pushState', 'replaceState'].forEach(function (method) {
    var original = window.history[method];
    window.history[method] = function (state, title, url) {
      if (url !== undefined && url !== null) {
        var target = resolve(url);
        if (target && target.origin === window.location.origin && !inFrozen(target.pathname)) {
          leave(target.href);
          return;
        }
      }
      return original.apply(window.history, arguments);
    };
  });
})();`;
}

module.exports = function frozenArchivePlugin() {
  const script = buildScript(frozenVersions);

  return {
    name: 'frozen-archive',

    injectHtmlTags() {
      return {
        headTags: [
          {
            tagName: 'script',
            innerHTML: script,
          },
        ],
      };
    },
  };
};
