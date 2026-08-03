import React from 'react';
import Content from '@theme-original/DocItem/Content';
import MarkdownActions from '@site/src/components/MarkdownActions';

// Wrapper swizzle: renders the "Copy as Markdown" control above the article
// body, so the affordance sits above the fold near the title. The doc footer is
// already occupied by the Feedback widget, and a discovery control belongs where
// readers land rather than where they leave.
//
// MarkdownActions renders nothing on pages without a .md twin (older versions,
// non-en locales, navigation-only index pages).
export default function ContentWrapper(props) {
  return (
    <>
      <MarkdownActions />
      <Content {...props} />
    </>
  );
}
