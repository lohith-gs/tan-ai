'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, Thread } from '@/lib/types';
import { useStore } from '@/lib/store';
import { GitBranch } from 'lucide-react';

interface Props {
  message: Message;
  isStreaming?: boolean;
  /** Child threads that branched directly from this message */
  attachedBranches?: Thread[];
}

export default function MessageItem({ message, isStreaming = false, attachedBranches = [] }: Props) {
  const [hovered, setHovered] = useState(false);
  const openBranchModal = useStore((s) => s.openBranchModal);
  const switchThread = useStore((s) => s.switchThread);

  const isUser = message.role === 'user';

  return (
    <div
      className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Role label */}
      <span className="text-[11px] text-zinc-600 px-1">
        {isUser ? 'You' : 'Assistant'}
      </span>

      {/* Bubble */}
      <div
        className={[
          'max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-sm bg-blue-600 text-white'
            : 'rounded-bl-sm bg-zinc-800 text-zinc-100',
          isStreaming ? 'streaming-cursor' : '',
        ].join(' ')}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Inline code
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                code({ node, className, children, ...props }) {
                  const isBlock = !!className;
                  if (!isBlock) {
                    return (
                      <code
                        className="rounded bg-zinc-700 px-1 py-0.5 font-mono text-xs text-zinc-200"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <pre className="-mx-1 my-2 overflow-x-auto rounded-lg bg-zinc-900 p-3">
                      <code
                        className="font-mono text-xs text-zinc-200"
                        {...props}
                      >
                        {children}
                      </code>
                    </pre>
                  );
                },
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-2 list-disc space-y-1 pl-4">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-2 list-decimal space-y-1 pl-4">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-zinc-200">{children}</li>
                ),
                h1: ({ children }) => (
                  <h1 className="mb-2 text-base font-bold text-zinc-50">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-1.5 text-sm font-bold text-zinc-50">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-1 text-sm font-semibold text-zinc-100">{children}</h3>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-zinc-50">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-zinc-300">{children}</em>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-2 border-l-2 border-zinc-600 pl-3 italic text-zinc-400">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline hover:text-blue-300"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="my-3 border-zinc-700" />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Existing branches pinned to this message */}
      {!isUser && attachedBranches.length > 0 && (
        <div className="flex flex-col items-start pl-3 pt-0.5">
          {/* Vertical connector: drops straight down from the bubble */}
          <div className="flex flex-col items-center">
            <div className="h-4 w-px bg-emerald-700/70" />
            <div className="h-2 w-2 rounded-full border border-emerald-600 bg-emerald-800" />
          </div>
          {/* Branch pills — sit directly below the connector dot */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attachedBranches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => switchThread(branch.id)}
                className="flex items-center gap-1.5 rounded-full border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-xs text-emerald-400 transition-colors hover:border-emerald-600 hover:bg-emerald-900 hover:text-emerald-300"
              >
                <GitBranch size={10} />
                {branch.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Branch from here — only on AI messages, only on hover */}
      {!isUser && !isStreaming && (
        <button
          onClick={() => openBranchModal(message.id)}
          className={[
            'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs text-emerald-500 transition-all duration-150 hover:bg-emerald-500/10 hover:text-emerald-400',
            hovered ? 'opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
        >
          <GitBranch size={11} />
          Branch from here
        </button>
      )}
    </div>
  );
}
