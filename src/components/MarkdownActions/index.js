import React, {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import agentDocsRoutes from '@site/src/agentDocsRoutes';
import styles from './styles.module.css';

const {hasMarkdownTwin, markdownUrlFor} = agentDocsRoutes;

// Prompt handed to an assistant when the reader opens the page there.
function promptFor(absoluteMarkdownUrl) {
  return `Read ${absoluteMarkdownUrl} so you can answer my questions about StarRocks.`;
}

// GA4 is loaded by @docusaurus/plugin-google-gtag. Counts here are a FLOOR:
// content blockers drop them for a meaningful share of a developer audience.
// The authoritative number is the CloudFront log query for .md requests
// carrying a docs Referer — see analytics/agent-traffic/queries.sql.
function track(action, page) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'markdown_action', {action, page});
  }
}

function CopyIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CaretIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/**
 * "Copy page as Markdown" control shown on doc pages that have a `.md` twin.
 *
 * Doubles as discovery: most readers do not know the docs are published as
 * Markdown, and the menu teaches the `<route>.md` convention by using it.
 */
export default function MarkdownActions() {
  const {pathname} = useLocation();
  const {
    siteConfig: {url: siteUrl},
    i18n: {currentLocale},
  } = useDocusaurusContext();

  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState('idle'); // idle | copying | copied | error
  const containerRef = useRef(null);
  const resetTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Reset the transient "Copied" label when navigating to another page.
  useEffect(() => {
    setCopyState('idle');
    setOpen(false);
  }, [pathname]);

  const markdownUrl = markdownUrlFor(pathname);
  const absoluteMarkdownUrl = `${siteUrl}${markdownUrl}`;

  const scheduleReset = useCallback((state) => {
    setCopyState(state);
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = setTimeout(() => setCopyState('idle'), 2500);
  }, []);

  const handleCopy = useCallback(async () => {
    setCopyState('copying');
    track('copy', pathname);
    try {
      const response = await fetch(markdownUrl, {
        headers: {Accept: 'text/markdown'},
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const markdown = await response.text();
      await navigator.clipboard.writeText(markdown);
      scheduleReset('copied');
    } catch (error) {
      // Clipboard permission denied, offline, or the .md twin is missing.
      // Deliberately no window.open() fallback here: the popup would fire after
      // an await, outside the user-gesture window, so it is liable to be
      // silently blocked — worse than an honest error. "View as Markdown" in
      // the menu is one click away and is a plain gesture-time navigation.
      scheduleReset('error');
    }
  }, [markdownUrl, pathname, scheduleReset]);

  const handleMenuAction = useCallback(
    (action, href) => {
      track(action, pathname);
      setOpen(false);
      window.open(href, '_blank', 'noopener,noreferrer');
    },
    [pathname],
  );

  // Markdown exists for the en locale only, for the latest version, and not for
  // navigation-only index pages. The pathname check covers versioned and
  // localized routes on its own; the locale check makes the intent explicit.
  if (currentLocale !== 'en' || !hasMarkdownTwin(pathname)) {
    return null;
  }

  const copyLabel = {
    idle: 'Copy as Markdown',
    copying: 'Copying…',
    copied: 'Copied',
    error: 'Copy failed',
  }[copyState];

  const prompt = encodeURIComponent(promptFor(absoluteMarkdownUrl));

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.group}>
        <button
          type="button"
          className={clsx(styles.button, styles.primaryButton)}
          onClick={handleCopy}
          disabled={copyState === 'copying'}
          title="Copy this page as Markdown for pasting into an AI assistant">
          {copyState === 'copied' ? <CheckIcon /> : <CopyIcon />}
          <span className={styles.label}>{copyLabel}</span>
        </button>
        <div className={clsx('dropdown', 'dropdown--right', open && 'dropdown--show')}>
          <button
            type="button"
            className={clsx(styles.button, styles.caretButton)}
            onClick={() => setOpen((wasOpen) => !wasOpen)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="More Markdown options">
            <CaretIcon />
          </button>
          <ul className={clsx('dropdown__menu', styles.menu)} role="menu">
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className={clsx('dropdown__link', styles.menuItem)}
                onClick={() => handleMenuAction('view', markdownUrl)}>
                View as Markdown
                <span className={styles.menuHint}>{markdownUrl}</span>
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className={clsx('dropdown__link', styles.menuItem)}
                onClick={() =>
                  handleMenuAction('claude', `https://claude.ai/new?q=${prompt}`)
                }>
                Open in Claude
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className={clsx('dropdown__link', styles.menuItem)}
                onClick={() =>
                  handleMenuAction(
                    'chatgpt',
                    `https://chatgpt.com/?hint=search&q=${prompt}`,
                  )
                }>
                Open in ChatGPT
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className={clsx('dropdown__link', styles.menuItem)}
                onClick={() => handleMenuAction('llms_txt', '/llms.txt')}>
                Browse all docs as Markdown
                <span className={styles.menuHint}>/llms.txt</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
