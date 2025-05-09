# doc-build

These are the published URLs for staging and production:

- Staging, sandbox, test: https://docs-stage.starrocks.io/docs/introduction/StarRocks_intro/
- Production: https://docs.starrocks.io/docs/introduction/StarRocks_intro/

## Building staging or production

There are GitHub workflows to build staging and production. These are run each weekday on a schedule. They can also be run on demand from the repo Actions menu.

## Building locally

You can build all of the languages and versions on a Macbook M2 with 16 GB RAM. Other machines may also build fine. To do this run these commands from the `doc-build` directory:

```bash
yarn install --frozen-lockfile
git clone git@github.com:StarRocks/starrocks.git temp
npm run copy
export DOCUSAURUS_IGNORE_SSG_WARNINGS=true
export NODE_OPTIONS="--max-old-space-size=12192"
yarn clear && yarn build && yarn serve
```

## Changing versions

We publish several versions of the docs. This is the procedure for editing them.

You may want to refer to the PRs that make these changes for the Candidate version 3.4:

- [docs-site PR](https://github.com/StarRocks/docs-site/pull/223/files)
- [documentation PR](https://github.com/StarRocks/starrocks/pull/53854/files)

### Edit `docs-site/versions.json`

This is a Docusaurus `versions.json`, this one is used by Docusaurus to configure which versions should be included in nav. Add the new version to the top, and remove any versions that we will no longer publish (negotiate with CTO and PM)

```bash
[
  "3.4",
  "3.3",
  "3.2",
  "3.1",
  "2.5"
]
```

### Edit `docs-site/src/versions.json`

There is a second `versions.json`, this one is used by the StarRocks build process to configure which branches get built. Add the new version to the list below `main`, and remove any versions that we will no longer publish (negotiate with CTO and PM)

```bash
[
  {
    "branch": "main"
  },
  {
    "branch": "3.4"
  },
  {
    "branch": "3.3"
  },
  {
    "branch": "3.2"
  },
  {
    "branch": "3.1"
  },
  {
    "branch": "2.5"
  }
]
```

### Edit `docs-site/docusaurus.config.js`

There are several places to edit in the `docusaurus.config.js`. Search in the file for the current highest version (`3.3` in this example) and make the changes.

#### `lastVersion` section

There are comments in the file describing `lastVersion`. The only line to edit is `return '3.3';` in the example below:

```bash
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
              return '3.4';
            }
          })(),
```
#### `onlyIncludeVersions`

Edit the `return` line and add the new version:

```bash
          //onlyIncludeVersions: ['3.4', '3.3', 3.2', '3.1', '2.5'],
          onlyIncludeVersions: (() => {
            if (isVersioningDisabled) {
              return ['current'];
            } else if (isBuildFast){
              return [...versions.slice(0, 1)];
            } else {
              return ['3.4', '3.3', '3.2', '3.1', '2.5'];
            }
          })(),
```

#### `versions()` function

Edit the `versions()` function to return the labels used in the nav. This is also used for a banner at the top of the page to tell readers that they are not looking at the latest version of the docs. We remove the banners by setting `banner: 'none'` because we have customers who stay on a single version for a long time. Edit the function to set which versions should be:
- `Latest-`
- `Stable-`
- `Candidate-` (Note: we only have `Candidate-` for short periods of time before a release)

```bash
          versions: (() => {
            if (isVersioningDisabled) {
              return { current: { label: 'current' } };
            } else {
              return {
                '3.4': { label: 'Candidate-3.3', banner: 'none' },
                '3.3': { label: 'Latest-3.3', banner: 'none' },
                '3.2': { label: '3.2', banner: 'none' },
                '3.1': { label: 'Stable-3.1', banner: 'none' },
                '2.5': { label: '2.5', banner: 'none' },
              };
            }
          })(),
```

### Edit the script that copies the Release Notes and Developer docs into place

Edit `_IGNORE/cp_common_docs.sh` and add lines for the new version. The easiest thing to do is to find all of the lines related to the current version, make a copy, and set the new version.

### Add the new version to the Release Notes nav

The release notes are published with their own nav. Edit the file `docusaurus/releasenotes-sidebars.json` and add the new version:

```json
  "docs": [
    {
      "type": "category",
      "collapsible": "false",
      "label": "StarRocks",
      "items": [
        "release-3.4",
        "release-3.3",
        "release-3.2",
        "release-3.1",
        "release-3.0",
```

### Version specific translation file

Navigation entries for the `zh` docs need to be modified in some cases. For example, if we have a release candidate published, then the translation file needs to be edited to add the label `Candidate-3.4` (for example). This is done in the `starrocks/starrocks` repo, and the filename is `docs/docusaurus/i18n/zh/docusaurus-plugin-content-docs/current.json`. Make sure you edit this for the branch that is a release candidate.


