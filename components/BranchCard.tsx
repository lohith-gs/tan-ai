"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { Thread } from "@/types";
import { useChatStore } from "@/store/useChatStore";
import {
  Bot, User, GitBranch, GitMerge, ArrowRight, Check, Send, AlertCircle,
  RotateCcw, RefreshCw, Copy, Square, AlertTriangle, Loader2,
} from "lucide-react";

const PARENT_CONTEXT_WINDOW = 6; // messages from parent thread to include before branch point
import BranchPopup, { type CompareSelection } from "./canvas/BranchPopup";
import MarkdownContent from "./MarkdownContent";
import MergeCard from "./MergeCard";
import SummaryChip from "./SummaryChip";
import { makeMergeContent, parseMergeMessage, toModelContent, findMergeMessage } from "@/lib/merge";
import { getContextWindow, getModelName } from "@/lib/providers";
import type { Provider } from "@/lib/providers";
import {
  anchorIndex, takeLastByTokens, summarySystemContent,
  inheritedSummarySystemContent, PARENT_GAP_CAP_TOKENS,
} from "@/lib/context";
import { triggerSummarizeIfNeeded } from "@/lib/summarize-client";

const CHECKPOINT_SENTINEL = "\n[CHECKPOINTS]";
const STREAM_ERROR_SENTINEL = "\n[STREAM_ERROR]";

interface Props {
  branch: Thread;
  isActive: boolean;
  onHeightChange: (h: number) => void;
  onMessageRef?: (messageId: string, el: HTMLDivElement | null) => void;
}

interface StreamErrorState {
  message: string;
  isKeyError: boolean;
}

export default function BranchCard({ branch, isActive, onHeightChange, onMessageRef }: Props) {
  const {
    currentConversation,
    addMessage,
    addCheckpoints,
    createBranch,
    setActiveThread,
    setKeyInvalid,
    deleteMessage,
    updateMessage,
    pendingAutoSendThreadIds,
    setPendingAutoSend,
    clearPendingAutoSend,
    activeProvider,
    activeModel,
  } = useChatStore();

  const cardRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCtxRef = useRef<Array<{ role: string; content: string }> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoSentRef = useRef(false);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<StreamErrorState | null>(null);
  const [popupMessageId, setPopupMessageId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [optimisticUserContent, setOptimisticUserContent] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const liveBranch =
    currentConversation?.threads.find((t) => t.id === branch.id) ?? branch;

  // Keep textarea height in sync with content on every input change (including
  // programmatic clears, where onChange never fires and stale height lingers).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 72) + "px";
  }, [input]);

  const parentThread = currentConversation?.threads.find(
    (t) => t.id === liveBranch.parentThreadId
  );
  const parentMessage = parentThread?.messages.find(
    (m) => m.id === liveBranch.parentMessageId
  );

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveBranch.messages.length, streamingContent, isLoading]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      onHeightChange(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-stream when this branch was just created via checkpoint/popup click
  useEffect(() => {
    if (
      pendingAutoSendThreadIds.includes(liveBranch.id) &&
      !autoSentRef.current &&
      liveBranch.messages.length >= 1 &&
      !liveBranch.messages.some((m) => m.role === "assistant") &&
      !isLoading &&
      streamingContent === null
    ) {
      autoSentRef.current = true;
      clearPendingAutoSend(liveBranch.id);
      const ctx = buildContext();
      lastCtxRef.current = ctx;
      runStream(ctx, liveBranch.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoSendThreadIds, liveBranch.messages.length]);

  function buildContext(): Array<{ role: string; content: string }> {
    const ctx: Array<{ role: string; content: string }> = [];

    // One combined system preamble — the /api/chat Anthropic path only honors
    // the first system message, so snapshot + own summary must share it.
    const systemParts: string[] = [];
    if (liveBranch.inheritedSummary) {
      systemParts.push(inheritedSummarySystemContent(liveBranch.inheritedSummary));
    }
    if (liveBranch.summary) {
      systemParts.push(summarySystemContent(liveBranch.summary));
    }
    if (systemParts.length) ctx.push({ role: "system", content: systemParts.join("\n\n") });

    const ancestry: Thread[] = [];
    let current: Thread | undefined = liveBranch;
    while (current) {
      ancestry.unshift(current);
      if (!current.parentThreadId) break;
      current = currentConversation?.threads.find((t) => t.id === current!.parentThreadId);
    }
    for (let i = 0; i < ancestry.length; i++) {
      const t = ancestry[i];
      if (i === ancestry.length - 1) {
        // Leaf (current) thread: everything after our own rolling-summary anchor
        const start = liveBranch.summary
          ? anchorIndex(t.messages, liveBranch.summarizedUpToMessageId)
          : 0;
        ctx.push(...t.messages.slice(start).map((m) => ({ role: m.role, content: toModelContent(m.content) })));
      } else if (i === ancestry.length - 2) {
        // Immediate parent: verbatim gap from the frozen snapshot's anchor up to
        // the fork point — no hole, bounded by the summarization invariant.
        const nextThread = ancestry[i + 1];
        const idx = t.messages.findIndex((m) => m.id === nextThread.parentMessageId);
        const upToFork = t.messages.slice(0, idx !== -1 ? idx + 1 : undefined);
        const gapStart = liveBranch.inheritedSummaryAnchorId
          ? anchorIndex(upToFork, liveBranch.inheritedSummaryAnchorId)
          : 0;
        ctx.push(
          ...takeLastByTokens(upToFork.slice(gapStart), PARENT_GAP_CAP_TOKENS)
            .map((m) => ({ role: m.role, content: toModelContent(m.content) }))
        );
      } else {
        // Higher ancestors: short verbatim tails before their fork points
        // (their older context is folded into the inherited snapshot chain)
        const nextThread = ancestry[i + 1];
        const idx = t.messages.findIndex((m) => m.id === nextThread.parentMessageId);
        const messagesUpToBranch = t.messages.slice(0, idx !== -1 ? idx + 1 : undefined);
        ctx.push(
          ...messagesUpToBranch
            .slice(-PARENT_CONTEXT_WINDOW)
            .map((m) => ({ role: m.role, content: toModelContent(m.content) }))
        );
      }
    }
    return ctx;
  }

  async function runStream(ctx: Array<{ role: string; content: string }>, threadId: string) {
    setStreamError(null);
    setIsLoading(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    function fail(message: string, isKeyError: boolean) {
      setStreamingContent(null);
      if (isKeyError) setKeyInvalid(true);
      setStreamError({ message, isKeyError });
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // provider/model pin the thread's model when set (branch compare)
        body: JSON.stringify({ messages: ctx, provider: liveBranch.provider, model: liveBranch.model }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        const isKeyError = response.status === 400 || response.status === 401;
        fail(json.error ?? "Request failed", isKeyError);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      const onAbort = () => reader.cancel();
      controller.signal.addEventListener("abort", onAbort);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          if (accumulated.indexOf(STREAM_ERROR_SENTINEL) !== -1) break;
          const cpIdx = accumulated.indexOf(CHECKPOINT_SENTINEL);
          setStreamingContent(cpIdx === -1 ? accumulated : accumulated.slice(0, cpIdx));
        }
      } finally {
        controller.signal.removeEventListener("abort", onAbort);
      }

      if (controller.signal.aborted) {
        setStreamingContent(null);
        return;
      }

      const errIdx = accumulated.indexOf(STREAM_ERROR_SENTINEL);
      if (errIdx !== -1) {
        try {
          const errData = JSON.parse(accumulated.slice(errIdx + STREAM_ERROR_SENTINEL.length));
          fail(errData.error ?? "Stream failed", errData.isKeyError ?? false);
        } catch {
          fail("Stream failed", false);
        }
        return;
      }

      const cpIdx = accumulated.indexOf(CHECKPOINT_SENTINEL);
      const fullText = cpIdx === -1 ? accumulated : accumulated.slice(0, cpIdx);
      let checkpoints: string[] = [];
      if (cpIdx !== -1) {
        try { checkpoints = JSON.parse(accumulated.slice(cpIdx + CHECKPOINT_SENTINEL.length)); } catch {}
      }

      await addMessage(threadId, { role: "assistant", content: fullText });
      setStreamingContent(null);

      const last = useChatStore.getState().currentConversation?.threads
        .find((t) => t.id === threadId)?.messages.at(-1);
      if (last && checkpoints.length > 0) {
        await addCheckpoints(last.id, checkpoints.map((label) => ({ label })));
      }

      // Background context compression — fire and forget
      triggerSummarizeIfNeeded(threadId);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setStreamingContent(null);
        return;
      }
      fail("Something went wrong. Try again.", false);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setStreamError(null);
    setOptimisticUserContent(trimmed);
    await setActiveThread(liveBranch.id);
    await addMessage(liveBranch.id, { role: "user", content: trimmed });
    setOptimisticUserContent(null);

    const ctx = buildContext();
    ctx.push({ role: "user", content: trimmed });
    lastCtxRef.current = ctx;

    await runStream(ctx, liveBranch.id);
  }

  async function handleRetry() {
    if (!lastCtxRef.current) return;
    await runStream(lastCtxRef.current, liveBranch.id);
  }

  async function handleRegenerate() {
    const msgs = liveBranch.messages;
    const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant || isLoading) return;

    await deleteMessage(lastAssistant.id, liveBranch.id);

    const ctx = buildContext().filter((m, i, arr) => {
      // remove the last assistant entry from context
      if (m.role === "assistant" && i === arr.length - 1) return false;
      return true;
    });
    lastCtxRef.current = ctx;
    await runStream(ctx, liveBranch.id);
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && isLoading) {
      handleCancel();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleCopy(messageId: string, content: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function handleMessageClick(e: React.MouseEvent, messageId: string) {
    e.stopPropagation();
    setPopupPosition({ x: e.clientX, y: e.clientY });
    setPopupMessageId(messageId);
  }

  async function handleBranchCreate(
    messageId: string,
    question: string,
    compare?: [CompareSelection, CompareSelection]
  ) {
    setPopupMessageId(null);

    const selections: Array<CompareSelection | undefined> = compare ?? [undefined];
    for (const sel of selections) {
      const label = sel
        ? `${question} · ${getModelName(sel.provider as Provider, sel.model)}`
        : question;
      // createBranch parents off activeThread and switches it to the new branch,
      // so re-pin the intended parent before each sibling.
      await setActiveThread(liveBranch.id);
      await addCheckpoints(messageId, [{ label }]);

      const thread = useChatStore.getState().currentConversation?.threads
        .find((t) => t.id === liveBranch.id);
      const cp = thread?.checkpoints
        .filter((c) => c.messageId === messageId && c.label === label && !c.isExplored)
        .at(-1);
      if (!cp) continue;

      const branchThreadId = await createBranch(cp.id, label, messageId, undefined, sel);
      await addMessage(branchThreadId, { role: "user", content: question });
      setPendingAutoSend(branchThreadId);
    }
  }

  async function handleCheckpointClick(checkpoint: any) {
    if (checkpoint.isExplored && checkpoint.branchThreadId) {
      await setActiveThread(checkpoint.branchThreadId);
      return;
    }
    await setActiveThread(liveBranch.id);
    const branchThreadId = await createBranch(checkpoint.id, checkpoint.label, checkpoint.messageId);
    await addMessage(branchThreadId, { role: "user", content: checkpoint.label });
    setPendingAutoSend(branchThreadId);
  }

  const contextTokenEstimate = useMemo(() => {
    const ctx = buildContext();
    return ctx.reduce((sum, m) => sum + m.content.length, 0) / 4;
  }, [liveBranch.messages, currentConversation?.threads]);

  // Warn at 90% of the active model's context window; critical when the
  // estimate exceeds the window itself (requests may start failing).
  const contextWindow = getContextWindow(activeProvider, activeModel);
  const contextState =
    contextTokenEstimate > contextWindow        ? "critical" :
    contextTokenEstimate > contextWindow * 0.9  ? "warning"  : "normal";

  function handleBranchFromWarning() {
    const lastAssistant = [...liveBranch.messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    setPopupPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setPopupMessageId(lastAssistant.id);
  }

  const existingMerge = parentThread ? findMergeMessage(parentThread.messages, liveBranch.id) : null;
  const isMerged = !!existingMerge;
  // Stale when the branch grew past what the synthesis covered (new messages,
  // or a sub-branch merged into this one). Old merges without msgCount count as stale.
  const mergeIsStale = !!existingMerge &&
    liveBranch.messages.length > (existingMerge.meta.msgCount ?? 0);
  const canMerge = liveBranch.messages.some((m) => m.role === "assistant") &&
    !isLoading && (!isMerged || mergeIsStale);

  async function handleMerge(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canMerge || isMerging || !liveBranch.parentThreadId) return;
    setIsMerging(true);
    setMergeError(null);
    try {
      const response = await fetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchName: liveBranch.name,
          messages: liveBranch.messages.map((m) => ({ role: m.role, content: toModelContent(m.content) })),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        setMergeError(json.error ?? "Merge failed");
        return;
      }
      const content = makeMergeContent(
        liveBranch.id, liveBranch.name, json.synthesis, liveBranch.messages.length
      );
      if (existingMerge) {
        // Re-merge: refresh the existing card in place instead of duplicating
        await updateMessage(existingMerge.message.id, liveBranch.parentThreadId, content);
      } else {
        await addMessage(liveBranch.parentThreadId, { role: "assistant", content });
      }
      await setActiveThread(liveBranch.parentThreadId);
    } catch {
      setMergeError("Merge failed. Check your connection.");
    } finally {
      setIsMerging(false);
    }
  }

  const lastAssistantMsgId = [...liveBranch.messages].reverse().find((m) => m.role === "assistant")?.id;
  const showOptimistic = optimisticUserContent !== null &&
    liveBranch.messages.at(-1)?.content !== optimisticUserContent;

  const lastBranchMsg = liveBranch.messages.at(-1);
  const showStreamingBubble = isLoading && streamingContent !== null &&
    !(lastBranchMsg?.role === "assistant" && lastBranchMsg?.content === streamingContent);

  return (
    <div
      ref={cardRef}
      onClick={() => setActiveThread(liveBranch.id)}
      className={`
        rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer
        ${isActive
          ? "border-green-500/40 shadow-[0_0_24px_rgba(34,197,94,0.10)]"
          : "border-[#1c2035] hover:border-[#252d42]"}
        bg-[#0c0f1a]/80 backdrop-blur-sm
      `}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${
        isActive ? "border-green-500/20 bg-green-600/5" : "border-[#1c2035]"
      }`}>
        <GitBranch size={11} className={isActive ? "text-green-400" : "text-zinc-600"} />
        <span className={`text-xs font-medium truncate flex-1 ${isActive ? "text-green-300" : "text-zinc-400"}`}>
          {liveBranch.name}
        </span>
        {liveBranch.provider && liveBranch.model && (
          <span
            title="This branch is pinned to this model"
            className="text-[9px] text-amber-400/80 border border-amber-500/25 bg-amber-500/5 px-1.5 py-px rounded-full shrink-0 font-mono"
          >
            {getModelName(liveBranch.provider as Provider, liveBranch.model)}
          </span>
        )}
        {canMerge ? (
          <button
            onClick={handleMerge}
            disabled={isMerging}
            title={isMerged
              ? "Branch changed since the last merge. Refresh the synthesis in the parent thread."
              : "Synthesize this branch's insights into the parent thread"}
            className={`flex items-center gap-1 text-[10px] disabled:opacity-50 px-1.5 py-0.5 rounded-full border transition-all ${
              isMerged
                ? "text-violet-400 border-violet-500/30 bg-violet-600/10 hover:text-violet-200 hover:border-violet-400/50"
                : "text-zinc-500 border-[#252d42] hover:text-violet-300 hover:border-violet-500/40 hover:bg-violet-600/10"
            }`}
          >
            {isMerging ? <Loader2 size={9} className="animate-spin" /> : <GitMerge size={9} />}
            {isMerging ? "merging…" : isMerged ? "re-merge" : "merge"}
          </button>
        ) : isMerged ? (
          <span className="flex items-center gap-1 text-[10px] text-violet-400 px-1.5 py-0.5 rounded-full border border-violet-500/30 bg-violet-600/10">
            <GitMerge size={9} />
            merged
          </span>
        ) : null}
        <span className="text-[10px] text-zinc-600">{liveBranch.messages.length} msgs</span>
      </div>

      {mergeError && (
        <div className="px-3 py-1.5 border-b border-red-500/20 bg-red-500/10 flex items-center gap-1.5">
          <AlertCircle size={10} className="text-red-400 shrink-0" />
          <span className="text-[10px] text-red-400">{mergeError}</span>
        </div>
      )}

      {/* "Branched from" strip */}
      {parentMessage && (
        <div className="px-3 py-2 border-b border-[#1c2035]/50 bg-[#07090f]/60 flex items-start gap-2">
          <GitBranch size={9} className="mt-0.5 shrink-0 text-zinc-700" />
          <p className="text-[10px] text-zinc-600 leading-snug line-clamp-2 italic">
            "{parentMessage.content}"
          </p>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex flex-col gap-3 p-3 overflow-y-auto" style={{ maxHeight: 340 }}>
        {liveBranch.messages.length === 0 && !isLoading && (
          <p className="text-xs text-zinc-700 text-center py-6">Ask your question…</p>
        )}

        {liveBranch.messages.map((message) => {
          const mergeMeta = message.role === "assistant" ? parseMergeMessage(message.content) : null;
          return (
          <div
            key={message.id}
            ref={message.role === "assistant" && onMessageRef
              ? (el) => onMessageRef(message.id, el)
              : undefined}
            className="group"
          >
            <div className={`flex items-start gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                message.role === "user" ? "bg-blue-600" : mergeMeta ? "bg-violet-600/20" : "bg-[#10141f]"
              }`}>
                {message.role === "user"
                  ? <User size={9} className="text-white" />
                  : mergeMeta
                  ? <GitMerge size={9} className="text-violet-400" />
                  : <Bot size={9} className="text-zinc-400" />}
              </div>
              {mergeMeta ? (
                <div className="max-w-[84%] flex-1">
                  <MergeCard meta={mergeMeta} compact />
                </div>
              ) : (
              <div
                className={`px-2.5 py-1.5 rounded-xl max-w-[84%] ${
                  message.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm text-xs leading-relaxed"
                    : "bg-[#10141f] text-zinc-300 rounded-tl-sm cursor-pointer hover:bg-[#151a28] hover:ring-1 hover:ring-blue-500/20 transition-all"
                }`}
                onClick={message.role === "assistant"
                  ? (e) => handleMessageClick(e, message.id)
                  : undefined}
              >
                {message.role === "user"
                  ? message.content
                  : <MarkdownContent content={message.content} compact />}
              </div>
              )}
            </div>

            {/* Copy + regenerate under assistant messages */}
            {message.role === "assistant" && !mergeMeta && (
              <div className="flex items-center gap-1.5 mt-1 ml-7 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopy(message.id, message.content); }}
                  className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors px-1.5 py-0.5 rounded hover:bg-[#151a28]"
                >
                  {copiedId === message.id
                    ? <><Check size={11} className="text-green-400" /><span className="text-green-400">copied</span></>
                    : <><Copy size={11} /><span>copy</span></>}
                </button>
                {message.id === lastAssistantMsgId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRegenerate(); }}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors px-1.5 py-0.5 rounded hover:bg-[#151a28]"
                  >
                    <RefreshCw size={11} />
                    <span>regenerate</span>
                  </button>
                )}
              </div>
            )}

            {/* Checkpoints */}
            {message.role === "assistant" && (() => {
              const cps = liveBranch.checkpoints.filter((cp) => cp.messageId === message.id);
              if (!cps.length) return null;
              return (
                <div className="mt-1.5 ml-7 flex flex-wrap gap-1">
                  {cps.map((cp) => (
                    <button
                      key={cp.id}
                      onClick={(e) => { e.stopPropagation(); handleCheckpointClick({ ...cp, messageId: message.id }); }}
                      className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all ${
                        cp.isExplored
                          ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                          : "bg-[#0c0f1a] border-indigo-500/30 text-indigo-400 hover:border-indigo-400/50 hover:text-indigo-300"
                      }`}
                    >
                      {cp.isExplored ? <Check size={8} /> : <ArrowRight size={8} />}
                      {cp.label}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Compression boundary: everything above is sent as the summary */}
            {liveBranch.summary && message.id === liveBranch.summarizedUpToMessageId && (
              <SummaryChip summary={liveBranch.summary} compact />
            )}
          </div>
          );
        })}

        {/* Optimistic user message */}
        {showOptimistic && (
          <div className="flex items-start gap-2 flex-row-reverse">
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-blue-600">
              <User size={9} className="text-white" />
            </div>
            <div className="px-2.5 py-1.5 rounded-xl rounded-tr-sm bg-blue-600 text-white text-xs leading-relaxed max-w-[84%]">
              {optimisticUserContent}
            </div>
          </div>
        )}

        {/* Streaming — plain text to avoid flicker */}
        {showStreamingBubble && (
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[#10141f]">
              <Bot size={9} className="text-zinc-400" />
            </div>
            <div className="px-2.5 py-1.5 rounded-xl rounded-tl-sm bg-[#10141f] text-zinc-300 max-w-[84%]">
              {streamingContent
                ? <p className="text-xs leading-relaxed whitespace-pre-wrap">{streamingContent}</p>
                : <span className="text-xs opacity-40">thinking…</span>}
              <span className="inline-block w-0.5 h-3 bg-zinc-400 ml-0.5 animate-pulse align-middle" />
            </div>
          </div>
        )}

        {isLoading && streamingContent === null && (
          <div className="flex gap-1 ml-7">
            {[0, 150, 300].map((d) => (
              <div key={d} className="w-1 h-1 bg-[#252d42] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}

        {/* Stream error */}
        {streamError && (
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-red-900/30">
              <AlertCircle size={9} className="text-red-400" />
            </div>
            <div className="px-2.5 py-2 rounded-xl rounded-tl-sm bg-red-900/20 border border-red-500/20 max-w-[84%] flex flex-col gap-1.5">
              <p className="text-[11px] text-red-400">{streamError.message}</p>
              <div className="flex items-center gap-2.5">
                {!streamError.isKeyError && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRetry(); }}
                    className="flex items-center gap-1 text-[10px] text-red-300 hover:text-red-200 transition-colors"
                  >
                    <RotateCcw size={9} /> Retry
                  </button>
                )}
                {streamError.isKeyError && (
                  <Link
                    href="/profile"
                    className="text-[10px] text-red-300 hover:text-red-200 underline transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Update API key →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Context warning */}
      {contextState !== "normal" && (
        <div
          className={`mx-2 mb-1 px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 ${
            contextState === "critical"
              ? "bg-red-900/20 border-red-500/20"
              : "bg-amber-900/20 border-amber-600/20"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle size={9} className={contextState === "critical" ? "text-red-400 shrink-0" : "text-amber-400 shrink-0"} />
            <p className={`text-[10px] truncate ${contextState === "critical" ? "text-red-400" : "text-amber-400"}`}>
              {contextState === "critical"
                ? "Context exceeds the model's limit. Requests may fail."
                : "Approaching the model's context limit."}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleBranchFromWarning(); }}
            className="text-[9px] px-1.5 py-0.5 rounded border border-[#1c2035] text-zinc-400 hover:text-zinc-200 hover:border-[#252d42] transition-all whitespace-nowrap shrink-0"
          >
            Branch →
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-2.5 pb-2.5 pt-1" onClick={(e) => e.stopPropagation()}>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 bg-[#07090f]/50 transition-colors ${
          isActive ? "border-green-500/25 focus-within:border-green-500/40" : "border-[#1c2035] focus-within:border-[#252d42]"
        }`}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 72) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Continue this branch…"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 resize-none outline-none leading-relaxed disabled:opacity-50"
            style={{ maxHeight: 72, overflowY: "auto" }}
          />
          {isLoading ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleCancel(); }}
              title="Cancel (Esc)"
              className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#1e2540] hover:bg-[#252d52] transition-all shrink-0"
            >
              <Square size={9} className="text-zinc-400" />
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleSend(); }}
              disabled={!input.trim()}
              className="w-6 h-6 rounded-lg flex items-center justify-center bg-blue-600/80 hover:bg-blue-500 disabled:opacity-20 disabled:cursor-not-allowed transition-all shrink-0"
            >
              <Send size={10} className="text-white" />
            </button>
          )}
        </div>
      </div>

      {popupMessageId && (
        <BranchPopup
          messageId={popupMessageId}
          position={popupPosition}
          onClose={() => setPopupMessageId(null)}
          onBranch={handleBranchCreate}
        />
      )}
    </div>
  );
}
