import React from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import "@site/src/css/copilotkit.css";
import clsx from "clsx";
import ErrorBoundary from "@docusaurus/ErrorBoundary";
import { PageMetadata, SkipToContentFallbackId, ThemeClassNames } from "@docusaurus/theme-common";
import { useKeyboardNavigation } from "@docusaurus/theme-common/internal";
import SkipToContent from "@theme/SkipToContent";
import AnnouncementBar from "@theme/AnnouncementBar";
import Navbar from "@theme/Navbar";
import Footer from "@theme/Footer";
import LayoutProvider from "@theme/Layout/Provider";
import ErrorPageContent from "@theme/ErrorPageContent";
import styles from "./styles.module.css";
import { SearchDocActionView } from "@site/src/components/SearchDocActionView";
import { GeneralToolCallView } from "@site/src/components/GeneralToolCallView";
import { CopilotCustomInput } from "@site/src/components/CopilotCustomInput";

const createMarkdownTagRenderers = (originalRenderers = {}) => {
  return {
    ...originalRenderers,
    code: ({ children, className, inline, ...props }) => {
      // Handle inline code
      if (
        inline ||
        (children && typeof children === "string" && !children.includes("\n"))
      ) {
        return (
          <code className="bg-gray-200 px-1 py-0.5 rounded text-sm">
            {children}
          </code>
        );
      }

      // Handle regular code blocks
      return (
        <pre className="bg-gray-200 p-4 rounded-md overflow-x-auto mb-4">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },
  };
};

function MyRenderActionExecutionMessage(props) {
  const { message } = props;

  // Skip rendering if message doesn't have required properties
  if (!message || !message.name) {
    return null;
  }

  if (message.name === "search_starrocks_doc") {
    return <SearchDocActionView {...props} />;
  } else {
    return <GeneralToolCallView {...props} />;
  }
}

export default function Layout(props) {
  const {
    children,
    noFooter,
    wrapperClassName,
    // Not really layout-related, but kept for convenience/retro-compatibility
    title,
    description,
  } = props;
  useKeyboardNavigation();
  return (
    <CopilotKit
      agent="sr_agent"
      runtimeUrl="https://ai-agent.starrocks.com/copilotkit/"
      showDevConsole={false}
    >
      <LayoutProvider>
        <PageMetadata title={title} description={description} />

        <SkipToContent />

        <AnnouncementBar />

        <Navbar />

        <div
          id={SkipToContentFallbackId}
          className={clsx(
            ThemeClassNames.wrapper.main,
            styles.mainWrapper,
            wrapperClassName
          )}
        >
          <ErrorBoundary
            fallback={(params) => <ErrorPageContent {...params} />}
          >
            {children}
          </ErrorBoundary>
        </div>

        {!noFooter && <Footer />}
        <CopilotPopup
          labels={{
            title: "StarRocks Assistant",
            initial:
              "AI generated answers are based on docs and other sources. Please test answers in non-production environments.",
          }}
          defaultOpen={false}
          markdownTagRenderers={createMarkdownTagRenderers()}
          RenderActionExecutionMessage={MyRenderActionExecutionMessage}
          Input={(props) => (
            <CopilotCustomInput
              {...props}
            />
          )}
        />
      </LayoutProvider>
    </CopilotKit>
  );
}
