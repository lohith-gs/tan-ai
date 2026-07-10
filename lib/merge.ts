// lib/merge.ts
// Merge messages are regular assistant messages whose content starts with a
// metadata line: [merged]{"threadId":"...","threadName":"..."}
// This keeps the DB schema unchanged — the UI parses the line to render a
// merge card, and context builders swap it for a clean framing line.

const MERGE_TAG = "[merged]";

export interface MergeMeta {
  threadId: string;
  threadName: string;
  // How many branch messages the synthesis covered — used to detect staleness
  // (absent on merges created before this field existed).
  msgCount?: number;
  body: string;
}

export function makeMergeContent(
  threadId: string,
  threadName: string,
  body: string,
  msgCount: number
): string {
  return `${MERGE_TAG}${JSON.stringify({ threadId, threadName, msgCount })}\n${body.trim()}`;
}

export function parseMergeMessage(content: string): MergeMeta | null {
  if (!content.startsWith(MERGE_TAG)) return null;
  const newlineIdx = content.indexOf("\n");
  const metaRaw = (newlineIdx === -1 ? content : content.slice(0, newlineIdx)).slice(MERGE_TAG.length);
  try {
    const meta = JSON.parse(metaRaw);
    if (typeof meta.threadId !== "string" || typeof meta.threadName !== "string") return null;
    return {
      threadId: meta.threadId,
      threadName: meta.threadName,
      msgCount: typeof meta.msgCount === "number" ? meta.msgCount : undefined,
      body: newlineIdx === -1 ? "" : content.slice(newlineIdx + 1),
    };
  } catch {
    return null;
  }
}

// The existing merge message for a branch in its parent's messages, if any.
export function findMergeMessage<T extends { content: string }>(
  parentMessages: T[],
  branchThreadId: string
): { message: T; meta: MergeMeta } | null {
  for (const message of parentMessages) {
    const meta = parseMergeMessage(message.content);
    if (meta?.threadId === branchThreadId) return { message, meta };
  }
  return null;
}

// What the model sees in context instead of the raw metadata line.
export function toModelContent(content: string): string {
  const meta = parseMergeMessage(content);
  if (!meta) return content;
  return `[Synthesis merged back from the side exploration "${meta.threadName}"]\n${meta.body}`;
}

// True if `parentMessages` already contains a merge of the given branch.
export function isBranchMerged(
  parentMessages: Array<{ content: string }>,
  branchThreadId: string
): boolean {
  return parentMessages.some((m) => parseMergeMessage(m.content)?.threadId === branchThreadId);
}
