#!/bin/bash

echo "cleanup before running yarn build"
echo "rm TOCs"
find i18n -type f -name TOC.md | xargs rm -f
find versioned_docs -type f -name TOC.md | xargs rm -f
echo "rm READMEs"
rm -f i18n/zh/docusaurus-plugin-content-docs/version-*/README.md
rm -f i18n/ja/docusaurus-plugin-content-docs/version-*/README.md
rm -f versioned_docs/version-*/README.md

echo "rm ecosystem_release notes"
rm -rf i18n/zh/docusaurus-plugin-content-docs/version-*/ecosystem_release/
rm -rf i18n/ja/docusaurus-plugin-content-docs/version-*/ecosystem_release/
rm -rf versioned_docs/version-*/ecosystem_release/

echo "\nadd release notes and dev pages"
_IGNORE/cp_common_docs.sh

echo "verifying Markdown"
npx docusaurus-mdx-checker -c versioned_docs
npx docusaurus-mdx-checker -c i18n

rm -rf versioned_docs/version-*/zh/
echo "removing temp files"
rm -rf temp
