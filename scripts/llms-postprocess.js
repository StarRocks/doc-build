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

// Keep every section file comfortably under the 50,000-char spec target.
const MAX_SECTION_BYTES = 45000;

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
    fs.writeFileSync(file, `${MD_DIRECTIVE}\n\n${content}`, 'utf8');
    count++;
  }
  return count;
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

  const canSplit = groups.size > 0 && depth < 12;

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
