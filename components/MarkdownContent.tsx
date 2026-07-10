"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

function CodeBlock({ language, code, compact }: { language: string; code: string; compact: boolean }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative group my-2">
      <div className="flex items-center justify-between px-3 py-1 bg-zinc-800 border border-zinc-700/60 rounded-t-lg border-b-0">
        <span className="text-[10px] text-zinc-500 font-mono">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} />}
          <span>{copied ? "copied" : "copy"}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: "0 0 8px 8px",
          fontSize: compact ? "11px" : "12px",
          padding: "10px 14px",
          background: "#0d1117",
          border: "1px solid #3f3f46",
        }}
        codeTagProps={{ style: { fontFamily: "var(--font-mono, monospace)" } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

interface Props {
  content: string;
  compact?: boolean; // true = branch card (smaller text)
}

export default function MarkdownContent({ content, compact = false }: Props) {
  const prose = compact ? "text-xs" : "text-sm";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Paragraphs
        p({ children }) {
          return <p className={`${prose} leading-relaxed mb-2 last:mb-0`}>{children}</p>;
        },

        // Headings
        h1({ children }) {
          return <h1 className="text-base font-semibold mt-3 mb-1.5 text-zinc-100">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-sm font-semibold mt-3 mb-1 text-zinc-100">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-xs font-semibold mt-2 mb-1 text-zinc-200">{children}</h3>;
        },

        // Code blocks and inline code
        code({ children, className }) {
          const isBlock = className?.startsWith("language-");
          const language = className?.replace("language-", "") ?? "text";
          if (isBlock) {
            return (
              <CodeBlock
                language={language}
                code={String(children).replace(/\n$/, "")}
                compact={compact}
              />
            );
          }
          return (
            <code className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-blue-300 font-mono text-[0.85em] border border-zinc-700/50">
              {children}
            </code>
          );
        },

        // Block quote
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-zinc-600 pl-3 my-2 text-zinc-400 italic">
              {children}
            </blockquote>
          );
        },

        // Lists
        ul({ children }) {
          return <ul className="list-disc list-outside ml-4 mb-2 space-y-0.5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-outside ml-4 mb-2 space-y-0.5">{children}</ol>;
        },
        li({ children }) {
          return <li className={`${prose} leading-relaxed`}>{children}</li>;
        },

        // Horizontal rule
        hr() {
          return <hr className="border-zinc-700 my-3" />;
        },

        // Strong / em
        strong({ children }) {
          return <strong className="font-semibold text-zinc-100">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic text-zinc-300">{children}</em>;
        },

        // Table (GFM)
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="text-xs border-collapse w-full">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="border border-zinc-700 px-2 py-1 bg-zinc-800 text-zinc-200 font-medium text-left">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-zinc-700 px-2 py-1 text-zinc-300">{children}</td>
          );
        },

        // Links
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
