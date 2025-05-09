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
const versions = config.versions.filter((i) => i.branch !== "latest");
const exec = require("child_process").exec;
const execSync = require("child_process").execSync;

const tempDir = path.join(__dirname, "temp");
const docsDir = path.join(__dirname, config.docDir);
const deleteDirIfExist = (path) => {
  if (fs.existsSync(path)) {
    fs.rmSync(path, { recursive: true });
  }
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
  execSync(`./_IGNORE/clean_up.sh`);
  console.log("done");
};

if (args[2] === "copy") {
  copyDocs();
}
