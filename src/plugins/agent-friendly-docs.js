// Agent-Friendly Docs plugin
// -----------------------------------------------------------------------------
// Improves the site's https://afdocs.dev/ score by making llms.txt / markdown
// output discoverable to AI agents.
//
// This plugin injects a discovery directive into every HTML page:
//   - a visually-hidden element near the top of the body pointing agents at
//     /llms.txt and telling them each page is available as Markdown at its
//     ".md" URL, and
//   - a <head> alternate link to /llms.txt.
//
// The visually-hidden style deliberately avoids `display:none` (which some
// HTML->markdown converters strip) per the afdocs spec.
//
// The related file post-processing (prepending a markdown directive to .md
// files and splitting llms.txt into a root index + section files) is done by
// scripts/llms-postprocess.js, which runs AFTER `yarn build` completes.
// It cannot live in this plugin's postBuild hook because Docusaurus runs all
// plugins' postBuild hooks in parallel (Promise.all), so llms.txt is not
// guaranteed to exist yet when this plugin would run.
//
// Registered only for the default (en) locale in docusaurus.config.js, matching
// the llms-txt plugin — the markdown files and llms.txt only exist for en, so
// the directive is only truthful there.
// -----------------------------------------------------------------------------

// Visually-hidden style that survives HTML->markdown conversion (avoids
// display:none, which some converters strip — see the afdocs spec).
const HIDDEN_STYLE =
  'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';

module.exports = function agentFriendlyDocsPlugin(context) {
  // Match the site URL being built (prod vs. staging) so the directive is
  // truthful in every environment.
  const siteUrl = (context.siteConfig.url || 'https://docs.starrocks.io').replace(/\/$/, '');
  const LLMS_TXT_URL = `${siteUrl}/llms.txt`;

  return {
    name: 'agent-friendly-docs',

    injectHtmlTags() {
      return {
        headTags: [
          {
            tagName: 'link',
            attributes: {
              rel: 'alternate',
              type: 'text/markdown',
              href: '/llms.txt',
              title: 'LLM-friendly documentation index',
            },
          },
        ],
        preBodyTags: [
          {
            tagName: 'div',
            attributes: {
              'data-llms-directive': '',
              // Hidden from assistive tech: this is an agent-facing hint, not
              // human content. The anchor is kept (agents/detectors look for a
              // link to llms.txt) but made non-focusable via tabindex="-1" so
              // keyboard users can't tab to an invisible link.
              'aria-hidden': 'true',
              style: HIDDEN_STYLE,
            },
            innerHTML:
              `For AI agents: a machine-readable documentation index is available at ` +
              `<a href="${LLMS_TXT_URL}" tabindex="-1">${LLMS_TXT_URL}</a>. ` +
              `Every documentation page is also available as Markdown by appending ".md" to its URL.`,
          },
        ],
      };
    },
  };
};
