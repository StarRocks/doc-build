import React from 'react';
import clsx from 'clsx';
import Translate from '@docusaurus/Translate';
import Heading from '@theme/Heading';
export default function NotFoundContent({className}) {
  return (
    <main className={clsx('container margin-vert--xl', className)}>
      <div className="row">
        <div className="col col--6 col--offset-3">
          <Heading as="h1" className="hero__title">
            <Translate
              id="theme.NotFound.title"
              description="The title of the 404 page">
              Page Not Found
            </Translate>
          </Heading>
          <p>
            <Translate
              id="theme.NotFound.p1"
              description="The first paragraph of the 404 page">
              Our documentation has been reorganized, please try the search box
              provided in the documentation site. You can find the search box in
              the top navigation bar, or use Command-K or CTRL-K to pop up
              the search.
    
              Google is in the process of reindexing our docs now, so we should
              be caught up soon.
            </Translate>
          </p>
        </div>
      </div>
    </main>
  );
}
