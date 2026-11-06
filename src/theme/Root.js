import React from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";

// Root wraps every page and is not remounted on navigation, so the Ask AI conversation
// survives moving between pages. Only built in when ASK_AI_URL is set; otherwise the
// CopilotKit widget in src/theme/Layout serves Ask AI.
export default function Root({ children }) {
  const { siteConfig } = useDocusaurusContext();
  const api = siteConfig.customFields?.askAiUrl;
  return (
    <>
      {children}
      {api && (
        <BrowserOnly>
          {() => {
            const AskAI = require("@site/src/components/AskAI").default;
            return <AskAI api={api} />;
          }}
        </BrowserOnly>
      )}
    </>
  );
}
