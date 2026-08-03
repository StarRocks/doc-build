#!/usr/bin/env node
// llms.txt / markdown post-processing for agent-friendly docs
// -----------------------------------------------------------------------------
// Run AFTER `yarn build` completes (see build.sh and the GitHub workflows).
// It operates on the static build output and does two things:
//
//   1. addMarkdownDirective — prepends the spec-recommended blockquote directive
//      to every generated .md file, pointing agents at /llms.txt.
//
//   2. splitLlmsTxt — rewrites the single large llms.txt into a small root index
//      that links to per-section llms.txt files (progressive disclosure, per
//      https://agentdocsspec.com/spec/). Sections are split recursively by URL
//      path so no section file exceeds ~50K characters, while descriptions are
//      preserved.
//
// This lives in a standalone script rather than the agent-friendly-docs plugin's
// postBuild hook because Docusaurus runs all plugins' postBuild hooks in
// parallel (Promise.all), so llms.txt (written by the llms-txt plugin) is not
// guaranteed to exist when the plugin's own hook runs.
//
// Usage: node scripts/llms-postprocess.js [buildDir]   (defaults to ./build)
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

// Must match the Docusaurus `url` (SITE_URL env) so generated links point to
// the environment being built (prod vs. staging).
const SITE_URL = (process.env.SITE_URL || 'https://docs.starrocks.io').replace(/\/$/, '');
const LLMS_TXT_URL = `${SITE_URL}/llms.txt`;
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

// Soft size budget before a section file splits into sub-indexes. Set high
// enough that navigationally-important trees stay flat: the SQL function
// reference (~442 pages, ~81K of links) collapses into a SINGLE flat index an
// agent can scan in one fetch, instead of 20 per-category sub-indexes it has to
// drill through. Section files are opt-in (an agent fetches one only after
// choosing to drill in), so a larger-but-flatter file beats a deep tree here;
// the ~100K agent-truncation concern applies to the mandatory root index, not
// these. sql-reference as a whole (~136K) still exceeds this and splits one
// level (into sql-functions, sql-statements, …), which is the intended cutoff.
const MAX_SECTION_BYTES = 120000;

// Hard cap on how many path levels deep the split may recurse. depth = number
// of URL path segments identifying a node (e.g. ['docs','sql-reference',
// 'sql-functions'] is depth 3). A node at or past this depth is always written
// as a flat leaf regardless of size, bounding the worst-case navigation to
// root -> section -> subsection -> .md (3 index fetches). Keep this small:
// every extra level is another hop an agent can stop short at or mis-navigate.
const MAX_SPLIT_DEPTH = 3;

// Sections smaller than this (or with very few links) are inlined directly into
// the root index as .md links rather than getting their own section file.
const INLINE_MAX_BYTES = 1500;

// Blockquote prepended to every generated markdown page.
const MD_DIRECTIVE = `> For the complete documentation index, see [llms.txt](${LLMS_TXT_URL}). This page is also available as Markdown at its \`.md\` URL.`;

function main() {
  const buildDir = path.resolve(process.argv[2] || 'build');
  if (!fs.existsSync(buildDir)) {
    console.error(`[llms-postprocess] build dir not found: ${buildDir}`);
    process.exit(1);
  }

  const mdCount = addMarkdownDirective(buildDir);
  console.log(
    `[llms-postprocess] Prepended markdown directive to ${mdCount} .md files.`,
  );

  const fullTxtCleaned = cleanLlmsFullTxt(buildDir);
  if (fullTxtCleaned === null) {
    console.log('[llms-postprocess] No llms-full.txt found; skipped cleanup.');
  } else {
    console.log(
      `[llms-postprocess] Removed ${fullTxtCleaned} empty HTML comment(s) from llms-full.txt.`,
    );
  }

  const robotsFixed = fixRobotsSitemap(buildDir);
  if (robotsFixed) {
    console.log(`[llms-postprocess] robots.txt Sitemap: -> ${SITEMAP_URL}`);
  } else {
    console.log('[llms-postprocess] robots.txt not found or unchanged; skipped Sitemap rewrite.');
  }

  const result = splitLlmsTxt(buildDir);
  if (result) {
    console.log(
      `[llms-postprocess] Split llms.txt: root index ${result.rootBytes} bytes, ` +
        `${result.fileCount} section files (largest ${result.maxSectionBytes} bytes).`,
    );
  } else {
    console.log('[llms-postprocess] No llms.txt found; skipped split.');
  }
}

// -----------------------------------------------------------------------------
// 1. Markdown directive
// -----------------------------------------------------------------------------

function addMarkdownDirective(buildDir) {
  let count = 0;
  for (const file of walk(buildDir, (f) => f.endsWith('.md'))) {
    const content = fs.readFileSync(file, 'utf8');
    // Idempotent: skip if the directive is already present near the top.
    if (content.startsWith('> For the complete documentation index')) continue;
    const cleaned = stripEmptyHtmlComments(unescapeIntrawordUnderscores(content));
    fs.writeFileSync(file, `${MD_DIRECTIVE}\n\n${cleaned}`, 'utf8');
    count++;
  }
  return count;
}

// The llms-txt plugin escapes underscores (\_) in prose/headings to avoid
// accidental Markdown emphasis. For an underscore *between* two word characters
// (e.g. mv_refresh_total_success_jobs), CommonMark never treats it as emphasis,
// so the backslash is redundant: rendering is identical with or without it.
// Removing it keeps identifiers intact for agents reading the raw .md and for
// tooling that doesn't unescape Markdown before matching. Only intra-word
// escapes are touched; a leading/standalone \_ (which could be real emphasis)
// is left alone. Escapes inside code spans/blocks aren't present — Markdown
// doesn't process escapes there, so the plugin emits raw underscores in code.
function unescapeIntrawordUnderscores(md) {
  // Require an alphanumeric on both sides (not just \w, which includes "_"):
  // this targets identifiers like foo_bar_baz and avoids touching escaped
  // emphasis runs such as \_\_bold\_\_.
  return md.replace(/(?<=[A-Za-z0-9])\\_(?=[A-Za-z0-9])/g, '_');
}

// React emits `<!-- -->` separators between adjacent text nodes in its SSR
// output. The llms-txt plugin derives Markdown from the rendered HTML, so those
// empty comments survive into the .md — heavily on pages using DocCardList,
// where they land *inside* link labels:
//
//   ## [📄️<!-- --> <!-- -->Deploy StarRocks with Docker](.../shared-nothing.md)
//
// They are pure serialization noise: invisible in rendered Markdown, but agents
// reading the raw file see them, and they corrupt link text. As of this writing
// they affected 693 of 1051 generated pages.
//
// Only EMPTY comments are removed. Authored comments carry real content — the
// docs include XML/pom snippets with comments like `<!-- Extension jar -->` —
// so the pattern requires the comment body to be whitespace-only.
//
// Fenced code blocks are skipped entirely: an empty comment inside a fence is
// example code a reader is meant to see, not a serialization artifact.
function stripEmptyHtmlComments(md) {
  const EMPTY_COMMENT_RUN = /(?:<!--\s*-->\s*)+/g;
  const lines = md.split('\n');
  const out = [];
  let inFence = false;
  let fenceMarker = null;
  let swallowNextBlank = false;

  for (const line of lines) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceMarker = fence[1][0];
      } else if (fence[1][0] === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    // A line that is nothing but empty comments is dropped outright. It is
    // normally surrounded by blank lines (it was a "paragraph"), so also
    // swallow the following blank to avoid leaving a double gap behind.
    if (/^\s*(?:<!--\s*-->\s*)+$/.test(line)) {
      swallowNextBlank = out.length > 0 && out[out.length - 1].trim() === '';
      continue;
    }
    if (swallowNextBlank) {
      swallowNextBlank = false;
      if (line.trim() === '') {
        continue;
      }
    }

    // Mid-line: a run that was separating two pieces of text collapses to a
    // single space, so `[📄️<!-- --> <!-- -->Title]` becomes `[📄️ Title]`;
    // a run with no whitespace in it (`a<!-- -->b`) collapses to nothing.
    out.push(
      line
        .replace(EMPTY_COMMENT_RUN, (match) =>
          match.replace(/<!--\s*-->/g, '').length > 0 ? ' ' : '',
        )
        .replace(/[ \t]+$/, ''),
    );
  }

  return out.join('\n');
}

// llms-full.txt is the concatenation of every page, produced by the same
// HTML-derived pipeline as the .md twins, so it carries the same React SSR
// comment artifacts. It is the file bulk/RAG consumers ingest, so the noise is
// worth removing there too. Returns the number of artifacts removed, or null
// if the file does not exist.
function cleanLlmsFullTxt(buildDir) {
  const file = path.join(buildDir, 'llms-full.txt');
  if (!fs.existsSync(file)) return null;

  const before = fs.readFileSync(file, 'utf8');
  const after = stripEmptyHtmlComments(before);
  if (after === before) return 0;

  const removed = (before.match(/<!--\s*-->/g) || []).length -
    (after.match(/<!--\s*-->/g) || []).length;
  fs.writeFileSync(file, after, 'utf8');
  return removed;
}

// -----------------------------------------------------------------------------
// 1b. robots.txt Sitemap URL — make it environment-aware
// -----------------------------------------------------------------------------
//
// static/robots.txt hard-codes the PROD sitemap (`Sitemap: https://docs.starrocks.io/
// sitemap.xml`). On staging that URL is cross-origin, so sitemap-aware crawlers and
// scorecards (e.g. afdocs.dev) won't treat it as ground truth — the staging
// llms-txt-coverage check ends up SKIPped ("No sitemap found") rather than
// reflecting the same result prod shows. Rewrite the Sitemap: line to the site
// being built (SITE_URL) so staging points at its own same-origin sitemap.
// Only the Sitemap: line is touched; Disallow/Allow rules are left as authored.
function fixRobotsSitemap(buildDir) {
  const robotsPath = path.join(buildDir, 'robots.txt');
  if (!fs.existsSync(robotsPath)) return false;

  const content = fs.readFileSync(robotsPath, 'utf8');
  // Match an existing "Sitemap: <url>" line (case-insensitive directive).
  const re = /^([ \t]*Sitemap:[ \t]*).*$/im;
  let next;
  if (re.test(content)) {
    next = content.replace(re, `$1${SITEMAP_URL}`);
  } else {
    // No directive present — append one so crawlers can still discover it.
    next = `${content.replace(/\s*$/, '')}\n\nSitemap: ${SITEMAP_URL}\n`;
  }
  if (next === content) return false;
  fs.writeFileSync(robotsPath, next, 'utf8');
  return true;
}

// -----------------------------------------------------------------------------
// 2. llms.txt splitter
// -----------------------------------------------------------------------------

function splitLlmsTxt(buildDir) {
  const rootPath = path.join(buildDir, 'llms.txt');
  if (!fs.existsSync(rootPath)) return null;

  const raw = fs.readFileSync(rootPath, 'utf8');
  const { h1, blockquote, sections } = parseLlmsTxt(raw);
  if (!sections.length) return null;

  const state = { maxSectionBytes: 0, fileCount: 0 };
  const rootParts = [];

  for (const section of sections) {
    const entries = section.links
      .map(parseLink)
      .filter((e) => e && e.segs.length > 0);
    if (!entries.length) continue;

    rootParts.push(`## ${section.name}`, '');

    const bytes = renderedBytes(entries);
    if (bytes <= INLINE_MAX_BYTES || entries.length <= 3) {
      // Small sections: list their .md links directly in the root index.
      for (const e of entries) rootParts.push(e.raw);
    } else {
      // Larger sections: emit a section file (recursively split) and link to it.
      const baseSegs = commonPrefix(entries.map((e) => e.segs));
      const fileUrl = emitNode(buildDir, entries, baseSegs, section.name, state);
      rootParts.push(
        `- [${section.name}](${fileUrl}): section index of ${entries.length} documentation pages.`,
      );
    }
    rootParts.push('');
  }

  const rootBody = [
    h1 || '# StarRocks Documentation',
    '',
    blockquote ||
      '> StarRocks documentation index for AI agents. Each section links to a section-level llms.txt file or directly to Markdown pages.',
    '',
    rootParts.join('\n'),
  ].join('\n');

  fs.writeFileSync(rootPath, rootBody, 'utf8');
  return {
    rootBytes: byteLen(rootBody),
    fileCount: state.fileCount,
    maxSectionBytes: state.maxSectionBytes,
  };
}

// Recursively emit a section (or sub-section) llms.txt file and return its URL.
// - entries:  link objects belonging to this node
// - baseSegs: path segments identifying this node's directory
//             (e.g. ['docs','sql-reference'])
// - name:     human-readable name for the node
function emitNode(buildDir, entries, baseSegs, name, state) {
  const bytes = renderedBytes(entries);
  const depth = baseSegs.length;

  // "direct"   = pages living directly at this level (path ends one past base).
  // "children" = grouped by the next path segment (sub-directories).
  const direct = [];
  const groups = new Map();
  for (const e of entries) {
    if (e.segs.length <= depth + 1) {
      direct.push(e);
    } else {
      const seg = e.segs[depth];
      if (!groups.has(seg)) groups.set(seg, []);
      groups.get(seg).push(e);
    }
  }

  const canSplit = groups.size > 0 && depth < MAX_SPLIT_DEPTH;

  // Leaf: small enough, or nothing left to split by.
  if (bytes <= MAX_SECTION_BYTES || !canSplit) {
    const body = renderSectionFile(name, `## ${name}`, entries.map((e) => e.raw));
    return writeSectionFile(buildDir, baseSegs, body, state);
  }

  // Index node: recurse into each child group, plus keep direct pages inline.
  const lines = [];
  if (direct.length) {
    lines.push(`### ${name}`, '');
    for (const e of direct) lines.push(e.raw);
    lines.push('');
  }
  const childSegs = [...groups.keys()].sort();
  for (const seg of childSegs) {
    const childEntries = groups.get(seg);
    const childName = prettySegment(seg);
    const childUrl = emitNode(
      buildDir,
      childEntries,
      [...baseSegs, seg],
      childName,
      state,
    );
    lines.push(
      `- [${childName}](${childUrl}): ${childEntries.length} documentation pages.`,
    );
  }

  const body = renderSectionFile(name, `## ${name}`, lines);
  return writeSectionFile(buildDir, baseSegs, body, state);
}

function renderSectionFile(name, heading, contentLines) {
  return [
    `# StarRocks Documentation — ${name}`,
    '',
    `> Section index of the StarRocks documentation. For the complete documentation index, see [llms.txt](${LLMS_TXT_URL}). Pages are available as Markdown at their \`.md\` URLs.`,
    '',
    heading,
    '',
    contentLines.join('\n'),
    '',
  ].join('\n');
}

function writeSectionFile(buildDir, baseSegs, body, state) {
  const fileUrl = `${SITE_URL}/${baseSegs.join('/')}/llms.txt`;
  const filePath = path.join(buildDir, ...baseSegs, 'llms.txt');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, 'utf8');
  state.fileCount++;
  const size = byteLen(body);
  if (size > state.maxSectionBytes) state.maxSectionBytes = size;
  return fileUrl;
}

// -----------------------------------------------------------------------------
// Parsing / helpers
// -----------------------------------------------------------------------------

function parseLlmsTxt(raw) {
  const lines = raw.split('\n');
  let h1 = '';
  const blockquoteLines = [];
  const sections = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('# ') && !h1) {
      h1 = line;
      continue;
    }
    if (line.startsWith('## ')) {
      current = { name: line.slice(3).trim(), links: [] };
      sections.push(current);
      continue;
    }
    if (current) {
      if (line.startsWith('- [')) current.links.push(line);
    } else if (line.startsWith('>')) {
      blockquoteLines.push(line);
    }
  }

  return { h1, blockquote: blockquoteLines.join('\n'), sections };
}

// Parse a "- [Title](https://...): description" line. Preserves the raw line
// verbatim; only the URL / path segments are extracted for grouping.
function parseLink(line) {
  const m = line.match(/\]\((https?:\/\/[^)]+)\)/);
  if (!m) return null;
  const url = m[1];
  const pathname = url.replace(/^https?:\/\/[^/]+/, '');
  const segs = pathname.split('/').filter(Boolean);
  return { raw: line, url, segs };
}

// UTF-8 byte length — the size budgets are in bytes, and docs contain some
// non-ASCII (curly quotes, etc.), so measure bytes, not UTF-16 char count.
function byteLen(str) {
  return Buffer.byteLength(str, 'utf8');
}

function renderedBytes(entries) {
  let n = 0;
  for (const e of entries) n += byteLen(e.raw) + 1;
  return n;
}

// Longest common leading path segments across a set of segment arrays.
function commonPrefix(segArrays) {
  if (!segArrays.length) return [];
  // Never treat a trailing file (e.g. "foo.md") as a directory prefix.
  const prefix = [...segArrays[0]];
  if (prefix.length && prefix[prefix.length - 1].endsWith('.md')) prefix.pop();
  for (const segs of segArrays.slice(1)) {
    let i = 0;
    while (
      i < prefix.length &&
      i < segs.length &&
      prefix[i] === segs[i] &&
      !segs[i].endsWith('.md')
    ) {
      i++;
    }
    prefix.length = i;
  }
  // Fall back to the first segment (e.g. "docs") if divergence is total.
  if (!prefix.length && segArrays[0].length) return [segArrays[0][0]];
  return prefix;
}

function prettySegment(seg) {
  return seg
    .replace(/\.md$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Recursively yield file paths under dir matching the predicate.
function* walk(dir, match) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full, match);
    } else if (entry.isFile() && match(full)) {
      yield full;
    }
  }
}

main();
