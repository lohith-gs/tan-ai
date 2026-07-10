// store/useChatStore.ts
import { create } from "zustand";
import { Conversation, Thread, Message, Checkpoint } from "@/types";
import { createClient } from "@/utils/supabase/client";
import { PROVIDER_CONFIGS, PROVIDER_ORDER, getDefaultModel } from "@/lib/providers";

interface ChatState {
  currentConversation: Conversation | null;
  activeThread: Thread | null;
  allConversations: Conversation[];
  isLoading: boolean;
  highlightMessageId: string | null;
  hasApiKey: boolean;
  keyInvalid: boolean;
  setKeyInvalid: (v: boolean) => void;
  trialNotice: string | null;
  setTrialNotice: (v: string | null) => void;
  activeProvider: string;
  activeModel: string;
  configuredProviders: string[];
  pendingAutoSendThreadIds: string[];
  setPendingAutoSend: (id: string) => void;
  clearPendingAutoSend: (id: string) => void;
  setProviderModel: (provider: string, model: string) => Promise<void>;
  refreshProviderState: () => Promise<void>;

  initialize: () => Promise<void>;
  createConversation: (title?: string) => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  loadAllConversations: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  setActiveThread: (threadId: string) => Promise<void>;
  addMessage: (
    threadId: string,
    message: Omit<Message, "id" | "timestamp" | "threadId">
  ) => Promise<void>;
  createBranch: (
    checkpointId: string,
    checkpointLabel: string,
    parentMessageId: string,
    parentMessageY?: number,
    modelOverride?: { provider: string; model: string }
  ) => Promise<string>;
  addCheckpoints: (
    messageId: string,
    checkpoints: Omit<Checkpoint, "id" | "messageId" | "isExplored">[]
  ) => Promise<void>;
  deleteMessage: (messageId: string, threadId: string) => Promise<void>;
  updateMessage: (messageId: string, threadId: string, content: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  applyThreadSummary: (threadId: string, summary: string, anchorId: string) => void;
  shareConversation: () => Promise<string | null>;
}

// ── Supabase row types (snake_case) ──────────────────────────────────────────

interface ConvRow {
  id: string;
  user_id: string;
  title: string;
  main_thread_id: string | null;
  active_thread_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ThreadRow {
  id: string;
  conversation_id: string;
  user_id: string;
  name: string;
  parent_thread_id: string | null;
  parent_message_id: string | null;
  parent_message_y: number | null;
  created_at: string;
  updated_at: string;
  summary: string | null;
  summarized_up_to_message_id: string | null;
  inherited_summary: string | null;
  inherited_summary_anchor_id: string | null;
  provider: string | null;
  model: string | null;
}

interface MessageRow {
  id: string;
  thread_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface CheckpointRow {
  id: string;
  message_id: string;
  user_id: string;
  label: string;
  is_explored: boolean;
  branch_thread_id: string | null;
  created_at: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: new Date(row.created_at),
    threadId: row.thread_id,
  };
}

function mapCheckpoint(row: CheckpointRow): Checkpoint {
  return {
    id: row.id,
    messageId: row.message_id,
    label: row.label,
    isExplored: row.is_explored,
    branchThreadId: row.branch_thread_id ?? undefined,
  };
}

function mapThread(
  row: ThreadRow,
  messages: Message[],
  checkpoints: Checkpoint[]
): Thread {
  return {
    id: row.id,
    name: row.name,
    parentThreadId: row.parent_thread_id ?? undefined,
    parentMessageId: row.parent_message_id ?? undefined,
    parentMessageY: row.parent_message_y ?? undefined,
    messages,
    checkpoints,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    summary: row.summary ?? undefined,
    summarizedUpToMessageId: row.summarized_up_to_message_id ?? undefined,
    inheritedSummary: row.inherited_summary ?? undefined,
    inheritedSummaryAnchorId: row.inherited_summary_anchor_id ?? undefined,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
  };
}

function mapConversation(row: ConvRow, threads: Thread[]): Conversation {
  return {
    id: row.id,
    title: row.title,
    mainThreadId: row.main_thread_id ?? threads[0]?.id ?? "",
    activeThreadId: row.active_thread_id ?? threads[0]?.id ?? "",
    threads,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

// Trial limits (users without their own API key). BYOK users are unlimited.
export const TRIAL_MAX_CONVERSATIONS = 3;
export const TRIAL_MAX_BRANCHES = 5;

export const useChatStore = create<ChatState>((set, get) => ({
  currentConversation: null,
  activeThread: null,
  allConversations: [],
  isLoading: false,
  highlightMessageId: null,
  hasApiKey: false,
  keyInvalid: false,
  setKeyInvalid: (v) => set({ keyInvalid: v }),
  trialNotice: null,
  setTrialNotice: (v) => set({ trialNotice: v }),
  activeProvider: "groq",
  activeModel: getDefaultModel("groq"),
  configuredProviders: [],
  pendingAutoSendThreadIds: [],
  setPendingAutoSend: (id) =>
    set((s) => ({
      pendingAutoSendThreadIds: s.pendingAutoSendThreadIds.includes(id)
        ? s.pendingAutoSendThreadIds
        : [...s.pendingAutoSendThreadIds, id],
    })),
  clearPendingAutoSend: (id) =>
    set((s) => ({
      pendingAutoSendThreadIds: s.pendingAutoSendThreadIds.filter((x) => x !== id),
    })),
  // Reflect a server-side summarization result in local state (DB already updated).
  applyThreadSummary: (threadId, summary, anchorId) => {
    const { currentConversation, activeThread } = get();
    if (!currentConversation) return;
    const patch = { summary, summarizedUpToMessageId: anchorId };
    set({
      currentConversation: {
        ...currentConversation,
        threads: currentConversation.threads.map((t) =>
          t.id === threadId ? { ...t, ...patch } : t
        ),
      },
      ...(activeThread?.id === threadId ? { activeThread: { ...activeThread, ...patch } } : {}),
    });
  },
  setProviderModel: async (provider, model) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ active_provider: provider, active_model: model }).eq("id", user.id);
    set({ activeProvider: provider, activeModel: model });
  },
  refreshProviderState: async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("groq_api_key, openai_api_key, anthropic_api_key, active_provider, active_model")
      .eq("id", user.id)
      .single();
    const configuredProviders: string[] = [];
    if (profile?.groq_api_key?.trim()) configuredProviders.push("groq");
    if (profile?.openai_api_key?.trim()) configuredProviders.push("openai");
    if (profile?.anthropic_api_key?.trim()) configuredProviders.push("anthropic");
    const hasApiKey = configuredProviders.length > 0;
    let activeProvider = profile?.active_provider ?? configuredProviders[0] ?? "groq";
    if (!configuredProviders.includes(activeProvider) && configuredProviders.length > 0) {
      activeProvider = configuredProviders[0];
    }
    const activeModel = profile?.active_model ?? getDefaultModel(activeProvider as keyof typeof PROVIDER_CONFIGS);
    set({ hasApiKey, configuredProviders, activeProvider, activeModel });
  },

  initialize: async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("groq_api_key, openai_api_key, anthropic_api_key, active_provider, active_model")
      .eq("id", user.id)
      .single();

    const configuredProviders: string[] = [];
    if (profile?.groq_api_key?.trim()) configuredProviders.push("groq");
    if (profile?.openai_api_key?.trim()) configuredProviders.push("openai");
    if (profile?.anthropic_api_key?.trim()) configuredProviders.push("anthropic");

    const hasApiKey = configuredProviders.length > 0;
    let activeProvider = profile?.active_provider ?? configuredProviders[0] ?? "groq";
    if (!configuredProviders.includes(activeProvider) && configuredProviders.length > 0) {
      activeProvider = configuredProviders[0];
    }
    const activeModel = profile?.active_model ?? getDefaultModel(activeProvider as keyof typeof PROVIDER_CONFIGS);

    set({ hasApiKey, configuredProviders, activeProvider, activeModel });

    if (!hasApiKey) return;

    const { loadAllConversations, createConversation } = get();
    await loadAllConversations();
    const { allConversations } = get();
    if (allConversations.length > 0) {
      await get().loadConversation(allConversations[0].id);
    } else {
      await createConversation();
    }
  },

  loadAllConversations: async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error || !data) return;

    // For the sidebar we only need shallow conversation data (no threads/messages)
    const conversations: Conversation[] = (data as ConvRow[]).map((row) =>
      mapConversation(row, [])
    );

    // Load thread stubs for branch-count display
    const ids = conversations.map((c) => c.id);
    if (ids.length === 0) {
      set({ allConversations: [] });
      return;
    }

    const { data: threadRows } = await supabase
      .from("threads")
      .select("*")
      .in("conversation_id", ids);

    const threadsByConv: Record<string, Thread[]> = {};
    for (const row of (threadRows ?? []) as ThreadRow[]) {
      const t = mapThread(row, [], []);
      if (!threadsByConv[row.conversation_id]) threadsByConv[row.conversation_id] = [];
      threadsByConv[row.conversation_id].push(t);
    }

    const withThreads = (data as ConvRow[]).map((row) =>
      mapConversation(row, threadsByConv[row.id] ?? [])
    );

    set({ allConversations: withThreads });
  },

  loadConversation: async (id: string) => {
    const supabase = createClient();

    const { data: convRow, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !convRow) return;

    const { data: threadRows } = await supabase
      .from("threads")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    const threads = threadRows as ThreadRow[] ?? [];
    const threadIds = threads.map((t) => t.id);

    const { data: messageRows } = await supabase
      .from("messages")
      .select("*")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: true });

    const messages = (messageRows ?? []) as MessageRow[];
    const messageIds = messages.map((m) => m.id);

    const { data: checkpointRows } = await supabase
      .from("checkpoints")
      .select("*")
      .in("message_id", messageIds.length > 0 ? messageIds : ["__none__"])
      .order("created_at", { ascending: true });

    const checkpoints = (checkpointRows ?? []) as CheckpointRow[];

    // Group by parent
    const msgByThread: Record<string, Message[]> = {};
    for (const m of messages) {
      if (!msgByThread[m.thread_id]) msgByThread[m.thread_id] = [];
      msgByThread[m.thread_id].push(mapMessage(m));
    }

    const cpByMessage: Record<string, Checkpoint[]> = {};
    for (const cp of checkpoints) {
      if (!cpByMessage[cp.message_id]) cpByMessage[cp.message_id] = [];
      cpByMessage[cp.message_id].push(mapCheckpoint(cp));
    }

    // Attach checkpoints to correct messages (update cpByMessage into messages)
    const fullThreads: Thread[] = threads.map((row) => {
      const threadMessages = (msgByThread[row.id] ?? []).map((m) => ({
        ...m,
      }));
      // Collect all checkpoints for messages in this thread
      const threadCheckpoints: Checkpoint[] = threadMessages.flatMap(
        (m) => cpByMessage[m.id] ?? []
      );
      return mapThread(row, threadMessages, threadCheckpoints);
    });

    const conversation = mapConversation(convRow as ConvRow, fullThreads);
    const activeThread =
      fullThreads.find((t) => t.id === conversation.activeThreadId) ??
      fullThreads[0];

    set({ currentConversation: conversation, activeThread });
  },

  deleteConversation: async (id: string) => {
    const supabase = createClient();
    const { currentConversation, allConversations, loadConversation } = get();

    // Cascade: messages + checkpoints via FK; delete threads first
    const { data: threads } = await supabase
      .from("threads")
      .select("id")
      .eq("conversation_id", id);

    if (threads && threads.length > 0) {
      const threadIds = threads.map((t: { id: string }) => t.id);
      const { data: msgs } = await supabase
        .from("messages")
        .select("id")
        .in("thread_id", threadIds);

      if (msgs && msgs.length > 0) {
        const msgIds = msgs.map((m: { id: string }) => m.id);
        await supabase.from("checkpoints").delete().in("message_id", msgIds);
        await supabase.from("messages").delete().in("thread_id", threadIds);
      }
      await supabase.from("threads").delete().eq("conversation_id", id);
    }

    await supabase.from("conversations").delete().eq("id", id);

    const remaining = allConversations.filter((c) => c.id !== id);
    set({ allConversations: remaining });

    if (currentConversation?.id === id) {
      if (remaining.length > 0) {
        await loadConversation(remaining[0].id);
      } else {
        await get().createConversation();
      }
    }
  },

  createConversation: async (title = "New Conversation") => {
    // Trial users are capped; BYOK users are unlimited
    if (!get().hasApiKey && get().allConversations.length >= TRIAL_MAX_CONVERSATIONS) {
      set({ trialNotice: `Trial is limited to ${TRIAL_MAX_CONVERSATIONS} chats. Add your own API key for unlimited use. Groq keys are free.` });
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const conversationId = crypto.randomUUID();
    const mainThreadId = crypto.randomUUID();

    // Insert conversation (main_thread_id null initially to avoid FK chicken-and-egg)
    const { error: convErr } = await supabase.from("conversations").insert({
      id: conversationId,
      user_id: user.id,
      title,
      main_thread_id: null,
      active_thread_id: mainThreadId,
    });
    if (convErr) return;

    // Insert main thread
    const { error: threadErr } = await supabase.from("threads").insert({
      id: mainThreadId,
      conversation_id: conversationId,
      user_id: user.id,
      name: "Main Thread",
    });
    if (threadErr) return;

    // Set main_thread_id now that thread exists
    await supabase
      .from("conversations")
      .update({ main_thread_id: mainThreadId })
      .eq("id", conversationId);

    const mainThread: Thread = {
      id: mainThreadId,
      name: "Main Thread",
      messages: [],
      checkpoints: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const conversation: Conversation = {
      id: conversationId,
      title,
      mainThreadId,
      activeThreadId: mainThreadId,
      threads: [mainThread],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const all = [conversation, ...get().allConversations];
    set({ currentConversation: conversation, activeThread: mainThread, allConversations: all });
  },

  setActiveThread: async (threadId: string) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    const thread = currentConversation.threads.find((t) => t.id === threadId);
    if (!thread) return;

    // Update UI immediately so canvas renders with correct active thread right away
    const highlight = thread.parentMessageId ?? null;
    const updated = { ...currentConversation, activeThreadId: threadId };
    set({ activeThread: thread, currentConversation: updated, highlightMessageId: highlight });

    if (highlight) {
      setTimeout(() => set({ highlightMessageId: null }), 1800);
    }

    // Persist to DB in background
    const supabase = createClient();
    supabase
      .from("conversations")
      .update({ active_thread_id: threadId })
      .eq("id", currentConversation.id);
  },

  addMessage: async (threadId: string, messageData) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const messageId = crypto.randomUUID();
    const now = new Date();

    const { error } = await supabase.from("messages").insert({
      id: messageId,
      thread_id: threadId,
      user_id: user.id,
      role: messageData.role,
      content: messageData.content,
    });
    if (error) return;

    const message: Message = {
      id: messageId,
      ...messageData,
      threadId,
      timestamp: now,
    };

    const { currentConversation } = get();
    if (!currentConversation) return;

    let updatedConversation = { ...currentConversation };

    // Auto-title on first user message
    const isMainThread = threadId === currentConversation.mainThreadId;
    const thread = currentConversation.threads.find((t) => t.id === threadId);
    const isFirstMessage = (thread?.messages.length ?? 0) === 0;
    const isUser = messageData.role === "user";
    const isTitleDefault = currentConversation.title === "New Conversation";

    if (isMainThread && isFirstMessage && isUser && isTitleDefault) {
      const raw = messageData.content.trim();
      const title = raw.length > 50 ? raw.slice(0, 47) + "…" : raw;
      await supabase
        .from("conversations")
        .update({ title })
        .eq("id", currentConversation.id);
      updatedConversation = { ...updatedConversation, title };
    }

    const updatedThreads = updatedConversation.threads.map((t) =>
      t.id === threadId
        ? { ...t, messages: [...t.messages, message], updatedAt: now }
        : t
    );
    updatedConversation = { ...updatedConversation, threads: updatedThreads };

    updatedConversation = { ...updatedConversation, updatedAt: now };

    const existing = get().allConversations.find((c) => c.id === updatedConversation.id);
    const updatedAllConversations = existing
      ? [
          { ...existing, title: updatedConversation.title, updatedAt: now },
          ...get().allConversations.filter((c) => c.id !== updatedConversation.id),
        ]
      : get().allConversations;

    set({
      currentConversation: updatedConversation,
      activeThread: updatedThreads.find((t) => t.id === threadId),
      allConversations: updatedAllConversations,
    });
  },

  createBranch: async (checkpointId, checkpointLabel, parentMessageId, parentMessageY, modelOverride) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";

    const branchThreadId = crypto.randomUUID();
    const { currentConversation, activeThread, hasApiKey } = get();
    if (!currentConversation || !activeThread) return "";

    // Trial users are capped per conversation; BYOK users are unlimited
    const branchCount = currentConversation.threads.length - 1; // minus main thread
    if (!hasApiKey && branchCount >= TRIAL_MAX_BRANCHES) {
      set({ trialNotice: `Trial is limited to ${TRIAL_MAX_BRANCHES} branches per chat. Add your own API key for unlimited use. Groq keys are free.` });
      return "";
    }

    // Freeze the parent's compressed context NOW: the parent's rolling summary
    // keeps evolving after this fork and must never leak "future" main-thread
    // content into the branch. A parent that is itself a branch contributes its
    // own frozen snapshot too.
    const snapshotParts: string[] = [];
    if (activeThread.inheritedSummary) snapshotParts.push(activeThread.inheritedSummary);
    if (activeThread.summary) snapshotParts.push(activeThread.summary);
    const inheritedSummary = snapshotParts.length ? snapshotParts.join("\n\n---\n\n") : null;
    const inheritedAnchorId = activeThread.summary
      ? activeThread.summarizedUpToMessageId ?? null
      : null;

    const { error } = await supabase.from("threads").insert({
      id: branchThreadId,
      conversation_id: currentConversation.id,
      user_id: user.id,
      name: checkpointLabel,
      parent_thread_id: activeThread.id,
      parent_message_id: parentMessageId,
      parent_message_y: parentMessageY ?? null,
      inherited_summary: inheritedSummary,
      inherited_summary_anchor_id: inheritedAnchorId,
      provider: modelOverride?.provider ?? null,
      model: modelOverride?.model ?? null,
    });
    if (error) {
      console.error("[tan-ai] branch creation failed:", error.message,
        "— if this mentions a missing column, run the pending SQL migrations in supabase/migrations/");
      return "";
    }

    // Mark checkpoint as explored
    await supabase
      .from("checkpoints")
      .update({ is_explored: true, branch_thread_id: branchThreadId })
      .eq("id", checkpointId);

    // Update active_thread_id on conversation
    await supabase
      .from("conversations")
      .update({ active_thread_id: branchThreadId })
      .eq("id", currentConversation.id);

    const branchThread: Thread = {
      id: branchThreadId,
      name: checkpointLabel,
      parentThreadId: activeThread.id,
      parentMessageId,
      parentMessageY,
      messages: [],
      checkpoints: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      inheritedSummary: inheritedSummary ?? undefined,
      inheritedSummaryAnchorId: inheritedAnchorId ?? undefined,
      provider: modelOverride?.provider,
      model: modelOverride?.model,
    };

    // Update checkpoint in memory
    const updatedThreads = currentConversation.threads.map((t) => {
      if (t.id !== activeThread.id) return t;
      return {
        ...t,
        checkpoints: t.checkpoints.map((cp) =>
          cp.id === checkpointId
            ? { ...cp, isExplored: true, branchThreadId }
            : cp
        ),
      };
    });

    const updatedConversation: Conversation = {
      ...currentConversation,
      threads: [...updatedThreads, branchThread],
      activeThreadId: branchThreadId,
      updatedAt: new Date(),
    };

    set({ currentConversation: updatedConversation, activeThread: branchThread });
    return branchThreadId;
  },

  deleteMessage: async (messageId: string, threadId: string) => {
    const supabase = createClient();
    await supabase.from("checkpoints").delete().eq("message_id", messageId);
    await supabase.from("messages").delete().eq("id", messageId);

    const { currentConversation, activeThread } = get();
    if (!currentConversation) return;

    const updatedThreads = currentConversation.threads.map((t) => {
      if (t.id !== threadId) return t;
      return {
        ...t,
        messages: t.messages.filter((m) => m.id !== messageId),
        checkpoints: t.checkpoints.filter((cp) => cp.messageId !== messageId),
      };
    });

    set({
      currentConversation: { ...currentConversation, threads: updatedThreads },
      activeThread:
        activeThread?.id === threadId
          ? updatedThreads.find((t) => t.id === threadId)
          : activeThread,
    });
  },

  // Publish (or refresh) a frozen public snapshot of the current conversation.
  // Returns the share id (public URL token) or null on failure.
  shareConversation: async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { currentConversation } = get();
    if (!user || !currentConversation) return null;

    const snapshot = {
      title: currentConversation.title,
      mainThreadId: currentConversation.mainThreadId,
      threads: currentConversation.threads.map((t) => ({
        id: t.id,
        name: t.name,
        parentThreadId: t.parentThreadId ?? null,
        parentMessageId: t.parentMessageId ?? null,
        messages: t.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
      })),
    };

    const { data, error } = await supabase
      .from("shared_conversations")
      .upsert(
        {
          user_id: user.id,
          conversation_id: currentConversation.id,
          title: currentConversation.title,
          snapshot,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id" }
      )
      .select("id")
      .single();

    if (error || !data) return null;
    return data.id as string;
  },

  updateMessage: async (messageId: string, threadId: string, content: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("messages").update({ content }).eq("id", messageId);
    if (error) return;

    const { currentConversation, activeThread } = get();
    if (!currentConversation) return;

    const updatedThreads = currentConversation.threads.map((t) => {
      if (t.id !== threadId) return t;
      return {
        ...t,
        messages: t.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
      };
    });

    set({
      currentConversation: { ...currentConversation, threads: updatedThreads },
      activeThread:
        activeThread?.id === threadId
          ? updatedThreads.find((t) => t.id === threadId)
          : activeThread,
    });
  },

  renameConversation: async (id: string, title: string) => {
    const supabase = createClient();
    await supabase.from("conversations").update({ title }).eq("id", id);

    set((state) => ({
      allConversations: state.allConversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
      currentConversation:
        state.currentConversation?.id === id
          ? { ...state.currentConversation, title }
          : state.currentConversation,
    }));
  },

  addCheckpoints: async (messageId, checkpointData) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const checkpoints: Checkpoint[] = checkpointData.map((cp) => ({
      id: crypto.randomUUID(),
      messageId,
      isExplored: false,
      ...cp,
    }));

    await supabase.from("checkpoints").insert(
      checkpoints.map((cp) => ({
        id: cp.id,
        message_id: cp.messageId,
        user_id: user.id,
        label: cp.label,
        is_explored: false,
      }))
    );

    const { currentConversation, activeThread } = get();
    if (!currentConversation || !activeThread) return;

    // Find which thread owns this message
    const ownerThread = currentConversation.threads.find((t) =>
      t.messages.some((m) => m.id === messageId)
    );
    if (!ownerThread) return;

    const updatedThreads = currentConversation.threads.map((t) => {
      if (t.id !== ownerThread.id) return t;
      return { ...t, checkpoints: [...t.checkpoints, ...checkpoints] };
    });

    const updatedConversation = { ...currentConversation, threads: updatedThreads };
    set({
      currentConversation: updatedConversation,
      activeThread:
        activeThread.id === ownerThread.id
          ? updatedThreads.find((t) => t.id === activeThread.id)
          : activeThread,
    });
  },
}));
