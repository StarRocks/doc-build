import fs from "fs/promises";
import path from "path";
import { glob } from "glob";

/**
 * Inline snippet imports recursively
 */
async function inlineSnippets(filePath, visited = new Set()) {
  if (visited.has(filePath)) return "";
  visited.add(filePath);

  const dir = path.dirname(filePath);
  let content = await fs.readFile(filePath, "utf8");

  // Match MDX imports like: import SQL from '../_assets/quick-start/_SQL.mdx'
  const importRegex = /^import\s+(\w+)\s+from\s+['"](.+?\.mdx)['"]/gm;
  const imports = {};
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const [, name, relPath] = match;
    const snippetPath = path.resolve(dir, relPath);
    imports[name] = snippetPath;
    console.log(`... including content from ${snippetPath}...`);
  }

  // Remove import lines
  content = content.replace(importRegex, "");

  // Replace <Component /> tags with snippet content
  for (const [name, snippetPath] of Object.entries(imports)) {
    const snippetContent = await inlineSnippets(snippetPath, visited);
    const tagRegex = new RegExp(`<${name}\\s*/>`, "g");
    content = content.replace(tagRegex, snippetContent);
  }

  return content;
}

/**
 * Write out the file including the snippets
 */
async function processFile(filePath) {
  const expanded = await inlineSnippets(filePath);
  fs.writeFile( filePath, expanded, err => { if (err) { console.error(err); } else { } });
}

/**
 * Walk directory, process all .mdx files
 */
async function main() {
  //const docsDir = "/Users/droscign/GitHub/starrocks/docs/";
  const files = await glob('/Users/droscign/GitHub/starrocks/docs/{en,zh,ja}/**/*.{md,mdx}', { ignore: '_assets/**' })
  for (const file of files) {
    console.log(`Processing ${file}...`);
    await processFile(file);
  }
}

main().catch(console.error);

