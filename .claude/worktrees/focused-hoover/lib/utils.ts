import { Thread, Conversation, Message } from './types';

// ─── Derived state helpers ──────────────────────────────────────────────────

export function getActiveConversation(
  conversations: Record<string, Conversation>,
  activeConversationId: string | null
): Conversation | null {
  if (!activeConversationId) return null;
  return conversations[activeConversationId] ?? null;
}

export function getActiveThread(
  threads: Record<string, Thread>,
  conversations: Record<string, Conversation>,
  activeConversationId: string | null
): Thread | null {
  const conv = getActiveConversation(conversations, activeConversationId);
  if (!conv) return null;
  return threads[conv.activeThreadId] ?? null;
}

/**
 * Returns the ancestry chain from root to the given thread (inclusive).
 * e.g. [MainThread, BranchA, BranchB]
 */
export function getBreadcrumb(
  threads: Record<string, Thread>,
  activeThread: Thread | null
): Thread[] {
  if (!activeThread) return [];
  const chain: Thread[] = [];
  let current: Thread | null = activeThread;
  while (current) {
    chain.unshift(current);
    current = current.parentThreadId ? (threads[current.parentThreadId] ?? null) : null;
  }
  return chain;
}

/**
 * Builds the full message history to send to the AI, respecting branch context.
 *
 * For a branch, the context is:
 *   [parent messages up to branch point] + [current thread messages]
 *
 * For deeper nesting it recurses up the full ancestry chain.
 */
export function buildContextMessages(
  threads: Record<string, Thread>,
  threadId: string
): { role: 'user' | 'assistant'; content: string }[] {
  const thread = threads[threadId];
  if (!thread) return [];

  // Build ancestry chain from root → current
  const chain: Thread[] = [];
  let current: Thread | null = thread;
  while (current) {
    chain.unshift(current);
    current = current.parentThreadId ? (threads[current.parentThreadId] ?? null) : null;
  }

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  for (let i = 0; i < chain.length; i++) {
    const t = chain[i];
    const nextThread = chain[i + 1]; // the child that branched off this thread

    if (nextThread?.branchPointMessageId) {
      // Take messages up to and INCLUDING the branch point message
      const branchIdx = t.messages.findIndex((m) => m.id === nextThread.branchPointMessageId);
      const slice = branchIdx >= 0 ? t.messages.slice(0, branchIdx + 1) : t.messages;
      messages.push(...slice.map((m) => ({ role: m.role, content: m.content })));
    } else {
      // Last thread in chain — take all messages
      messages.push(...t.messages.map((m) => ({ role: m.role, content: m.content })));
    }
  }

  return messages;
}

// ─── Factories ──────────────────────────────────────────────────────────────

export function createThread(params: {
  conversationId: string;
  parentThreadId: string | null;
  branchPointMessageId: string | null;
  label: string;
}): Thread {
  return {
    id: crypto.randomUUID(),
    conversationId: params.conversationId,
    label: params.label,
    parentThreadId: params.parentThreadId,
    branchPointMessageId: params.branchPointMessageId,
    messages: [],
    createdAt: new Date().toISOString(),
    childThreadIds: [],
  };
}

export function createConversation(rootThreadId: string): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'New conversation',
    rootThreadId,
    activeThreadId: rootThreadId,
    createdAt: new Date().toISOString(),
  };
}
