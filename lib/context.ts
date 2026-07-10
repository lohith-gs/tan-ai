// lib/context.ts — rolling context compression: shared thresholds and helpers.
//
// Invariant: whenever the region of a thread older than the last KEEP_VERBATIM
// messages exceeds SUMMARIZE_TRIGGER_TOKENS, it gets distilled into the thread's
// rolling summary. This bounds the unsummarized region, which in turn bounds what
// branches must inherit verbatim (summary snapshot + gap + fork tail).

import { Thread } from "@/types";

export const KEEP_VERBATIM = 6; // recent messages always sent verbatim
export const SUMMARIZE_TRIGGER_TOKENS = 6000;
// Hard cap on the verbatim parent gap a branch inherits (snapshot anchor → fork
// point). Normally the gap is ≤ SUMMARIZE_TRIGGER_TOKENS by invariant; the cap
// only bites for pre-migration threads that never got summarized.
export const PARENT_GAP_CAP_TOKENS = 8000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Index right after the summarized anchor (0 if no summary or anchor missing —
// e.g. the anchor message was deleted; re-summarizing from the start is safe
// because distillation merges duplicates into the existing summary).
export function anchorIndex(messages: Array<{ id: string }>, anchorId?: string): number {
  if (!anchorId) return 0;
  const idx = messages.findIndex((m) => m.id === anchorId);
  return idx === -1 ? 0 : idx + 1;
}

// Should this thread be summarized now? Mirrors the server-side check so the
// client can skip pointless API calls.
export function needsSummarization(thread: Thread): boolean {
  const start = anchorIndex(thread.messages, thread.summarizedUpToMessageId);
  const region = thread.messages.slice(start, Math.max(start, thread.messages.length - KEEP_VERBATIM));
  if (region.length === 0) return false;
  const tokens = region.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  return tokens > SUMMARIZE_TRIGGER_TOKENS;
}

// Last messages that fit within maxTokens (always keeps at least one).
export function takeLastByTokens<T extends { content: string }>(msgs: T[], maxTokens: number): T[] {
  let total = 0;
  const out: T[] = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    total += estimateTokens(msgs[i].content);
    if (total > maxTokens && out.length > 0) break;
    out.unshift(msgs[i]);
  }
  return out;
}

// System-message framing for a thread's own rolling summary.
export function summarySystemContent(summary: string): string {
  return `Summary of the earlier part of this conversation (older messages were compressed):\n\n${summary}`;
}

// System-message framing for a branch's frozen parent snapshot.
export function inheritedSummarySystemContent(summary: string): string {
  return `Background from the parent conversation this branch forked from:\n\n${summary}`;
}
