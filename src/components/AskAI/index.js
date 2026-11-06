// "Ask AI" chat for the docs, on the Vercel AI SDK. Replaces the CopilotKit widget when
// the site is built with ASK_AI_URL (see docusaurus.config.js customFields.askAiUrl).
//
// The backend is starrocks-community-ai's POST /api/ask: it takes useChat's
// {id, messages} and answers with the AI SDK UI message stream. Each doc search arrives
// as a `tool-search_starrocks_doc` part whose output has the shape SearchDocActionView
// already renders ({query, docs, duration, doc_type}); then the answer text; then
// `source-url` parts for the doc references. The server is stateless: the conversation
// lives here and is resent on every turn.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import useBaseUrl from "@docusaurus/useBaseUrl";
import { SearchDocActionView } from "@site/src/components/SearchDocActionView";
import styles from "./styles.module.css";

const INITIAL_NOTE =
  "AI generated answers are based on docs and other sources. Please test answers in non-production environments.";

const markdownComponents = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

// The backend answers errors with JSON {"error": "..."} (400/429) and the transport
// puts the response body in the message.
function errorText(error) {
  if (!error) return "";
  try {
    const parsed = JSON.parse(error.message);
    if (parsed && typeof parsed.error === "string") return parsed.error;
  } catch {
    // not JSON
  }
  return error.message || "Something went wrong. Please try again.";
}

function AssistantParts({ message }) {
  const sources = message.parts.filter((p) => p.type === "source-url");
  return (
    <>
      {message.parts.map((part, i) => {
        if (part.type === "tool-search_starrocks_doc" || (part.type === "dynamic-tool" && part.toolName === "search_starrocks_doc")) {
          return (
            <div key={part.toolCallId || i} className={styles.tool}>
              <SearchDocActionView
                inProgress={part.state !== "output-available" && part.state !== "output-error"}
                actionResult={part.state === "output-available" ? part.output : undefined}
              />
            </div>
          );
        }
        if (part.type === "text" && part.text) {
          return (
            <div key={i} className={styles.markdown}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {part.text}
              </ReactMarkdown>
            </div>
          );
        }
        return null;
      })}
      {sources.length > 0 && (
        <div className={styles.sources}>
          <div className={styles.sourcesTitle}>References</div>
          <ul>
            {sources.map((s) => (
              <li key={s.sourceId}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function ChatWindow({ api, onClose }) {
  const transport = useMemo(() => new DefaultChatTransport({ api }), [api]);
  const { messages, sendMessage, status, error, stop, setMessages, clearError } = useChat({ transport });
  const [input, setInput] = useState("");
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const busy = status === "submitted" || status === "streaming";
  const last = messages[messages.length - 1];
  const waiting = busy && (!last || last.role === "user" || !last.parts.some((p) => p.type === "text" && p.text));

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    if (error) clearError();
    sendMessage({ text });
    setInput("");
  };

  const reset = () => {
    stop();
    setMessages([]);
    if (error) clearError();
  };

  return (
    <div className={styles.window} role="dialog" aria-label="StarRocks Assistant">
      <div className={styles.header}>
        <img src={useBaseUrl("/img/rocky.svg")} alt="Rocky the happy otter" className={styles.avatar} />
        <span className={styles.title}>StarRocks Assistant</span>
        <button type="button" className={styles.textButton} onClick={reset} disabled={messages.length === 0}>
          New chat
        </button>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close chat">
          ×
        </button>
      </div>

      <div className={styles.messages} ref={listRef}>
        <div className={styles.note}>{INITIAL_NOTE}</div>
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className={styles.user}>
              {m.parts.filter((p) => p.type === "text").map((p) => p.text).join("")}
            </div>
          ) : (
            <div key={m.id} className={styles.assistant}>
              <AssistantParts message={m} />
            </div>
          )
        )}
        {waiting && <div className={styles.thinking}>Searching the docs…</div>}
        {error && <div className={styles.error}>{errorText(error)}</div>}
      </div>

      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={input}
          rows={2}
          placeholder="Ask here... Cmd/Ctrl + Enter to send. Sponsored by PhoenixAI"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        {busy ? (
          <button type="button" className={styles.sendButton} onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="button" className={styles.sendButton} onClick={send} disabled={!input.trim()}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}

export default function AskAI({ api }) {
  const [open, setOpen] = useState(false);
  // Mounted once opened and kept while closed, so the conversation survives closing
  // the window and moving between pages (this lives in Root, not Layout).
  const [mounted, setMounted] = useState(false);

  return (
    <>
      {mounted && (
        <div style={{ display: open ? "block" : "none" }}>
          <ChatWindow api={api} onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        type="button"
        className={open ? styles.launcherOpen : styles.launcher}
        aria-label={open ? "Close Ask AI" : "Ask AI"}
        onClick={() => {
          setMounted(true);
          setOpen(!open);
        }}
      >
        {open ? "×" : null}
      </button>
    </>
  );
}
