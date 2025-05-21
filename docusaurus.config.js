// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';
import versions from './versions.json';

// Used to limit build to just two versions for debugging
const isBuildFast = !!process.env.BUILD_FAST;

// if the env var DISABLE_VERSIONING is set
// (example `export DISABLE_VERSIONING=true`) then build only the
// content of `docs/en` and `docs/zh`. To build all versions remove
// the env var with `unset DISABLE_VERSIONING` 
// (don't set it to false, we are checking to see if the var is set,
// not what the value is).
//
//NOTE: This is only for use when building locally in Docker
// 
const isVersioningDisabled = !!process.env.DISABLE_VERSIONING || false;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'StarRocks',
  tagline: 'StarRocks documentation',
  favicon: 'img/favicon.ico',

  url: 'https://docs.starrocks.io/',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'StarRocks', // Usually your GitHub org/user name.
  projectName: 'starrocks', // Usually your repo name.

  // needed for hosting in S3:
  trailingSlash: true,

  onBrokenAnchors: 'ignore',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',

  future: {
    experimental_faster: true,
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh', 'ja'],
    localeConfigs: {
      en: {
        htmlLang: 'en-US',
      },
      zh: {
        htmlLang: 'zh-CN',
      },
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: 'sidebars.json',
          // Edit links for English and Chinese
          editUrl: ({locale, docPath}) => {
              return 'https://github.com/StarRocks/starrocks/edit/main/docs/' + locale + '/' + docPath
              },
          admonitions: { keywords:
                  ['experimental', 'beta', 'note', 'tip', 'info', 'caution', 'danger'],
              },
          // Versions:
          // We don't want to show `main` or `current`
          // except when testing PRs.
          // We want to show the released versions.
          // lastVersion identifies the latest release.
          // onlyIncludeVersions limits what we show.
          // By default Docusaurus shows an "unsupported" banner,
          // but we support multiple versions, so the banner is set
          // to none on the versions other than latest (latest
          // doesn't get a banner by default).
          lastVersion: (() => {
            if (isVersioningDisabled) {
              return 'current';
            } else {
              return '3.5';
            }
          })(),

          //onlyIncludeVersions: ['3.5', '3.4', '3.3', 3.2', '3.1', '2.5'],
          onlyIncludeVersions: (() => {
            if (isVersioningDisabled) {
              return ['current'];
            } else if (isBuildFast){
              return [...versions.slice(0, 1)];
            } else {
              return ['3.5', '3.4', '3.3', '3.2', '3.1', '2.5'];
            }
          })(),

          versions: (() => {
            if (isVersioningDisabled) {
              return { current: { label: 'current' } };
            } else {
              return {
                '3.5': { label: 'Candidate-3.5', banner: 'none' },
                '3.4': { label: 'Latest-3.4', banner: 'none' },
                '3.3': { label: 'Stable-3.3', banner: 'none' },
                '3.2': { label: '3.2', banner: 'none' },
                '3.1': { label: '3.1', banner: 'none' },
                '2.5': { label: '2.5', banner: 'none' },
              };
            }
          })(),
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        gtag: {
          trackingID: 'G-VTBXVPZLHB',
          anonymizeIP: true,
        },
      }),
    ],
  ],

  scripts: [
    {
      src: "/scripts/zoominfo.js",
      async: true,
      defer: true,
    },
  ],
  plugins: [
    'docusaurus-plugin-hubspot',
    [
      "@docusaurus/plugin-content-docs",
      {
        path: "releasenotes",
        id: "releasenotes",
        routeBasePath: "releasenotes",
        sidebarPath: "./releasenotes-sidebars.json",
        // Edit links for English and Chinese
        editUrl: ({locale, docPath}) => {
          return 'https://github.com/StarRocks/starrocks/edit/main/docs/' + locale + '/release_notes/' + docPath
        }
      },
    ],
    [
    '@docusaurus/plugin-client-redirects',
    {
      redirects: [
        // /docs/oldDoc -> /docs/newDoc
        {
          from: '/docs/loading/cloud_storage_load/',
          to: '/docs/loading/objectstorage/'
        },
      ],
    },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: true,
        },
      },
      // This image shows in Slack when you paste a link
      image: 'img/logo.svg',
      navbar: {
        title: 'StarRocks',
        logo: {
          alt: 'StarRocks Logo',
          src: 'img/logo.svg',
          href: 'https://www.starrocks.io/',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            docsPluginId: 'default',
            position: 'left',
            label: 'Docs',
          },
          {
            type: 'docsVersionDropdown',
            docsPluginId: 'default',
            position: 'left',
          },
          {
            type: 'localeDropdown',
            docsPluginId: 'default',
            position: 'left',
          },
          // only for production begin. For local builds by the doc team we don't need
          // the extra nav items. If you do need to QA these build in staging after
          // merging your PR.
          {
            type: 'docSidebar',
            docsPluginId: 'releasenotes',
            sidebarId: 'docs',
            position: 'right',
            label: 'Release Notes',
          },
          {
            href: 'https://github.com/StarRocks/starrocks',
            position: 'right',
            className: 'header-github-link',
            'aria-label': 'GitHub repository',
          },
          {
            type: 'dropdown',
            label: 'Community',
            hoverable: true,
            className: 'EnglishOnly',
            position: 'right',
            items: [
              {
                label: 'Slack',
                to: 'https://try.starrocks.com/join-starrocks-on-slack',
                className: 'header-slack-link',
                'aria-label': 'Slack workspace',
              },
              {
                label: 'Forum',
                to: 'https://forum.starrocks.io/',
                className: 'header-discourse-link',
                'aria-label': 'Forum',
              },
            ],
          },
          {
            type: 'dropdown',
            label: '社区群',
            hoverable: true,
            className: 'ChineseOnly',
            position: 'right',
            items: [
              {
                label: 'StarRocks中文社区论坛',
                to: 'https://forum.mirrorship.cn/',
                className: 'header-chinese-forum-link',
                'aria-label': 'StarRocks中文社区论坛',
              },
              {
                label: '技术支持渠道',
                to: 'https://docs.starrocks.io/zh/docs/project_help/slack/',
                'aria-label': '技术支持渠道',
              },
            ],
          },
          // end only for production
          {
            label: 'Privacy policy',
            position: 'right',
            to: 'https://www.starrocks.io/product/privacy-policy',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            items: [
              {
                label: 'StarRocks.io',
                to: 'https://www.starrocks.io/',
              },
              {
                label: 'Privacy policy',
                to: 'https://www.starrocks.io/product/privacy-policy',
              },
            ],
          },
        ],
        copyright: `Docs built with Docusaurus.`,
      },

      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: [
          'java',
          'haskell',
          'python',
          'matlab',
          'bash',
          'diff',
          'json',
          'scss',
        ],
      },
      algolia: {
        // The application ID provided by Algolia
        appId: 'ER08SJMRY1',
  
        // Public API key: it is safe to commit it
        apiKey: '08af8d37380974edb873fe8fd61e8dda',
  
        indexName: 'starrocks',
  
        // Optional: see doc section below
        contextualSearch: true,
  
        // Optional: Algolia search parameters
        searchParameters: {},

        // Optional: path for search page that enabled by default (`false` to disable it)
        searchPagePath: 'search',

      },
      hubspot: {
        accountId: '21782839',
        async: false,
        defer: false,
      },
    }),
};

module.exports = config;
