// lib/summarize-client.ts — fire-and-forget summarization trigger.
// Called after an assistant response lands. Failures are silent by design:
// the threshold check re-fires on the next turn, so a failed run just retries.

import { useChatStore } from "@/store/useChatStore";
import { needsSummarization } from "@/lib/context";

export async function triggerSummarizeIfNeeded(threadId: string): Promise<void> {
  const conversation = useChatStore.getState().currentConversation;
  const thread = conversation?.threads.find((t) => t.id === threadId);
  if (!thread || !needsSummarization(thread)) return;

  try {
    const response = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    });
    const json = await response.json();
    if (response.ok && json.summary && json.anchorId) {
      useChatStore.getState().applyThreadSummary(threadId, json.summary, json.anchorId);
    }
  } catch {
    // silent — retried on the next threshold check
  }
}
