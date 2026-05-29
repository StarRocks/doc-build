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
const isDefaultLocale = (process.env.DOCUSAURUS_CURRENT_LOCALE ?? 'en') === 'en';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'StarRocks',
  tagline: 'StarRocks documentation',
  favicon: 'img/favicon.ico',

  url: process.env.SITE_URL || 'https://docs.starrocks.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'StarRocks', // Usually your GitHub org/user name.
  projectName: 'starrocks', // Usually your repo name.

  // needed for hosting in S3:
  trailingSlash: true,

  onBrokenAnchors: 'ignore',
  onBrokenLinks: 'throw',
  markdown: { hooks: { onBrokenMarkdownLinks: 'throw' } },


  future: {
    v4: true,
    experimental_faster: {
      rspackBundler: false, // Enables Rspack as the bundler
      rspackPersistentCache: false, // Speeds up subsequent builds
      swcJsLoader: true, // Uses SWC for faster JS transpilation
      swcJsMinimizer: true, // Uses SWC for faster JS minification
      swcHtmlMinimizer: true, // Uses SWC for faster HTML minification
      lightningCssMinimizer: true, // Uses Lightning CSS for faster CSS minification
      mdxCrossCompilerCache: true, // Speeds up MDX compilation
    },
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
              return '4.1';
            }
          })(),

          //onlyIncludeVersions: ['4.1', '4.0', '3.5', '3.4', '3.3', 3.2', '3.1'],
          onlyIncludeVersions: (() => {
            if (isVersioningDisabled) {
              return ['current'];
            } else if (isBuildFast){
              return [...versions.slice(0, 2)];
            } else {
              return ['4.1', '4.0', '3.5', '3.4', '3.3', '3.2', '3.1'];
            }
          })(),

          versions: (() => {
            if (isVersioningDisabled) {
              return { current: { label: 'current' } };
            } else {
              return {
                '4.1': { label: 'Latest-4.1', banner: 'none' },
				'4.0': { label: '4.0', banner: 'none' },
                '3.5': { label: 'Stable-3.5', banner: 'none' },
                '3.4': { label: '3.4', banner: 'none' },
                '3.3': { label: '3.3', banner: 'none' },
                '3.2': { label: '3.2', banner: 'none' },
                '3.1': { label: '3.1', banner: 'none' },
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
    './src/plugins/tailwind-config.js',
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
          from: '/docs/using_starrocks/data_lake_query_acceleration_with_materialized_views/',
          to: '/docs/using_starrocks/async_mv/use_cases/data_lake_query_acceleration_with_materialized_views/'
        },
        {
          from: '/docs/loading/cloud_storage_load/',
          to: '/docs/loading/objectstorage/'
        },
      ],
    },
    ],
    ...(isDefaultLocale ? [[
      '@signalwire/docusaurus-plugin-llms-txt',
      {
                // Markdown file generation options
        markdown: {
          enableFiles: true,
          relativePaths: false,
          includeBlog: false,
          includePages: false,
          includeDocs: true,
          includeVersionedDocs: false,
          excludeRoutes: [
            // Pure navigation pages — no content for LLMs
            '/docs/cover_pages/**',
            '/docs/category/**',
            // DocCardList-only section index pages (navigation, no content)
            // Add new ones here as the nav structure evolves
            '/docs/administration/',
            '/docs/administration/management/',
            '/docs/administration/management/configuration/',
            '/docs/benchmarking/',
            '/docs/data_source/catalog/catalog_intro/',
            '/docs/faq/',
            '/docs/integrations/',
            '/docs/integrations/streaming/',
            '/docs/integrations/streaming/apache_kafka/',
            '/docs/introduction/',
            '/docs/loading/',
            '/docs/loading/loading_introduction/loading_overview/',
            '/docs/loading/objectstorage/',
            '/docs/project_help/',
            '/docs/sql-reference/data-types/',
            '/docs/sql-reference/data-types/date-types/',
            '/docs/sql-reference/sql-functions/',
            '/docs/sql-reference/sql-functions/date-time-functions/',
            '/docs/unloading/',
          ],
        },
        llmsTxt: {
          enableLlmsFullTxt: true,
          includeBlog: false,
          includePages: false,
          includeDocs: true,
          includeVersionedDocs: false,
          excludeRoutes: [
            // Pure navigation pages — no content for LLMs
            '/docs/cover_pages/**',
            '/docs/category/**',
            // DocCardList-only section index pages (navigation, no content)
            // Add new ones here as the nav structure evolves
            '/docs/administration/',
            '/docs/administration/management/',
            '/docs/administration/management/configuration/',
            '/docs/benchmarking/',
            '/docs/data_source/catalog/catalog_intro/',
            '/docs/faq/',
            '/docs/integrations/',
            '/docs/integrations/streaming/',
            '/docs/integrations/streaming/apache_kafka/',
            '/docs/introduction/',
            '/docs/loading/',
            '/docs/loading/loading_introduction/loading_overview/',
            '/docs/loading/objectstorage/',
            '/docs/project_help/',
            '/docs/sql-reference/data-types/',
            '/docs/sql-reference/data-types/date-types/',
            '/docs/sql-reference/sql-functions/',
            '/docs/sql-reference/sql-functions/date-time-functions/',
            '/docs/unloading/',
          ],
          autoSectionDepth: 2,

          // Site metadata
          siteTitle: 'StarRocks Documentation',
          siteDescription: 'StarRocks is an open-source, high-performance OLAP database for real-time analytics at scale. It supports Standard SQL, materialized views, data lakes (Iceberg, Delta Lake, Hudi), stream ingestion (Kafka, Flink), and cloud-native deployment. This documentation covers SQL reference, table design, data loading, query acceleration, administration, and release notes.',
        },
      },
    ]] : []),
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
            href: "https://www.youtube.com/playlist?list=PL0eWwaesODdjjEvyaupqunQjE5Ndy7-Ku",
            label: "StarRocks Summit 2025",
            position: "right",
          },          
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
                to: 'https://join.slack.com/t/starrocks/shared_invite/zt-1d0cs3cs2-7eL5Q0cGoBofhyIOx7pLfQ',
                className: 'header-slack-link',
                'aria-label': 'Slack workspace',
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
      announcementBar: {
        // content: `⭐️ If you like Docusaurus, give it a star on <a target="_blank" rel="noopener noreferrer" href="https://github.com/facebook/docusaurus">GitHub</a> and follow us on <a target="_blank" rel="noopener noreferrer" href="https://x.com/docusaurus">X ${TwitterSvg}</a>`,
	    content: `🎉️ <b><a target="_blank" href="https://www.youtube.com/playlist?list=PL0eWwaesODdjjEvyaupqunQjE5Ndy7-Ku">Watch on demand: StarRocks Summit 2025</a></b> 🎉️`,
        id: 'summit',
        backgroundColor: '#111F64',
        textColor: '#ffffff',
        isCloseable: true,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: [
          "java",
          "haskell",
          "python",
          "matlab",
          "bash",
          "diff",
          "json",
          "scss",
          "scala",
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
    }),
};

module.exports = config;
