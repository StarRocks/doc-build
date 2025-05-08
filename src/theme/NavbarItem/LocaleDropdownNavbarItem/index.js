import React from 'react';
import { useActiveDocContext } from "@docusaurus/plugin-content-docs/client";
import LocaleDropdownNavbarItem from '@theme-original/NavbarItem/LocaleDropdownNavbarItem';

export default function LocaleDropdownNavbarItemWrapper(props) {
  // do not display this navbar item if current page is a release note
  const { activeDoc } = useActiveDocContext(props.docsPluginId);
  if (!activeDoc) {
    return null;
  }

  return (
    <>
      <LocaleDropdownNavbarItem {...props} />
    </>
  );
}
