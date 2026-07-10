'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { getBreadcrumb, getActiveThread } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumb() {
  const threads = useStore((s) => s.threads);
  const conversations = useStore((s) => s.conversations);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const switchThread = useStore((s) => s.switchThread);

  const activeThread = useMemo(
    () => getActiveThread(threads, conversations, activeConversationId),
    [threads, conversations, activeConversationId]
  );

  const breadcrumb = useMemo(
    () => getBreadcrumb(threads, activeThread),
    [threads, activeThread]
  );

  // Only render the breadcrumb when we're inside a branch (depth > 1)
  if (breadcrumb.length <= 1) return null;

  return (
    <div className="flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-zinc-800 px-4 py-2">
      {breadcrumb.map((thread, i) => {
        const isLast = i === breadcrumb.length - 1;
        return (
          <div key={thread.id} className="flex flex-shrink-0 items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-zinc-700" />}
            <button
              onClick={() => switchThread(thread.id)}
              className={[
                'truncate text-xs transition-colors',
                isLast
                  ? 'cursor-default text-zinc-300'
                  : 'text-zinc-500 hover:text-zinc-300',
              ].join(' ')}
            >
              {thread.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
