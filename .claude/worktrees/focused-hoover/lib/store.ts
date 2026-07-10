import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Conversation, Thread, Message, BranchModalState } from './types';
import {
  buildContextMessages,
  createConversation,
  createThread,
} from './utils';

// ─── Store types ─────────────────────────────────────────────────────────────

interface StoreState {
  conversations: Record<string, Conversation>;
  threads: Record<string, Thread>;
  activeConversationId: string | null;
  isStreaming: boolean;
  branchModal: BranchModalState;
}

interface StoreActions {
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  sendMessage: (content: string) => Promise<void>;
  createBranch: (fromMessageId: string, label: string) => void;
  switchThread: (threadId: string) => void;
  openBranchModal: (fromMessageId: string) => void;
  closeBranchModal: () => void;
  /** Reorder the children of a parent thread to a new ordering */
  reorderChildThreads: (parentThreadId: string, orderedChildIds: string[]) => void;
}

export type Store = StoreState & StoreActions;

// ─── Store ───────────────────────────────────────────────────────────────────

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────────
      conversations: {},
      threads: {},
      activeConversationId: null,
      isStreaming: false,
      branchModal: { isOpen: false, fromMessageId: null },

      // ── Conversation actions ───────────────────────────────────────────────

      newConversation: () => {
        // Create the root thread first (needs a conversation ID)
        const convId = crypto.randomUUID();
        const rootThread = createThread({
          conversationId: convId,
          parentThreadId: null,
          branchPointMessageId: null,
          label: 'Main Thread',
        });
        const conv = createConversation(rootThread.id);
        // Override the auto-generated ID with our pre-assigned one
        const convWithId: Conversation = { ...conv, id: convId };

        set((state) => ({
          conversations: { ...state.conversations, [convId]: convWithId },
          threads: { ...state.threads, [rootThread.id]: rootThread },
          activeConversationId: convId,
        }));
      },

      selectConversation: (id) => {
        set({ activeConversationId: id });
      },

      deleteConversation: (id) => {
        set((state) => {
          const nextConvs = { ...state.conversations };
          delete nextConvs[id];

          // Remove all threads belonging to this conversation
          const nextThreads = Object.fromEntries(
            Object.entries(state.threads).filter(([, t]) => t.conversationId !== id)
          );

          // Pick next active conversation (most recent remaining)
          const remaining = Object.values(nextConvs).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          const nextActiveId =
            state.activeConversationId === id ? (remaining[0]?.id ?? null) : state.activeConversationId;

          return {
            conversations: nextConvs,
            threads: nextThreads,
            activeConversationId: nextActiveId,
          };
        });
      },

      // ── Message actions ────────────────────────────────────────────────────

      sendMessage: async (content) => {
        const { conversations, threads, activeConversationId, isStreaming } = get();
        if (isStreaming) return;

        const conv = activeConversationId ? conversations[activeConversationId] : null;
        const activeThread = conv ? threads[conv.activeThreadId] : null;
        if (!conv || !activeThread) return;

        const activeThreadId = activeThread.id;
        const trimmedContent = content.trim();
        if (!trimmedContent) return;

        // 1. Add user message
        const userMsg: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: trimmedContent,
          createdAt: new Date().toISOString(),
          threadId: activeThreadId,
        };

        set((state) => {
          const thread = state.threads[activeThreadId];
          const isFirstMessage =
            thread.messages.length === 0 && thread.parentThreadId === null;

          return {
            threads: {
              ...state.threads,
              [activeThreadId]: {
                ...thread,
                messages: [...thread.messages, userMsg],
              },
            },
            conversations: {
              ...state.conversations,
              [conv.id]: {
                ...state.conversations[conv.id],
                // Auto-title from first message in main thread
                title: isFirstMessage
                  ? trimmedContent.slice(0, 60) + (trimmedContent.length > 60 ? '…' : '')
                  : state.conversations[conv.id].title,
              },
            },
          };
        });

        // 2. Build full context (includes user message we just added)
        const contextMessages = buildContextMessages(get().threads, activeThreadId);

        // 3. Add placeholder AI message (empty, will stream into)
        const aiMsgId = crypto.randomUUID();
        set((state) => ({
          isStreaming: true,
          threads: {
            ...state.threads,
            [activeThreadId]: {
              ...state.threads[activeThreadId],
              messages: [
                ...state.threads[activeThreadId].messages,
                {
                  id: aiMsgId,
                  role: 'assistant' as const,
                  content: '',
                  createdAt: new Date().toISOString(),
                  threadId: activeThreadId,
                },
              ],
            },
          },
        }));

        // 4. Stream response from API
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: contextMessages }),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || `HTTP ${response.status}`);
          }

          const reader = response.body!.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });

            set((state) => ({
              threads: {
                ...state.threads,
                [activeThreadId]: {
                  ...state.threads[activeThreadId],
                  messages: state.threads[activeThreadId].messages.map((m) =>
                    m.id === aiMsgId ? { ...m, content: m.content + chunk } : m
                  ),
                },
              },
            }));
          }
        } catch (err) {
          console.error('[tan-ai] Chat error:', err);
          // Replace empty placeholder with an error notice
          const errorContent =
            err instanceof Error && err.message.includes('ANTHROPIC_API_KEY')
              ? '⚠️ **API key not configured.** Please add your `ANTHROPIC_API_KEY` to `.env.local` and restart the dev server.'
              : `⚠️ **Something went wrong.** ${err instanceof Error ? err.message : 'Please try again.'}`;

          set((state) => ({
            threads: {
              ...state.threads,
              [activeThreadId]: {
                ...state.threads[activeThreadId],
                messages: state.threads[activeThreadId].messages.map((m) =>
                  m.id === aiMsgId ? { ...m, content: errorContent } : m
                ),
              },
            },
          }));
        } finally {
          set({ isStreaming: false });
        }
      },

      // ── Branch actions ─────────────────────────────────────────────────────

      createBranch: (fromMessageId, label) => {
        const { conversations, threads, activeConversationId } = get();
        const conv = activeConversationId ? conversations[activeConversationId] : null;
        const activeThread = conv ? threads[conv.activeThreadId] : null;
        if (!conv || !activeThread) return;

        const newThread = createThread({
          conversationId: conv.id,
          parentThreadId: activeThread.id,
          branchPointMessageId: fromMessageId,
          label: label.trim() || `Branch ${activeThread.childThreadIds.length + 1}`,
        });

        set((state) => ({
          threads: {
            ...state.threads,
            [newThread.id]: newThread,
            [activeThread.id]: {
              ...state.threads[activeThread.id],
              childThreadIds: [...state.threads[activeThread.id].childThreadIds, newThread.id],
            },
          },
          conversations: {
            ...state.conversations,
            [conv.id]: {
              ...state.conversations[conv.id],
              activeThreadId: newThread.id,
            },
          },
          branchModal: { isOpen: false, fromMessageId: null },
        }));
      },

      switchThread: (threadId) => {
        const { conversations, activeConversationId } = get();
        const conv = activeConversationId ? conversations[activeConversationId] : null;
        if (!conv) return;

        set((state) => ({
          conversations: {
            ...state.conversations,
            [conv.id]: { ...state.conversations[conv.id], activeThreadId: threadId },
          },
        }));
      },

      // ── Modal actions ──────────────────────────────────────────────────────

      openBranchModal: (fromMessageId) => {
        set({ branchModal: { isOpen: true, fromMessageId } });
      },

      closeBranchModal: () => {
        set({ branchModal: { isOpen: false, fromMessageId: null } });
      },

      reorderChildThreads: (parentThreadId, orderedChildIds) => {
        set((state) => {
          const parent = state.threads[parentThreadId];
          if (!parent) return state;
          return {
            threads: {
              ...state.threads,
              [parentThreadId]: { ...parent, childThreadIds: orderedChildIds },
            },
          };
        });
      },
    }),
    {
      name: 'tan-ai-v1',
      storage: createJSONStorage(() => localStorage),
      // Only persist the conversation data, not transient UI state
      partialize: (state) => ({
        conversations: state.conversations,
        threads: state.threads,
        activeConversationId: state.activeConversationId,
      }),
    }
  )
);
