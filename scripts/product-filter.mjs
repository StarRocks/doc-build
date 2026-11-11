#!/usr/bin/env node
// Drop the pages and passages that are not published to one product.
//
// Every site built from this repo's docs runs this over the tree it has
// assembled, after its copies and before Docusaurus sees it:
//
//   CelerData Enterprise  docs/enterprise/docusaurus/scripts/move-files.sh  --product enterprise
//   PhoenixAI Cloud       phoenixdata-docs combine-phoenixai-and-enterprise.sh  --product cloud
//   PhoenixAI Anywhere    phoenixai-anywhere-docs import-enterprise-docs.sh     --product anywhere
//
// Two markers, both documented in README.md next to this file:
//
//   Page:     frontmatter `products: [enterprise, cloud]`, naming the
//             products that publish the page. Every page needs one: a page
//             with no `products` key is published nowhere. Pages that are not
//             published to --product are deleted. Partials (files under a
//             directory whose name starts with "_") carry no key; they go
//             wherever the pages that import them go.
//
//   Passage:  a `:::product cloud anywhere` ... `:::` block. The content is
//             kept for the products named and removed for the others. The
//             fence lines are always removed.
//
// A page this product keeps must not link to, or import, a page this run
// removes: that is an error naming the linking file and line. Without it, a
// tagged page fails a site's Docusaurus build far from its cause, or ships as a
// dead link where broken links only warn.
//
// Anything malformed is an error, never a silent pass: publishing a page to the
// wrong product is the failure this exists to prevent. All errors in the tree
// are reported before the process exits non-zero.
//
// Usage:
//   node product-filter.mjs --product <name> [--blocks-only] [--dry-run] [--quiet] <dir>...
//   node product-filter.mjs --check-tags <dir-or-file>...
//
// --blocks-only resolves the :::product blocks and leaves every page in place,
// whatever its `products` key says or whether it has one. It is for a tree whose
// pages are not tagged, such as StarRocks/starrocks: the StarRocks/doc-build
// site runs a copy of this file (scripts/product-filter.mjs there) with
// --product oss, so that a block synced up from this repo neither shows its
// fence lines nor publishes another product's passage. No page is removed, so
// there are no links to check.
//
// --check-tags changes nothing. It reports every page that has no `products`
// key, which would otherwise disappear from every site, and every malformed
// key. It takes directories, files, or both. CI passes it the pages a pull
// request adds or changes, so an untagged page fails the pull request that adds
// it and not every later one.
//
// With several <dir>s (for example an English tree and a Japanese tree), files
// at the same relative path are treated as translations of one page, and a
// warning is printed when their `products` lists differ.
//
// Plain Node (fs, path) and no dependencies, so it runs wherever the sites
// build: Node 22 in the enterprise image, Node 24 in the PhoenixAI builds.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRODUCTS = ['oss', 'enterprise', 'cloud', 'anywhere'];

const FENCE = /^(\s*)(`{3,}|~{3,})/;
const PRODUCT_OPEN = /^\s*:::product(?:\s+(.*?))?\s*$/;
const CONTAINER_OPEN = /^\s*:{3,}[A-Za-z]/;
const CONTAINER_CLOSE = /^\s*:{3,}\s*$/;

function parseProductList(raw, where, errors) {
  const names = raw.split(/[\s,]+/).filter(Boolean);
  if (names.length === 0) {
    errors.push(`${where}: names no products`);
    return null;
  }
  const unknown = names.filter((n) => !PRODUCTS.includes(n));
  if (unknown.length) {
    errors.push(`${where}: unknown product ${unknown.map((n) => `'${n}'`).join(', ')} (known: ${PRODUCTS.join(', ')})`);
    return null;
  }
  return [...new Set(names)];
}

// Returns { products: string[] | null } where null means "no products key".
export function readProducts(text, file, errors) {
  const src = text.replace(/\r\n/g, '\n');
  if (!src.startsWith('---\n')) return { products: null };
  const end = src.indexOf('\n---', 4);
  if (end === -1) return { products: null };
  const lines = src.slice(4, end).split('\n');
  const i = lines.findIndex((l) => /^products\s*:/.test(l));
  if (i === -1) return { products: null };
  const value = lines[i].replace(/^products\s*:\s*/, '');
  const m = value.match(/^\[(.*)\]\s*$/);
  if (!m) {
    errors.push(`${file}: 'products' must be a one-line list, for example products: [enterprise, cloud]`);
    return { products: null, invalid: true };
  }
  const products = parseProductList(m[1], `${file}: 'products'`, errors);
  return { products, invalid: products === null };
}

// Returns { text, removed, kept } with every :::product block resolved for
// `product`. Pushes to `errors` on unbalanced or nested blocks.
export function filterBlocks(text, product, file, errors) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const out = [];
  let fence = null; // the opening fence marker while inside fenced code
  let block = null; // { line, keep, depth } while inside a :::product block
  let removed = 0;
  let kept = 0;

  lines.forEach((line, idx) => {
    const n = idx + 1;
    const f = line.match(FENCE);
    if (fence) {
      if (f && f[2][0] === fence[0] && f[2].length >= fence.length && line.trim() === f[2]) fence = null;
      if (!block || block.keep) out.push(line);
      return;
    }
    if (f) {
      fence = f[2];
      if (!block || block.keep) out.push(line);
      return;
    }

    const open = line.match(PRODUCT_OPEN);
    if (open) {
      if (block) {
        errors.push(`${file}:${n}: :::product inside the :::product block opened on line ${block.line}; nesting is not supported`);
        return;
      }
      const names = parseProductList(open[1] || '', `${file}:${n}: :::product`, errors);
      block = { line: n, keep: names ? names.includes(product) : true, depth: 0 };
      if (block.keep) kept++;
      else removed++;
      return;
    }

    if (block) {
      if (CONTAINER_OPEN.test(line)) block.depth++;
      else if (CONTAINER_CLOSE.test(line)) {
        if (block.depth === 0) {
          block = null;
          return;
        }
        block.depth--;
      }
      if (block.keep) out.push(line);
      return;
    }
    out.push(line);
  });

  if (block) errors.push(`${file}:${block.line}: :::product block is never closed`);
  if (fence) errors.push(`${file}: unclosed code fence '${fence}'`);
  return { text: out.join(eol), removed, kept };
}

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (/\.mdx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

// A file under a directory whose name starts with "_" (for example _assets/)
// is a partial or asset, not a routed page. Deleting it would break every page
// that imports it, so a page-level tag there is an error: tag the importing
// page, or wrap the passage in a :::product block.
function isPartial(rel) {
  return rel.split(path.sep).slice(0, -1).some((seg) => seg.startsWith('_'));
}

const INLINE_LINK = /\]\(\s*<?([^)\s>]+)>?/g;
const REFERENCE_DEF = /^\s{0,3}\[[^\]]+\]:\s*<?([^\s>]+)>?/;
const IMPORT_FROM = /^\s*import\s[^'"]*\sfrom\s+['"]([^'"]+)['"]/;

// Yields { line, target } for every relative link and import path in a page,
// outside fenced code. Absolute URLs, in-page anchors and root-relative routes
// (/data_source/...) are skipped: a route is not a file path, so it cannot be
// matched against the files this run removed.
export function* relativeLinks(text) {
  let fence = null;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const f = line.match(FENCE);
    if (fence) {
      if (f && f[2][0] === fence[0] && f[2].length >= fence.length && line.trim() === f[2]) fence = null;
      continue;
    }
    if (f) {
      fence = f[2];
      continue;
    }
    const targets = [...line.matchAll(INLINE_LINK)].map((m) => m[1]);
    const ref = line.match(REFERENCE_DEF);
    if (ref) targets.push(ref[1]);
    const imp = line.match(IMPORT_FROM);
    if (imp) targets.push(imp[1]);
    for (const t of targets) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('#') || t.startsWith('/')) continue;
      yield { line: i + 1, target: t };
    }
  }
}

function linkTargetPath(file, target) {
  let t = target.replace(/[#?].*$/, '');
  if (!t) return null;
  try {
    t = decodeURI(t);
  } catch {
    // keep it as written
  }
  return path.resolve(path.dirname(file), t);
}

export function run({ product, dirs, blocksOnly = false, dryRun = false, log = console.log, warn = console.warn }) {
  const errors = [];
  const warnings = [];
  const removedPages = [];
  const tags = new Map(); // relative path -> [{ root, products }]
  let scanned = 0;
  let blocksRemoved = 0;
  let blocksKept = 0;
  const writes = [];
  const keptPages = []; // { file, text } with blocks already resolved

  for (const root of dirs) {
    for (const file of walk(root)) {
      scanned++;
      const rel = path.relative(root, file);
      const text = fs.readFileSync(file, 'utf8');
      // With --blocks-only every page stays, so its products key is not read.
      if (!blocksOnly) {
        const { products, invalid } = readProducts(text, file, errors);
        if (invalid) continue;
        const list = tags.get(rel) || [];
        list.push({ root, products });
        tags.set(rel, list);

        // A page with no products key is published nowhere.
        if (products === null && !isPartial(rel)) {
          removedPages.push(file);
          writes.push({ file, remove: true });
          continue;
        }
        if (products && !products.includes(product)) {
          if (isPartial(rel)) {
            errors.push(`${file}: 'products' is set on a partial; tag the page that imports it, or use a :::product block`);
            continue;
          }
          removedPages.push(file);
          writes.push({ file, remove: true });
          continue;
        }
      }
      // Only files that use the marker are parsed for blocks. Code-fence
      // tracking is what keeps a marker shown inside a code sample from being
      // treated as a real block, and it reports unbalanced fences as errors;
      // those only matter in a file that has blocks, and existing pages with
      // unbalanced fences must not fail a build that never touches them.
      if (!text.includes(':::product')) {
        keptPages.push({ file, text });
        continue;
      }
      const res = filterBlocks(text, product, file, errors);
      blocksRemoved += res.removed;
      blocksKept += res.kept;
      if (res.text !== text) writes.push({ file, text: res.text });
      keptPages.push({ file, text: res.text });
    }
  }

  // A removed page must not be linked to, or imported by, a page this product
  // keeps. The sites would otherwise fail later, in Docusaurus, with a broken
  // link far from its cause (onBrokenLinks: 'throw'), or ship a dead link where
  // broken links only warn. Links inside a removed :::product block are already
  // gone from the text checked here.
  if (removedPages.length) {
    const removed = new Set(removedPages.map((f) => path.resolve(f)));
    for (const { file, text } of keptPages) {
      if (!text.includes('](') && !text.includes(']:') && !text.includes('import ')) continue;
      for (const { line, target } of relativeLinks(text)) {
        const resolved = linkTargetPath(file, target);
        if (resolved && removed.has(resolved)) {
          errors.push(`${file}:${line}: links to ${target}, which is not published to ${product}. Remove the link, or wrap it in a :::product block for the products that publish the target`);
        }
      }
    }
  }

  for (const [rel, list] of tags) {
    if (list.length < 2) continue;
    const keys = new Set(list.map((t) => (t.products ? [...t.products].sort().join(',') : '(none)')));
    if (keys.size > 1) {
      warnings.push(`${rel}: translations disagree on 'products': ${list.map((t) => `${t.root} ${t.products ? `[${t.products.join(', ')}]` : '(none)'}`).join('; ')}`);
    }
  }

  for (const w of warnings) warn(`product-filter: warning: ${w}`);
  if (errors.length) {
    for (const e of errors) warn(`product-filter: error: ${e}`);
    warn(`product-filter: ${errors.length} error(s); nothing was changed.`);
    return { ok: false, errors, warnings, removedPages, scanned, blocksRemoved, blocksKept };
  }

  if (!dryRun) {
    for (const w of writes) {
      if (w.remove) fs.rmSync(w.file);
      else fs.writeFileSync(w.file, w.text);
    }
  }
  log(`product-filter (${product}${blocksOnly ? ', blocks only' : ''}${dryRun ? ', dry run' : ''}): ${scanned} files scanned, ${removedPages.length} pages removed, ${blocksRemoved} blocks removed, ${blocksKept} blocks kept`);
  for (const f of removedPages) log(`  removed ${f}`);
  return { ok: true, errors, warnings, removedPages, scanned, blocksRemoved, blocksKept };
}

// Every page must name its products. Returns { ok, errors }; changes nothing.
// Each entry of `dirs` is a directory, which is walked, or a single file. A
// file is skipped when it is not .md/.mdx or sits under a "_" directory.
export function checkTags({ dirs, log = console.log, warn = console.warn }) {
  const errors = [];
  let pages = 0;
  for (const root of dirs) {
    const isFile = fs.statSync(root).isFile();
    const files = isFile ? (/\.mdx?$/.test(root) ? [root] : []) : walk(root);
    for (const file of files) {
      if (isPartial(isFile ? file : path.relative(root, file))) continue;
      pages++;
      const { products, invalid } = readProducts(fs.readFileSync(file, 'utf8'), file, errors);
      if (!invalid && products === null) {
        errors.push(`${file}: no 'products' line, so no site publishes it. Add one to the frontmatter naming the products that publish the page, for example products: [oss, enterprise, cloud, anywhere]`);
      }
    }
  }
  for (const e of errors) warn(`product-filter: error: ${e}`);
  if (errors.length) warn(`product-filter: ${errors.length} error(s).`);
  else log(`product-filter (check tags): ${pages} pages, all tagged`);
  return { ok: errors.length === 0, errors };
}

function main(argv) {
  let product = null;
  let dryRun = false;
  let quiet = false;
  let checkOnly = false;
  let blocksOnly = false;
  const dirs = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--product') product = argv[++i];
    else if (a.startsWith('--product=')) product = a.slice('--product='.length);
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--quiet') quiet = true;
    else if (a === '--check-tags') checkOnly = true;
    else if (a === '--blocks-only') blocksOnly = true;
    else if (a.startsWith('--')) {
      console.error(`product-filter: unknown option ${a}`);
      return 2;
    } else dirs.push(a);
  }
  if ((checkOnly ? product !== null || blocksOnly : !PRODUCTS.includes(product)) || dirs.length === 0) {
    console.error(`usage: product-filter.mjs --product <${PRODUCTS.join('|')}> [--blocks-only] [--dry-run] [--quiet] <dir>...`);
    console.error('       product-filter.mjs --check-tags <dir-or-file>...');
    return 2;
  }
  for (const d of dirs) {
    if (checkOnly && fs.existsSync(d) && fs.statSync(d).isFile()) continue;
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) {
      console.error(`product-filter: not a directory: ${d}`);
      return 2;
    }
  }
  const log = quiet ? () => {} : console.log;
  const res = checkOnly ? checkTags({ dirs, log }) : run({ product, dirs, blocksOnly, dryRun, log });
  return res.ok ? 0 : 1;
}

// Run when invoked directly. Compare real paths: Node resolves symlinks for the
// module's own URL but not for argv[1], so a checkout reached through a
// symlink would otherwise skip main() and silently filter nothing.
const invokedDirectly = (() => {
  try {
    return process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
