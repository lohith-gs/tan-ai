// lib/db.ts
import Dexie, { Table } from "dexie";
import { Conversation, Thread, Message, Checkpoint } from "@/types";

class TanAIDatabase extends Dexie {
  conversations!: Table<Conversation>;
  threads!: Table<Thread>;
  messages!: Table<Message>;
  checkpoints!: Table<Checkpoint>;

  constructor() {
    super("TanAIDB");

    this.version(1).stores({
      conversations: "id, createdAt",
      threads: "id, parentThreadId, createdAt",
      messages: "id, threadId, timestamp",
      checkpoints: "id, messageId, branchThreadId",
    });
  }
}

export const db = new TanAIDatabase();
