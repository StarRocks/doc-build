import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';
import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useDocsVersion} from '@docusaurus/plugin-content-docs/client';

// The feature cards on StarRocks_intro point at the same eleven destinations in
// every language, so the URLs live here once and the per-language lists below
// carry only the text. They used to be repeated in all three lists, which is how
// four of them silently rotted: the targets were restructured upstream and only
// the daily full build noticed.
//
// Paths are relative to a version's docs root (no leading slash) and are turned
// into absolute URLs by useFeatureUrl() below. Do NOT write them as `../../foo/`
// — a relative URL resolves against the *page* URL, and StarRocks_intro sits at a
// different depth depending on the version (`introduction/StarRocks_intro` in
// 3.1-3.4, the version root in 3.5+) and on whether the version is the unprefixed
// latest one. That is what made 3.5 and 4.0 link into the 4.1 docs.
// Several of these resolve to a bare directory because the doc inside is a
// Docusaurus "category index": a file named index.*, readme.*, or after its own
// parent directory (plugin-content-docs/lib/docs.js, isCategoryIndex) takes the
// directory's slug rather than its own. That is why the target is
// `loading/loading_introduction/` and not
// `loading/loading_introduction/loading_introduction/`.
const DOC_PATHS = {
  introduction: 'introduction/',
  quickStart: 'quick_start/',
  loading: 'loading/loading_introduction/',
  tableDesign: 'table_design/StarRocks_table_design/',
  dataLakes: 'integrations/data_lakes/',
  semiStructured: 'sql-reference/data-types/semi_structured/',
  integrations: 'integrations/',
  administration: 'administration/',
  reference: 'sql-reference/',
  faq: 'faq/',
  benchmarking: 'benchmarking/',
};

// 3.4 and older predate the upstream docs restructure. There, data loading and
// the data lake page still live under their old names, and "Semi-structured" and
// "Reference" are `link: {type: generated-index}` categories rather than real
// docs, so they are served from /category/. Those categories are gone from 3.5
// onward (0 generated-index categories remain), replaced by index docs.
const LEGACY_DOC_PATHS = {
  ...DOC_PATHS,
  loading: 'loading/Loading_intro/',
  dataLakes: 'data_source/data_lakes/',
  semiStructured: 'category/semi-structured/',
  reference: 'category/reference/',
};

// Versions before 3.5 use the pre-restructure layout. Anything unparseable
// (`current`, used when DISABLE_VERSIONING is set) tracks main, which is current.
function usesLegacyPaths(version) {
  const match = /^(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    return false;
  }
  const [, major, minor] = match;
  return Number(major) * 100 + Number(minor) < 305;
}

// Resolve a DOC_PATHS key to an absolute URL for the version being rendered.
// The latest version is served unprefixed at /docs/, every other version at
// /docs/<version>/. useBaseUrl prepends the locale baseUrl, so this stays correct
// for the zh (/zh/) and ja (/ja/) builds.
function useFeatureUrl(slot) {
  const {version, isLast} = useDocsVersion();
  const paths = usesLegacyPaths(version) ? LEGACY_DOC_PATHS : DOC_PATHS;
  return useBaseUrl(`/docs/${isLast ? '' : `${version}/`}${paths[slot]}`);
}

const ChineseFeatureList = [
  {
    title: '产品简介',
    slot: 'introduction',
    description: (
      <>
        OLAP、特性、系统架构
      </>
    ),
  },
  {
    title: '快速入门信息',
    slot: 'quickStart',
    description: (
      <>
        快速部署、导入、查询
      </>
    ),
  },
  {
    title: '导入数据',
    slot: 'loading',
    description: (
      <>
        数据清洗、转换、导入
      </>
    ),
  },
  {
    title: '表设计',
    slot: 'tableDesign',
    description: (
      <>
        表、索引、分区、加速
      </>
    ),
  },
  {
    title: '查询数据湖',
    slot: 'dataLakes',
    description: (
      <>
        Iceberg, Hive, Delta Lake, …
      </>
    ),
  },
  {
    title: '半结构化类型',
    slot: 'semiStructured',
    description: (
      <>
        JSON, map, struct, array
      </>
    ),
  },
  {
    title: '外部系统集成',
    slot: 'integrations',
    description: (
      <>
        BI、IDE、认证信息
      </>
    ),
  },
  {
    title: '管理手册',
    slot: 'administration',
    description: (
      <>
        扩缩容、备份恢复、权限、性能调优
      </>
    ),
  },
  {
    title: '参考手册',
    slot: 'reference',
    description: (
      <>
        SQL 语法、命令、函数、变量
      </>
    ),
  },
  {
    title: '常见问题解答',
    slot: 'faq',
    description: (
      <>
        部署、导入、查询、权限常见问题
      </>
    ),
  },
  {
    title: '性能测试',
    slot: 'benchmarking',
    description: (
      <>
        性能测试：数据库性能对比
      </>
    ),
  },
];

const EnglishFeatureList = [
  {
    title: 'Introduction',
    slot: 'introduction',
    description: (
      <>
        OLAP, features, architecture
      </>
    ),
  },
  {
    title: 'Quick Start',
    slot: 'quickStart',
    description: (
      <>
        Get up and running quickly.
      </>
    ),
  },
  {
    title: 'Data Loading',
    slot: 'loading',
    description: (
      <>
        Clean, transform, and load
      </>
    ),
  },
  {
    title: 'Table Design',
    slot: 'tableDesign',
    description: (
      <>
        Tables, indexing, acceleration
      </>
    ),
  },
  {
    title: 'Data Lakes',
    slot: 'dataLakes',
    description: (
      <>
        Iceberg, Hive, Delta Lake, …
      </>
    ),
  },
  {
    title: 'Work with semi-structured data',
    slot: 'semiStructured',
    description: (
      <>
        JSON, map, struct, array
      </>
    ),
  },
  {
    title: 'Integrations',
    slot: 'integrations',
    description: (
      <>
        BI tools, IDEs, Cloud authentication, …
      </>
    ),
  },
  {
    title: 'Administration',
    slot: 'administration',
    description: (
      <>
        Scale, backups, roles and privileges, …
      </>
    ),
  },
  {
    title: 'Reference',
    slot: 'reference',
    description: (
      <>
        SQL, functions, error codes, …
      </>
    ),
  },
  {
    title: 'FAQs',
    slot: 'faq',
    description: (
      <>
        Frequently asked questions.
      </>
    ),
  },
  {
    title: 'Benchmarks',
    slot: 'benchmarking',
    description: (
      <>
        DB performance comparison benchmarks.
      </>
    ),
  },
];

const JapaneseFeatureList = [
  {
    title: '紹介',
    slot: 'introduction',
    description: (
      <>
        OLAP、機能、アーキテクチャ
      </>
    ),
  },
  {
    title: 'クイックスタート',
    slot: 'quickStart',
    description: (
      <>
        デプロイ、ロード、クエリ
      </>
    ),
  },
  {
    title: 'データロード',
    slot: 'loading',
    description: (
      <>
        データクレンジング、変換、ロード
      </>
    ),
  },
  {
    title: 'テーブルデザイン',
    slot: 'tableDesign',
    description: (
      <>
        テーブル、インデックス、パーティション、クエリー加速
      </>
    ),
  },
  {
    title: 'データレイクをクエリ',
    slot: 'dataLakes',
    description: (
      <>
        Iceberg、Hive、Delta Lake …
      </>
    ),
  },
  {
    title: 'セミ構造化タイプ',
    slot: 'semiStructured',
    description: (
      <>
        JSON、map、struct、array
      </>
    ),
  },
  {
    title: '外部システム統合',
    slot: 'integrations',
    description: (
      <>
        BI、IDE、認証情報
      </>
    ),
  },
  {
    title: '管理',
    slot: 'administration',
    description: (
      <>
        スケールインとスケールアウト、バックアップ、権限、パフォーマンスチューニング
      </>
    ),
  },
  {
    title: 'リファレンス',
    slot: 'reference',
    description: (
      <>
        SQL 構文、コマンド、関数、変数
      </>
    ),
  },
  {
    title: 'FAQ',
    slot: 'faq',
    description: (
      <>
        デプロイ、ロード、クエリー、権限 FAQ
      </>
    ),
  },
  {
    title: 'ベンチマーク',
    slot: 'benchmarking',
    description: (
      <>
        ベンチマーク：データベース・パフォーマンスの比較
      </>
    ),
  },
];

function Feature({slot, title, description}) {
  const url = useFeatureUrl(slot);
  return (
    <div className={clsx('col col--6 margin-bottom--lg')}>
     <Link to={url} target="_self" className="card padding--lg cardContainer_fWXF">
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
     </Link>
    </div>
  );
}


export default function Features({language}) {
  if (language == "Chinese") {
    return (
      <section className={styles.features}>
        <div className="container">
          <div className="row">
            {ChineseFeatureList.map((props, idx) => (
              <Feature key={idx} {...props} />
            ))}
          </div>
        </div>
      </section>
    );
  }
  else if (language == "Japanese") {
    return (
      <section className={styles.features}>
        <div className="container">
          <div className="row">
            {JapaneseFeatureList.map((props, idx) => (
              <Feature key={idx} {...props} />
            ))}
          </div>
        </div>
      </section>
    );
  }
  else{
    return (
      <section className={styles.features}>
        <div className="container">
          <div className="row">
            {EnglishFeatureList.map((props, idx) => (
              <Feature key={idx} {...props} />
            ))}
          </div>
        </div>
      </section>
    );
  }
}
