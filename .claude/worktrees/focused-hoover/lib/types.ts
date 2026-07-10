export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  threadId: string;
}

export interface Thread {
  id: string;
  conversationId: string;
  label: string;
  /** ID of the parent thread (null for root/main thread) */
  parentThreadId: string | null;
  /** The message ID in the parent thread where this branch was created */
  branchPointMessageId: string | null;
  messages: Message[];
  createdAt: string;
  childThreadIds: string[];
}

export interface Conversation {
  id: string;
  title: string;
  rootThreadId: string;
  /** Which thread is currently active / visible for this conversation */
  activeThreadId: string;
  createdAt: string;
}

export interface BranchModalState {
  isOpen: boolean;
  fromMessageId: string | null;
}
