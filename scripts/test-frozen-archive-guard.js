#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Unit test for the inline guard script built by src/plugins/frozen-archive.js.
//
// That script cannot be exercised by a Docusaurus build — it only does anything
// on a page inside a frozen doc tree, and once the freeze lands no build emits
// one. So its behavior is pinned here instead: the script is evaluated against a
// stubbed window/document and every navigation case is asserted.
//
// Run: node scripts/test-frozen-archive-guard.js
// -----------------------------------------------------------------------------

const plugin = require('../src/plugins/frozen-archive.js');
const src = plugin().injectHtmlTags().headTags[0].innerHTML;

function run(pathname) {
  const origin = 'https://docs.starrocks.io';
  const listeners = [];
  let assigned = null;
  const realPush = function () { return 'ORIGINAL_PUSH'; };
  const win = {
    location: {
      pathname,
      href: origin + pathname,
      origin,
      assign(h) { assigned = h; },
    },
    history: { pushState: realPush, replaceState: realPush },
    URL,
  };
  const doc = {
    addEventListener(type, fn, capture) { listeners.push({type, fn, capture}); },
  };
  new Function('window', 'document', 'URL', src)(win, doc, URL);
  return {
    armed: listeners.length > 0,
    patched: win.history.pushState !== realPush,
    click(href, opts = {}) {
      assigned = null;
      let prevented = false;
      const anchor = {
        target: opts.target,
        getAttribute: () => href,
        hasAttribute: (n) => n === 'download' && !!opts.download,
      };
      const ev = {
        defaultPrevented: false, button: 0,
        target: {closest: () => anchor},
        preventDefault() { prevented = true; },
        ...opts.ev,
      };
      listeners.filter(l => l.type === 'click').forEach(l => l.fn(ev));
      return {prevented, assigned};
    },
    push(url) {
      assigned = null;
      const r = win.history.pushState({}, '', url);
      return {assigned, passedThrough: r === 'ORIGINAL_PUSH'};
    },
  };
}

let fails = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`}`);
}

// --- inert on live pages ---
const live = run('/docs/introduction/StarRocks_intro/');
check('live page: guard not armed', {armed: live.armed, patched: live.patched}, {armed: false, patched: false});

// --- armed on a frozen en page ---
const en = run('/docs/3.4/loading/Loading_intro/');
check('frozen en page: armed', {armed: en.armed, patched: en.patched}, {armed: true, patched: true});
check('en: link within same frozen version stays SPA',
  en.click('/docs/3.4/quick_start/'), {prevented: false, assigned: null});
check('en: link to another frozen version stays SPA (same bundle)',
  en.click('/docs/3.1/quick_start/'), {prevented: false, assigned: null});
check('en: link to current docs escapes',
  en.click('/docs/introduction/StarRocks_intro/'),
  {prevented: true, assigned: 'https://docs.starrocks.io/docs/introduction/StarRocks_intro/'});
check('en: link to still-built 3.5 escapes',
  en.click('/docs/3.5/quick_start/'),
  {prevented: true, assigned: 'https://docs.starrocks.io/docs/3.5/quick_start/'});
check('en: cross-locale link escapes (separate bundle)',
  en.click('/zh/docs/3.4/quick_start/'),
  {prevented: true, assigned: 'https://docs.starrocks.io/zh/docs/3.4/quick_start/'});
check('en: external link untouched',
  en.click('https://github.com/StarRocks/starrocks'), {prevented: false, assigned: null});
check('en: anchor on same frozen page stays SPA',
  en.click('#section'), {prevented: false, assigned: null});
check('en: target=_blank untouched',
  en.click('/docs/introduction/', {target: '_blank'}), {prevented: false, assigned: null});
check('en: download untouched',
  en.click('/files/x.pdf', {download: true}), {prevented: false, assigned: null});
check('en: modified click untouched',
  en.click('/docs/introduction/', {ev: {metaKey: true}}), {prevented: false, assigned: null});
check('en: pushState out of archive escapes',
  en.push('/docs/introduction/'),
  {assigned: 'https://docs.starrocks.io/docs/introduction/', passedThrough: false});
check('en: pushState within archive passes through',
  en.push('/docs/3.4/quick_start/'), {assigned: null, passedThrough: true});

// --- zh locale ---
const zh = run('/zh/docs/3.2/quick_start/');
check('frozen zh page: armed', {armed: zh.armed, patched: zh.patched}, {armed: true, patched: true});
check('zh: link within zh archive stays SPA',
  zh.click('/zh/docs/3.2/loading/'), {prevented: false, assigned: null});
check('zh: link to zh current docs escapes',
  zh.click('/zh/docs/introduction/'),
  {prevented: true, assigned: 'https://docs.starrocks.io/zh/docs/introduction/'});
check('zh: link to en archive escapes (separate bundle)',
  zh.click('/docs/3.2/quick_start/'),
  {prevented: true, assigned: 'https://docs.starrocks.io/docs/3.2/quick_start/'});

// --- ja locale ---
const ja = run('/ja/docs/3.1/quick_start/');
check('frozen ja page: armed', {armed: ja.armed, patched: ja.patched}, {armed: true, patched: true});
check('ja: link to ja current docs escapes',
  ja.click('/ja/docs/introduction/'),
  {prevented: true, assigned: 'https://docs.starrocks.io/ja/docs/introduction/'});

// --- lookalike paths must NOT arm ---
check('en 3.10 lookalike: not armed', run('/docs/3.10/x/').armed, false);
check('release notes: not armed', run('/releasenotes/release-3.4/').armed, false);
check('zh current: not armed', run('/zh/docs/introduction/').armed, false);

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
