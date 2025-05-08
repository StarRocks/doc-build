#!/bin/bash

mkdir -p releasenotes
mkdir -p common

rm -rf versioned_docs/version-*/release_notes versioned_docs/version-*/developers
rm -rf i18n/zh/docusaurus-plugin-content-docs/version-*/release_notes i18n/zh/docusaurus-plugin-content-docs/version-*/developers
mkdir -p versioned_docs/version-3.4/developers/
mkdir -p i18n/zh/docusaurus-plugin-content-docs/version-3.4/developers/
mkdir -p versioned_docs/version-3.3/developers/
mkdir -p i18n/zh/docusaurus-plugin-content-docs/version-3.3/developers/
mkdir -p versioned_docs/version-3.2/developers/
mkdir -p i18n/zh/docusaurus-plugin-content-docs/version-3.2/developers/
mkdir -p versioned_docs/version-3.1/developers/
mkdir -p i18n/zh/docusaurus-plugin-content-docs/version-3.1/developers/
mkdir -p versioned_docs/version-2.5/developers/
mkdir -p i18n/zh/docusaurus-plugin-content-docs/version-2.5/developers/

cp versioned_docs/version-3.4/_assets/*trace*.png versioned_docs/version-3.3/_assets/
cp versioned_docs/version-3.3/_assets/*trace*.png versioned_docs/version-3.2/_assets/
cp versioned_docs/version-3.2/_assets/*trace*.png versioned_docs/version-3.1/_assets/
cp versioned_docs/version-3.1/_assets/debug_info.png versioned_docs/version-2.5/_assets/
cp versioned_docs/version-3.1/_assets/IDEA*.png versioned_docs/version-2.5/_assets/
cp versioned_docs/version-3.1/_assets/ide*.png versioned_docs/version-2.5/_assets/
cp versioned_docs/version-3.1/_assets/*trace*.png versioned_docs/version-2.5/_assets/

cp versioned_docs/version-3.1/_assets/debug_info.png i18n/zh/docusaurus-plugin-content-docs/version-3.1/_assets/
cp versioned_docs/version-3.1/_assets/IDEA*.png i18n/zh/docusaurus-plugin-content-docs/version-3.1/_assets/
cp versioned_docs/version-3.1/_assets/ide*.png i18n/zh/docusaurus-plugin-content-docs/version-3.1/_assets/
cp versioned_docs/version-3.1/_assets/*trace*.png i18n/zh/docusaurus-plugin-content-docs/version-3.1/_assets/
cp versioned_docs/version-3.1/_assets/debug_info.png i18n/zh/docusaurus-plugin-content-docs/version-2.5/_assets/
cp versioned_docs/version-3.1/_assets/IDEA*.png i18n/zh/docusaurus-plugin-content-docs/version-2.5/_assets/
cp versioned_docs/version-3.1/_assets/ide*.png i18n/zh/docusaurus-plugin-content-docs/version-2.5/_assets/
cp versioned_docs/version-3.1/_assets/*trace*.png i18n/zh/docusaurus-plugin-content-docs/version-2.5/_assets/

mv common/releasenotes/en-us/release*.md releasenotes/
mv common/releasenotes/en-us/*or.md releasenotes/

mv common/releasenotes/zh-cn/release*.md i18n/zh/docusaurus-plugin-content-docs-releasenotes/current/
mv common/releasenotes/zh-cn/*or.md i18n/zh/docusaurus-plugin-content-docs-releasenotes/current/

cp -r common/releasenotes/en-us/build-starrocks versioned_docs/version-3.4/developers/
cp -r common/releasenotes/en-us/code-style-guides versioned_docs/version-3.4/developers/
cp common/releasenotes/en-us/debuginfo.md versioned_docs/version-3.4/developers/
cp -r common/releasenotes/en-us/development-environment versioned_docs/version-3.4/developers/
cp -r common/releasenotes/en-us/trace-tools versioned_docs/version-3.4/developers/

cp -r common/releasenotes/en-us/build-starrocks versioned_docs/version-3.3/developers/
cp -r common/releasenotes/en-us/code-style-guides versioned_docs/version-3.3/developers/
cp common/releasenotes/en-us/debuginfo.md versioned_docs/version-3.3/developers/
cp -r common/releasenotes/en-us/development-environment versioned_docs/version-3.3/developers/
cp -r common/releasenotes/en-us/trace-tools versioned_docs/version-3.3/developers/

cp -r common/releasenotes/en-us/build-starrocks versioned_docs/version-3.2/developers/
cp -r common/releasenotes/en-us/code-style-guides versioned_docs/version-3.2/developers/
cp common/releasenotes/en-us/debuginfo.md versioned_docs/version-3.2/developers/
cp -r common/releasenotes/en-us/development-environment versioned_docs/version-3.2/developers/
cp -r common/releasenotes/en-us/trace-tools versioned_docs/version-3.2/developers/

cp -r common/releasenotes/en-us/build-starrocks versioned_docs/version-3.1/developers/
cp -r common/releasenotes/en-us/code-style-guides versioned_docs/version-3.1/developers/
cp common/releasenotes/en-us/debuginfo.md versioned_docs/version-3.1/developers/
cp -r common/releasenotes/en-us/development-environment versioned_docs/version-3.1/developers/
cp -r common/releasenotes/en-us/trace-tools versioned_docs/version-3.1/developers/

cp -r common/releasenotes/zh-cn/build-starrocks i18n/zh/docusaurus-plugin-content-docs/version-3.1/developers/
cp -r common/releasenotes/zh-cn/code-style-guides i18n/zh/docusaurus-plugin-content-docs/version-3.1/developers/
cp common/releasenotes/zh-cn/debuginfo.md i18n/zh/docusaurus-plugin-content-docs/version-3.1/developers/
cp -r common/releasenotes/zh-cn/development-environment i18n/zh/docusaurus-plugin-content-docs/version-3.1/developers/
cp -r common/releasenotes/zh-cn/trace-tools i18n/zh/docusaurus-plugin-content-docs/version-3.1/developers/

cp -r common/releasenotes/zh-cn/build-starrocks i18n/zh/docusaurus-plugin-content-docs/version-3.2/developers/
cp -r common/releasenotes/zh-cn/code-style-guides i18n/zh/docusaurus-plugin-content-docs/version-3.2/developers/
cp common/releasenotes/zh-cn/debuginfo.md i18n/zh/docusaurus-plugin-content-docs/version-3.2/developers/
cp -r common/releasenotes/zh-cn/development-environment i18n/zh/docusaurus-plugin-content-docs/version-3.2/developers/
cp -r common/releasenotes/zh-cn/trace-tools i18n/zh/docusaurus-plugin-content-docs/version-3.2/developers/

cp -r common/releasenotes/zh-cn/build-starrocks i18n/zh/docusaurus-plugin-content-docs/version-3.4/developers/
cp -r common/releasenotes/zh-cn/code-style-guides i18n/zh/docusaurus-plugin-content-docs/version-3.4/developers/
cp common/releasenotes/zh-cn/debuginfo.md i18n/zh/docusaurus-plugin-content-docs/version-3.4/developers/
cp -r common/releasenotes/zh-cn/development-environment i18n/zh/docusaurus-plugin-content-docs/version-3.4/developers/
cp -r common/releasenotes/zh-cn/trace-tools i18n/zh/docusaurus-plugin-content-docs/version-3.4/developers/

cp -r common/releasenotes/zh-cn/build-starrocks i18n/zh/docusaurus-plugin-content-docs/version-3.3/developers/
cp -r common/releasenotes/zh-cn/code-style-guides i18n/zh/docusaurus-plugin-content-docs/version-3.3/developers/
cp common/releasenotes/zh-cn/debuginfo.md i18n/zh/docusaurus-plugin-content-docs/version-3.3/developers/
cp -r common/releasenotes/zh-cn/development-environment i18n/zh/docusaurus-plugin-content-docs/version-3.3/developers/
cp -r common/releasenotes/zh-cn/trace-tools i18n/zh/docusaurus-plugin-content-docs/version-3.3/developers/

cp -r common/releasenotes/en-us/build-starrocks versioned_docs/version-2.5/developers/
cp -r common/releasenotes/en-us/code-style-guides versioned_docs/version-2.5/developers/
cp common/releasenotes/en-us/debuginfo.md versioned_docs/version-2.5/developers/
cp -r common/releasenotes/en-us/development-environment versioned_docs/version-2.5/developers/
cp -r common/releasenotes/en-us/trace-tools versioned_docs/version-2.5/developers/

cp -r common/releasenotes/zh-cn/build-starrocks i18n/zh/docusaurus-plugin-content-docs/version-2.5/developers/
cp -r common/releasenotes/zh-cn/code-style-guides i18n/zh/docusaurus-plugin-content-docs/version-2.5/developers/
cp common/releasenotes/zh-cn/debuginfo.md i18n/zh/docusaurus-plugin-content-docs/version-2.5/developers/
cp -r common/releasenotes/zh-cn/development-environment i18n/zh/docusaurus-plugin-content-docs/version-2.5/developers/
cp -r common/releasenotes/zh-cn/trace-tools i18n/zh/docusaurus-plugin-content-docs/version-2.5/developers/
