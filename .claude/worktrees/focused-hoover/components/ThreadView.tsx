'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { getActiveThread } from '@/lib/utils';
import MessageItem from './MessageItem';
import InputBar from './InputBar';
import Breadcrumb from './Breadcrumb';
import { GitBranch, MessageSquare } from 'lucide-react';

export default function ThreadView() {
  const threads = useStore((s) => s.threads);
  const conversations = useStore((s) => s.conversations);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const isStreaming = useStore((s) => s.isStreaming);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conv = activeConversationId ? conversations[activeConversationId] : null;
  const thread = useMemo(
    () => getActiveThread(threads, conversations, activeConversationId),
    [threads, conversations, activeConversationId]
  );

  // Auto-scroll to bottom when new messages arrive or content streams in
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages.length, isStreaming]);

  // ── Empty state (no active conversation) ─────────────────────────────────
  if (!conv || !thread) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-600">
        <GitBranch size={36} className="text-zinc-800" />
        <p className="text-sm">Select a conversation or start a new chat.</p>
      </div>
    );
  }

  const isBranch = !!thread.parentThreadId;
  const isEmpty = thread.messages.length === 0;

  // Find the message that this branch diverged from (shown as context header)
  const branchPointMsg = isBranch && thread.branchPointMessageId
    ? (() => {
        const parentThread = threads[thread.parentThreadId!];
        return parentThread?.messages.find((m) => m.id === thread.branchPointMessageId) ?? null;
      })()
    : null;

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Thread header */}
      <div className="flex h-14 flex-shrink-0 items-center gap-2.5 border-b border-zinc-800 px-4">
        {isBranch ? (
          <GitBranch size={14} className="flex-shrink-0 text-emerald-500" />
        ) : (
          <MessageSquare size={14} className="flex-shrink-0 text-zinc-500" />
        )}
        <span className="truncate text-sm font-medium text-zinc-200">{thread.label}</span>
      </div>

      {/* Breadcrumb (only when in a branch) */}
      <Breadcrumb />

      {/* Messages scroll area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            {isBranch ? (
              <>
                <div className="flex items-center gap-2 text-emerald-500">
                  <GitBranch size={28} />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300">
                    Branch: <span className="text-emerald-400">{thread.label}</span>
                  </p>
                  {branchPointMsg && (
                    <p className="mt-2 max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs leading-relaxed text-zinc-500 italic">
                      "{branchPointMsg.content.slice(0, 140)}
                      {branchPointMsg.content.length > 140 ? '…' : ''}"
                    </p>
                  )}
                  <p className="mt-3 text-xs text-zinc-600">
                    Ask your question — the AI has full context from the parent thread.
                  </p>
                </div>
              </>
            ) : (
              <>
                <GitBranch size={28} className="text-zinc-800" />
                <div>
                  <p className="text-sm text-zinc-400">What would you like to explore?</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Hover any AI message to branch the conversation.
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Message list */
          <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
            {thread.messages.map((msg, i) => {
              const isLastMsg = i === thread.messages.length - 1;
              const showCursor = isStreaming && isLastMsg && msg.role === 'assistant';

              // Find all child threads that branched from THIS specific message
              const attachedBranches = Object.values(threads).filter(
                (t) =>
                  t.parentThreadId === thread.id &&
                  t.branchPointMessageId === msg.id
              );

              return (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  isStreaming={showCursor}
                  attachedBranches={attachedBranches}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <InputBar />
    </div>
  );
}
