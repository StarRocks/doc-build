import React from 'react';
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useActiveDocContext } from "@docusaurus/plugin-content-docs/client";

import DropdownNavbarItem from '@theme-original/NavbarItem/DropdownNavbarItem';

export default function DropdownNavbarItemWrapper(props) {
  // do not display this navbar item if current locale does not match the
  // docsLocale var set in docusaurus.config.js for this dropdown
  // (used to show Chinese community links when viewing Chinese docs,
  // and English community links when viewing English docs)
  // The English dropdown has className: 'EnglishOnly',
  // and the Chinese dropdown has className: 'ChineseOnly',
  // These are not the appropriate props, but all I could use
  function useZh() {
    const {i18n} = useDocusaurusContext();
    const locale = i18n.currentLocale;
    return locale === "zh" || locale === "zh_cn" || locale == "zh_CN";
  }

  const isZh = useZh();

  if (((props.className === 'EnglishOnly') && isZh)||((props.className === 'ChineseOnly') && !isZh)) {
    return null;
  }

  return (
    <>
      <DropdownNavbarItem {...props} />
    </>
  );
}
