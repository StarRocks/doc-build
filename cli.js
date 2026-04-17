const args = process.argv;
const path = require("path");
const config = require("./src/config");
const fse = require("fs-extra");
const fs = require("fs");
const {
  jaSiderbarPath,
  zhSiderbarPath,
  enSiderbarPath,
  locales,
  commonSiderBars,
} = config;
const versions = [
  { branch: "main" },
  ...require("./versions.json").map((v) => ({ branch: v })),
];
const exec = require("child_process").exec;
const execSync = require("child_process").execSync;

const tempDir = path.join(__dirname, "temp");
const docsDir = path.join(__dirname, config.docDir);
const deleteDirIfExist = (path) => {
  if (fs.existsSync(path)) {
    fs.rmSync(path, { recursive: true });
  }
};
const cleanup = () => {
  const versionedBranches = versions
    .filter(v => v.branch !== 'main')
    .map(v => v.branch);
  const latestVersion = versionedBranches[0];

  // Recursively delete all files with a given name under a directory
  const removeFilesNamed = (dir, filename) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) removeFilesNamed(full, filename);
      else if (entry.name === filename) fs.rmSync(full);
    }
  };

  // Delete a path (file or directory) if it exists
  const removeSilent = (p) => {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  };

  // Absolute path to the versioned content dir for a given locale and version branch
  const localeDirFor = (locale, ver) => {
    if (locale === 'zh') return path.join(__dirname, 'i18n', 'zh', 'docusaurus-plugin-content-docs', `version-${ver}`);
    if (locale === 'ja') return path.join(__dirname, 'i18n', 'ja', 'docusaurus-plugin-content-docs', `version-${ver}`);
    return path.join(__dirname, 'versioned_docs', `version-${ver}`); // en
  };
  const allLocaleDirsFor = (ver) => ['en', 'zh', 'ja'].map(l => localeDirFor(l, ver));

  // Copy files whose names match a shell-style glob pattern from srcDir to each destination dir
  const matchGlob = (name, pattern) => {
    const re = new RegExp(
      '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'
    );
    return re.test(name);
  };
  const copyGlob = (srcDir, pattern, destDirs) => {
    if (!fs.existsSync(srcDir)) return;
    const files = fs.readdirSync(srcDir).filter(f => matchGlob(f, pattern));
    for (const file of files) {
      for (const dest of destDirs) {
        fse.copySync(path.join(srcDir, file), path.join(dest, file), { overwrite: true });
      }
    }
  };

  // Move files matching a shell-style glob from srcDir into destDir
  const moveGlob = (srcDir, pattern, destDir) => {
    if (!fs.existsSync(srcDir)) return;
    fse.ensureDirSync(destDir);
    const files = fs.readdirSync(srcDir).filter(f => matchGlob(f, pattern));
    for (const file of files) {
      fse.moveSync(path.join(srcDir, file), path.join(destDir, file), { overwrite: true });
    }
  };

  // ── Pre-copy cleanup ──────────────────────────────────────────────────────

  console.log('rm TOCs');
  removeFilesNamed(path.join(__dirname, 'i18n'), 'TOC.md');
  removeFilesNamed(path.join(__dirname, 'versioned_docs'), 'TOC.md');

  console.log('rm READMEs');
  for (const ver of versionedBranches) {
    for (const dir of allLocaleDirsFor(ver)) {
      removeSilent(path.join(dir, 'README.md'));
    }
  }

  console.log('rm ecosystem_release');
  for (const ver of versionedBranches) {
    for (const dir of allLocaleDirsFor(ver)) {
      removeSilent(path.join(dir, 'ecosystem_release'));
    }
  }

  // ── Stage release notes and developer docs ────────────────────────────────

  // Clear existing release_notes and developers dirs before repopulating
  for (const ver of versionedBranches) {
    for (const dir of allLocaleDirsFor(ver)) {
      removeSilent(path.join(dir, 'release_notes'));
      removeSilent(path.join(dir, 'developers'));
    }
  }

  fse.ensureDirSync(path.join(__dirname, 'releasenotes'));
  fse.ensureDirSync(path.join(__dirname, 'common'));

  for (const ver of versionedBranches) {
    for (const dir of allLocaleDirsFor(ver)) {
      fse.ensureDirSync(path.join(dir, '_assets'));
      fse.ensureDirSync(path.join(dir, 'developers'));
    }
  }

  // Copy shared images from latest version's _assets to all other versions.
  // Source of truth is always the English versioned_docs for the latest version.
  const latestEnAssets = path.join(__dirname, 'versioned_docs', `version-${latestVersion}`, '_assets');
  const otherVersions = versionedBranches.slice(1);

  // Heap profile, debug info, and trace images go to:
  //   en: all versions except latest (which is the source)
  //   zh + ja: all versions
  for (const pattern of ['visualized_heap_profile.png', 'debug_info.png', '*trace*.png']) {
    copyGlob(latestEnAssets, pattern, [
      ...otherVersions.map(v => path.join(__dirname, 'versioned_docs', `version-${v}`, '_assets')),
      ...versionedBranches.map(v => path.join(localeDirFor('zh', v), '_assets')),
      ...versionedBranches.map(v => path.join(localeDirFor('ja', v), '_assets')),
    ]);
  }

  // IDE images go to:
  //   zh: version-3.1 only (other zh versions have them from their git branches)
  //   ja: all versions (ja branches do not include IDE images)
  //   en: not needed (present in each version's git branch)
  for (const pattern of ['IDEA*.png', 'ide*.png']) {
    copyGlob(latestEnAssets, pattern, [
      path.join(localeDirFor('zh', '3.1'), '_assets'),
      ...versionedBranches.map(v => path.join(localeDirFor('ja', v), '_assets')),
    ]);
  }

  // Move release note markdown files from common/ staging area to Docusaurus content dirs
  const releaseNotesLocales = [
    {
      src:  path.join(__dirname, 'common', 'releasenotes', 'en-us'),
      dest: path.join(__dirname, 'releasenotes'),
    },
    {
      src:  path.join(__dirname, 'common', 'releasenotes', 'zh-cn'),
      dest: path.join(__dirname, 'i18n', 'zh', 'docusaurus-plugin-content-docs-releasenotes', 'current'),
    },
    {
      src:  path.join(__dirname, 'common', 'releasenotes', 'ja'),
      dest: path.join(__dirname, 'i18n', 'ja', 'docusaurus-plugin-content-docs-releasenotes', 'current'),
    },
  ];
  for (const { src, dest } of releaseNotesLocales) {
    moveGlob(src, 'release-4*.md', dest);
    moveGlob(src, 'release-3*.md', dest);
    moveGlob(src, 'release-2.5.md', dest);
    moveGlob(src, '*or.md', dest);
  }

  // Copy developer docs from the common/ staging area into the latest version,
  // then propagate to all other versions.
  const developerFiles = ['debuginfo.md', 'How_to_Contribute.md', 'jemalloc_heap_profile.md', 'versions.md'];
  const developerSubdirs = ['build-starrocks', 'code-style-guides', 'development-environment', 'trace-tools'];
  const devSourceByLocale = [
    { src: path.join(__dirname, 'common', 'releasenotes', 'en-us'), locale: 'en' },
    { src: path.join(__dirname, 'common', 'releasenotes', 'zh-cn'), locale: 'zh' },
    { src: path.join(__dirname, 'common', 'releasenotes', 'ja'),    locale: 'ja' },
  ];
  for (const { src, locale } of devSourceByLocale) {
    const latestDevDest = path.join(localeDirFor(locale, latestVersion), 'developers');
    for (const file of developerFiles) {
      fse.copySync(path.join(src, file), path.join(latestDevDest, file));
    }
    for (const subdir of developerSubdirs) {
      fse.copySync(path.join(src, subdir), path.join(latestDevDest, subdir));
    }
    for (const ver of otherVersions) {
      fse.copySync(latestDevDest, path.join(localeDirFor(locale, ver), 'developers'), { overwrite: true });
    }
  }

  // versions.md is specific to the latest release; remove it from older versions
  for (const ver of ['3.2', '3.1']) {
    for (const dir of allLocaleDirsFor(ver)) {
      removeSilent(path.join(dir, 'developers', 'versions.md'));
    }
  }

  // ── Post-copy cleanup ─────────────────────────────────────────────────────

  console.log('verifying Markdown');
  execSync('npx docusaurus-mdx-checker -c versioned_docs', { stdio: 'inherit' });
  execSync('npx docusaurus-mdx-checker -c i18n', { stdio: 'inherit' });

  // The English git checkout includes a zh/ subdir inside versioned_docs; remove it
  // because Chinese content is served from i18n/zh/ instead
  for (const ver of versionedBranches) {
    removeSilent(path.join(__dirname, 'versioned_docs', `version-${ver}`, 'zh'));
  }

  console.log('removing temp files');
  deleteDirIfExist(tempDir);
};

const copyDocs = () => {
  const deleteExistDir = () => {
    const enDir = path.join(__dirname, "versioned_docs");
    const zhDir = path.join(
      __dirname,
      "i18n/zh/docusaurus-plugin-content-docs/"
    );
    const jaDir = path.join(
      __dirname,
      "i18n/ja/docusaurus-plugin-content-docs/"
    );
    if (fs.existsSync(enDir)) {
      fs.rmSync(enDir, { recursive: true });
    }
    if (fs.existsSync(jaDir)) {
    const jaFolders = fs.readdirSync(jaDir);
    jaFolders.forEach((folder) => {
      if (folder.startsWith("version-")) {
        fs.rmSync(jaDir + "/" + folder, { recursive: true });
      }
    });
    }
    const zhFolders = fs.readdirSync(zhDir);
    zhFolders.forEach((folder) => {
      if (folder.startsWith("version-")) {
        fs.rmSync(zhDir + "/" + folder, { recursive: true });
      }
    });
  };
  deleteExistDir();
  console.log("begin iterating over locales");
  locales.forEach((l) => {
    const tempLocaleDir = `${tempDir}/${l.sourceDir}`;
    const normalFrom = path.join(
      tempLocaleDir,
      ("/" + l.docsPath).slice(0, -1)
    );
    let from = normalFrom;
    console.log("begin iterating over each version");
    versions.forEach((v) => {
      console.log("working on locale " + l.id + " and version " + v.branch);
      const targetBranch =
        v.branch === "main" ? "main" : l.branchPrefix + v.branch;
      let to = path.join(__dirname, `versioned_docs/version-${v.branch}`);
      if (l.id === "zh-cn") {
        to = path.join(
          __dirname,
          `i18n/zh/docusaurus-plugin-content-docs/version-${v.branch}`
        );
      } else if (l.id === "ja") {
        to = path.join(
          __dirname,
          `i18n/ja/docusaurus-plugin-content-docs/version-${v.branch}`
        );
      }
      // added `mkdir -p` because older versions do not have `docs/ja` dir, so `cd` fails
      execSync(
        `mkdir -p ${from} && cd ${from} && git checkout ${targetBranch}`
      );
      if (targetBranch === "main") {
        const floderPath =
          {
            "en-us": enSiderbarPath,
            "zh-cn": zhSiderbarPath,
            ja: jaSiderbarPath,
          }[l.id] || "/";
        to = path.join(__dirname, floderPath);
        deleteDirIfExist(to);
        commonSiderBars.forEach((floder) => {
          from = path.join(
            tempLocaleDir,
            ("/" + l.docsPath).slice(0, -1) + "/" + floder
          );
          fse.copySync(from, to);
          from = normalFrom;
        });
      } else {
        // check for locale so we only copy the sidebars file
        // once (it is same for both locales)
        if (l.id === "zh-cn") {
          let fromSidebarPath = path.join(
            tempDir,
            "docs/docusaurus/sidebars.json"
          );
          let toSidebarPath = path.join(
            __dirname,
            "versioned_sidebars/version-" + v.branch + "-sidebars.json"
          );
          let fromTranslationFilePath = path.join(
            tempDir,
            "docs/docusaurus/i18n/zh/docusaurus-plugin-content-docs/current.json"
          );
          let toTranslationFilePath = path.join(
            __dirname,
            `i18n/zh/docusaurus-plugin-content-docs/version-${v.branch}.json`
          );
          console.log(
            "\n fromSidebarPath: ",
            fromSidebarPath,
            "\n toSidebarPath: ",
            toSidebarPath,
            "\n toTranslationFilePath: ",
            toTranslationFilePath
          );
          fse.copySync(fromSidebarPath, toSidebarPath);
          fse.copySync(fromTranslationFilePath, toTranslationFilePath);
        } else if (l.id === "ja") {
          let fromTranslationFilePath = path.join(
            tempDir,
            "docs/docusaurus/i18n/ja/docusaurus-plugin-content-docs/current.json"
          );
          let toTranslationFilePath = path.join(
            __dirname,
            `i18n/ja/docusaurus-plugin-content-docs/version-${v.branch}.json`
          );
          console.log("\n toTranslationFilePath: ", toTranslationFilePath);
          fse.copySync(fromTranslationFilePath, toTranslationFilePath);
        }
        fse.copySync(from, to);
      }
    });
  });
  console.log("Starting cleanup");
  cleanup();
  console.log("done");
};

if (args[2] === "copy") {
  copyDocs();
}
