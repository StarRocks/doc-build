import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';
import React from 'react';
import Link from '@docusaurus/Link';

const ChineseFeatureList = [
  {
    title: '产品简介',
    url: '../../introduction/',
    description: (
      <>
        OLAP、特性、系统架构
      </>
    ),
  },
  {
    title: '快速入门信息',
    url: '../../quick_start/',
    description: (
      <>
        快速部署、导入、查询
      </>
    ),
  },
  {
    title: '导入数据',
    url: '../../loading/Loading_intro/',
    description: (
      <>
        数据清洗、转换、导入
      </>
    ),
  },
  {
    title: '表设计',
    url: '../../table_design/StarRocks_table_design/',
    description: (
      <>
        表、索引、分区、加速
      </>
    ),
  },
  {
    title: '查询数据湖',
    url: '../../data_source/data_lakes/',
    description: (
      <>
        Iceberg, Hive, Delta Lake, …
      </>
    ),
  },
  {
    title: '半结构化类型',
    url: '../../category/semi-structured/',
    description: (
      <>
        JSON, map, struct, array
      </>
    ),
  },
  {
    title: '外部系统集成',
    url: '../../integrations/',
    description: (
      <>
        BI、IDE、认证信息
      </>
    ),
  },
  {
    title: '管理手册',
    url: '../../administration/',
    description: (
      <>
        扩缩容、备份恢复、权限、性能调优
      </>
    ),
  },
  {
    title: '参考手册',
    url: '../../category/reference/',
    description: (
      <>
        SQL 语法、命令、函数、变量
      </>
    ),
  },
  {
    title: '常见问题解答',
    url: '../../faq/',
    description: (
      <>
        部署、导入、查询、权限常见问题
      </>
    ),
  },
  {
    title: '性能测试',
    url: '../../benchmarking/',
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
    url: '../../introduction/',
    description: (
      <>
        OLAP, features, architecture
      </>
    ),
  },
  {
    title: 'Quick Start',
    url: '../../quick_start/',
    description: (
      <>
        Get up and running quickly.
      </>
    ),
  },
  {
    title: 'Data Loading',
    url: '../../loading/Loading_intro/',
    description: (
      <>
        Clean, transform, and load
      </>
    ),
  },
  {
    title: 'Table Design',
    url: '../../table_design/StarRocks_table_design/',
    description: (
      <>
        Tables, indexing, acceleration
      </>
    ),
  },
  {
    title: 'Data Lakes',
    url: '../../data_source/data_lakes/',
    description: (
      <>
        Iceberg, Hive, Delta Lake, …
      </>
    ),
  },
  {
    title: 'Work with semi-structured data',
    url: '../../category/semi-structured/',
    description: (
      <>
        JSON, map, struct, array
      </>
    ),
  },
  {
    title: 'Integrations',
    url: '../../integrations/',
    description: (
      <>
        BI tools, IDEs, Cloud authentication, …
      </>
    ),
  },
  {
    title: 'Administration',
    url: '../../administration/',
    description: (
      <>
        Scale, backups, roles and privileges, …
      </>
    ),
  },
  {
    title: 'Reference',
    url: '../../category/reference/',
    description: (
      <>
        SQL, functions, error codes, …
      </>
    ),
  },
  {
    title: 'FAQs',
    url: '../../faq/',
    description: (
      <>
        Frequently asked questions.
      </>
    ),
  },
  {
    title: 'Benchmarks',
    url: '../../benchmarking/',
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
    url: '../../introduction/',
    description: (
      <>
        OLAP、機能、アーキテクチャ
      </>
    ),
  },
  {
    title: 'クイックスタート',
    url: '../../quick_start/',
    description: (
      <>
        デプロイ、ロード、クエリ
      </>
    ),
  },
  {
    title: 'データロード',
    url: '../../loading/Loading_intro/',
    description: (
      <>
        データクレンジング、変換、ロード
      </>
    ),
  },
  {
    title: 'テーブルデザイン',
    url: '../../table_design/StarRocks_table_design/',
    description: (
      <>
        テーブル、インデックス、パーティション、クエリー加速
      </>
    ),
  },
  {
    title: 'データレイクをクエリ',
    url: '../../data_source/data_lakes/',
    description: (
      <>
        Iceberg、Hive、Delta Lake …
      </>
    ),
  },
  {
    title: 'セミ構造化タイプ',
    url: '../../category/semi-structured/',
    description: (
      <>
        JSON、map、struct、array
      </>
    ),
  },
  {
    title: '外部システム統合',
    url: '../../integrations/',
    description: (
      <>
        BI、IDE、認証情報
      </>
    ),
  },
  {
    title: '管理',
    url: '../../administration/',
    description: (
      <>
        スケールインとスケールアウト、バックアップ、権限、パフォーマンスチューニング
      </>
    ),
  },
  {
    title: 'リファレンス',
    url: '../../category/reference/',
    description: (
      <>
        SQL 構文、コマンド、関数、変数
      </>
    ),
  },
  {
    title: 'FAQ',
    url: '../../faq/',
    description: (
      <>
        デプロイ、ロード、クエリー、権限 FAQ
      </>
    ),
  },
  {
    title: 'ベンチマーク',
    url: '../../benchmarking/',
    description: (
      <>
        ベンチマーク：データベース・パフォーマンスの比較
      </>
    ),
  },
];

function Feature({url, title, description}) {
  return (
    <div className={clsx('col col--6 margin-bottom--lg')}>
     <Link href={url} target="_self" className="card padding--lg cardContainer_fWXF">
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
