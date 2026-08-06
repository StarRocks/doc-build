// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';
import versions from './versions.json';
import agentDocsRoutes from './src/agentDocsRoutes.js';

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

// Which doc versions this build ships, and which one is "latest".
// Hoisted out of the preset so the sitemap config below can derive the archived
// version prefixes from the same source rather than repeating the list.
//
// lastVersion is served unprefixed at /docs/...; every other included version is
// served at /docs/<version>/... .
const lastVersion = isVersioningDisabled ? 'current' : '4.1';

const includedVersions = (() => {
  if (isVersioningDisabled) {
    return ['current'];
  }
  if (isBuildFast) {
    return [...versions.slice(0, 2)];
  }
  return ['4.1', '4.0', '3.5', '3.4', '3.3', '3.2', '3.1'];
})();

// Archived (non-latest) versions, i.e. the ones that get a /docs/<version>/ prefix.
const archivedVersions = includedVersions.filter((v) => v !== lastVersion);

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
      // SWC HTML minification strips optional closing tags (</td>, </tr>,
      // </body>, ...). Lenient HTML parsers used by many agent tools — and by
      // the afdocs markdown-content-parity checker (node-html-parser) — don't
      // implement HTML5 implicit tag closing, so they fail to nest <body>/<main>/
      // <table> and fall back to whole-document text, producing false content
      // mismatches. Docusaurus's default (Terser) minifier keeps closing tags,
      // so the emitted HTML stays parseable. See scripts/llms-postprocess.js.
      swcHtmlMinimizer: false,
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
          lastVersion,

          //onlyIncludeVersions: ['4.1', '4.0', '3.5', '3.4', '3.3', 3.2', '3.1'],
          onlyIncludeVersions: includedVersions,

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
        // THE PUBLIC SITEMAP: current version only, real content first.
        //
        // This is the file robots.txt advertises and search engines consume.
        // Algolia DocSearch reads /sitemap-algolia.xml instead — see the second
        // plugin-sitemap instance in `plugins` below for why they are separate.
        //
        // ignorePatterns — drop the archived version trees.
        // static/robots.txt already Disallows /docs/4.*/, /docs/3.*/ and
        // /docs/2.5/ for every user-agent, so listing those same ~5,800 URLs here
        // told crawlers "index these" and "don't fetch these" at once. That is
        // what produces "Indexed, though blocked by robots.txt" in Search
        // Console. They were only ever in this file because Algolia needed them,
        // and Algolia now has its own.
        //
        // createSitemapItems — sort navigation stubs after real content.
        // Still needed after the trim. ~90 auto-generated /docs/category/**
        // DocCardList stubs sort alphabetically into the front of the remaining
        // block; without this the head of the sitemap is ~59% twin-less. That
        // matters because agent-readiness checkers (afdocs.dev) probe content
        // negotiation by sampling from the HEAD of the sitemap, not uniformly at
        // random — which is how "Server ignores Accept: text/markdown (0/50
        // sampled pages return markdown)" was reported while negotiation was in
        // fact working on every current doc page.
        //
        // The archived tier below is now unreachable via this instance
        // (ignorePatterns filters those routes out first). It is kept because the
        // same tier function documents the full ordering intent, and because a
        // version roll that forgets to update `lastVersion` would otherwise let
        // the previous latest through unsorted.
        //
        // hasMarkdownTwin() is the repo's single source of truth for "this route
        // has real content", so the tiers derive from it rather than from a
        // second hand-maintained list.
        //
        // scripts/check-sitemap-markdown-coverage.js fails the build if any of
        // this regresses.
        sitemap: {
          ignorePatterns: archivedVersions.map((v) => `/docs/${v}/**`),
          createSitemapItems: async ({defaultCreateSitemapItems, ...rest}) => {
            const items = await defaultCreateSitemapItems(rest);
            const archivedPrefixes = archivedVersions.map((v) => `/docs/${v}/`);
            const tierOf = (item) => {
              const {pathname} = new URL(item.url);
              // 2: archived versions (/docs/4.0/..., /docs/3.5/..., ...)
              if (archivedPrefixes.some((p) => pathname.startsWith(p))) return 2;
              // 0: current-version pages with real content; 1: navigation stubs
              // (/docs/category/**, /docs/cover_pages/**, section indexes, /search/)
              return agentDocsRoutes.hasMarkdownTwin(pathname) ? 0 : 1;
            };
            // Stable partition: relative order within each tier is preserved.
            return [0, 1, 2].flatMap((tier) => items.filter((i) => tierOf(i) === tier));
          },
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
    // Agent-Friendly Docs: HTML/markdown llms.txt directives + llms.txt splitting.
    // Only for the default (en) locale — markdown files and llms.txt only exist there.
    ...(isDefaultLocale ? ['./src/plugins/agent-friendly-docs.js'] : []),
    // Second sitemap, for Algolia DocSearch only.
    // -------------------------------------------------------------------------
    // /sitemap.xml is the PUBLIC sitemap: what robots.txt advertises and what
    // search engines and agent-readiness checkers consume. It should describe the
    // canonical surface — the current version — and nothing that robots.txt turns
    // around and Disallows.
    //
    // Algolia needs the opposite: search is supported for EVERY version, so its
    // crawler needs all ~6,900 URLs. Those two audiences were in conflict only
    // because they shared one file. They don't have to: the Algolia crawler
    // config takes an explicit `sitemaps: [...]` list, so it can be pointed at a
    // file of its own that robots.txt never mentions.
    //
    // This instance emits the complete set — every version. It must NEVER get
    // ignorePatterns: it is the only remaining file that lists the archived doc
    // trees, so filtering it would silently drop 3.1–4.0 out of search.
    // scripts/check-sitemap-markdown-coverage.js asserts it stays a superset of
    // the public sitemap and still contains archived-version URLs.
    [
      '@docusaurus/plugin-sitemap',
      {
        id: 'algolia',
        filename: 'sitemap-algolia.xml',
      },
    ],
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
          // Single source of truth: src/agentDocsRoutes.js
          excludeRoutes: agentDocsRoutes.EXCLUDE_ROUTE_PATTERNS,
        },
        llmsTxt: {
          enableLlmsFullTxt: true,
          includeBlog: false,
          includePages: false,
          includeDocs: true,
          includeVersionedDocs: false,
          excludeRoutes: agentDocsRoutes.EXCLUDE_ROUTE_PATTERNS,
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
                to: 'https://docs.starrocks.io/join/',
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
