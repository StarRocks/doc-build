import React from 'react';
import {translate} from '@docusaurus/Translate';
import {PageMetadata} from '@docusaurus/theme-common';
import Layout from '@theme/Layout';
import NotFoundContent from '@theme/NotFound/Content';
import frozenVersions from '@site/frozenVersions.json';

// Catch-all for client-side navigation into a frozen doc version.
// -----------------------------------------------------------------------------
// Versions in frozenVersions.json are still served from S3 but are no longer
// routes in this bundle, so a client-side navigation into one renders this 404
// page for a URL the server would answer correctly. The version dropdown uses
// `pathname://` and DocSearch has algolia.externalUrlRegex, so this only catches
// what slips past those — a stale link, a third-party widget, a bookmark opened
// via the router.
//
// Reloading hands the URL back to the server, which serves the real page. The
// sessionStorage key is what stops a genuinely missing frozen URL from reloading
// forever: after one attempt the same pathname renders a real 404. If storage is
// unavailable we do nothing rather than risk a loop.
// -----------------------------------------------------------------------------
const RELOAD_KEY = 'frozen-archive-reload';

function isFrozenPath(pathname) {
  // Each locale is a separate build, so derive the locale root from the path.
  const localeMatch = /^\/(?:zh|ja)\//.exec(pathname);
  const root = localeMatch ? localeMatch[0] : '/';
  return frozenVersions.some((v) => pathname.startsWith(`${root}docs/${v}/`));
}

function useFrozenArchiveReload() {
  React.useEffect(() => {
    const {pathname, href} = window.location;
    if (!isFrozenPath(pathname)) {
      return;
    }
    try {
      if (window.sessionStorage.getItem(RELOAD_KEY) === pathname) {
        return;
      }
      window.sessionStorage.setItem(RELOAD_KEY, pathname);
    } catch {
      return;
    }
    window.location.replace(href);
  }, []);
}

export default function Index() {
  const title = translate({
    id: 'theme.NotFound.title',
    message: 'Page Not Found',
  });
  useFrozenArchiveReload();
  return (
    <>
      <PageMetadata title={title} />
      <Layout>
        <NotFoundContent />
      </Layout>
    </>
  );
}
