// types/index.ts

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  threadId: string;
}

export interface Checkpoint {
  id: string;
  messageId: string; // Which AI message has this checkpoint
  label: string; // e.g., "What's App Router?"
  description?: string;
  isExplored: boolean; // Has user clicked this?
  branchThreadId?: string; // If clicked, which thread was created
}

export interface Thread {
  id: string;
  name: string;
  parentThreadId?: string;
  parentMessageId?: string;
  parentMessageY?: number; // Y position of clicked message
  messages: Message[];
  checkpoints: Checkpoint[];
  createdAt: Date;
  updatedAt: Date;
  // Rolling context compression (covers this thread's own older messages)
  summary?: string;
  summarizedUpToMessageId?: string;
  // Frozen snapshot of parent context taken at branch creation (branches only)
  inheritedSummary?: string;
  inheritedSummaryAnchorId?: string;
  // Pinned model for this thread (branch compare) — overrides the active model
  provider?: string;
  model?: string;
}

// Frozen public snapshot stored in shared_conversations.snapshot (JSONB)
export interface SharedThreadSnapshot {
  id: string;
  name: string;
  parentThreadId: string | null;
  parentMessageId: string | null;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
}

export interface SharedSnapshot {
  title: string;
  mainThreadId: string;
  threads: SharedThreadSnapshot[];
}

export interface Conversation {
  id: string;
  title: string;
  mainThreadId: string;
  threads: Thread[];
  activeThreadId: string; // Which thread user is currently viewing
  createdAt: Date;
  updatedAt: Date;
}
